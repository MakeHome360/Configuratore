"""Test R89 quater — Backend PDF generation (weasyprint)."""
import os
import requests
import pytest
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10)
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def H(token):
    return {"Authorization": f"Bearer {token}"}


def test_pdf_endpoint_generates_valid_pdf_for_bagno(H, token):
    # Crea un preventivo bagno
    p = requests.post(f"{API}/preventivi", json={
        "tipo": "bagno",
        "cliente": {"nome": "Test PDF Gen", "email": "test@example.com"},
        "manodopera_base": 6500, "bathroom_tier": "bagno-gold",
        "piastrelle_mq": 20, "piastrelle_prezzo_mq": 35,
        "extra_voci": [],
        "sconto_eur": 0, "iva_pct": 10,
        "totale_iva_incl": 12870, "totale_iva_escl": 11700,
    }, headers=H, timeout=10).json()
    pid = p["id"]
    try:
        # Test con token in query string
        r = requests.get(f"{API}/preventivi/{pid}/pdf?token={token}", timeout=15)
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content.startswith(b"%PDF-")
        assert len(r.content) > 5000, f"PDF troppo piccolo: {len(r.content)} bytes"
        # Content-Disposition presente
        assert "Preventivo" in r.headers.get("content-disposition", "")

        # Test con Authorization header
        r2 = requests.get(f"{API}/preventivi/{pid}/pdf", headers=H, timeout=15)
        assert r2.status_code == 200
        assert r2.content.startswith(b"%PDF-")

        # Verifica contenuto testuale del PDF
        try:
            from pypdf import PdfReader
        except ImportError:
            from PyPDF2 import PdfReader
        from io import BytesIO
        reader = PdfReader(BytesIO(r.content))
        assert len(reader.pages) >= 1
        text = "".join(p.extract_text() for p in reader.pages)
        # I prezzi DEVONO comparire (bug fix originale: erano vuoti in html2canvas)
        assert "6.500,00" in text, f"Manodopera €6500 non nel PDF: {text[:500]}"
        assert "3.500,00" in text, f"Tier Gold €3500 non nel PDF"
        assert "12.870,00" in text or "12.870" in text, f"Totale finale non nel PDF"
        # Testi completi (no truncation)
        assert "installazione sanitari e miscelatori" in text or "installazione" in text
        # No placeholder admin
        assert "admin@admin.it" not in text
    finally:
        requests.delete(f"{API}/preventivi/{pid}", headers=H, timeout=10)


def test_pdf_endpoint_requires_auth():
    r = requests.get(f"{API}/preventivi/fake-id/pdf", timeout=10)
    assert r.status_code == 401
