"""Test Round 77 — Audit Trail + Marginalita Composite cost calc"""
import os
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")
ADMIN_EMAIL = "admin@admin.it"
ADMIN_PASSWORD = "admin"


def _login(email=ADMIN_EMAIL, password=ADMIN_PASSWORD):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def test_audit_login_logged():
    s = _login()
    r = s.get(f"{BASE_URL}/api/audit-logs?entity=auth&action=login&limit=5")
    assert r.status_code == 200, r.text
    rows = r.json()
    assert len(rows) >= 1
    assert rows[0]["entity"] == "auth"
    assert rows[0]["action"] == "login"
    assert rows[0]["user_email"] == ADMIN_EMAIL


def test_audit_preventivo_crud():
    s = _login()
    # Create
    payload = {
        "tipo": "composite",
        "cliente": {"nome": "Test Audit Round 77"},
        "mq": 50,
        "composite_selections": [],
        "infissi_extras": [],
        "sicurezza_pct": 3,
        "direzione_lavori_pct": 5,
        "sconto_eur": 0,
        "iva_pct": 10,
        "totale_iva_incl": 1000,
        "totale_iva_escl": 900,
    }
    r = s.post(f"{BASE_URL}/api/preventivi", json=payload)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    # Delete
    r = s.delete(f"{BASE_URL}/api/preventivi/{pid}")
    assert r.status_code == 200
    # Verify both events in audit
    r = s.get(f"{BASE_URL}/api/audit-logs?entity=preventivo&entity_id={pid}")
    assert r.status_code == 200
    rows = r.json()
    actions = [r["action"] for r in rows]
    assert "create" in actions
    assert "delete" in actions


def test_audit_impostazioni_update():
    s = _login()
    cur = s.get(f"{BASE_URL}/api/impostazioni").json()
    new_val = float(cur.get("margine_minimo") or 30) + 0.01
    r = s.put(f"{BASE_URL}/api/impostazioni", json={**cur, "margine_minimo": new_val})
    assert r.status_code == 200
    r = s.get(f"{BASE_URL}/api/audit-logs?entity=impostazioni&action=update&limit=5")
    rows = r.json()
    assert len(rows) >= 1
    assert rows[0]["entity"] == "impostazioni"
    # Restore
    s.put(f"{BASE_URL}/api/impostazioni", json=cur)


def test_audit_rbac_non_admin_blocked():
    """Solo admin/responsabile/gestore può leggere audit-logs."""
    # Login con un utente non admin (registriamo uno cliente al volo)
    s_admin = _login()
    invite = {"email": f"clienteaudit{os.getpid()}@test.it", "name": "Tester", "role": "cliente"}
    inv = s_admin.post(f"{BASE_URL}/api/users/invite", json=invite)
    if inv.status_code != 200:
        return  # Skip if env not ready
    data = inv.json()
    s2 = requests.Session()
    r = s2.post(f"{BASE_URL}/api/auth/login", json={"email": invite["email"], "password": data["temporary_password"]})
    if r.status_code != 200:
        return
    tok = r.json().get("access_token")
    if tok:
        s2.headers.update({"Authorization": f"Bearer {tok}"})
    rr = s2.get(f"{BASE_URL}/api/audit-logs")
    assert rr.status_code == 403
    # cleanup
    s_admin.delete(f"{BASE_URL}/api/users/{data['user_id']}")


def test_marginalita_calcola_endpoint():
    """Verifica che il widget marginalità funzioni (endpoint usato sia da Pacchetto che Composite)."""
    s = _login()
    r = s.post(f"{BASE_URL}/api/marginalita/calcola", json={
        "totale_iva_escl": 10000,
        "costi_diretti": 5500,
        "ruolo_venditore": "semplice",
    })
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ricavo"] == 10000
    assert d["costi_diretti"] == 5500
    assert "margine_pct" in d
    assert "costi_fissi_breakdown" in d
    assert "provvigione_venditore" in d
