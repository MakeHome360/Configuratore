"""Tests for iteration 4: AI material generator, materials POST, voci backoffice unit/price update."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@admin.it"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def auth_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------------- Materials ----------------
class TestMaterialsCRUD:
    def test_create_material(self, auth_session):
        payload = {
            "name": "TEST_Sanitario sospeso",
            "category": "fixture",
            "unit": "€/pz",
            "price": 320.0,
            "color": "#FFFFFF",
            "thumb": None,
            "description": "Test material",
        }
        r = auth_session.post(f"{BASE_URL}/api/materials", json=payload, timeout=20)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "id" in data and data["id"]
        assert data["name"] == "TEST_Sanitario sospeso"
        assert data["category"] == "fixture"
        assert data["price"] == 320.0
        # Verify persistence
        lst = auth_session.get(f"{BASE_URL}/api/materials", timeout=20).json()
        ids = [m["id"] for m in lst]
        assert data["id"] in ids
        # cleanup
        auth_session.put(f"{BASE_URL}/api/materials/{data['id']}", json={"name": "TEST_DEL"}, timeout=10)


class TestAIMaterialGenerate:
    def test_ai_generate_returns_material(self, auth_session):
        payload = {"prompt": "Sanitario sospeso bianco minimal", "category": "fixture"}
        r = auth_session.post(f"{BASE_URL}/api/materials/ai-generate", json=payload, timeout=120)
        assert r.status_code == 200, f"{r.status_code} {r.text[:500]}"
        data = r.json()
        assert "material" in data
        m = data["material"]
        assert m.get("name") and isinstance(m["name"], str)
        assert m.get("description")
        assert m.get("category")
        assert m.get("unit")
        # Price must be realistic (>50 per spec)
        assert isinstance(m.get("price"), (int, float))
        assert m["price"] > 50, f"price too low: {m['price']}"
        assert m.get("color", "").startswith("#")
        # image_data_url can be null but key must exist
        assert "image_data_url" in data
        if data["image_data_url"]:
            assert data["image_data_url"].startswith("data:image/")

    def test_ai_generate_missing_prompt(self, auth_session):
        r = auth_session.post(f"{BASE_URL}/api/materials/ai-generate", json={"category": "floor"}, timeout=20)
        assert r.status_code == 400


# ---------------- Voci Backoffice DB state ----------------
class TestVociBackofficeUnits:
    def test_voci_units_and_prices(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/voci-backoffice", timeout=20)
        assert r.status_code == 200
        voci = r.json()
        by_id = {v["id"]: v for v in voci}

        # tapparelle and zanzariere should now be m²
        for vid in ("voce-tapparelle", "voce-zanzariere"):
            assert vid in by_id, f"missing {vid}"
            assert by_id[vid]["unit"] == "m²", f"{vid} unit={by_id[vid]['unit']} (expected m²)"

        # voce-infissi-pvc unit m² and prezzo_acquisto=280
        assert "voce-infissi-pvc" in by_id, "voce-infissi-pvc missing"
        infissi = by_id["voce-infissi-pvc"]
        assert infissi["unit"] == "m²", f"infissi-pvc unit={infissi['unit']}"
        assert float(infissi["prezzo_acquisto"]) == 280.0, f"prezzo={infissi['prezzo_acquisto']}"

    def test_voce_create_with_modificabile_soglia(self, auth_session):
        payload = {
            "category": "MURATURA",
            "name": "TEST_Voce mod",
            "prezzo_acquisto": 50.0,
            "ricarico": 1.8,
            "unit": "m²",
            "modificabile_dal_venditore": True,
            "soglia_inclusa": 60.0,
        }
        r = auth_session.post(f"{BASE_URL}/api/voci-backoffice", json=payload, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert d.get("modificabile_dal_venditore") is True
        assert d.get("soglia_inclusa") == 60.0
        # cleanup
        auth_session.delete(f"{BASE_URL}/api/voci-backoffice/{d['id']}", timeout=10)
