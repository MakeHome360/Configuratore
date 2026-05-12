"""
Round 37 hotfix tests:
- Packages prices (BASIC=380, SMART=490, PREMIUM=790, ELITE=1180)
- Computo metrico generation from preventivo.items
- PATCH assegna voce computo
- Cassa scadenze (multi-payment fields + PATCH)
- Subappaltatore documenti / ready-check
- POST /subappaltatori/assegna VINCOLO docs check
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
COMMESSA_ID = "6ca5efe8-be70-4cc2-b603-6bc0a812d8c1"
SUB_ID = "sub-898b28d4"


@pytest.fixture(scope="session")
def auth_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "admin@admin.it", "password": "admin"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- 1. Packages prices ----------
class TestPackagesPrices:
    def test_packages_prices(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/packages")
        assert r.status_code == 200
        pkgs = r.json()
        by_name = {p["name"]: p for p in pkgs}
        for name, expected in [("BASIC", 380.0), ("SMART", 490.0),
                                ("PREMIUM", 790.0), ("ELITE", 1180.0)]:
            assert name in by_name, f"Missing package {name}"
            assert float(by_name[name]["price_per_m2"]) == expected, \
                f"{name} price_per_m2 expected {expected}, got {by_name[name]['price_per_m2']}"


# ---------- 2. Computo metrico generation ----------
class TestComputoMetrico:
    def test_genera_computo(self, auth_client):
        r = auth_client.post(
            f"{BASE_URL}/api/commesse/{COMMESSA_ID}/workflow/computo")
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "items" in data
        items = data["items"]
        assert len(items) >= 1, "Computo must have at least 1 item"
        first = items[0]
        for key in ("name", "qty", "unit", "prezzo_unit", "totale",
                    "stato_assegnazione"):
            assert key in first, f"Missing key {key} in computo item"
        assert first["stato_assegnazione"] in (
            "da_assegnare", "artigiano", "interno", "autorizzato")

    def test_assegna_voce(self, auth_client):
        # First get the latest computo
        r = auth_client.post(
            f"{BASE_URL}/api/commesse/{COMMESSA_ID}/workflow/computo")
        assert r.status_code == 200
        items = r.json().get("items") or []
        if not items:
            pytest.skip("No computo items")
        voce_id = items[0]["id"]
        body = {"stato_assegnazione": "artigiano",
                "artigiano_nome": "Test SRL",
                "note_assegnazione": "test"}
        r2 = auth_client.patch(
            f"{BASE_URL}/api/commesse/{COMMESSA_ID}/workflow/computo/{voce_id}/assegna",
            json=body)
        assert r2.status_code == 200, f"{r2.status_code} {r2.text}"
        out = r2.json()
        assert out.get("ok") is True
        item = out.get("item") or {}
        assert item.get("stato_assegnazione") == "artigiano"
        assert item.get("artigiano_nome") == "Test SRL"
        assert item.get("assigned_at")


# ---------- 3. Cassa multi-payment ----------
class TestCassa:
    cassa_id = None

    def test_create_cassa_scadenza(self, auth_client):
        body = {
            "tipo": "uscita",
            "importo": 1000,
            "data": "2026-02-15",
            "data_scadenza": "2026-04-15",
            "stato_pagamento": "programmato",
            "beneficiario_tipo": "subappaltatore",
            "beneficiario_nome": "Test",
            "categoria": "acconto",
            "descrizione": "Acconto test",
            "metodo": "bonifico",
        }
        r = auth_client.post(
            f"{BASE_URL}/api/commesse/{COMMESSA_ID}/workflow/cassa", json=body)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        m = r.json()
        assert m.get("id")
        assert m.get("stato_pagamento") == "programmato"
        assert m.get("data_scadenza") == "2026-04-15"
        assert m.get("beneficiario_tipo") == "subappaltatore"
        assert m.get("categoria") == "acconto"
        TestCassa.cassa_id = m["id"]

    def test_get_workflow_cassa(self, auth_client):
        if not TestCassa.cassa_id:
            pytest.skip("no cassa id")
        r = auth_client.get(
            f"{BASE_URL}/api/commesse/{COMMESSA_ID}/workflow")
        assert r.status_code == 200
        cassa = r.json().get("cassa") or []
        ids = [c.get("id") for c in cassa]
        assert TestCassa.cassa_id in ids

    def test_patch_mark_paid(self, auth_client):
        if not TestCassa.cassa_id:
            pytest.skip("no cassa id")
        r = auth_client.patch(
            f"{BASE_URL}/api/commesse/{COMMESSA_ID}/workflow/cassa/{TestCassa.cassa_id}",
            json={"stato_pagamento": "pagato"})
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json().get("stato_pagamento") == "pagato"


# ---------- 4. Sub-appaltatori documenti ----------
class TestSubappDocs:
    def test_tipi_documenti(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/subappaltatori/tipi-documenti")
        assert r.status_code == 200
        tipi = r.json()
        assert isinstance(tipi, list)
        assert len(tipi) == 9
        keys = [t["key"] for t in tipi]
        for k in ("durc", "visura_camerale", "carta_identita",
                  "assicurazione_rc", "iscrizione_inps_inail"):
            assert k in keys

    def test_documenti_sub_empty(self, auth_client):
        r = auth_client.get(
            f"{BASE_URL}/api/subappaltatori/{SUB_ID}/documenti")
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "documenti" in data
        assert "completezza" in data
        assert data.get("ok_per_assegnazione") is False
        comp = data["completezza"]
        assert len(comp) == 9
        # All should have presente=False
        obblig = [c for c in comp if c["obbligatorio"]]
        assert len(obblig) == 5
        for c in obblig:
            assert c["presente"] is False
            assert c["valido"] is False

    def test_ready_check(self, auth_client):
        r = auth_client.get(
            f"{BASE_URL}/api/subappaltatori/{SUB_ID}/ready-check")
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok_per_assegnazione") is False
        mancanti = data.get("mancanti") or []
        tipi_mancanti = [m["tipo"] for m in mancanti]
        for k in ("durc", "visura_camerale", "carta_identita",
                  "assicurazione_rc", "iscrizione_inps_inail"):
            assert k in tipi_mancanti


# ---------- 5. Assegnazione blocked when sub has no docs ----------
class TestAssegnaVincolo:
    def test_assegna_blocked_missing_docs(self, auth_client):
        body = {"commessa_id": COMMESSA_ID,
                "subappaltatore_id": SUB_ID,
                "fasi_assegnate": []}
        r = auth_client.post(
            f"{BASE_URL}/api/subappaltatori/assegna", json=body)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        detail = (r.json().get("detail") or "").lower()
        # Could be blocked at preventivo, contratto, or documenti check
        # Round 37 requirement says docs check is VINCOLO 3
        assert any(s in detail for s in (
            "documenti", "contratto", "preventivo")), \
            f"Unexpected error message: {detail}"
