"""Round 68 — Fix pagato→cassa + workflow preventivi fornitori (admin approve/reject).

Crea commessa fresca, voci computo + voci_acquisti, e verifica:
- POST paga: crea movimento, marca pagato, idempotente, errore 400 se eff<=0
- POST annulla-pagamento: rimuove movimento + reset flag
- POST artigiani-preventivi: classifica scarto vs computo (ok/warning/da_autorizzare)
- POST .../autorizza: aggiorna voci_acquisti.preventivato + subappaltatore + computo.stato_assegnazione (solo admin)
- POST .../rifiuta?motivo=...: stato=rifiutato + motivo_rifiuto
- GET /preventivi-fornitori/da-approvare: lista con stato warning/da_autorizzare
- RBAC: non-admin riceve 403 su autorizza/rifiuta
"""
import os
import pytest
import requests

def _read_env_url():
    v = os.environ.get('REACT_APP_BACKEND_URL')
    if v:
        return v.rstrip('/')
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.strip().startswith('REACT_APP_BACKEND_URL='):
                    return line.strip().split('=', 1)[1].strip().rstrip('/')
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE_URL = _read_env_url()
ADMIN_EMAIL = "admin@admin.it"
ADMIN_PASSWORD = "admin"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login admin failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def commessa_id(admin_session):
    """Usa commessa esistente c0fc72dd e seed di computo_metrico + voci_acquisti via PUT."""
    s = admin_session
    cid = "c0fc72dd-cac1-43c3-9c1d-dcde64d90061"
    # Verifica esistenza
    g = s.get(f"{BASE_URL}/api/commesse/{cid}", timeout=30)
    if g.status_code != 200:
        # Fallback: prendi la prima commessa disponibile
        lst = s.get(f"{BASE_URL}/api/commesse", timeout=30).json()
        assert isinstance(lst, list) and len(lst) > 0, "Nessuna commessa disponibile"
        cid = lst[0]["id"]
        print(f"Using fallback commessa: {cid}")
    # Seed via PUT
    upd = s.put(f"{BASE_URL}/api/commesse/{cid}", json={
        "computo_metrico": {
            "items": [
                {"id": "cmitem-1-r68", "voce_id": "voce-a-r68", "name": "TEST_R68 Voce A", "qty": 10, "unit": "mq",
                 "prezzo_unit": 50, "totale": 500, "category": "MURATURA",
                 "stato_assegnazione": "da_assegnare"},
                {"id": "cmitem-2-r68", "voce_id": "voce-b-r68", "name": "TEST_R68 Voce B", "qty": 5, "unit": "pz",
                 "prezzo_unit": 20, "totale": 100, "category": "IMPIANTI",
                 "stato_assegnazione": "da_assegnare"},
            ],
            "totale": 600,
        },
        "voci_acquisti": [
            {"voce_id": "voce-a-r68", "voce": "TEST_R68 Voce A", "subappaltatore": "Mario Rossi",
             "qty": 10, "stima_backoffice": 400, "preventivato": 500, "effettivo": 450,
             "pagato": False, "computo_item_id": "cmitem-1-r68", "category": "MURATURA"},
            {"voce_id": "voce-b-r68", "voce": "TEST_R68 Voce B", "subappaltatore": "",
             "qty": 5, "stima_backoffice": 80, "preventivato": 0, "effettivo": 0,
             "pagato": False, "computo_item_id": "cmitem-2-r68", "category": "IMPIANTI"},
        ],
    }, timeout=30)
    assert upd.status_code == 200, f"Seed PUT failed: {upd.status_code} {upd.text}"
    # Cleanup stale movimenti cassa per le voci appena seedate (test_pollution da round precedenti/curl)
    try:
        cassa = s.get(f"{BASE_URL}/api/commesse/{cid}/workflow/cassa", timeout=30).json()
        for m in cassa:
            if m.get("voce_acquisto_idx") in (0, 1):
                s.delete(f"{BASE_URL}/api/commesse/{cid}/workflow/cassa/{m['id']}", timeout=15)
    except Exception as e:
        print(f"Stale cleanup warning: {e}")
    # Cleanup preventivi TEST_R68 precedenti
    yield cid


