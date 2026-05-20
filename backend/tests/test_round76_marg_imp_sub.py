"""Round 76 — Marginalità + Documenti sub configurabili + Fasi configurabili + Computo fix."""
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
    assert r.status_code == 200
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        sess.headers.update({"Authorization": f"Bearer {tok}"})
    return sess


def test_impostazioni_seeds(s):
    r = s.get(f"{BASE_URL}/api/impostazioni", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d.get("costi_fissi_globali"), list)
    assert len(d["costi_fissi_globali"]) >= 4
    assert isinstance(d.get("documenti_subappaltatore"), list)
    assert len(d["documenti_subappaltatore"]) >= 6
    assert isinstance(d.get("fasi_per_tipo_lavori"), dict)
    assert "ristrutturazione_completa" in d["fasi_per_tipo_lavori"]
    assert "manutenzione" in d["fasi_per_tipo_lavori"]
    assert isinstance(d.get("checklist_per_tipo_lavori"), dict)


def test_marginalita_calcola(s):
    r = s.post(f"{BASE_URL}/api/marginalita/calcola", json={
        "totale_iva_escl": 50000, "costi_diretti": 30000, "ruolo_venditore": "semplice"
    }, timeout=10)
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["ricavo"] == 50000
    assert m["costi_diretti"] == 30000
    # Costi fissi: 300+200 fissi + 2%*50000 + 1.5%*50000 = 500 + 1000 + 750 = 2250
    assert m["costi_fissi_totale"] == 2250.0
    assert len(m["costi_fissi_breakdown"]) >= 4
    # Provvigione semplice 3% di 50000 = 1500
    assert m["provvigione_venditore"] == 1500
    assert m["provvigione_venditore_pct"] == 3.0
    # Utile = 50000 - 30000 - 2250 - 1500 = 16250
    assert m["utile_netto"] == 16250.0
    assert m["margine_pct"] == 32.5


def test_marginalita_responsabile(s):
    r = s.post(f"{BASE_URL}/api/marginalita/calcola", json={
        "totale_iva_escl": 50000, "costi_diretti": 30000, "ruolo_venditore": "responsabile"
    }, timeout=10)
    m = r.json()
    # Provvigione responsabile 5%
    assert m["provvigione_venditore_pct"] == 5.0
    assert m["provvigione_venditore"] == 2500


def test_sub_dashboard_uses_impostazioni(s):
    """Dashboard sub legge i tipi documento dalle impostazioni."""
    # Override impostazioni con tipi custom
    r = s.put(f"{BASE_URL}/api/impostazioni", json={"documenti_subappaltatore": [
        {"tipo": "durc", "label": "DURC TEST", "obbligatorio": True, "scadenza_alert_gg": 45, "descrizione": "Test"},
        {"tipo": "extra_doc", "label": "Documento extra", "obbligatorio": False, "scadenza_alert_gg": 30},
    ]}, timeout=10)
    assert r.status_code == 200
    subs = s.get(f"{BASE_URL}/api/subappaltatori", timeout=10).json()
    if not subs:
        pytest.skip("No subappaltatori")
    sid = subs[0]["id"]
    r = s.get(f"{BASE_URL}/api/subappaltatori/{sid}/dashboard", timeout=10)
    d = r.json()
    tipi = [x["tipo"] for x in d["documenti_check"]]
    assert "durc" in tipi
    assert "extra_doc" in tipi
    durc = next(x for x in d["documenti_check"] if x["tipo"] == "durc")
    assert durc["label"] == "DURC TEST"
    extra = next(x for x in d["documenti_check"] if x["tipo"] == "extra_doc")
    assert extra["obbligatorio"] is False
    # critici_mancanti deve filtrare solo obbligatori
    crit_tipi = [x["tipo"] for x in d["documenti_critici_mancanti"]]
    assert "extra_doc" not in crit_tipi
    # ripristina default (reseed)
    from packages_seed import DEFAULT_IMPOSTAZIONI
    s.put(f"{BASE_URL}/api/impostazioni", json={"documenti_subappaltatore": DEFAULT_IMPOSTAZIONI["documenti_subappaltatore"]}, timeout=10)
