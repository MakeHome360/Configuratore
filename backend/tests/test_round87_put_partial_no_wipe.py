"""R87 — Bug critico: PUT /preventivi/{id} con body parziale NON deve azzerare gli altri campi."""
import os
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"})
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


def test_put_preventivo_parziale_non_azzera_dati():
    """SCENARIO BUG: creo un preventivo composite con 50k di dati, poi faccio PUT
    aggiornando SOLO l'email cliente. Il totale e le voci DEVONO essere preservati."""
    s = _login()
    body = {
        "tipo": "composite",
        "cliente": {"nome": "Marco Test Bug", "telefono": "+39333", "email": "", "indirizzo": "Via Roma 1"},
        "mq": 80,
        "composite_selections": [
            {"section_id": "demo", "voce_id": "v1", "name": "Demolizione muri", "unit": "m²", "price": 40, "qty": 100},
            {"section_id": "ric", "voce_id": "v2", "name": "Rifacimento elettrico", "unit": "punti", "price": 80, "qty": 30},
        ],
        "manual_extras": [
            {"name": "Smaltimento mobilio", "category": "EXTRA", "unit": "corpo", "qty": 1, "price": 40000, "manual": True}
        ],
        "listini_selections": [],
        "infissi_extras": [],
        "sicurezza_pct": 3, "direzione_lavori_pct": 5,
        "sconto_eur": 0, "sconto_pct": 0, "iva_pct": 10, "note": "marco",
        "totale_iva_incl": 48800, "totale_iva_escl": 44363,
    }
    cr = s.post(f"{BASE_URL}/api/preventivi", json=body)
    assert cr.status_code in (200, 201), cr.text
    pid = cr.json()["id"]
    try:
        # Verifica creato OK
        d0 = s.get(f"{BASE_URL}/api/preventivi/{pid}").json()
        assert d0.get("totale_iva_incl") and d0["totale_iva_incl"] > 40000
        assert len(d0.get("composite_selections") or []) == 2
        assert len(d0.get("manual_extras") or []) == 1
        assert d0.get("mq") == 80

        # Ora simula il bug: PUT solo con cliente (aggiunta email)
        upd = s.put(f"{BASE_URL}/api/preventivi/{pid}", json={
            "cliente": {**d0["cliente"], "email": "marco@example.com"}
        })
        assert upd.status_code == 200, upd.text
        d1 = upd.json()

        # I dati ORIGINALI devono essere preservati
        assert d1.get("mq") == 80, f"BUG: mq azzerato! valore={d1.get('mq')}"
        assert d1.get("totale_iva_incl") == 48800, f"BUG: totale azzerato! valore={d1.get('totale_iva_incl')}"
        assert d1.get("totale_iva_escl") == 44363, "BUG: totale_iva_escl azzerato"
        assert len(d1.get("composite_selections") or []) == 2, "BUG: composite_selections azzerate"
        assert len(d1.get("manual_extras") or []) == 1, "BUG: manual_extras azzerate"
        assert d1.get("sicurezza_pct") == 3
        assert d1.get("direzione_lavori_pct") == 5
        # Solo l'email è cambiata
        assert d1["cliente"]["email"] == "marco@example.com"
        assert d1["cliente"]["nome"] == "Marco Test Bug"
    finally:
        s.delete(f"{BASE_URL}/api/preventivi/{pid}")