# ============ TEST 1: PAGA voce_acquisti → crea movimento cassa ============
class TestPagaVoceAcquisti:
    def test_paga_crea_movimento(self, admin_session, commessa_id):
        s = admin_session
        r = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/voci-acquisti/paga",
                   json={"idx": 0}, timeout=30)
        assert r.status_code == 200, f"Paga failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("ok") is True
        assert "pagamento_id" in data
        mov = data.get("movimento") or {}
        assert mov.get("tipo") == "uscita"
        assert mov.get("stato_pagamento") == "pagato"
        assert mov.get("beneficiario_nome") == "Mario Rossi"
        assert float(mov.get("importo")) == 450.0  # effettivo
        # Verifica voce marcata pagata
        wf = s.get(f"{BASE_URL}/api/commesse/{commessa_id}/workflow", timeout=30).json()
        v0 = wf["commessa"]["voci_acquisti"][0]
        assert v0.get("pagato") is True
        assert v0.get("pagamento_id") == data["pagamento_id"]
        # Marginalita.uscito
        marg = wf["marginalita"]
        assert marg["uscito"] >= 450.0

    def test_paga_idempotente(self, admin_session, commessa_id):
        s = admin_session
        # Get current pagamento_id
        wf = s.get(f"{BASE_URL}/api/commesse/{commessa_id}/workflow", timeout=30).json()
        prev_pid = wf["commessa"]["voci_acquisti"][0]["pagamento_id"]
        r = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/voci-acquisti/paga",
                   json={"idx": 0}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["pagamento_id"] == prev_pid
        assert data.get("duplicato") is True
        # Conta movimenti — solo 1
        cassa = s.get(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/cassa", timeout=30).json()
        uscite_per_voce = [m for m in cassa if m.get("voce_acquisto_idx") == 0]
        assert len(uscite_per_voce) == 1, f"Movimenti duplicati: {len(uscite_per_voce)}"

    def test_paga_400_se_eff_zero(self, admin_session, commessa_id):
        s = admin_session
        # idx=1 ha effettivo=0
        r = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/voci-acquisti/paga",
                   json={"idx": 1}, timeout=30)
        assert r.status_code == 400, f"Expected 400, got {r.status_code} {r.text}"
        assert "Importo" in r.text or "importo" in r.text

    def test_annulla_pagamento(self, admin_session, commessa_id):
        s = admin_session
        r = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/voci-acquisti/annulla-pagamento",
                   json={"idx": 0}, timeout=30)
        assert r.status_code == 200, r.text
        # Verifica voce reset
        wf = s.get(f"{BASE_URL}/api/commesse/{commessa_id}/workflow", timeout=30).json()
        v0 = wf["commessa"]["voci_acquisti"][0]
        assert v0.get("pagato") is False
        assert v0.get("pagamento_id") in (None, "")
        # Movimento eliminato
        cassa = s.get(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/cassa", timeout=30).json()
        uscite = [m for m in cassa if m.get("voce_acquisto_idx") == 0]
        assert len(uscite) == 0


# ============ TEST 2: PREVENTIVI FORNITORI workflow ============
class TestPreventiviFornitori:
    def test_crea_preventivo_da_autorizzare(self, admin_session, commessa_id):
        """Preventivo €5000 vs computo voce-a (500€) → scarto >25% → da_autorizzare"""
        s = admin_session
        r = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi",
                   json={"artigiano_nome": "TEST_R68 Idraulico Caro",
                         "voci_riferite": ["cmitem-1-r68"],
                         "modalita": "artigiano",
                         "importo_offerto": 5000}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["stato"] == "da_autorizzare"
        assert data["ai_analisi"]["esito"] == "blocco"
        pytest.preventivo_id_alto = data["id"]

    def test_crea_preventivo_ok(self, admin_session, commessa_id):
        """Preventivo basso → stato ok"""
        s = admin_session
        # voce-b rivendita 100 → offerta 90 = -10% = ok
        r = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi",
                   json={"artigiano_nome": "TEST_R68 Buon Prezzo",
                         "voci_riferite": ["cmitem-2-r68"],
                         "modalita": "artigiano",
                         "importo_offerto": 90}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["stato"] == "ok"

    def test_dashboard_da_approvare(self, admin_session, commessa_id):
        s = admin_session
        r = s.get(f"{BASE_URL}/api/preventivi-fornitori/da-approvare", timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        # Deve contenere il nostro "da_autorizzare"
        ours = [x for x in rows if x.get("id") == pytest.preventivo_id_alto]
        assert len(ours) == 1
        assert ours[0]["stato"] in ("da_autorizzare", "warning")
        assert ours[0].get("commessa", {}).get("id") == commessa_id

    def test_autorizza_aggiorna_voci_acquisti(self, admin_session, commessa_id):
        s = admin_session
        pid = pytest.preventivo_id_alto
        r = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi/{pid}/autorizza",
                   timeout=30)
        assert r.status_code == 200, r.text
        # Verifica side effects
        wf = s.get(f"{BASE_URL}/api/commesse/{commessa_id}/workflow", timeout=30).json()
        # voci_acquisti aggiornato
        va = [v for v in wf["commessa"]["voci_acquisti"] if v.get("computo_item_id") == "cmitem-1-r68"][0]
        assert float(va["preventivato"]) == 5000.0  # importo_offerto / 1 voce
        assert va["subappaltatore"] == "TEST_R68 Idraulico Caro"
        # computo_metrico.items[].stato_assegnazione=artigiano
        cm_item = [it for it in wf["commessa"]["computo_metrico"]["items"] if it["id"] == "cmitem-1-r68"][0]
        assert cm_item["stato_assegnazione"] == "artigiano"

    def test_rifiuta_con_motivo(self, admin_session, commessa_id):
        s = admin_session
        # Crea altro preventivo "warning" da rifiutare
        cr = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi",
                    json={"artigiano_nome": "TEST_R68 Da Rifiutare",
                          "voci_riferite": ["cmitem-2-r68"],
                          "modalita": "artigiano",
                          "importo_offerto": 120}, timeout=30)  # +20% warning
        pid = cr.json()["id"]
        r = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi/{pid}/rifiuta",
                   params={"motivo": "Troppo caro"}, timeout=30)
        assert r.status_code == 200
        rows = s.get(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi",
                     timeout=30).json()
        ours = [x for x in rows if x["id"] == pid][0]
        assert ours["stato"] == "rifiutato"
        assert ours.get("motivo_rifiuto") == "Troppo caro"


