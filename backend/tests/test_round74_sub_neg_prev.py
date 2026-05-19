"""Round 74 — Subapp/Negozio dashboard + Preventivi multipli su commessa + RBAC docs."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10)
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        sess.headers.update({"Authorization": f"Bearer {tok}"})
    return sess


def test_sub_dashboard(s):
    r = s.get(f"{BASE_URL}/api/subappaltatori", timeout=10)
    assert r.status_code == 200
    subs = r.json()
    assert subs, "Nessun subappaltatore"
    sid = subs[0]["id"]
    r = s.get(f"{BASE_URL}/api/subappaltatori/{sid}/dashboard", timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "subappaltatore" in d
    assert "documenti_check" in d
    assert isinstance(d["documenti_check"], list)
    # 6 documenti standard sempre presenti
    tipi = [x["tipo"] for x in d["documenti_check"]]
    assert "durc" in tipi
    assert "visura" in tipi
    assert "polizza_rc" in tipi
    assert "idoneita_tecnica" in tipi
    assert "kpi" in d
    assert "incassato" in d["kpi"]
    assert "da_incassare" in d["kpi"]
    assert "cantieri" in d
    # 404 se non esiste
    r = s.get(f"{BASE_URL}/api/subappaltatori/notexist/dashboard", timeout=10)
    assert r.status_code == 404


def test_sub_documenti_aziendali(s):
    subs = s.get(f"{BASE_URL}/api/subappaltatori", timeout=10).json()
    sid = subs[0]["id"]
    # Aggiungi DURC con scadenza futura
    r = s.post(f"{BASE_URL}/api/subappaltatori/{sid}/documenti", json={
        "tipo": "durc", "nome": "DURC TEST R74", "url": "https://example.com/durc.pdf",
        "scadenza": "2028-12-31", "note": "test"
    }, timeout=10)
    assert r.status_code == 200, r.text
    did = r.json()["id"]
    # Verifica nel dashboard
    d = s.get(f"{BASE_URL}/api/subappaltatori/{sid}/dashboard", timeout=10).json()
    durc_row = next(x for x in d["documenti_check"] if x["tipo"] == "durc")
    assert durc_row["stato"] == "valid"
    assert durc_row["scadenza"] == "2028-12-31"
    # Aggiungi DURC scaduto (overwrite by creating a new one — they coexist by id)
    r2 = s.post(f"{BASE_URL}/api/subappaltatori/{sid}/documenti", json={
        "tipo": "visura", "nome": "Visura scaduta", "scadenza": "2020-01-01"
    }, timeout=10)
    d2 = s.get(f"{BASE_URL}/api/subappaltatori/{sid}/dashboard", timeout=10).json()
    # Le voci nel check vengono dal PRIMO match per tipo: la nostra Visura scaduta
    visura_row = next(x for x in d2["documenti_check"] if x["tipo"] == "visura")
    assert visura_row["stato"] == "expired"
    # cleanup
    s.delete(f"{BASE_URL}/api/subappaltatori/{sid}/documenti/{did}", timeout=10)
    s.delete(f"{BASE_URL}/api/subappaltatori/{sid}/documenti/{r2.json()['id']}", timeout=10)


def test_negozio_dashboard(s):
    r = s.get(f"{BASE_URL}/api/negozi", timeout=10)
    assert r.status_code == 200
    negs = r.json()
    assert negs, "Nessun negozio"
    nid = negs[0]["id"]
    r = s.get(f"{BASE_URL}/api/negozi/{nid}/dashboard", timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "negozio" in d
    assert "venditori" in d
    assert "totali" in d
    assert "num_venditori" in d["totali"]
    assert "fatturato_venduto" in d["totali"]
    assert "conversion_rate" in d["totali"]
    # 404 se non esiste
    r = s.get(f"{BASE_URL}/api/negozi/notexist/dashboard", timeout=10)
    assert r.status_code == 404


def test_commessa_preventivi_multipli(s):
    # crea prev + commessa
    suf = uuid.uuid4().hex[:6]
    r = s.post(f"{BASE_URL}/api/preventivi", json={
        "tipo": "pacchetto", "cliente": {"nome": f"TestR74_{suf}", "email": f"r74{suf}@t.it"},
        "package_id": "pkg-smart", "mq": 70, "items": [], "totale_iva_incl": 30000, "totale_iva_escl": 27000,
    }, timeout=10)
    pid = r.json()["id"]
    r = s.post(f"{BASE_URL}/api/commesse", json={"preventivo_id": pid}, timeout=10)
    cid = r.json()["id"]

    # lista preventivi commessa → 1 (originale)
    r = s.get(f"{BASE_URL}/api/commesse/{cid}/preventivi", timeout=10)
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) == 1
    assert lst[0]["is_principale"] is True
    assert lst[0]["id"] == pid

    # clone come extra
    r = s.post(f"{BASE_URL}/api/commesse/{cid}/preventivi/clone-from/{pid}", json={"titolo": "Extra parquet R74"}, timeout=10)
    assert r.status_code == 200, r.text
    clone = r.json()
    assert clone["is_extra"] is True
    assert clone["parent_preventivo_id"] == pid
    assert clone["commessa_id"] == cid
    assert clone["stato"] == "bozza"
    assert "Extra parquet R74" in clone["note"]

    # lista preventivi commessa → 2
    lst = s.get(f"{BASE_URL}/api/commesse/{cid}/preventivi", timeout=10).json()
    assert len(lst) == 2
    assert lst[0]["is_principale"] is True
    assert lst[1]["is_extra"] is True

    # modifica preventivo accettato → ritorna a bozza
    # 1. accetta originale
    s.patch(f"{BASE_URL}/api/preventivi/{pid}/stato", json={"stato": "accettato"}, timeout=10)
    # 2. ora aggiorna prezzo (richiede nuova accettazione)
    r = s.put(f"{BASE_URL}/api/preventivi/{pid}", json={
        "tipo": "pacchetto", "cliente": {"nome": f"TestR74_{suf}", "email": f"r74{suf}@t.it"},
        "package_id": "pkg-smart", "mq": 75, "items": [], "totale_iva_incl": 35000, "totale_iva_escl": 31000,
    }, timeout=10)
    assert r.status_code == 200
    p2 = r.json()
    assert p2["stato"] == "bozza", "Modifica preventivo accettato deve riportare a bozza"
    assert p2.get("needs_reacceptance") is True

    # cleanup
    s.delete(f"{BASE_URL}/api/preventivi/{clone['id']}", timeout=10)
    s.delete(f"{BASE_URL}/api/commesse/{cid}", timeout=10)
    s.delete(f"{BASE_URL}/api/preventivi/{pid}", timeout=10)
