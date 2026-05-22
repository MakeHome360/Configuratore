"""Round 86 — Audit Trail su Documenti/Foto Cantiere + PDF preventivo legge da /impostazioni."""
import os
import uuid
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001")


def _login(email="admin@admin.it", password="admin"):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


def _create_commessa(s):
    """Crea un preventivo minimo + commessa diretta."""
    p = s.post(f"{BASE_URL}/api/preventivi", json={
        "tipo": "composite",
        "cliente": {"nome": f"Cl Audit {uuid.uuid4().hex[:5]}", "telefono": "", "email": "", "indirizzo": ""},
        "mq": 50, "composite_selections": [], "manual_extras": [],
        "infissi_extras": [], "sicurezza_pct": 3, "direzione_lavori_pct": 5,
        "sconto_eur": 0, "sconto_pct": 0, "iva_pct": 10, "note": "",
        "totale_iva_incl": 0, "totale_iva_escl": 0,
        "listini_selections": [],
    })
    assert p.status_code in (200, 201), p.text
    pid = p.json()["id"]
    c = s.post(f"{BASE_URL}/api/commesse", json={
        "preventivo_id": pid,
        "indirizzo_cantiere": "Via Audit 1, Milano",
    })
    assert c.status_code in (200, 201), c.text
    cid = c.json()["id"]
    return cid, pid


def test_audit_doc_upload_and_delete():
    """L'upload e il delete di un documento di commessa devono generare entry audit_logs."""
    s = _login()
    cid, pid = _create_commessa(s)
    try:
        # Upload
        up = s.post(f"{BASE_URL}/api/commesse/{cid}/workflow/documenti", json={
            "tipo": "doc_cliente", "name": "CI cliente test", "url": "https://example.com/ci.pdf", "note": "test audit"
        })
        assert up.status_code == 200, up.text
        doc_id = up.json()["id"]
        # Cerca audit per quel doc_id
        logs = s.get(f"{BASE_URL}/api/audit-logs", params={"entity": "commessa_documento", "limit": 50}).json()
        assert any(l.get("action") == "doc_upload" and l.get("entity_id") == doc_id for l in logs), \
            f"audit doc_upload mancante per {doc_id}: actions={[l.get('action') for l in logs[:10]]}"
        # Delete
        d = s.delete(f"{BASE_URL}/api/commesse/{cid}/workflow/documenti/{doc_id}")
        assert d.status_code == 200
        logs2 = s.get(f"{BASE_URL}/api/audit-logs", params={"entity": "commessa_documento", "limit": 50}).json()
        assert any(l.get("action") == "doc_delete" and l.get("entity_id") == doc_id for l in logs2), \
            f"audit doc_delete mancante per {doc_id}"
    finally:
        s.delete(f"{BASE_URL}/api/commesse/{cid}")
        s.delete(f"{BASE_URL}/api/preventivi/{pid}")


def test_audit_foto_cantiere_lifecycle():
    """upload + update + delete foto cantiere → 3 audit entries."""
    s = _login()
    cid, pid = _create_commessa(s)
    try:
        up = s.post(f"{BASE_URL}/api/commesse/{cid}/foto-cantiere", json={
            "data": "2026-02-10", "titolo": "Smontaggio pavimento", "foto": [
                {"url": "https://example.com/a.jpg", "name": "a.jpg", "content_type": "image/jpeg", "size": 1024},
            ], "note": "Lato sud",
        })
        assert up.status_code == 200, up.text
        gid = up.json()["id"]
        # update
        s.put(f"{BASE_URL}/api/commesse/{cid}/foto-cantiere/{gid}", json={
            "titolo": "Smontaggio pavimento + battiscopa",
            "foto": [
                {"url": "https://example.com/a.jpg", "name": "a.jpg"},
                {"url": "https://example.com/b.jpg", "name": "b.jpg"},
            ],
        })
        # delete
        s.delete(f"{BASE_URL}/api/commesse/{cid}/foto-cantiere/{gid}")
        logs = s.get(f"{BASE_URL}/api/audit-logs", params={"entity": "commessa_foto", "limit": 50}).json()
        actions = [l.get("action") for l in logs if l.get("entity_id") == gid]
        assert "foto_upload" in actions, actions
        assert "foto_update" in actions, actions
        assert "foto_delete" in actions, actions
    finally:
        s.delete(f"{BASE_URL}/api/commesse/{cid}")
        s.delete(f"{BASE_URL}/api/preventivi/{pid}")


def test_audit_contratto_signed():
    """Firmare il contratto di una commessa genera un audit `contratto_update`."""
    s = _login()
    cid, pid = _create_commessa(s)
    try:
        r = s.post(f"{BASE_URL}/api/commesse/{cid}/workflow/contratto", json={
            "url": "https://example.com/contratto.pdf", "firmato": True, "firma_data": "2026-02-10",
        })
        assert r.status_code == 200, r.text
        logs = s.get(f"{BASE_URL}/api/audit-logs", params={"entity": "commessa_contratto", "limit": 20}).json()
        assert any(l.get("action") == "contratto_update" for l in logs), \
            f"audit contratto_update mancante: {[l.get('action') for l in logs[:10]]}"
    finally:
        s.delete(f"{BASE_URL}/api/commesse/{cid}")
        s.delete(f"{BASE_URL}/api/preventivi/{pid}")


def test_impostazioni_expose_company_fields_for_pdf():
    """Il PDF preventivo legge `/impostazioni`: i campi nuovi devono essere disponibili."""
    s = _login()
    before = s.get(f"{BASE_URL}/api/impostazioni").json()
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
            {"id": "s1", "nome": "Showroom Milano", "indirizzo": "Via Test 5", "citta": "Milano", "cap": "20100", "telefono": "0212345"},
        ],
    }
    s.put(f"{BASE_URL}/api/impostazioni", json=payload)
    after = s.get(f"{BASE_URL}/api/impostazioni").json()
    assert after.get("ragione_sociale") == "RELA SRLS"
    assert after.get("marchio_commerciale") == "Sa di casa"
    assert after.get("partita_iva") == "12345678901"
    assert (after.get("sedi_operative") or [])[0]["nome"] == "Showroom Milano"