# ============ TEST 3: RBAC ============
class TestRBAC:
    def test_non_admin_403_autorizza(self, admin_session, commessa_id):
        """Crea un utente venditore, prova autorizza → 403"""
        s = admin_session
        # Crea preventivo nuovo
        cr = s.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi",
                    json={"artigiano_nome": "TEST_R68 Rbac",
                          "voci_riferite": ["cmitem-2-r68"],
                          "modalita": "artigiano",
                          "importo_offerto": 5000}, timeout=30)
        pid = cr.json()["id"]
        # Registra un utente standard
        s2 = requests.Session()
        email = "test_r68_venditore@example.com"
        reg = s2.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": "Vendi12345!",
                            "nome": "TEST R68 Vend", "role": "venditore"}, timeout=30)
        if reg.status_code not in (200, 201):
            # Try login if already exists
            pass
        login = s2.post(f"{BASE_URL}/api/auth/login",
                        json={"email": email, "password": "Vendi12345!"}, timeout=30)
        if login.status_code != 200:
            pytest.skip(f"Venditore login failed: {login.text}")
        r = s2.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi/{pid}/autorizza",
                    timeout=30)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        r2 = s2.post(f"{BASE_URL}/api/commesse/{commessa_id}/workflow/artigiani-preventivi/{pid}/rifiuta",
                     params={"motivo": "x"}, timeout=30)
        assert r2.status_code == 403
