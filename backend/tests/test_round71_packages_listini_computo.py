"""Round 71 — Test:
1. GET /api/packages ritorna listini_items + price_override (persistenza completa)
2. POST /api/preventivi pacchetto con listini_selections + package_listini_items + optional → computo metrico in commessa include TUTTO
3. Documenti tipo_lavori e documenti_skip si salvano nella commessa
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL non configurato"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10)
    if r.status_code != 200:
        r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@ristruttura.app", "password": "Admin12345!"}, timeout=10)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        sess.headers.update({"Authorization": f"Bearer {tok}"})
    return sess


def test_packages_persist_listini_and_override(s):
    r = s.get(f"{BASE_URL}/api/packages", timeout=10)
    assert r.status_code == 200
    pkgs = r.json()
    assert pkgs, "no packages"
    pid = pkgs[0]["id"]

    payload = {
        "price_override": 9876.54,
        "listini_items": [
            {"listino_id": "L-TEST", "id": "P-TEST-1", "nome": "Porta TEST R71",
             "fornitore_nome": "Test Forn.", "categoria": "porte_interne",
             "qty": 3, "prezzo_rivendita": 180.0, "modificabile_dal_venditore": True},
            {"listino_id": "L-TEST", "id": "P-TEST-2", "nome": "Piastrella TEST R71",
             "fornitore_nome": "Test Forn.", "categoria": "piastrelle",
             "qty": 50, "prezzo_rivendita": 35.5, "modificabile_dal_venditore": False},
        ],
    }
    r = s.put(f"{BASE_URL}/api/packages/{pid}", json=payload, timeout=10)
    assert r.status_code == 200, r.text

    # Re-read
    r = s.get(f"{BASE_URL}/api/packages", timeout=10)
    pkg = next(p for p in r.json() if p["id"] == pid)
    assert pkg.get("price_override") == 9876.54
    assert len(pkg.get("listini_items") or []) == 2
    assert pkg["listini_items"][0]["nome"] == "Porta TEST R71"
    assert pkg["listini_items"][0]["modificabile_dal_venditore"] is True
    # Cleanup
    s.put(f"{BASE_URL}/api/packages/{pid}", json={"price_override": None, "listini_items": []}, timeout=10)


def test_computo_includes_optional_and_pkg_listini(s):
    payload = {
        "tipo": "pacchetto",
        "cliente": {"nome": "Mario", "cognome": "Test", "email": f"m{uuid.uuid4().hex[:6]}@t.it"},
        "package_id": "pkg-smart",
        "mq": 70,
        "items": [
            {"voce_id": "demoliz-mq", "name": "Demolizione pavimento", "qty_richiesta": 70, "unit_price": 15.75, "category": "DEMOLIZIONI"},
        ],
        "optional": [
            {"id": "opt-climatizzatore", "name": "Climatizzatore", "qty": 2, "unit_price": 1500, "total": 3000, "per_m2": False, "unit": "pz"},
        ],
        "listini_selections": [
            {"listino_id": "L1", "id": "P1", "nome": "Porta Garofoli R71", "fornitore_nome": "Garofoli", "categoria": "porte_interne", "qty": 5, "prezzo_rivendita": 250, "unit": "pz"},
        ],
        "package_listini_items": [
            {"listino_id": "L1", "id": "P2", "nome": "Piastrella Marazzi R71 (pacchetto)", "fornitore_nome": "Marazzi", "categoria": "piastrelle", "qty": 80, "prezzo_rivendita": 25, "unit": "m²"},
        ],
        "totale_iva_incl": 50000,
        "totale_iva_escl": 45000,
    }
    r = s.post(f"{BASE_URL}/api/preventivi", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    prev = r.json()
    pid = prev["id"]
    r2 = s.get(f"{BASE_URL}/api/preventivi/{pid}", timeout=10)
    p2 = r2.json()
    assert len(p2.get("listini_selections") or []) == 1
    assert len(p2.get("package_listini_items") or []) == 1
    assert len(p2.get("optional") or []) == 1

    # accetta → auto-popola commessa
    r = s.patch(f"{BASE_URL}/api/preventivi/{pid}/stato", json={"stato": "accettato"}, timeout=10)
    assert r.status_code in (200, 201), r.text
    rc = s.get(f"{BASE_URL}/api/commesse", timeout=10)
    com = next((c for c in rc.json() if c.get("preventivo_id") == pid), None)
    assert com, "commessa non trovata"
    cm = (com.get("computo_metrico") or {}).get("items") or []
    names = [i.get("name", "") for i in cm]
    assert any("Demolizione" in n for n in names), f"manca demolizione in computo: {names}"
    assert any("Climatizzatore" in n and "optional" in n.lower() for n in names), f"manca optional: {names}"
    assert any("Porta Garofoli R71" in n for n in names), f"manca listino selection: {names}"
    assert any("Piastrella Marazzi R71" in n for n in names), f"manca pkg listino: {names}"
    # cleanup
    s.delete(f"{BASE_URL}/api/commesse/{com['id']}", timeout=10)
    s.delete(f"{BASE_URL}/api/preventivi/{pid}", timeout=10)


def test_commessa_tipo_lavori_skip_persist(s):
    prev_payload = {
        "tipo": "pacchetto", "cliente": {"nome": "T", "cognome": "X", "email": f"t{uuid.uuid4().hex[:6]}@t.it"},
        "package_id": "pkg-smart", "mq": 70, "items": [], "totale_iva_incl": 1000, "totale_iva_escl": 900,
    }
    r = s.post(f"{BASE_URL}/api/preventivi", json=prev_payload, timeout=10)
    pid = r.json()["id"]
    r = s.post(f"{BASE_URL}/api/commesse", json={"preventivo_id": pid}, timeout=10)
    assert r.status_code == 200, r.text
    com = r.json()
    cid = com["id"]
    r = s.put(f"{BASE_URL}/api/commesse/{cid}", json={**com, "tipo_lavori": "manutenzione", "documenti_skip": ["pratica", "tavola_progetto"]}, timeout=10)
    assert r.status_code == 200
    r = s.get(f"{BASE_URL}/api/commesse/{cid}", timeout=10)
    c = r.json()
    assert c.get("tipo_lavori") == "manutenzione"
    assert set(c.get("documenti_skip") or []) == {"pratica", "tavola_progetto"}
    # cleanup
    s.delete(f"{BASE_URL}/api/commesse/{cid}", timeout=10)
    s.delete(f"{BASE_URL}/api/preventivi/{pid}", timeout=10)
