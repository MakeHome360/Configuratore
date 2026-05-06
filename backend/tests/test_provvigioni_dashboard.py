"""Test smoke per la dashboard venditore + calcolo provvigioni con gerarchia."""
import os
import uuid
import pytest
import httpx

BASE = os.environ.get("API_BASE", "http://localhost:8001/api")
ADMIN = ("admin@admin.it", "admin")


def _login(email, pwd):
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def test_impostazioni_have_provvigioni_keys():
    t = _login(*ADMIN)
    imp = httpx.get(f"{BASE}/impostazioni", headers=_h(t), timeout=15).json()
    for k in [
        "provvigione_semplice_pct",
        "provvigione_responsabile_pct",
        "provvigione_area_manager_pct",
        "provvigione_responsabile_override_pct",
        "provvigione_area_manager_override_pct",
    ]:
        assert k in imp, f"Manca chiave provvigione: {k}"


def test_dashboard_venditore_admin_view_self():
    t = _login(*ADMIN)
    r = httpx.get(f"{BASE}/venditori/me/dashboard", headers=_h(t), timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "venditore" in d and "stats" in d and "provvigioni" in d
    assert d["settings"]["own_pct"] >= 0
    # struttura attesa
    for k in ("preventivi_propri", "commesse_proprie", "fatturato_proprio", "provvigioni_totali"):
        assert k in d["stats"]


def test_provvigioni_calc_for_venditore_semplice():
    t = _login(*ADMIN)
    # crea venditore semplice
    email = f"prov-test-{uuid.uuid4().hex[:6]}@example.com"
    inv = httpx.post(
        f"{BASE}/users/invite", headers=_h(t),
        json={"email": email, "name": "Provv Test", "role": "venditore", "venditore_level": "semplice"},
        timeout=20,
    ).json()
    vid = inv["user_id"]
    try:
        # inserisci una commessa fittizia via mongo
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        async def _seed():
            cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
            db = cli[os.environ["DB_NAME"]]
            await db.commesse.insert_one({
                "id": str(uuid.uuid4()), "numero": "C-PROV-1",
                "cliente": {"nome": "X", "cognome": "Y"},
                "stato": "in_corso", "totale_preventivo": 100000,
                "venditore_id": vid, "created_at": "2026-02-01T10:00:00+00:00",
                "data_inizio": "2026-02-05T10:00:00+00:00",
            })
        asyncio.run(_seed())
        d = httpx.get(f"{BASE}/venditori/{vid}/dashboard", headers=_h(t), timeout=20).json()
        # default semplice = 3%
        assert d["stats"]["fatturato_proprio"] == 100000.0
        assert d["stats"]["provvigioni_totali"] == 3000.0
        assert d["provvigioni"][0]["tipo"] == "diretta"
        assert d["provvigioni"][0]["stato"] == "maturata"
    finally:
        # cleanup
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        async def _clean():
            cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
            db = cli[os.environ["DB_NAME"]]
            await db.users.delete_one({"id": vid})
            await db.commesse.delete_one({"numero": "C-PROV-1"})
        asyncio.run(_clean())
