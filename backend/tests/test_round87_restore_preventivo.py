"""R87 — Test endpoint ripristino preventivo (snapshot + audit log + admin-restore)."""
import os
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"})
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


def _crea_preventivo(s, totale=48000):
    body = {
        "tipo": "composite",
        "cliente": {"nome": "Marco Bug Test", "telefono": "+39333", "email": "marco@test.it", "indirizzo": "Via Roma 1"},
        "mq": 80,
        "composite_selections": [
            {"section_id": "demo", "voce_id": "v1", "name": "Demolizione", "unit": "m²", "price": 40, "qty": 100},
            {"section_id": "ric", "voce_id": "v2", "name": "Rifacimento elettrico", "unit": "punti", "price": 80, "qty": 30},
        ],
        "manual_extras": [{"name": "Smaltimento", "category": "EXTRA", "unit": "corpo", "qty": 1, "price": 40000, "manual": True}],
        "listini_selections": [], "infissi_extras": [],
        "sicurezza_pct": 3, "direzione_lavori_pct": 5, "sconto_eur": 0, "sconto_pct": 0, "iva_pct": 10,
        "note": "", "totale_iva_incl": totale, "totale_iva_escl": totale * 0.91,
    }
    return s.post(f"{BASE_URL}/api/preventivi", json=body).json()


def test_snapshot_su_PUT_e_ripristino_completo():
    """Su PUT si crea snapshot; ripristino-snapshot recupera TUTTE le voci."""
    s = _login()
    p = _crea_preventivo(s)
    pid = p["id"]
    try:
        # Verifica creato OK
        d0 = s.get(f"{BASE_URL}/api/preventivi/{pid}").json()
        assert len(d0.get("composite_selections") or []) == 2
        # Faccio un PUT che modifica solo il cliente (con il fix, NON azzera, ma deve creare snapshot)
        s.put(f"{BASE_URL}/api/preventivi/{pid}", json={"cliente": {**d0["cliente"], "email": "marco-new@test.it"}})
        # Verifica snapshot creato
        snaps = s.get(f"{BASE_URL}/api/preventivi/{pid}/snapshots").json()
        assert len(snaps) >= 1, f"Atteso almeno 1 snapshot, trovati {len(snaps)}"
        last = snaps[0]
        assert last["totale_iva_incl"] == 48000
        assert last["tipo"] == "composite"
        assert last["n_voci"] == 2
        assert last["n_manuali"] == 1
        # Simulo wipe manuale (per testare il restore)
        s.put(f"{BASE_URL}/api/preventivi/{pid}/admin-restore", json={
            "totale_iva_incl": 0, "totale_iva_escl": 0, "mq": 0,
            "composite_selections": [], "manual_extras": [], "tipo": "pacchetto",
        })
        d1 = s.get(f"{BASE_URL}/api/preventivi/{pid}").json()
        assert d1.get("totale_iva_incl") == 0, "Wipe non applicato"
        # Ora ripristino dallo snapshot
        r = s.post(f"{BASE_URL}/api/preventivi/{pid}/ripristina-snapshot")
        assert r.status_code == 200, r.text
        d2 = r.json()["preventivo"]
        assert d2.get("totale_iva_incl") == 48000, "Ripristino non riuscito"
        assert d2.get("tipo") == "composite"
        assert len(d2.get("composite_selections") or []) == 2
        assert len(d2.get("manual_extras") or []) == 1
    finally:
        s.delete(f"{BASE_URL}/api/preventivi/{pid}")


def test_ricostruisci_da_audit_log():
    """Se non ci sono snapshot, recupera ALMENO totale e tipo dall'audit log."""
    s = _login()
    p = _crea_preventivo(s, totale=72000)
    pid = p["id"]
    try:
        # Faccio un PUT che cambia mq (così c'è audit con il before)
        s.put(f"{BASE_URL}/api/preventivi/{pid}", json={"mq": 85})
        # Cancello manualmente gli snapshot (simulo caso di preventivo wiped PRIMA del fix snapshot)
        # Non posso da API → simulo wipe diretto
        s.put(f"{BASE_URL}/api/preventivi/{pid}/admin-restore", json={"totale_iva_incl": 0, "tipo": "pacchetto", "mq": 0})
        # Ora chiamo ricostruzione da audit log
        r = s.post(f"{BASE_URL}/api/preventivi/{pid}/ricostruisci-da-audit")
        assert r.status_code == 200, r.text
        rj = r.json()
        assert rj["preventivo"]["totale_iva_incl"] == 72000
        assert rj["preventivo"]["tipo"] == "composite"
        assert "Voci dettagliate" in rj["warning"]
        # Verifica audit "restore_audit"
        logs = s.get(f"{BASE_URL}/api/audit-logs", params={"entity": "preventivo", "limit": 30}).json()
        assert any(l.get("action") == "restore_audit" and l.get("entity_id") == pid for l in logs)
    finally:
        s.delete(f"{BASE_URL}/api/preventivi/{pid}")
