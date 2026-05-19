"""Round 75 — Sito pubblico pacchetti + Optional avanzati."""
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
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        sess.headers.update({"Authorization": f"Bearer {tok}"})
    return sess


def test_public_packages_no_auth():
    """L'endpoint /api/public/packages deve essere accessibile SENZA token."""
    r = requests.get(f"{BASE_URL}/api/public/packages", timeout=10)
    assert r.status_code == 200, r.text
    pkgs = r.json()
    assert len(pkgs) >= 4
    names = [p["name"] for p in pkgs]
    for n in ["BASIC", "SMART", "PREMIUM", "ELITE"]:
        assert n in names, f"Manca pacchetto {n} in public/packages"
    # Tutti devono avere price_per_m2 numerico
    for p in pkgs:
        assert isinstance(p["price_per_m2"], (int, float))
        # Campi sicuri presenti
        assert "id" in p
        assert "color" in p
        # Campi sensibili NON esposti
        assert "items" not in p
        assert "listini_items" not in p


def test_public_packages_sync_with_admin(s):
    """Modifica del prezzo in admin si riflette automaticamente in /public/packages."""
    # Imposta prezzo custom su SMART
    new_price = 555.55
    r = s.put(f"{BASE_URL}/api/packages/pkg-smart", json={"price_per_m2": new_price}, timeout=10)
    assert r.status_code == 200
    # Re-fetch pubblico (senza auth)
    r = requests.get(f"{BASE_URL}/api/public/packages", timeout=10)
    smart = next(p for p in r.json() if p["id"] == "pkg-smart")
    assert smart["price_per_m2"] == new_price
    # Rollback
    s.put(f"{BASE_URL}/api/packages/pkg-smart", json={"price_per_m2": 490}, timeout=10)


def test_public_packages_override_propagated(s):
    """Se admin imposta price_override, il public endpoint lo espone."""
    r = s.put(f"{BASE_URL}/api/packages/pkg-elite", json={"price_override": 99999.0}, timeout=10)
    assert r.status_code == 200
    pkg = next(p for p in requests.get(f"{BASE_URL}/api/public/packages", timeout=10).json() if p["id"] == "pkg-elite")
    assert pkg["price_override"] == 99999.0
    # cleanup
    s.put(f"{BASE_URL}/api/packages/pkg-elite", json={"price_override": None}, timeout=10)


def test_optional_listino_scontato_persist(s):
    """Crea optional di tipo listino_scontato + exclude_extras + verifica round-trip."""
    # Prendi una voce backoffice qualsiasi
    voci = s.get(f"{BASE_URL}/api/voci-backoffice", timeout=10).json()
    voce = next((v for v in voci if v.get("prezzo_acquisto")), voci[0])
    body = {
        "name": f"OptR75 {uuid.uuid4().hex[:6]}",
        "tipo_prezzo": "listino_scontato",
        "voce_backoffice_id": voce["id"],
        "prezzo_unitario_listino": 35.5,
        "sconto_pct": 15,
        "unit": "m²",
        "exclude_extras_categories": ["infissi"],
        "package_ids": ["pkg-smart"],
        "price_listino": 0, "price_scontato": 0,  # legacy fields
    }
    r = s.post(f"{BASE_URL}/api/optional", json=body, timeout=10)
    assert r.status_code in (200, 201), r.text
    created = r.json()
    oid = created["id"]
    # Re-read list
    lst = s.get(f"{BASE_URL}/api/optional", timeout=10).json()
    o = next(x for x in lst if x["id"] == oid)
    assert o["tipo_prezzo"] == "listino_scontato"
    assert o["voce_backoffice_id"] == voce["id"]
    assert o["prezzo_unitario_listino"] == 35.5
    assert o["sconto_pct"] == 15
    assert o["exclude_extras_categories"] == ["infissi"]
    assert o["unit"] == "m²"
    # cleanup
    s.delete(f"{BASE_URL}/api/optional/{oid}", timeout=10)
