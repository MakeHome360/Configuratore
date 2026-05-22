"""Round 86 — Extra Manuali nel Composite + salvataggio voci_backoffice da venditore-responsabile."""
import os
import uuid
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login(email="admin@admin.it", password="admin"):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login fallita ({email}): {r.text}"
    tok = r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def test_preventivo_composite_persists_manual_extras():
    """Un preventivo composite con `manual_extras` deve persisterli round-trip."""
    s = _login()
    me = [
        {"name": "Smaltimento mobilio antico", "category": "EXTRA", "unit": "corpo",
         "qty": 1, "price": 350, "manual": True},
        {"name": "Trasporto piano alto", "category": "EXTRA", "unit": "ora",
         "qty": 3, "price": 80, "manual": True},
    ]
    payload = {
        "tipo": "composite",
        "cliente": {"nome": "Test Manuali", "telefono": "", "email": "", "indirizzo": ""},
        "mq": 80, "composite_selections": [], "manual_extras": me,
        "infissi_extras": [], "sicurezza_pct": 3, "direzione_lavori_pct": 5,
        "sconto_eur": 0, "sconto_pct": 0, "iva_pct": 10, "note": "test round86",
        "totale_iva_incl": 0, "totale_iva_escl": 0,
        "listini_selections": [],
    }
    cr = s.post(f"{BASE_URL}/api/preventivi", json=payload)
    assert cr.status_code in (200, 201), cr.text
    pid = cr.json()["id"]
    try:
        g = s.get(f"{BASE_URL}/api/preventivi/{pid}")
        assert g.status_code == 200
        d = g.json()
        got = d.get("manual_extras") or []
        assert len(got) == 2
        assert got[0]["name"] == "Smaltimento mobilio antico"
        assert got[1]["qty"] == 3
    finally:
        s.delete(f"{BASE_URL}/api/preventivi/{pid}")


def test_create_voce_backoffice_as_admin():
    """Admin può salvare una voce backoffice (caso base)."""
    s = _login()
    name = f"Voce test admin {uuid.uuid4().hex[:6]}"
    body = {
        "category": "EXTRA",
        "name": name,
        "prezzo_acquisto": 100.0,
        "ricarico": 1.8,
        "unit": "pz",
        "modificabile_dal_venditore": True,
        "prezzo_rivendita": 180.0,
    }
    r = s.post(f"{BASE_URL}/api/voci-backoffice", json=body)
    assert r.status_code == 200, r.text
    vid = r.json()["id"]
    try:
        # Cleanup
        s.delete(f"{BASE_URL}/api/voci-backoffice/{vid}")
    except Exception:
        pass


def test_create_voce_backoffice_as_responsabile():
    """Un venditore con livello `responsabile` può creare una voce backoffice (fix Round 86)."""
    s_admin = _login()
    email = f"resp.test+{uuid.uuid4().hex[:6]}@example.com"
    inv = s_admin.post(
        f"{BASE_URL}/api/users/invite",
        json={"email": email, "role": "venditore", "name": "Resp Test", "venditore_level": "responsabile"},
    )
    assert inv.status_code in (200, 201), f"impossibile creare utente: {inv.text}"
    j = inv.json()
    uid = j.get("user_id")
    pwd = j.get("temporary_password")
    assert pwd, j
    try:
        s_resp = _login(email, pwd)
        me = s_resp.get(f"{BASE_URL}/api/auth/me").json()
        assert me.get("role") == "venditore" and me.get("venditore_level") == "responsabile", me

        name = f"Voce test resp {uuid.uuid4().hex[:6]}"
        body = {
            "category": "EXTRA",
            "name": name,
            "prezzo_acquisto": 50.0,
            "ricarico": 1.6,
            "unit": "pz",
            "modificabile_dal_venditore": True,
            "prezzo_rivendita": 80.0,
        }
        r = s_resp.post(f"{BASE_URL}/api/voci-backoffice", json=body)
        assert r.status_code == 200, f"responsabile non può creare voce: {r.status_code} {r.text}"
        vid = r.json()["id"]
        s_admin.delete(f"{BASE_URL}/api/voci-backoffice/{vid}")
    finally:
        if uid:
            try: s_admin.delete(f"{BASE_URL}/api/users/{uid}")
            except Exception: pass


def test_create_voce_backoffice_denied_for_venditore_semplice():
    """Un venditore semplice (livello semplice) NON può creare voci."""
    s_admin = _login()
    email = f"vend.simp+{uuid.uuid4().hex[:6]}@example.com"
    inv = s_admin.post(
        f"{BASE_URL}/api/users/invite",
        json={"email": email, "role": "venditore", "name": "Vend Simp", "venditore_level": "semplice"},
    )
    assert inv.status_code in (200, 201)
    j = inv.json()
    uid = j.get("user_id"); pwd = j.get("temporary_password")
    try:
        s_v = _login(email, pwd)
        body = {"category": "EXTRA", "name": "deny voce", "prezzo_acquisto": 10.0, "ricarico": 1.5, "unit": "pz"}
        r = s_v.post(f"{BASE_URL}/api/voci-backoffice", json=body)
        assert r.status_code == 403, f"atteso 403, ottenuto {r.status_code}"
    finally:
        if uid:
            try: s_admin.delete(f"{BASE_URL}/api/users/{uid}")
            except Exception: pass
