"""Round 67 — Major refactor tests.

Covers:
- Auth login admin@admin.it / admin
- POST /api/preventivi accepts modalita_pagamento (extra=allow)
- POST /api/commesse from preventivo with modalita_pagamento.rate
  → resulting commessa.allegato_a.rate is populated with €
- POST /api/commesse/{cid}/workflow/voci-acquisti/import-from-computo
  imports real items from computo_metrico
- Regression: dati-azienda, list preventivi, list commesse all OK
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # primary creds: admin@admin.it / admin
    r = s.post(f"{API}/auth/login", json={"email": "admin@admin.it", "password": "admin"})
    if r.status_code != 200:
        r = s.post(f"{API}/auth/login", json={"email": "admin@ristruttura.app", "password": "Admin12345!"})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------- Regression smoke ----------
class TestRegression:
    def test_me(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json().get("email")

    def test_dati_azienda(self, admin_session):
        r = admin_session.get(f"{API}/dati-azienda")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("payment_presets", []), list)

    def test_list_preventivi(self, admin_session):
        r = admin_session.get(f"{API}/preventivi")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_commesse(self, admin_session):
        r = admin_session.get(f"{API}/commesse")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- FIX 6 / 7 — modalita_pagamento on preventivi ----------
class TestPreventivoModalitaPagamento:
    def test_create_preventivo_with_modalita_pagamento(self, admin_session):
        payload = {
            "tipo": "composite",
            "cliente": {"nome": "TEST_R67", "cognome": "MP", "email": "test_r67@test.it"},
            "mq": 80,
            "items": [
                {"voce_id": "v1", "name": "Demolizioni", "qty": 80, "unit": "mq",
                 "unit_price": 25, "total": 2000, "category": "DEMO"},
                {"voce_id": "v2", "name": "Pavimento gres", "qty": 80, "unit": "mq",
                 "unit_price": 50, "total": 4000, "category": "PAV"},
            ],
            "totale_iva_incl": 6600,
            "totale_iva_escl": 6000,
            "iva_pct": 10,
            "modalita_pagamento": {
                "preset_id": "custom",
                "label": "TEST 30/40/30",
                "rate": [
                    {"descrizione": "Acconto firma", "pct": 30},
                    {"descrizione": "Avanzamento 50%", "pct": 40},
                    {"descrizione": "Saldo fine lavori", "pct": 30},
                ],
            },
        }
        r = admin_session.post(f"{API}/preventivi", json=payload)
        assert r.status_code in (200, 201), r.text[:300]
        prev = r.json()
        assert "id" in prev
        # Persistence check
        g = admin_session.get(f"{API}/preventivi/{prev['id']}")
        assert g.status_code == 200
        gp = g.json()
        mp = gp.get("modalita_pagamento") or {}
        assert mp.get("label") == "TEST 30/40/30"
        assert len(mp.get("rate") or []) == 3
        assert mp["rate"][0]["pct"] == 30
        # Accept it to allow commessa creation without confirm prompt at API level
        upd = admin_session.put(f"{API}/preventivi/{prev['id']}", json={**gp, "stato": "accettato"})
        assert upd.status_code in (200, 201, 204), upd.text[:200]
        # Stash in class for next tests via pytest's "request" pattern — return id
        pytest.PREV_R67_ID = prev["id"]
        pytest.PREV_R67_TOTAL = 6600


# ---------- FIX 8 — commessa pre-popola allegato_a da modalita_pagamento ----------
class TestCommessaAllegatoAFromPreventivo:
    def test_create_commessa_pre_populates_allegato_a(self, admin_session):
        prev_id = getattr(pytest, "PREV_R67_ID", None)
        if not prev_id:
            pytest.skip("preventivo TEST_R67 non creato")
        # Get fasi
        rf = admin_session.get(f"{API}/fasi-commessa")
        fasi_ids = [f["id"] for f in rf.json()] if rf.status_code == 200 else []
        r = admin_session.post(f"{API}/commesse", json={
            "preventivo_id": prev_id,
            "fasi_attive_ids": fasi_ids,
        })
        assert r.status_code in (200, 201), r.text[:300]
        com = r.json()
        cid = com["id"]
        pytest.COM_R67_ID = cid
        # Verify allegato_a
        g = admin_session.get(f"{API}/commesse/{cid}")
        assert g.status_code == 200
        c = g.json()
        a = c.get("allegato_a") or {}
        rate = a.get("rate") or []
        assert len(rate) == 3, f"expected 3 rate, got {len(rate)}: {a}"
        # Each rata has descrizione, pct, importo computed off total 6600
        importi = sorted([r["importo"] for r in rate])
        # 30% of 6600 = 1980, 40% = 2640, 30% = 1980 → sorted: 1980,1980,2640
        assert importi == [1980.0, 1980.0, 2640.0], importi
        descs = [r["descrizione"] for r in rate]
        assert "Acconto firma" in descs
        assert a.get("auto_generato") is True


# ---------- FIX 10 — import voci-acquisti from computo ----------
class TestImportVociAcquistiFromComputo:
    def test_import_from_computo_populates_voci_acquisti(self, admin_session):
        cid = getattr(pytest, "COM_R67_ID", None)
        if not cid:
            pytest.skip("commessa TEST_R67 non creata")
        # Ensure computo is generated (auto on create_commessa); fetch it
        # Wait a moment for background generation if any
        time.sleep(0.5)
        g = admin_session.get(f"{API}/commesse/{cid}")
        assert g.status_code == 200
        c = g.json()
        cm = c.get("computo_metrico") or {}
        items = cm.get("items") or []
        # If empty, try to regenerate via the proper endpoint
        if not items:
            rg = admin_session.post(f"{API}/commesse/{cid}/workflow/computo/auto-generate")
            # endpoint may or may not exist; tolerate
            if rg.status_code in (200, 201):
                g2 = admin_session.get(f"{API}/commesse/{cid}")
                items = (g2.json().get("computo_metrico") or {}).get("items") or []
        assert items, f"computo_metrico vuoto sulla commessa {cid}"
        n_items = len(items)
        # Call import
        r = admin_session.post(f"{API}/commesse/{cid}/workflow/voci-acquisti/import-from-computo", json={})
        assert r.status_code in (200, 201), r.text[:300]
        # Verify voci_acquisti populated
        g2 = admin_session.get(f"{API}/commesse/{cid}")
        assert g2.status_code == 200
        va = g2.json().get("voci_acquisti") or []
        assert len(va) >= n_items, f"voci_acquisti={len(va)} expected>={n_items}"

    def test_cleanup(self, admin_session):
        # Soft cleanup: delete TEST_R67 commessa + preventivo
        cid = getattr(pytest, "COM_R67_ID", None)
        pid = getattr(pytest, "PREV_R67_ID", None)
        if cid:
            admin_session.delete(f"{API}/commesse/{cid}")
        if pid:
            admin_session.delete(f"{API}/preventivi/{pid}")
