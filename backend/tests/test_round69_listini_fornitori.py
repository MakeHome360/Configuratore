"""Round 69 — Listini Fornitori tests (CRUD listini/prodotti + import xlsx/csv + cerca + RBAC)."""
import io
import os
import uuid
import pytest
import requests
from openpyxl import Workbook

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@admin.it"
ADMIN_PASS = "admin"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    if r.status_code != 200:
        # fallback
        r = s.post(f"{API}/auth/login", json={"email": "admin@ristruttura.app", "password": "Admin12345!"}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def listino_id(admin_client):
    payload = {
        "fornitore_nome": "TEST_R69 Fornitore",
        "categoria": "porte_interne",
        "nome": f"TEST_R69 Listino {uuid.uuid4().hex[:6]}",
        "ricarico_default": 1.8,
    }
    r = admin_client.post(f"{API}/fornitori-listini", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["fornitore_nome"] == payload["fornitore_nome"]
    assert data["categoria"] == payload["categoria"]
    assert data["ricarico_default"] == 1.8
    assert "id" in data and isinstance(data["id"], str)
    yield data["id"]
    # cleanup
    admin_client.delete(f"{API}/fornitori-listini/{data['id']}", timeout=15)


# ---------- CRUD Listini ----------
class TestListinoCRUD:
    def test_get_list(self, admin_client, listino_id):
        r = admin_client.get(f"{API}/fornitori-listini", timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert any(x["id"] == listino_id for x in rows)
        for x in rows:
            assert "n_prodotti" in x

    def test_get_one(self, admin_client, listino_id):
        r = admin_client.get(f"{API}/fornitori-listini/{listino_id}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == listino_id

    def test_get_404(self, admin_client):
        r = admin_client.get(f"{API}/fornitori-listini/notexist123", timeout=15)
        assert r.status_code == 404

    def test_update_listino(self, admin_client, listino_id):
        r = admin_client.put(
            f"{API}/fornitori-listini/{listino_id}",
            json={
                "fornitore_nome": "TEST_R69 Fornitore Renamed",
                "categoria": "porte_interne",
                "nome": "TEST_R69 Listino Updated",
                "ricarico_default": 2.0,
            },
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["nome"] == "TEST_R69 Listino Updated"
        assert data["ricarico_default"] == 2.0


# ---------- CRUD Prodotti ----------
class TestProdottoCRUD:
    def test_add_prodotto_low(self, admin_client, listino_id):
        r = admin_client.post(
            f"{API}/fornitori-listini/{listino_id}/prodotti",
            json={"nome": "Porta scorrevole basic", "prezzo_netto": 20, "unit": "pz"},
            timeout=15,
        )
        assert r.status_code == 200
        p = r.json()
        # ricarico default sul listino è ora 2.0 dopo update -> 20*2 = 40 -> low (<50)
        assert p["prezzo_rivendita"] == 40.0
        assert p["fascia_prezzo"] == "low"
        assert p["ricarico"] == 2.0

    def test_add_prodotto_medium(self, admin_client, listino_id):
        r = admin_client.post(
            f"{API}/fornitori-listini/{listino_id}/prodotti",
            json={"nome": "Porta scorrevole medium", "prezzo_netto": 50, "unit": "pz"},
            timeout=15,
        )
        assert r.status_code == 200
        # 50*2=100 -> medium (50<=p<200)
        assert r.json()["prezzo_rivendita"] == 100.0
        assert r.json()["fascia_prezzo"] == "medium"

    def test_add_prodotto_high(self, admin_client, listino_id):
        r = admin_client.post(
            f"{API}/fornitori-listini/{listino_id}/prodotti",
            json={"nome": "Porta scorrevole premium", "prezzo_netto": 150, "unit": "pz"},
            timeout=15,
        )
        assert r.status_code == 200
        # 150*2=300 -> high (>=200)
        assert r.json()["prezzo_rivendita"] == 300.0
        assert r.json()["fascia_prezzo"] == "high"

    def test_update_prodotto(self, admin_client, listino_id):
        # crea
        r = admin_client.post(
            f"{API}/fornitori-listini/{listino_id}/prodotti",
            json={"nome": "Prodotto da aggiornare", "prezzo_netto": 10, "unit": "pz"},
            timeout=15,
        )
        pid = r.json()["id"]
        # update con ricarico override
        r2 = admin_client.put(
            f"{API}/fornitori-listini/{listino_id}/prodotti/{pid}",
            json={"nome": "Prodotto aggiornato", "prezzo_netto": 100, "ricarico": 3.0, "unit": "pz"},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["prezzo_rivendita"] == 300.0
        assert r2.json()["ricarico"] == 3.0
        assert r2.json()["nome"] == "Prodotto aggiornato"

    def test_delete_prodotto(self, admin_client, listino_id):
        r = admin_client.post(
            f"{API}/fornitori-listini/{listino_id}/prodotti",
            json={"nome": "Da eliminare", "prezzo_netto": 5},
            timeout=15,
        )
        pid = r.json()["id"]
        r2 = admin_client.delete(f"{API}/fornitori-listini/{listino_id}/prodotti/{pid}", timeout=15)
        assert r2.status_code == 200
        # verify gone
        r3 = admin_client.get(f"{API}/fornitori-listini/{listino_id}", timeout=15)
        assert not any(p["id"] == pid for p in r3.json().get("prodotti", []))


# ---------- Import Excel/CSV ----------
def _make_xlsx_bytes(rows):
    wb = Workbook()
    ws = wb.active
    ws.append(["codice", "nome", "descrizione", "unit", "prezzo_netto", "categoria"])
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


class TestImport:
    def test_import_xlsx_replace_4_rows(self, admin_client, listino_id):
        rows = [
            ["P001", "Porta A", "Effetto rovere", "pz", 80, "scorrevole"],
            ["P002", "Porta B", "Bianca laccata", "pz", 120, "battente"],
            ["P003", "Porta C", "Vetro satinato", "pz", 250, "scorrevole"],
            ["P004", "Porta D", "Wengé", "pz", 30, "battente"],
        ]
        data = _make_xlsx_bytes(rows)
        files = {"file": ("test.xlsx", data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = admin_client.post(
            f"{API}/fornitori-listini/{listino_id}/import?mode=replace",
            files=files,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        res = r.json()
        assert res["imported"] == 4
        assert res["total"] == 4
        # verify GET
        r2 = admin_client.get(f"{API}/fornitori-listini/{listino_id}", timeout=15)
        prodotti = r2.json()["prodotti"]
        assert len(prodotti) == 4
        nomi = [p["nome"] for p in prodotti]
        assert "Porta A" in nomi and "Porta C" in nomi

    def test_import_csv_normalize_prices(self, admin_client, listino_id):
        # csv con separator ; e prezzi formattati "€ 1.234,56"
        csv_content = "codice;nome;descrizione;unit;prezzo_netto;categoria\n"
        csv_content += "C1;Csv Item 1;desc;pz;€ 1.234,56;test\n"
        csv_content += "C2;Csv Item 2;desc;pz;99,90;test\n"
        files = {"file": ("test.csv", csv_content.encode("utf-8"), "text/csv")}
        r = admin_client.post(
            f"{API}/fornitori-listini/{listino_id}/import?mode=replace",
            files=files,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 2
        # verify normalized
        r2 = admin_client.get(f"{API}/fornitori-listini/{listino_id}", timeout=15)
        prodotti = r2.json()["prodotti"]
        by_codice = {p["codice"]: p for p in prodotti}
        assert by_codice["C1"]["prezzo_netto"] == 1234.56
        assert by_codice["C2"]["prezzo_netto"] == 99.90


# ---------- Cerca ----------
class TestCerca:
    def test_cerca_categoria_q_fascia(self, admin_client, listino_id):
        # ricarica con dati noti
        rows = [
            ["X1", "Porta scorrevole vetro", "vetro", "pz", 200, "scorrevole"],
            ["X2", "Porta battente classica", "classica", "pz", 30, "battente"],
        ]
        files = {"file": ("test.xlsx", _make_xlsx_bytes(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        admin_client.post(f"{API}/fornitori-listini/{listino_id}/import?mode=replace", files=files, timeout=30)

        # cerca scorrevole high (200*2.0=400 -> high)
        r = admin_client.get(
            f"{API}/fornitori-listini-prodotti/cerca",
            params={"categoria": "porte_interne", "q": "scorrevole", "fascia": "high"},
            timeout=15,
        )
        assert r.status_code == 200
        res = r.json()
        assert isinstance(res, list)
        assert any("scorrevole" in (p.get("nome", "").lower()) for p in res)
        for p in res:
            assert p["fascia_prezzo"] == "high"


# ---------- Categorie ----------
class TestCategorie:
    def test_get_categorie(self, admin_client):
        r = admin_client.get(f"{API}/fornitori-listini-categorie", timeout=15)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) == 14
        keys = [c["key"] for c in cats]
        for expected in ["porte_interne", "infissi", "piastrelle", "sanitari", "altro"]:
            assert expected in keys
        for c in cats:
            assert "n_listini" in c
            assert "label" in c
            assert "icon" in c


# ---------- Clear ----------
class TestClear:
    def test_clear_prodotti(self, admin_client, listino_id):
        # popola
        files = {"file": ("test.xlsx", _make_xlsx_bytes([["Z1", "tmp", "", "pz", 10, ""]]), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        admin_client.post(f"{API}/fornitori-listini/{listino_id}/import?mode=replace", files=files, timeout=30)
        # clear
        r = admin_client.post(f"{API}/fornitori-listini/{listino_id}/clear", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        r2 = admin_client.get(f"{API}/fornitori-listini/{listino_id}", timeout=15)
        assert r2.json()["prodotti"] == []


# ---------- RBAC ----------
class TestRBAC:
    def test_no_auth_returns_401(self, listino_id):
        s = requests.Session()  # no cookies/header
        r = s.post(
            f"{API}/fornitori-listini",
            json={"fornitore_nome": "x", "categoria": "altro", "nome": "y"},
            timeout=15,
        )
        # backend should reject unauthenticated
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"
