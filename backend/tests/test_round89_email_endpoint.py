"""Test R89 — Send email endpoint (was silently broken: missing @api.post decorator)."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


@pytest.fixture(scope="module")
def H():
    tok = requests.post(f"{API}/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_send_email_endpoint_exists(H):
    """L'endpoint /preventivi/{id}/send-email non deve dare 404 (era rotto: mancava @api.post)."""
    p = requests.post(f"{API}/preventivi", json={
        "tipo": "bagno",
        "cliente": {"nome": "Test send email", "email": "info@sadicasa.it"},
        "manodopera_base": 6500, "bathroom_tier": "bagno-silver",
        "totale_iva_incl": 11000, "totale_iva_escl": 10000,
    }, headers=H, timeout=10).json()
    pid = p["id"]
    try:
        r = requests.post(f"{API}/preventivi/{pid}/send-email",
                          headers=H, json={"to": "info@sadicasa.it"}, timeout=30)
        # Non deve essere 404 (endpoint mancante) né 405 (metodo sbagliato)
        assert r.status_code == 200, f"Endpoint /send-email non funzionante (status={r.status_code}, body={r.text[:200]})"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("sent_to") == "info@sadicasa.it"
    finally:
        requests.delete(f"{API}/preventivi/{pid}", headers=H, timeout=10)


def test_send_email_endpoint_supports_legacy_destinatario(H):
    """Deve accettare sia `to` (nuovo) sia `destinatario` (legacy) come chiave del destinatario."""
    p = requests.post(f"{API}/preventivi", json={
        "tipo": "bagno",
        "cliente": {"nome": "Test legacy dest"},
        "manodopera_base": 6500,
        "totale_iva_incl": 7150, "totale_iva_escl": 6500,
    }, headers=H, timeout=10).json()
    pid = p["id"]
    try:
        r = requests.post(f"{API}/preventivi/{pid}/send-email",
                          headers=H, json={"destinatario": "info@sadicasa.it"}, timeout=30).json()
        assert r.get("ok") is True
        assert r.get("sent_to") == "info@sadicasa.it"
    finally:
        requests.delete(f"{API}/preventivi/{pid}", headers=H, timeout=10)


def test_send_email_missing_recipient_returns_400(H):
    """Se non c'è né 'to' né email cliente, deve dare 400."""
    p = requests.post(f"{API}/preventivi", json={
        "tipo": "bagno",
        "cliente": {"nome": "Nessuna email"},
        "manodopera_base": 6500,
        "totale_iva_incl": 7150, "totale_iva_escl": 6500,
    }, headers=H, timeout=10).json()
    pid = p["id"]
    try:
        r = requests.post(f"{API}/preventivi/{pid}/send-email", headers=H, json={}, timeout=15)
        assert r.status_code == 400
    finally:
        requests.delete(f"{API}/preventivi/{pid}", headers=H, timeout=10)
