"""Round 73 — Test composite-sections da backoffice."""
import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@admin.it", "password": "admin"}, timeout=10)
    assert r.status_code == 200
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        sess.headers.update({"Authorization": f"Bearer {tok}"})
    return sess


def test_composite_sections_from_backoffice(s):
    r = s.get(f"{BASE_URL}/api/composite-sections", timeout=10)
    assert r.status_code == 200
    secs = r.json()
    assert isinstance(secs, list) and len(secs) >= 5
    # First section must be Demolizioni (or one of the main categories)
    cats = [x.get("category") for x in secs]
    assert "DEMOLIZIONI" in cats or "MURATURA" in cats
    # Each voce must have modificabile_dal_venditore flag (boolean)
    for sec in secs:
        for v in sec.get("voci", []):
            assert "modificabile_dal_venditore" in v
            assert isinstance(v["modificabile_dal_venditore"], bool)
            assert v.get("name")
            assert v.get("unit")
            assert v.get("price") is not None
    # At least 1 voce modificabile esiste (es. piastrelle, sanitari)
    flat = [v for sec in secs for v in sec.get("voci", [])]
    mod = [v for v in flat if v["modificabile_dal_venditore"]]
    assert len(mod) >= 1, f"Nessuna voce modificabile_dal_venditore trovata in backoffice (totale voci={len(flat)})"
    # totale voci serve almeno 30 (113 in backoffice attuali)
    assert len(flat) >= 30


def test_composite_sections_hardcoded_fallback(s):
    """Per retrocompatibilità, source=hardcoded torna la vecchia struttura."""
    r = s.get(f"{BASE_URL}/api/composite-sections?source=hardcoded", timeout=10)
    assert r.status_code == 200
    secs = r.json()
    # Hardcoded ne ha 13 (vedere packages_seed.COMPOSITE_SECTIONS)
    assert len(secs) >= 10
    # IDs hardcoded specifici
    ids = [s.get("id") for s in secs]
    assert "sec-pavimentazione" in ids
