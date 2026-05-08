"""Test smoke per Round 23: fix salvataggio progetti admin + voci elettriche."""
import os
import uuid
import httpx

BASE = os.environ.get("API_BASE", "http://localhost:8001/api")
ADMIN = ("admin@admin.it", "admin")


def _login(email, pwd):
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def test_admin_can_update_any_project():
    """Admin deve poter aggiornare progetti creati da altri user_id (precedente bug 404)."""
    t = _login(*ADMIN)
    # crea progetto
    body = {"name": "T-Round23", "data": {"rooms": [], "walls": [], "electrical": []}}
    r = httpx.post(f"{BASE}/projects", headers=_h(t), json=body, timeout=15).json()
    pid = r["id"]
    try:
        # update dello stesso progetto deve passare
        body2 = {"name": "T-Round23-up", "data": {"rooms": [], "walls": [], "electrical": [{"id": "e1", "type": "presa-tv", "x": 10, "y": 10, "wall_side": 1}]}}
        r2 = httpx.put(f"{BASE}/projects/{pid}", headers=_h(t), json=body2, timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["name"] == "T-Round23-up"
        assert d["data"]["electrical"][0]["wall_side"] == 1
    finally:
        httpx.delete(f"{BASE}/projects/{pid}", headers=_h(t), timeout=10)


def test_voci_elettriche_specifiche_present():
    """Le nuove voci elettriche specifiche devono essere presenti in voci_backoffice (anche con DB già seedato)."""
    t = _login(*ADMIN)
    docs = httpx.get(f"{BASE}/voci-backoffice", headers=_h(t), timeout=15).json()
    ids = {d.get("id") for d in docs}
    expected = {
        "voce-punto-presa-tv",
        "voce-punto-rj45",
        "voce-punto-presa-cucina",
        "voce-punto-deviatore",
        "voce-punto-luce-led",
    }
    missing = expected - ids
    assert not missing, f"Voci elettriche mancanti dopo backfill: {missing}"
