"""
R89 octies backend regression tests:
1. PDF firma NON contiene admin@admin.it né info@sadicasa.it. Contiene "L'Amministratore".
2. PUT /preventivi/{id} su stato='accettato' NON resetta a bozza; aggiorna updated_at;
   aggiunge modificato_dopo_accettazione=True; NON aggiunge needs_reacceptance.
3. Dopo PUT, il PDF header mostra "Ultima modifica: <data odierna in italiano>".
"""
import os
import re
import time
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

ADMIN_EMAIL = "admin@admin.it"
ADMIN_PASSWORD = "admin"

MESI_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
           "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def bagno_preventivo_id(session):
    # Try to reuse an existing bagno preventivo
    r = session.get(f"{BASE_URL}/api/preventivi", timeout=15)
    assert r.status_code == 200
    lst = r.json() or []
    for p in lst:
        if (p.get("tipo") or "").lower() == "bagno":
            return p["id"]
    # Otherwise create a minimal one
    payload = {
        "tipo": "bagno",
        "cliente": {"nome": "TEST R89octies Cliente", "email": "cliente@test.it", "telefono": "3331234567"},
        "manodopera_base": 5000,
        "piastrelle_mq": 20,
        "piastrelle_prezzo_mq": 30,
        "iva_pct": 10,
    }
    r = session.post(f"{BASE_URL}/api/preventivi", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _oggi_italiano():
    d = datetime.now(timezone.utc)
    return f"{d.day} {MESI_IT[d.month - 1]} {d.year}"


# ── 1. Firma PDF non contiene email admin ─────────────────────────────────────
def test_pdf_firma_no_admin_email(session, bagno_preventivo_id):
    r = session.get(f"{BASE_URL}/api/preventivi/{bagno_preventivo_id}/pdf", timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    body = r.content
    assert b"admin@admin.it" not in body, "L'email admin@admin.it non deve apparire nel PDF"
    assert b"info@sadicasa.it" not in body, "L'email info@sadicasa.it non deve apparire nel PDF (zona firma)"


def test_pdf_firma_contiene_amministratore(session, bagno_preventivo_id):
    # Rendered HTML source contains "L'Amministratore" (encoded in PDF stream, so
    # we do a soft check by asking backend for the HTML via PDF bytes fallback).
    r = session.get(f"{BASE_URL}/api/preventivi/{bagno_preventivo_id}/pdf", timeout=30)
    assert r.status_code == 200
    # PDF text extraction lightweight: use pdfminer if available, otherwise decode roughly.
    try:
        from pdfminer.high_level import extract_text
        from io import BytesIO
        txt = extract_text(BytesIO(r.content))
    except Exception:
        txt = r.content.decode("latin-1", errors="ignore")
    assert "Amministratore" in txt, "Il PDF deve contenere 'L'Amministratore' nella firma"


# ── 2. PUT su accettato non resetta a bozza + marca campi corretti ────────────
@pytest.fixture(scope="module")
def accepted_preventivo_id(session):
    """Riusa un preventivo esistente (per avere created_at >60s indietro) e lo accetta."""
    r = session.get(f"{BASE_URL}/api/preventivi", timeout=15)
    assert r.status_code == 200
    lst = r.json() or []
    pid = None
    now_utc = datetime.now(timezone.utc)
    for p in lst:
        ca = p.get("created_at")
        if not ca:
            continue
        try:
            d_ca = datetime.fromisoformat(str(ca).replace("Z", "+00:00"))
        except Exception:
            continue
        if (now_utc - d_ca).total_seconds() > 120 and (p.get("tipo") or "").lower() == "bagno":
            pid = p["id"]
            break
    if not pid:
        # fallback: crea (test 'ultima modifica' potrebbe non triggerare senza >60s gap)
        payload = {
            "tipo": "bagno",
            "cliente": {"nome": "TEST_R89octies Accettato", "email": "acc@test.it", "telefono": "3331111111"},
            "manodopera_base": 4000, "piastrelle_mq": 15, "piastrelle_prezzo_mq": 25, "iva_pct": 10,
        }
        r = session.post(f"{BASE_URL}/api/preventivi", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]
    # forza stato accettato
    rget = session.get(f"{BASE_URL}/api/preventivi/{pid}", timeout=15)
    full = rget.json() if rget.status_code == 200 else {}
    r2 = session.patch(f"{BASE_URL}/api/preventivi/{pid}/stato",
                       json={"stato": "accettato"}, timeout=15)
    if r2.status_code == 404:
        # alternative path: PUT full body with stato
        full["stato"] = "accettato"
        r2 = session.put(f"{BASE_URL}/api/preventivi/{pid}", json=full, timeout=15)
    assert r2.status_code in (200, 204), f"cannot accept preventivo: {r2.status_code} {r2.text}"
    # verify
    rg = session.get(f"{BASE_URL}/api/preventivi/{pid}", timeout=15)
    assert rg.status_code == 200
    assert rg.json().get("stato") == "accettato", f"stato non è accettato: {rg.json().get('stato')}"
    return pid


def test_put_accettato_non_resetta_bozza(session, accepted_preventivo_id):
    pid = accepted_preventivo_id
    # snapshot updated_at pre-PUT
    r0 = session.get(f"{BASE_URL}/api/preventivi/{pid}", timeout=15)
    assert r0.status_code == 200
    before = r0.json()
    ua_before = before.get("updated_at")

    time.sleep(1.2)  # per verificare l'aggiornamento della data
    # Modifica solo cliente.telefono per triggerare PUT
    r = session.put(f"{BASE_URL}/api/preventivi/{pid}",
                    json={"cliente": {**(before.get("cliente") or {}), "telefono": "3339999999"}},
                    timeout=15)
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated.get("stato") == "accettato", f"stato è cambiato: {updated.get('stato')} (deve restare 'accettato')"
    assert updated.get("modificato_dopo_accettazione") is True, "manca modificato_dopo_accettazione=True"
    assert updated.get("ultima_modifica_post_accept"), "manca ultima_modifica_post_accept"
    assert "needs_reacceptance" not in updated or updated.get("needs_reacceptance") in (None, False), \
        "needs_reacceptance non deve essere presente/True"
    ua_after = updated.get("updated_at")
    assert ua_after and ua_after != ua_before, f"updated_at non aggiornato: {ua_before} -> {ua_after}"


# ── 3. PDF dopo PUT mostra "Ultima modifica: <oggi>" ──────────────────────────
def test_pdf_ultima_modifica_visibile_dopo_put(session, accepted_preventivo_id):
    pid = accepted_preventivo_id
    r = session.get(f"{BASE_URL}/api/preventivi/{pid}/pdf", timeout=30)
    assert r.status_code == 200
    try:
        from pdfminer.high_level import extract_text
        from io import BytesIO
        txt = extract_text(BytesIO(r.content))
    except Exception:
        txt = r.content.decode("latin-1", errors="ignore")
    assert "Ultima modifica" in txt, "Il PDF deve contenere 'Ultima modifica' nell'header dopo PUT"
    oggi = _oggi_italiano()
    # tollerante: verifica mese + anno correnti (data può differire di uno per fuso orario)
    ora = datetime.now(timezone.utc)
    mese = MESI_IT[ora.month - 1]
    anno = str(ora.year)
    assert mese in txt.lower() or mese.capitalize() in txt, \
        f"Il PDF non contiene il mese corrente '{mese}' (oggi={oggi})"
    assert anno in txt, f"Il PDF non contiene l'anno corrente {anno}"


# ── 4. Cleanup ────────────────────────────────────────────────────────────────
def test_zzz_cleanup(session, accepted_preventivo_id):
    # Do not delete existing preventivi; only skip cleanup
    return
