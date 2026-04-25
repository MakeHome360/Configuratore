"""
Business logic backend tests for Ristruttura (Configuratore base44 replica).
Covers: packages, voci-backoffice, fasi-commessa, template-email, negozi,
dati-azienda, impostazioni, composite-sections, infissi/bagno config,
preventivi (pacchetto/bagno/composite/infissi), commesse, leads, subappaltatori,
dashboard stats, role-based access control.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://reno-cad-quote.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ristruttura.app"
ADMIN_PASSWORD = "Admin12345!"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token")
    assert token, f"No access_token returned: {body}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def user_client():
    s = requests.Session()
    email = f"biz_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Test12345!", "name": "TEST Biz"}, timeout=30)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    # register sets cookie; also login to get bearer token for header auth parity
    r2 = s.post(f"{API}/auth/login", json={"email": email, "password": "Test12345!"}, timeout=15)
    assert r2.status_code == 200
    token = r2.json().get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------------- Auth ----------------
class TestAuthLogin:
    def test_admin_login_returns_access_token(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d and isinstance(d["access_token"], str) and len(d["access_token"]) > 10
        # role is returned at top-level (flat shape) in current backend
        assert d.get("role") == "admin" or d.get("user", {}).get("role") == "admin"


# ---------------- Packages ----------------
class TestPackages:
    def test_list_packages_four_tiers_with_prices(self, admin_client):
        r = admin_client.get(f"{API}/packages", timeout=15)
        assert r.status_code == 200
        pkgs = r.json()
        assert isinstance(pkgs, list) and len(pkgs) == 4
        by_id = {p["id"]: p for p in pkgs}
        assert by_id["pkg-basic"]["price_per_m2"] == 380.0
        assert by_id["pkg-smart"]["price_per_m2"] == 490.0
        assert by_id["pkg-premium"]["price_per_m2"] == 790.0
        assert by_id["pkg-elite"]["price_per_m2"] == 1180.0
        # items attached
        assert isinstance(by_id["pkg-basic"]["items"], list) and len(by_id["pkg-basic"]["items"]) > 0

    def test_bagno_config(self, admin_client):
        r = admin_client.get(f"{API}/bagno-config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["manodopera_base"] == 6500.0
        names = {t["name"]: t["price"] for t in d["tiers"]}
        assert names["SILVER"] == 3500.0
        assert names["GOLD"] == 5500.0
        assert names["PLATINUM"] == 9000.0

    def test_composite_sections_13(self, admin_client):
        r = admin_client.get(f"{API}/composite-sections", timeout=15)
        assert r.status_code == 200
        secs = r.json()
        assert len(secs) == 13

    def test_infissi_config(self, admin_client):
        r = admin_client.get(f"{API}/infissi-config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert len(d["tipologie"]) >= 5
        assert len(d["materiali"]) >= 4
        assert len(d["vetri"]) >= 3


# ---------------- Voci Backoffice ----------------
class TestVociBackoffice:
    def test_list_voci_47_in_4_categories(self, admin_client):
        r = admin_client.get(f"{API}/voci-backoffice", timeout=15)
        assert r.status_code == 200
        voci = r.json()
        assert len(voci) == 47, f"Expected 47 voci, got {len(voci)}"
        cats = {v["category"] for v in voci}
        assert {"MURATURA", "IMPIANTI", "INFISSI", "SERVIZI"} <= cats
        # computed fields present
        v0 = voci[0]
        assert "prezzo_rivendita" in v0 and "margine_eur" in v0 and "margine_pct" in v0

    def test_update_voce_as_admin_persists(self, admin_client):
        r = admin_client.get(f"{API}/voci-backoffice", timeout=15)
        voci = r.json()
        target = voci[0]
        vid = target["id"]
        new_price = target["prezzo_acquisto"] + 1.23
        r2 = admin_client.put(f"{API}/voci-backoffice/{vid}",
                              json={"prezzo_acquisto": new_price, "ricarico": 2.0}, timeout=15)
        assert r2.status_code == 200
        # verify persisted
        r3 = admin_client.get(f"{API}/voci-backoffice", timeout=15)
        updated = next(v for v in r3.json() if v["id"] == vid)
        assert abs(updated["prezzo_acquisto"] - new_price) < 0.001
        assert updated["ricarico"] == 2.0
        # restore
        admin_client.put(f"{API}/voci-backoffice/{vid}",
                         json={"prezzo_acquisto": target["prezzo_acquisto"], "ricarico": target["ricarico"]}, timeout=15)

    def test_update_voce_as_user_forbidden(self, user_client):
        r = user_client.get(f"{API}/voci-backoffice", timeout=15)
        vid = r.json()[0]["id"]
        r2 = user_client.put(f"{API}/voci-backoffice/{vid}",
                             json={"prezzo_acquisto": 999.0, "ricarico": 2.0}, timeout=15)
        assert r2.status_code == 403


# ---------------- Fasi Commessa ----------------
class TestFasi:
    def test_18_fasi_sorted(self, admin_client):
        r = admin_client.get(f"{API}/fasi-commessa", timeout=15)
        assert r.status_code == 200
        fasi = r.json()
        assert len(fasi) == 18
        orders = [f["order"] for f in fasi]
        assert orders == sorted(orders)


# ---------------- Template Email ----------------
class TestTemplateEmail:
    def test_3_templates(self, admin_client):
        r = admin_client.get(f"{API}/template-email", timeout=15)
        assert r.status_code == 200
        t = r.json()
        assert len(t) == 3


# ---------------- Negozi / Dati / Impostazioni ----------------
class TestConfig:
    def test_negozi_nichelino(self, admin_client):
        r = admin_client.get(f"{API}/negozi", timeout=15)
        assert r.status_code == 200
        ng = r.json()
        assert any(n["name"] == "NICHELINO" for n in ng)

    def test_dati_azienda_default_teal(self, admin_client):
        r = admin_client.get(f"{API}/dati-azienda", timeout=15)
        assert r.status_code == 200
        assert r.json().get("colore_primario") == "teal"

    def test_impostazioni_defaults(self, admin_client):
        r = admin_client.get(f"{API}/impostazioni", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("sicurezza_pct") == 3.0
        assert d.get("direzione_lavori_pct") == 5.0
        assert d.get("iva_ristrutturazione") == 10.0

    def test_update_dati_azienda_as_admin(self, admin_client):
        orig = admin_client.get(f"{API}/dati-azienda", timeout=15).json()
        r = admin_client.put(f"{API}/dati-azienda", json={"colore_primario": "emerald"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("colore_primario") == "emerald"
        # restore
        admin_client.put(f"{API}/dati-azienda", json={"colore_primario": orig.get("colore_primario", "teal")}, timeout=15)

    def test_update_dati_azienda_as_user_forbidden(self, user_client):
        r = user_client.put(f"{API}/dati-azienda", json={"colore_primario": "rose"}, timeout=15)
        assert r.status_code == 403


# ---------------- Preventivi ----------------
class TestPreventivi:
    def test_create_preventivo_pacchetto(self, admin_client):
        payload = {
            "tipo": "pacchetto",
            "cliente": {"nome": "Mario", "cognome": "Rossi", "email": "m@r.it"},
            "package_id": "pkg-basic",
            "mq": 80,
            "items": [],
            "optional": [],
            "totale_iva_incl": 30400.0,
            "totale_iva_escl": 27636.36,
        }
        r = admin_client.post(f"{API}/preventivi", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["tipo"] == "pacchetto"
        assert d["stato"] == "bozza"
        assert d["package_id"] == "pkg-basic"
        assert d["totale_iva_incl"] == 30400.0
        assert d["numero"].startswith("PRV-")
        assert "id" in d
        TestPreventivi.pacchetto_id = d["id"]

    def test_create_preventivo_bagno(self, admin_client):
        r = admin_client.post(f"{API}/preventivi", json={
            "tipo": "bagno",
            "cliente": {"nome": "Lucia"},
            "bathroom_tier": "bagno-silver",
            "manodopera_base": 6500.0,
            "totale_iva_incl": 11000.0,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["tipo"] == "bagno"

    def test_create_preventivo_composite(self, admin_client):
        r = admin_client.post(f"{API}/preventivi", json={
            "tipo": "composite",
            "cliente": {"nome": "Piero"},
            "composite_selections": [{"section_id": "sec-pavimentazione", "voce_id": "cp-sovrap-pvc", "qty": 50}],
            "sicurezza_pct": 3.0,
            "direzione_lavori_pct": 5.0,
            "totale_iva_incl": 2000.0,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["tipo"] == "composite"

    def test_create_preventivo_infissi(self, admin_client):
        r = admin_client.post(f"{API}/preventivi", json={
            "tipo": "infissi",
            "cliente": {"nome": "Giovanni"},
            "infissi": [{"tipologia_id": "inf-finestra-2ante", "materiale_id": "mat-pvc",
                         "vetro_id": "vetro-doppio", "larghezza": 1.2, "altezza": 1.4, "qty": 2, "prezzo": 1411.2}],
            "totale_iva_incl": 1411.2,
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["tipo"] == "infissi"

    def test_patch_preventivo_stato(self, admin_client):
        pid = getattr(TestPreventivi, "pacchetto_id", None)
        assert pid, "Create pacchetto preventivo must run first"
        for st in ("inviato", "accettato"):
            r = admin_client.patch(f"{API}/preventivi/{pid}/stato", json={"stato": st}, timeout=15)
            assert r.status_code == 200
            assert r.json()["stato"] == st
        # invalid
        r = admin_client.patch(f"{API}/preventivi/{pid}/stato", json={"stato": "foo"}, timeout=15)
        assert r.status_code == 400


# ---------------- Commesse ----------------
class TestCommesse:
    def test_create_commessa_from_preventivo(self, admin_client):
        pid = getattr(TestPreventivi, "pacchetto_id", None)
        assert pid
        r = admin_client.post(f"{API}/commesse", json={"preventivo_id": pid}, timeout=15)
        assert r.status_code == 200
        c = r.json()
        assert c["numero"].startswith("COM-")
        assert c["stato"] == "da_iniziare"
        assert c["avanzamento_pct"] == 0
        assert isinstance(c["checklist"], list) and len(c["checklist"]) == 18
        TestCommesse.commessa_id = c["id"]

    def test_update_commessa_checklist_recomputes_pct(self, admin_client):
        cid = TestCommesse.commessa_id
        doc = admin_client.get(f"{API}/commesse/{cid}", timeout=15).json()
        checklist = doc["checklist"]
        # mark first 9 completed -> 50%
        for i, item in enumerate(checklist):
            item["completata"] = i < 9
        r = admin_client.put(f"{API}/commesse/{cid}", json={"checklist": checklist}, timeout=15)
        assert r.status_code == 200
        assert r.json()["avanzamento_pct"] == 50.0

    def test_patch_commessa_stato(self, admin_client):
        cid = TestCommesse.commessa_id
        r = admin_client.patch(f"{API}/commesse/{cid}/stato", json={"stato": "in_corso"}, timeout=15)
        assert r.status_code == 200
        r = admin_client.patch(f"{API}/commesse/{cid}/stato", json={"stato": "invalid"}, timeout=15)
        assert r.status_code == 400


# ---------------- Leads ----------------
class TestLeads:
    def test_create_lead_default_nuovo(self, admin_client):
        r = admin_client.post(f"{API}/leads", json={"nome": "TEST_Lead", "telefono": "123"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["stato"] == "nuovo"
        assert "id" in d


# ---------------- Subappaltatori ----------------
class TestSubappaltatori:
    def test_create_sub_as_admin(self, admin_client):
        r = admin_client.post(f"{API}/subappaltatori",
                              json={"tipo": "subappaltatore", "nome": "TEST_Sub", "categoria": "Muratore"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["tipo"] == "subappaltatore"
        TestSubappaltatori.sid = r.json()["id"]

    def test_create_sub_as_user_forbidden(self, user_client):
        r = user_client.post(f"{API}/subappaltatori", json={"tipo": "fornitore", "nome": "X"}, timeout=15)
        assert r.status_code == 403

    def test_delete_sub_cleanup(self, admin_client):
        sid = getattr(TestSubappaltatori, "sid", None)
        if sid:
            admin_client.delete(f"{API}/subappaltatori/{sid}", timeout=15)


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_dashboard_stats_keys(self, admin_client):
        r = admin_client.get(f"{API}/stats/dashboard", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("preventivi_totali", "preventivi_approvati", "commesse_attive",
                  "fatturato_totale", "per_pacchetto", "stati_commesse",
                  "ultimi_preventivi", "ultime_commesse"):
            assert k in d
        assert isinstance(d["per_pacchetto"], dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
