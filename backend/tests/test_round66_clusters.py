"""Round 66 cluster A/B/C verification tests.
Tests: payment_presets save (B.1), allegato_a save (B.2), voci backoffice tipo/fornitore (C.1),
import-from-computo + composite auto-gen computo (A.4/A.5)."""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/") + "/api"
ADMIN = {"email": "admin@admin.it", "password": "admin"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return sess


# --- B.1 payment_presets ---
def test_b1_payment_presets_save(s):
    cur = s.get(f"{BASE}/dati-azienda", timeout=10).json() or {}
    preset = {"id": "pp-test-r66", "nome": "TEST_30/40/30", "default": False,
              "rate": [{"descrizione": "Acconto", "pct": 30},
                       {"descrizione": "SAL", "pct": 40},
                       {"descrizione": "Saldo", "pct": 30}]}
    new_presets = [p for p in (cur.get("payment_presets") or []) if p.get("id") != "pp-test-r66"] + [preset]
    body = {**cur, "payment_presets": new_presets}
    body.pop("_id", None)
    r = s.put(f"{BASE}/dati-azienda", json=body, timeout=10)
    assert r.status_code == 200, f"PUT dati-azienda failed: {r.status_code} {r.text[:200]}"
    # GET verify
    g = s.get(f"{BASE}/dati-azienda", timeout=10).json()
    ids = [p.get("id") for p in (g.get("payment_presets") or [])]
    assert "pp-test-r66" in ids, f"preset not persisted; got ids={ids}"


# --- C.1 voci-backoffice tipo + fornitore ---
def test_c1_voci_backoffice_tipo_fornitore(s):
    payload = {"name": "TEST_R66_Voce", "category": "MURATURA", "unit": "m²",
               "prezzo_acquisto": 10.0, "ricarico": 1.8, "tipo": "manodopera",
               "fornitore_id": "", "modificabile_dal_venditore": False, "soglia_inclusa": None}
    r = s.post(f"{BASE}/voci-backoffice", json=payload, timeout=10)
    assert r.status_code in (200, 201), f"POST fail: {r.status_code} {r.text[:200]}"
    vid = r.json().get("id")
    # GET list and find
    lst = s.get(f"{BASE}/voci-backoffice", timeout=10).json()
    v = next((x for x in lst if x.get("id") == vid), None)
    assert v is not None, "voce not found"
    assert v.get("tipo") == "manodopera", f"tipo not persisted: {v.get('tipo')}"
    # cleanup
    s.delete(f"{BASE}/voci-backoffice/{vid}", timeout=10)


# --- B.2 + A.4 + C.3: get an existing commessa and exercise PUT with allegato_a / voci_extra ---
def test_b2_c3_commessa_allegato_a_and_voci_extra(s):
    coms = s.get(f"{BASE}/commesse", timeout=10).json()
    if not coms:
        pytest.skip("no commesse in DB to test")
    com = coms[0]
    cid = com["id"]
    full = s.get(f"{BASE}/commesse/{cid}", timeout=10).json()
    full.pop("_id", None)
    full["allegato_a"] = {"rate": [
        {"descrizione": "TEST_Acconto", "pct": 30, "importo": 1000},
        {"descrizione": "TEST_Saldo", "pct": 70, "importo": 2000}
    ]}
    full["voci_extra"] = [{"descrizione": "TEST_extra", "qty": 1, "prezzo": 100,
                            "data": "2026-01-15", "autorizzazione": "venditore"}]
    r = s.put(f"{BASE}/commesse/{cid}", json=full, timeout=15)
    assert r.status_code == 200, f"PUT commessa fail: {r.status_code} {r.text[:200]}"
    g = s.get(f"{BASE}/commesse/{cid}", timeout=10).json()
    assert g.get("allegato_a", {}).get("rate"), "allegato_a not saved"
    assert g.get("voci_extra"), "voci_extra not saved"
    assert g["allegato_a"]["rate"][0]["descrizione"] == "TEST_Acconto"


# --- A.4 import-from-computo endpoint ---
def test_a4_import_from_computo(s):
    coms = s.get(f"{BASE}/commesse", timeout=10).json()
    com = next((c for c in coms if c.get("computo_metrico", {}).get("items")), None)
    if not com:
        pytest.skip("no commessa with computo items")
    cid = com["id"]
    r = s.post(f"{BASE}/commesse/{cid}/workflow/voci-acquisti/import-from-computo", json={}, timeout=15)
    assert r.status_code == 200, f"import fail: {r.status_code} {r.text[:200]}"
    g = s.get(f"{BASE}/commesse/{cid}", timeout=10).json()
    assert isinstance(g.get("voci_acquisti"), list)


# --- C.4 cad_locked flag persistence on project ---
def test_c4_cad_locked_on_project(s):
    projs = s.get(f"{BASE}/projects", timeout=10).json()
    if not projs:
        pytest.skip("no projects")
    pid = projs[0]["id"]
    full = s.get(f"{BASE}/projects/{pid}", timeout=10).json()
    full.pop("_id", None)
    data = full.get("data") or {}
    data["cad_locked"] = True
    full["data"] = data
    r = s.put(f"{BASE}/projects/{pid}", json=full, timeout=10)
    assert r.status_code == 200
    g = s.get(f"{BASE}/projects/{pid}", timeout=10).json()
    assert g.get("data", {}).get("cad_locked") is True
    # cleanup → unlock
    data["cad_locked"] = False
    full["data"] = data
    s.put(f"{BASE}/projects/{pid}", json=full, timeout=10)
