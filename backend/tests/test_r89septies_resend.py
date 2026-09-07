"""R89 septies — verify Resend integration (primary) with SMTP fallback."""
import os
import sys
sys.path.insert(0, "/app/backend")
import asyncio
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")


# --- module: is_email_enabled with Resend key ---
def test_is_email_enabled_with_resend_key():
    from email_service import is_email_enabled, _cfg
    assert _cfg()["resend_key"].startswith("re_")
    assert is_email_enabled() is True


# --- module: direct send_email() uses Resend and returns True ---
def test_send_email_direct_resend():
    from email_service import send_email
    ok = asyncio.run(send_email(
        to="info@sadicasa.it",
        subject="R89septies pytest — direct send_email",
        html="<p>pytest direct</p>",
    ))
    assert ok is True


# --- module: SMTP fallback path when RESEND_API_KEY is empty ---
def test_smtp_fallback_when_resend_missing(monkeypatch):
    # Remove Resend key so send_email uses SMTP
    monkeypatch.setenv("RESEND_API_KEY", "")
    # Reload module state via _cfg (function re-reads env each call)
    from email_service import _cfg
    assert _cfg()["resend_key"] == ""
    assert _cfg()["host"] == "smtps.aruba.it"


# --- module: E2E endpoint /api/preventivi/{id}/send-email with PDF attachment ---
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@admin.it", "password": "admin",
    })
    if r.status_code != 200:
        # fallback env admin
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": os.environ.get("ADMIN_EMAIL"), "password": os.environ.get("ADMIN_PASSWORD"),
        })
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


def test_endpoint_send_email_resend(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    # Find a bathroom preventivo
    r = requests.get(f"{BASE_URL}/api/preventivi", headers=h)
    assert r.status_code == 200, r.text
    prevs = r.json()
    if isinstance(prevs, dict):
        prevs = prevs.get("items", []) or prevs.get("data", [])
    bagno = None
    for p in prevs:
        # Try both potential shapes
        tipo = (p.get("categoria") or p.get("tipo_cantiere") or p.get("tipologia") or "").lower()
        if "bagn" in tipo or p.get("package_name"):
            bagno = p
            break
    if not bagno and prevs:
        bagno = prevs[0]
    assert bagno, "No preventivi available for test"
    pid = bagno.get("id") or bagno.get("_id")

    r = requests.post(
        f"{BASE_URL}/api/preventivi/{pid}/send-email",
        headers=h, json={"to": "info@sadicasa.it"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True, body
    assert body.get("sent_to") == "info@sadicasa.it"
