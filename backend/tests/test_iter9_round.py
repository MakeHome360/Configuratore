"""Round 9 backend tests:
- POST /api/preventivi with tipo='cad' (extra fields allowed: items, project_id, package_base_total)
- GET /api/preventivi includes the CAD preventivo with required fields
- PUT /api/projects with preventivo_id sync (project.preventivo_id ↔ preventivo.project_id)
- POST /api/preventivi/{id}/create-project for orphan preventivo
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cad-preventivi-live.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@admin.it"
ADMIN_PASSWORD = "admin"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return {"preventivi": [], "projects": []}


# ---------------- Tests ----------------
class TestPreventivoCAD:
    def test_create_cad_preventivo_with_items(self, session, created_ids):
        payload = {
            "tipo": "cad",
            "cliente": {"nome": "TEST_R9_CAD", "email": "r9@test.it"},
            "mq": 75,
            "items": [
                {"voce": "Demolizione muri", "qta": 12.5, "um": "m²", "prezzo_unit": 22, "totale": 275.0},
                {"voce": "Pavimento gres 60x60", "qta": 75.0, "um": "m²", "prezzo_unit": 45, "totale": 3375.0},
            ],
            "package_base_total": 18500.0,
            "totale_iva_escl": 21900.0,
            "totale_iva_incl": 24090.0,
            "iva_pct": 10.0,
            "sconto_pct": 0,
            "sconto_eur": 0,
        }
        r = session.post(f"{API}/preventivi", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["tipo"] == "cad"
        assert doc["cliente"]["nome"] == "TEST_R9_CAD"
        assert isinstance(doc.get("items"), list) and len(doc["items"]) == 2
        # extra=allow should preserve package_base_total
        assert doc.get("package_base_total") == 18500.0
        assert doc.get("totale_iva_escl") == 21900.0
        assert doc.get("stato") == "bozza"
        assert doc.get("numero", "").startswith("PRV-")
        assert "id" in doc
        created_ids["preventivi"].append(doc["id"])
        # store for later tests
        TestPreventivoCAD.cad_id = doc["id"]

    def test_list_includes_cad_preventivo_with_required_fields(self, session):
        r = session.get(f"{API}/preventivi", timeout=15)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        ours = [d for d in docs if d.get("id") == TestPreventivoCAD.cad_id]
        assert len(ours) == 1, "Created CAD preventivo not listed"
        d = ours[0]
        assert d["tipo"] == "cad"
        assert isinstance(d.get("items"), list)
        assert d.get("package_base_total") == 18500.0
        assert d.get("totale_iva_escl") == 21900.0
        # _id should not be exposed
        assert "_id" not in d

    def test_update_cad_preventivo_does_not_duplicate(self, session):
        # Updated items (e.g. user added a demolition)
        update_payload = {
            "tipo": "cad",
            "cliente": {"nome": "TEST_R9_CAD", "email": "r9@test.it"},
            "mq": 75,
            "items": [
                {"voce": "Demolizione muri", "qta": 18.0, "um": "m²", "prezzo_unit": 22, "totale": 396.0},
                {"voce": "Pavimento gres 60x60", "qta": 75.0, "um": "m²", "prezzo_unit": 45, "totale": 3375.0},
                {"voce": "Demolizione pavimento", "qta": 75.0, "um": "m²", "prezzo_unit": 18, "totale": 1350.0},
            ],
            "package_base_total": 18500.0,
            "totale_iva_escl": 23800.0,
            "totale_iva_incl": 26180.0,
            "iva_pct": 10.0,
            "sconto_pct": 0,
            "sconto_eur": 0,
        }
        r = session.put(f"{API}/preventivi/{TestPreventivoCAD.cad_id}", json=update_payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == TestPreventivoCAD.cad_id
        assert len(d["items"]) == 3
        assert d["totale_iva_escl"] == 23800.0
        # confirm GET returns same id, and total count of preventivi for that cliente did not grow due to PUT
        r2 = session.get(f"{API}/preventivi", timeout=15)
        same_cliente = [x for x in r2.json() if (x.get("cliente") or {}).get("nome") == "TEST_R9_CAD"]
        assert len(same_cliente) == 1, f"Expected 1 preventivo per cliente TEST_R9_CAD after PUT, got {len(same_cliente)}"


class TestPreventivoProjectSync:
    """Verify project.preventivo_id <-> preventivo.project_id bidirectional sync."""

    def test_create_project_with_preventivo_id_syncs_inverse(self, session, created_ids):
        # 1. Create a fresh CAD preventivo
        prev_payload = {
            "tipo": "cad",
            "cliente": {"nome": "TEST_R9_SYNC"},
            "mq": 60,
            "items": [],
            "iva_pct": 10.0,
        }
        r = session.post(f"{API}/preventivi", json=prev_payload, timeout=15)
        assert r.status_code == 200
        prev = r.json()
        prev_id = prev["id"]
        created_ids["preventivi"].append(prev_id)

        # 2. Create a project linked to that preventivo
        project_payload = {
            "name": "TEST_R9_SYNC_PROJECT",
            "data": {"mq": 60, "rooms": [], "walls": []},
            "preventivo_id": prev_id,
        }
        r = session.post(f"{API}/projects", json=project_payload, timeout=15)
        assert r.status_code == 200
        proj = r.json()
        assert proj["preventivo_id"] == prev_id
        created_ids["projects"].append(proj["id"])

        # 3. Verify inverse sync: preventivo now has project_id
        r2 = session.get(f"{API}/preventivi/{prev_id}", timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("project_id") == proj["id"], "Inverse sync failed: preventivo.project_id not set"

    def test_update_project_preventivo_id_syncs_inverse(self, session, created_ids):
        # Create orphan project
        r = session.post(f"{API}/projects", json={"name": "TEST_R9_ORPHAN", "data": {"rooms": []}}, timeout=15)
        assert r.status_code == 200
        proj_id = r.json()["id"]
        created_ids["projects"].append(proj_id)

        # Create a fresh preventivo
        r2 = session.post(
            f"{API}/preventivi",
            json={"tipo": "cad", "cliente": {"nome": "TEST_R9_LINK"}, "mq": 50, "items": []},
            timeout=15,
        )
        assert r2.status_code == 200
        prev_id = r2.json()["id"]
        created_ids["preventivi"].append(prev_id)

        # PUT project with preventivo_id
        r3 = session.put(
            f"{API}/projects/{proj_id}",
            json={"name": "TEST_R9_ORPHAN", "data": {"rooms": []}, "preventivo_id": prev_id},
            timeout=15,
        )
        assert r3.status_code == 200
        assert r3.json().get("preventivo_id") == prev_id

        # Verify inverse sync
        r4 = session.get(f"{API}/preventivi/{prev_id}", timeout=15)
        assert r4.json().get("project_id") == proj_id


class TestCreateProjectFromPreventivo:
    def test_create_project_from_preventivo_endpoint(self, session, created_ids):
        # Create orphan preventivo (no project_id)
        r = session.post(
            f"{API}/preventivi",
            json={"tipo": "pacchetto", "cliente": {"nome": "TEST_R9_OP"}, "mq": 80, "items": []},
            timeout=15,
        )
        assert r.status_code == 200
        prev_id = r.json()["id"]
        created_ids["preventivi"].append(prev_id)
        assert r.json().get("project_id") in (None, "")

        # Call the create-project endpoint
        r2 = session.post(f"{API}/preventivi/{prev_id}/create-project", timeout=15)
        assert r2.status_code == 200, r2.text
        proj = r2.json()
        assert "id" in proj
        new_pid = proj["id"]
        created_ids["projects"].append(new_pid)
        # The project should be linked back
        assert proj.get("preventivo_id") == prev_id
        # The preventivo should now have project_id
        r3 = session.get(f"{API}/preventivi/{prev_id}", timeout=15)
        assert r3.json().get("project_id") == new_pid
        # Project should have mq pre-populated
        r4 = session.get(f"{API}/projects/{new_pid}", timeout=15)
        assert r4.status_code == 200
        assert (r4.json().get("data") or {}).get("mq") == 80

    def test_create_project_from_preventivo_returns_existing(self, session, created_ids):
        """Calling twice should return the existing project (existed=True)."""
        # Create + first call
        r = session.post(
            f"{API}/preventivi",
            json={"tipo": "cad", "cliente": {"nome": "TEST_R9_TWICE"}, "mq": 40, "items": []},
            timeout=15,
        )
        prev_id = r.json()["id"]
        created_ids["preventivi"].append(prev_id)
        r1 = session.post(f"{API}/preventivi/{prev_id}/create-project", timeout=15)
        first_pid = r1.json()["id"]
        created_ids["projects"].append(first_pid)
        # Second call
        r2 = session.post(f"{API}/preventivi/{prev_id}/create-project", timeout=15)
        assert r2.status_code == 200
        body = r2.json()
        assert body.get("id") == first_pid
        assert body.get("existed") is True

    def test_create_project_from_preventivo_404(self, session):
        r = session.post(f"{API}/preventivi/__nonexistent_id__/create-project", timeout=15)
        assert r.status_code == 404


# ---------------- Cleanup ----------------
@pytest.fixture(scope="module", autouse=True)
def _cleanup(session, created_ids):
    yield
    for pid in created_ids.get("projects", []):
        try:
            session.delete(f"{API}/projects/{pid}", timeout=10)
        except Exception:
            pass
    for pid in created_ids.get("preventivi", []):
        try:
            session.delete(f"{API}/preventivi/{pid}", timeout=10)
        except Exception:
            pass
