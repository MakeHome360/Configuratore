"""Round 81 — Dati Azienda (ragione sociale/P.IVA/sedi) + Preset Pagamento + CAD sync baseline."""
import os
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"})
    tok = r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def test_dati_azienda_e_sedi_persistence():
    s = _login()
    before = s.get(f"{BASE_URL}/api/impostazioni").json()
    try:
        payload = {
            **before,
            "ragione_sociale": "RELA SRLS",
            "marchio_commerciale": "Sa di casa",
            "partita_iva": "12345678901",
            "codice_fiscale": "RBNRSS80A01H501Z",
            "rea": "MI-123456",
            "pec": "rela@pec.it",
            "sede_legale_indirizzo": "Via Roma 1",
            "sede_legale_citta": "Milano",
            "sede_legale_cap": "20100",
            "sede_legale_provincia": "MI",
            "telefono_principale": "+390212345",
            "email_principale": "info@sadicasa.it",
            "sedi_operative": [
                {"id": "s1", "nome": "Showroom Milano", "indirizzo": "Via Test 5", "citta": "Milano", "cap": "20100"},
                {"id": "s2", "nome": "Deposito Brescia", "indirizzo": "Via Brescia 10", "citta": "Brescia", "cap": "25100"},
            ],
        }
        s.put(f"{BASE_URL}/api/impostazioni", json=payload)
        after = s.get(f"{BASE_URL}/api/impostazioni").json()
        assert after["ragione_sociale"] == "RELA SRLS"
        assert after["marchio_commerciale"] == "Sa di casa"
        assert after["partita_iva"] == "12345678901"
        assert after["sede_legale_citta"] == "Milano"
        assert len(after.get("sedi_operative") or []) == 2
        assert after["sedi_operative"][1]["nome"] == "Deposito Brescia"
    finally:
        s.put(f"{BASE_URL}/api/impostazioni", json=before)


def test_preset_pagamento_persistence():
    s = _login()
    before = s.get(f"{BASE_URL}/api/impostazioni").json()
    try:
        payload = {
            **before,
            "preset_modalita_pagamento": [
                {"id": "p1", "nome": "30/40/30", "descrizione": "Standard", "default": True, "rate": [
                    {"etichetta": "Acconto", "pct": 30, "scadenza_giorni": 0},
                    {"etichetta": "Inizio lavori", "pct": 40, "scadenza_giorni": 15},
                    {"etichetta": "Saldo", "pct": 30, "scadenza_giorni": 45},
                ]},
                {"id": "p2", "nome": "50/50", "descrizione": "Lavori brevi", "default": False, "rate": [
                    {"etichetta": "Acconto", "pct": 50, "scadenza_giorni": 0},
                    {"etichetta": "Saldo", "pct": 50, "scadenza_giorni": 30},
                ]},
            ],
        }
        s.put(f"{BASE_URL}/api/impostazioni", json=payload)
        after = s.get(f"{BASE_URL}/api/impostazioni").json()
        presets = after.get("preset_modalita_pagamento") or []
        assert len(presets) == 2
        p1 = next(p for p in presets if p["id"] == "p1")
        assert p1["default"] is True
        assert len(p1["rate"]) == 3
        assert sum(r["pct"] for r in p1["rate"]) == 100
        assert p1["rate"][1]["etichetta"] == "Inizio lavori"
    finally:
        s.put(f"{BASE_URL}/api/impostazioni", json=before)


def test_create_project_from_preventivo_snapshots_baseline():
    s = _login()
    # Crea preventivo con extras
    pid = s.post(f"{BASE_URL}/api/preventivi", json={
        "tipo": "pacchetto", "package_id": "pkg-basic", "cliente": {"nome": "Sync Test"}, "mq": 70,
        "items": [{"voce_id": "v1", "name": "Voce A", "qty_richiesta": 10, "unit_price": 50, "unit": "m²", "category": "MURATURA"}],
        "extra_voci": [{"name": "Punto luce extra", "qty": 3, "unit_price": 80, "category": "ELETTRICO"}],
        "infissi_extras": [{"name": "Finestra extra", "price": 600}],
        "iva_pct": 10, "totale_iva_incl": 5000, "totale_iva_escl": 4545,
    }).json()["id"]
    # Crea progetto
    proj = s.post(f"{BASE_URL}/api/preventivi/{pid}/create-project").json()
    assert "id" in proj
    # Carica progetto e verifica baseline
    detail = s.get(f"{BASE_URL}/api/projects/{proj['id']}").json()
    baseline = ((detail.get("data") or {}).get("baseline_preventivo") or {})
    assert baseline.get("preventivo_id") == pid
    assert baseline.get("tipo") == "pacchetto"
    assert baseline.get("package_id") == "pkg-basic"
    assert len(baseline.get("extra_voci") or []) == 1
    assert len(baseline.get("infissi_extras") or []) == 1
    assert baseline.get("totale_iva_incl") == 5000
