"""
Iteration 5 backend tests:
- POST /api/commesse from a preventivo with infissi must add 'Conferma rilievo misure infissi' to checklist
- backend health: ensure auth login works and base routes respond
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reno-cad-quote.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@admin.it"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# --- Auth / health ---
def test_health_auth_me(session):
    r = session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body.get("email") == ADMIN_EMAIL


# --- Commessa from preventivo with infissi -> checklist contains 'Conferma rilievo misure infissi' ---
def test_commessa_with_infissi_checklist_added(session):
    # Create a preventivo with infissi-like items (from_infissi=True, infisso_meta with measures)
    prev_payload = {
        "tipo": "infissi",
        "cliente": {"nome": "TEST_Mario Rossi", "email": "test_mr@example.com"},
        "mq": 80,
        "items": [
            {
                "name": "Infisso PVC 120x140",
                "qty": 1,
                "unit": "pz",
                "prezzo_unitario": 450.0,
                "from_infissi": True,
                "infisso_meta": {"larghezza": 120, "altezza": 140, "tipologia": "1 anta"},
            }
        ],
        "totale_iva_incl": 549.0,
    }
    rp = session.post(f"{BASE_URL}/api/preventivi", json=prev_payload)
    assert rp.status_code in (200, 201), f"create preventivo failed: {rp.status_code} {rp.text}"
    prev = rp.json()
    pid = prev.get("id")
    assert pid

    try:
        # Convert preventivo to commessa
        rc = session.post(f"{BASE_URL}/api/commesse", json={"preventivo_id": pid})
        assert rc.status_code in (200, 201), f"create commessa failed: {rc.status_code} {rc.text}"
        commessa = rc.json()
        checklist = commessa.get("checklist") or []
        # Find the infissi-rilievo item
        rilievo = next((c for c in checklist if c.get("name") == "Conferma rilievo misure infissi"), None)
        assert rilievo is not None, f"'Conferma rilievo misure infissi' missing in checklist. Got: {[c.get('name') for c in checklist]}"
        # rilievo_misure must be populated with original measures (from infisso_meta)
        rm = rilievo.get("rilievo_misure") or []
        assert len(rm) >= 1, "rilievo_misure should contain at least one entry from items[].infisso_meta"
        first = rm[0]
        assert first.get("L_originale") == 120
        assert first.get("H_originale") == 140
        assert first.get("stato") == "da_rilevare"

        # Cleanup commessa
        cid = commessa.get("id")
        if cid:
            session.delete(f"{BASE_URL}/api/commesse/{cid}")
    finally:
        # Cleanup preventivo (best-effort)
        session.delete(f"{BASE_URL}/api/preventivi/{pid}")


def test_commessa_without_infissi_no_rilievo_voce(session):
    # Preventivo senza infissi -> checklist should NOT contain rilievo voce
    prev_payload = {
        "tipo": "pacchetto",
        "cliente": {"nome": "TEST_NoInfissi", "email": "test_ni@example.com"},
        "mq": 50,
        "items": [
            {"name": "Demolizione muro", "qty": 5, "unit": "m²", "prezzo_unitario": 30.0}
        ],
        "totale_iva_incl": 183.0,
    }
    rp = session.post(f"{BASE_URL}/api/preventivi", json=prev_payload)
    assert rp.status_code in (200, 201)
    pid = rp.json().get("id")
    try:
        rc = session.post(f"{BASE_URL}/api/commesse", json={"preventivo_id": pid})
        assert rc.status_code in (200, 201)
        commessa = rc.json()
        checklist = commessa.get("checklist") or []
        names = [c.get("name") for c in checklist]
        assert "Conferma rilievo misure infissi" not in names, f"rilievo voce should NOT be present: {names}"
        cid = commessa.get("id")
        if cid:
            session.delete(f"{BASE_URL}/api/commesse/{cid}")
    finally:
        session.delete(f"{BASE_URL}/api/preventivi/{pid}")


def test_commessa_infissi_extras_checklist_added(session):
    # Preventivo with infissi as 'extras' (PreventivoComposite/Pacchetto add-ons)
    prev_payload = {
        "tipo": "pacchetto",
        "cliente": {"nome": "TEST_Extras", "email": "test_ex@example.com"},
        "mq": 60,
        "items": [],
        "infissi_extras": [
            {
                "name": "Finestra extra 100x120",
                "qty": 2,
                "infisso_meta": {"larghezza": 100, "altezza": 120, "tipologia": "1 anta"},
            }
        ],
        "totale_iva_incl": 1200.0,
    }
    rp = session.post(f"{BASE_URL}/api/preventivi", json=prev_payload)
    assert rp.status_code in (200, 201)
    pid = rp.json().get("id")
    try:
        rc = session.post(f"{BASE_URL}/api/commesse", json={"preventivo_id": pid})
        assert rc.status_code in (200, 201)
        commessa = rc.json()
        checklist = commessa.get("checklist") or []
        rilievo = next((c for c in checklist if c.get("name") == "Conferma rilievo misure infissi"), None)
        assert rilievo is not None, f"missing rilievo voce; got {[c.get('name') for c in checklist]}"
        rm = rilievo.get("rilievo_misure") or []
        assert len(rm) >= 1
        cid = commessa.get("id")
        if cid:
            session.delete(f"{BASE_URL}/api/commesse/{cid}")
    finally:
        session.delete(f"{BASE_URL}/api/preventivi/{pid}")
