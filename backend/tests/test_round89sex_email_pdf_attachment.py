"""Test R89 sexies — Invio email preventivo con allegato PDF."""
import os
import requests
import pytest
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_send_email_generates_pdf_attachment(H, monkeypatch):
    """Verifica che l'email include allegato PDF (via mock su send_email)."""
    import asyncio
    import sys
    sys.path.insert(0, "/app/backend")
    # Reset any cached module
    for m in ["email_service", "pdf_generator"]:
        if m in sys.modules:
            del sys.modules[m]
    import email_service

    captured = {}

    async def fake_send_email(**kwargs):
        captured.update(kwargs)
        return True

    monkeypatch.setattr(email_service, "send_email", fake_send_email)

    preventivo = {
        "id": "test-r89sex",
        "numero": "PRV-TEST-001",
        "tipo": "bagno",
        "cliente": {"nome": "Mario Rossi", "email": "test@example.com"},
        "manodopera_base": 6500,
        "bathroom_tier": "bagno-gold",
        "totale_iva_incl": 11000,
        "totale_iva_escl": 10000,
        "iva_pct": 10,
    }
    azienda = {"nome": "Sa di casa", "ragione_sociale": "RELA SRLS", "email": "info@sadicasa.it"}
    incaricato = {"name": "Admin", "email": "admin@sadicasa.it"}
    bathroom_tier = {"id": "bagno-gold", "name": "GOLD", "price": 3500, "color": "#F59E0B", "description": "Premium", "included_items": ["Vaso WC"]}

    ok = asyncio.run(email_service.send_preventivo_email(
        to="test@example.com",
        preventivo=preventivo,
        azienda=azienda,
        incaricato=incaricato,
        bathroom_tier=bathroom_tier,
    ))
    assert ok is True
    assert "attachments" in captured, "send_email deve ricevere allegati"
    atts = captured["attachments"]
    assert atts and len(atts) == 1, f"Deve esserci 1 allegato, ho {atts}"
    a = atts[0]
    assert a["filename"].endswith(".pdf")
    assert a["mime_type"] == "application/pdf"
    assert a["content"].startswith(b"%PDF-"), "Contenuto allegato non è un PDF valido"
    # PDF deve contenere prezzi corretti
    assert len(a["content"]) > 3000, f"PDF troppo piccolo: {len(a['content'])}"


def test_send_email_endpoint_still_works(H):
    """L'endpoint POST /api/preventivi/{id}/send-email deve continuare a funzionare."""
    # Trova un preventivo esistente
    p = requests.post(f"{API}/preventivi", json={
        "tipo": "bagno",
        "cliente": {"nome": "Test R89sex", "email": "info@sadicasa.it"},
        "manodopera_base": 6500, "bathroom_tier": "bagno-silver",
        "totale_iva_incl": 9240, "totale_iva_escl": 8400,
    }, headers=H, timeout=10).json()
    pid = p["id"]
    try:
        r = requests.post(f"{API}/preventivi/{pid}/send-email",
                          headers=H, json={"to": "info@sadicasa.it"}, timeout=30).json()
        assert r.get("ok") is True
        assert r.get("sent_to") == "info@sadicasa.it"
    finally:
        requests.delete(f"{API}/preventivi/{pid}", headers=H, timeout=10)
