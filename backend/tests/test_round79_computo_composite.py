"""Test Round 79 — Computo da preventivo COMPOSITE (bug fix)."""
import os
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"})
    tok = r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def test_computo_from_composite():
    s = _login()
    # Crea preventivo COMPOSITE con composite_selections
    pid = s.post(f"{BASE_URL}/api/preventivi", json={
        "tipo": "composite",
        "cliente": {"nome": "Test Round 79"},
        "mq": 50,
        "composite_selections": [
            {"section_id": "DEMOLIZIONI", "voce_id": "v-demo", "name": "Demolizione tramezzi", "unit": "m²", "qty": 30, "price": 25, "category": "MURATURA"},
            {"section_id": "FINITURE", "voce_id": "v-pav", "name": "Pavimento gres", "unit": "m²", "qty": 50, "price": 45, "category": "FINITURE"},
        ],
        "infissi_extras": [],
        "sicurezza_pct": 3,
        "direzione_lavori_pct": 5,
        "sconto_eur": 0,
        "iva_pct": 10,
        "totale_iva_incl": 4290,
        "totale_iva_escl": 3900,
    }).json()["id"]
    # Crea commessa
    cid = s.post(f"{BASE_URL}/api/commesse", json={"preventivo_id": pid, "cliente": {"nome": "Test"}}).json()["id"]
    # Rigenera computo
    r = s.post(f"{BASE_URL}/api/commesse/{cid}/workflow/computo")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data
    items = data["items"]
    assert len(items) == 2, f"Expected 2 items, got {len(items)}: {items}"
    names = [i.get("name") for i in items]
    assert "Demolizione tramezzi" in names
    assert "Pavimento gres" in names
    totale = sum(i.get("totale", 0) for i in items)
    assert totale == 3000, f"Expected totale 3000, got {totale}"


def test_computo_empty_returns_warning():
    s = _login()
    # Preventivo composite SENZA voci → computo deve dare warning
    pid = s.post(f"{BASE_URL}/api/preventivi", json={
        "tipo": "composite", "cliente": {"nome": "Empty"}, "mq": 50,
        "composite_selections": [], "infissi_extras": [],
        "sicurezza_pct": 3, "direzione_lavori_pct": 5,
        "sconto_eur": 0, "iva_pct": 10,
        "totale_iva_incl": 0, "totale_iva_escl": 0,
    }).json()["id"]
    cid = s.post(f"{BASE_URL}/api/commesse", json={"preventivo_id": pid, "cliente": {"nome": "Empty"}}).json()["id"]
    r = s.post(f"{BASE_URL}/api/commesse/{cid}/workflow/computo")
    assert r.status_code == 200
    data = r.json()
    assert data["items"] == []
    assert "warning" in data
    assert "vuoto" in data["warning"].lower()


def test_optional_new_schema_persisted():
    """tipo_prezzo + sorgente_prezzo + listino_categoria salvati correttamente."""
    s = _login()
    body = {
        "name": "Test Optional Round 79",
        "tipo_prezzo": "mq",
        "sorgente_prezzo": "listino_fornitori",
        "listino_categoria": "piastrelle",
        "prezzo_unitario_listino": 45,
        "sconto_pct": 10,
        "exclude_extras_categories": [],
        "package_ids": ["pkg-basic"],
    }
    r = s.post(f"{BASE_URL}/api/optional", json=body)
    assert r.status_code == 200
    oid = r.json()["id"]
    # Reload
    listed = s.get(f"{BASE_URL}/api/optional").json()
    mine = next(o for o in listed if o["id"] == oid)
    assert mine["tipo_prezzo"] == "mq"
    assert mine["sorgente_prezzo"] == "listino_fornitori"
    assert mine["listino_categoria"] == "piastrelle"
    assert mine["prezzo_unitario_listino"] == 45
    s.delete(f"{BASE_URL}/api/optional/{oid}")
