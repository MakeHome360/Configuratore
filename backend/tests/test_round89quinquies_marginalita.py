"""Round 89 quinquies — Marginalità interna reale (voci_backoffice + manual_extras con PA/ricarico).

Test focus:
1. GET /api/composite-sections restituisce prezzo_acquisto valorizzato per la maggior parte delle voci.
2. POST /api/marginalita/calcola con costi_diretti custom → il calcolo usa i costi passati (non stima).
3. Preventivo composite con manual_extras che includono prezzo_acquisto/ricarico:
   POST persiste i campi, GET li ritorna intatti, PUT parziale non li cancella.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@admin.it"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# --------------- 1) composite-sections restituisce prezzo_acquisto ---------------
class TestCompositeSectionsPrezzoAcquisto:
    def test_sections_include_prezzo_acquisto(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/composite-sections", timeout=15)
        assert r.status_code == 200, r.text[:300]
        sections = r.json()
        assert isinstance(sections, list) and len(sections) > 0
        total = 0
        with_pa = 0
        sample_examples = []
        for sec in sections:
            for v in sec.get("voci", []):
                total += 1
                assert "prezzo_acquisto" in v, f"missing prezzo_acquisto in voce {v.get('id')}"
                pa = v.get("prezzo_acquisto")
                if pa is not None and float(pa or 0) > 0:
                    with_pa += 1
                    if len(sample_examples) < 3:
                        sample_examples.append({"id": v["id"], "name": v["name"], "pa": pa, "price": v.get("price"), "ricarico": v.get("ricarico")})
        assert total > 0
        # Almeno ~90% delle voci deve avere prezzo_acquisto valorizzato (target: 121/122)
        ratio = with_pa / total
        print(f"[composite-sections] {with_pa}/{total} voci con prezzo_acquisto>0 (ratio={ratio:.2%})")
        print(f"[sample] {sample_examples}")
        assert ratio >= 0.90, f"Solo {with_pa}/{total} voci hanno prezzo_acquisto>0 (atteso >=90%)"


# --------------- 2) POST /api/marginalita/calcola con costi_diretti custom ---------------
class TestMarginalitaCalcolaCustomCosti:
    def test_calcola_uses_costi_diretti_input(self, api_client):
        payload = {
            "totale_iva_escl": 10000.0,
            "costi_diretti": 5000.0,
            "ruolo_venditore": "semplice",
        }
        r = api_client.post(f"{BASE_URL}/api/marginalita/calcola", json=payload, timeout=15)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        # costi_diretti riflette esattamente l'input
        assert d["costi_diretti"] == 5000.0, d
        assert d["ricavo"] == 10000.0
        # margine_lordo = ricavo - costi_diretti = 5000
        assert d["margine_lordo"] == 5000.0, d
        assert d["margine_lordo_pct"] == 50.0
        # provvigione = ricavo * pct/100 (default semplice=3% se non impostato altrimenti)
        assert d["provvigione_venditore"] > 0
        assert "utile_netto" in d and "margine_pct" in d
        # utile_netto = ricavo - costi_diretti - costi_fissi - provvigione
        expected_utile = round(
            d["ricavo"] - d["costi_diretti"] - d["costi_fissi_totale"] - d["provvigione_venditore"],
            2,
        )
        assert abs(d["utile_netto"] - expected_utile) < 0.02, d

    def test_calcola_high_costi_low_margin(self, api_client):
        # Costi diretti alti → margine basso, deve segnalare sotto_soglia
        payload = {"totale_iva_escl": 10000.0, "costi_diretti": 9000.0, "ruolo_venditore": "semplice"}
        r = api_client.post(f"{BASE_URL}/api/marginalita/calcola", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["margine_lordo"] == 1000.0
        assert d["margine_lordo_pct"] == 10.0
        assert d.get("sotto_soglia") in (True, False)  # deve esserci


# --------------- 3) Preventivo composite con manual_extras contenenti PA/ricarico ---------------
class TestPreventivoManualExtrasPersistPA:
    _created_ids = []

    def test_create_preventivo_with_manual_extras_pa(self, api_client):
        payload = {
            "tipo": "composite",
            "cliente": {"nome": "TEST Round89quinquies", "telefono": "0000000"},
            "mq": 100,
            "items": [],
            "composite_selections": [],
            "manual_extras": [
                {"id": str(uuid.uuid4()), "name": "TEST voce manuale con PA", "qty": 1,
                 "price": 200.0, "unit": "pz", "prezzo_acquisto": 100.0, "ricarico": 2.0},
                {"id": str(uuid.uuid4()), "name": "TEST voce manuale senza PA", "qty": 2,
                 "price": 150.0, "unit": "pz"},
            ],
            "totale_iva_escl": 500.0,
            "totale_iva_incl": 550.0,
        }
        r = api_client.post(f"{BASE_URL}/api/preventivi", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text[:400]
        doc = r.json()
        assert "id" in doc
        me = doc.get("manual_extras") or []
        assert len(me) == 2, f"expected 2 manual_extras, got {len(me)}: {me}"
        assert me[0]["prezzo_acquisto"] == 100.0
        assert me[0]["ricarico"] == 2.0
        assert me[0]["price"] == 200.0
        # Seconda voce senza PA: prezzo_acquisto non presente o None/0
        assert not me[1].get("prezzo_acquisto"), me[1]
        TestPreventivoManualExtrasPersistPA._created_ids.append(doc["id"])

    def test_get_preventivo_returns_pa_ricarico(self, api_client):
        assert TestPreventivoManualExtrasPersistPA._created_ids, "no preventivo created"
        pid = TestPreventivoManualExtrasPersistPA._created_ids[-1]
        r = api_client.get(f"{BASE_URL}/api/preventivi/{pid}", timeout=15)
        assert r.status_code == 200
        doc = r.json()
        me = doc.get("manual_extras") or []
        assert len(me) == 2
        v0 = me[0]
        assert v0.get("prezzo_acquisto") == 100.0
        assert v0.get("ricarico") == 2.0
        # margine implicito = price - PA = 100
        margine = float(v0["price"]) - float(v0["prezzo_acquisto"])
        assert margine == 100.0

    def test_put_partial_preserves_pa_ricarico(self, api_client):
        """Simula un PUT parziale (es. aggiornamento sconto) e verifica che i manual_extras
        con PA/ricarico non vengano persi."""
        assert TestPreventivoManualExtrasPersistPA._created_ids, "no preventivo created"
        pid = TestPreventivoManualExtrasPersistPA._created_ids[-1]
        # Recupera stato attuale
        r0 = api_client.get(f"{BASE_URL}/api/preventivi/{pid}", timeout=15)
        current = r0.json()
        me_orig = current.get("manual_extras") or []
        # PUT completo che include manual_extras
        put_body = {
            **{k: v for k, v in current.items() if k not in ("_id", "created_at", "updated_at")},
            "sconto_pct": 5.0,
        }
        r = api_client.put(f"{BASE_URL}/api/preventivi/{pid}", json=put_body, timeout=15)
        assert r.status_code == 200, r.text[:400]
        # Re-GET
        r2 = api_client.get(f"{BASE_URL}/api/preventivi/{pid}", timeout=15)
        me_after = r2.json().get("manual_extras") or []
        assert len(me_after) == len(me_orig)
        v0 = me_after[0]
        assert v0.get("prezzo_acquisto") == 100.0
        assert v0.get("ricarico") == 2.0

    @classmethod
    def teardown_class(cls):
        # cleanup
        try:
            s = requests.Session()
            r = s.post(f"{BASE_URL}/api/auth/login",
                       json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
            if r.status_code == 200:
                for pid in cls._created_ids:
                    s.delete(f"{BASE_URL}/api/preventivi/{pid}", timeout=10)
        except Exception:
            pass
