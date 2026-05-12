"""
Round 48 — Test:
1) Import planimetria: il backend deve restituire doors/windows (non più sempre []).
2) Convalida SAL: deve generare automaticamente un movimento di cassa programmato.

Usa il backend running su localhost:8001 (pattern come test_workflow_commessa.py).
"""
import os
import uuid
import asyncio
import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from unittest.mock import patch, AsyncMock

BASE = os.environ.get("API_BASE", "http://localhost:8001/api")
ADMIN = ("admin@admin.it", "admin")


def _login():
    r = httpx.post(f"{BASE}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
    if r.status_code != 200:
        r = httpx.post(f"{BASE}/auth/login", json={"email": "admin@ristruttura.app", "password": "Admin12345!"}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# -----------------------------------------------------------------------------
# TEST 1 + 2 — Import floorplan parsa doors/windows
# -----------------------------------------------------------------------------
def test_floorplan_parses_doors_windows():
    """Verifica che doors/windows arrivino al project_data — NON è più sempre vuoto."""
    # Iniettiamo direttamente nel server: patch LlmChat per ritornare JSON di test
    # Per farlo facciamo un piccolo trick: chiamiamo internamente la funzione server.
    import sys
    sys.path.insert(0, "/app/backend")
    import server as srv

    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    AI_JSON = (
        '{"rooms":[{"name":"Cucina","points":['
        '{"x":0,"y":0},{"x":400,"y":0},{"x":400,"y":300},{"x":0,"y":300}'
        '],"floorMaterial":"floor-ceramic","electrical":true,"plumbing":true}],'
        '"doors":[{"x":200,"y":0,"width":80,"hinge":"left","swing":"in","kind":"interior"}],'
        '"windows":[{"x":100,"y":300,"width":120,"height":140,"sillHeight":90,"kind":"finestra"}]}'
    )

    class _FakeChat:
        def __init__(self, *a, **kw): pass
        def with_model(self, *a, **kw): return self
        async def send_message(self, msg): return AI_JSON

    # Token utente fake per by-passare get_current_user via monkey-patch dependency
    fake_user = {"id": "test-user", "email": "admin@admin.it", "role": "admin"}

    async def _run():
        import server as srv_local
        orig_chat = srv_local.LlmChat
        orig_key = srv_local.EMERGENT_LLM_KEY
        try:
            srv_local.LlmChat = _FakeChat
            srv_local.EMERGENT_LLM_KEY = "fake-key"
            data = await srv_local.ai_floorplan_import(
                {"image_base64": tiny_png_b64, "mime": "image/png"},
                user=fake_user,
            )
            return data
        finally:
            srv_local.LlmChat = orig_chat
            srv_local.EMERGENT_LLM_KEY = orig_key

    data = asyncio.run(_run())
    pd = data["project_data"]
    assert len(pd["rooms"]) == 1, "Rooms should be parsed"
    assert len(pd["doors"]) == 1, f"Expected 1 door, got {pd['doors']}"
    assert len(pd["windows"]) == 1, f"Expected 1 window, got {pd['windows']}"
    wall_ids = {w["id"] for w in pd["walls"]}
    assert pd["doors"][0]["wallId"] in wall_ids
    assert 0 <= pd["doors"][0]["t"] <= 1
    assert pd["windows"][0]["wallId"] in wall_ids
    assert 0 <= pd["windows"][0]["t"] <= 1
    assert data["doors_count"] == 1
    assert data["windows_count"] == 1


def test_floorplan_rescale_applies_to_doors():
    """Quando known_area_m2 è fornita, le coordinate di doors devono scalare con i muri."""
    import sys; sys.path.insert(0, "/app/backend")
    import server as srv

    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    AI_JSON = (
        '{"rooms":[{"name":"Cucina","points":['
        '{"x":0,"y":0},{"x":400,"y":0},{"x":400,"y":300},{"x":0,"y":300}]}],'
        '"doors":[{"x":200,"y":0,"width":80,"hinge":"left","swing":"in"}],'
        '"windows":[]}'
    )

    class _FakeChat:
        def __init__(self, *a, **kw): pass
        def with_model(self, *a, **kw): return self
        async def send_message(self, msg): return AI_JSON

    fake_user = {"id": "test-user", "email": "admin@admin.it", "role": "admin"}

    async def _run():
        orig_chat = srv.LlmChat
        orig_key = srv.EMERGENT_LLM_KEY
        try:
            srv.LlmChat = _FakeChat
            srv.EMERGENT_LLM_KEY = "fake-key"
            return await srv.ai_floorplan_import(
                {"image_base64": tiny_png_b64, "mime": "image/png", "known_area_m2": 48},
                user=fake_user,
            )
        finally:
            srv.LlmChat = orig_chat
            srv.EMERGENT_LLM_KEY = orig_key

    data = asyncio.run(_run())
    pd = data["project_data"]
    scale = data["scale_applied"]
    # 400x300=120000cm² = 12m². Target 48 → factor sqrt(4)=2
    assert scale and abs(scale["factor"] - 2.0) < 0.05, scale
    # bbox dei punti rooms ~ 800x600
    xs = [p["x"] for r in pd["rooms"] for p in r["points"]]
    ys = [p["y"] for r in pd["rooms"] for p in r["points"]]
    assert max(xs) >= 750, f"bbox X = {max(xs)}"
    assert max(ys) >= 550, f"bbox Y = {max(ys)}"
    assert len(pd["doors"]) == 1


# -----------------------------------------------------------------------------
# TEST 3 + 4 — Convalida SAL genera movimento di cassa programmato
# -----------------------------------------------------------------------------
@pytest.fixture()
def sal_scenario():
    """Crea sub + commessa + assegnazione con avanzamento, restituisce gli id."""
    ids = {}
    async def _seed():
        db = _db()
        sub_id = f"sub-{uuid.uuid4().hex[:8]}"
        await db.subappaltatori.insert_one({"id": sub_id, "nome": "Test Sub SAL", "tipo": "subappaltatore", "categoria": "muratore"})
        com_id = f"com-{uuid.uuid4().hex[:8]}"
        await db.commesse.insert_one({"id": com_id, "numero": "COM-TEST-SAL", "stato": "in_corso", "cliente": {"nome": "Test", "cognome": "User"}})
        ass_id = f"ass-{uuid.uuid4().hex[:10]}"
        av_id = f"av-{uuid.uuid4().hex[:8]}"
        await db.subapp_assegnazioni.insert_one({
            "id": ass_id, "commessa_id": com_id, "subappaltatore_id": sub_id,
            "importo_pattuito": 10000.0, "descrizione_lavori": "Demolizioni",
            "stato": "in_corso", "fatturato": 0, "incassato": 0,
            "avanzamenti": [{
                "id": av_id, "descrizione": "Demolizioni completate", "percentuale": 50,
                "dichiarato_da": "sub", "dichiarato_il": "2026-02-01T00:00:00+00:00", "convalidato": False,
            }],
            "created_at": "2026-02-01T00:00:00+00:00",
        })
        ids.update({"sub_id": sub_id, "com_id": com_id, "ass_id": ass_id, "av_id": av_id})

    asyncio.run(_seed())
    yield ids

    async def _clean():
        db = _db()
        await db.commesse_cassa.delete_many({"commessa_id": ids["com_id"]})
        await db.subapp_assegnazioni.delete_one({"id": ids["ass_id"]})
        await db.commesse.delete_one({"id": ids["com_id"]})
        await db.subappaltatori.delete_one({"id": ids["sub_id"]})
    asyncio.run(_clean())


def test_sal_convalida_genera_cassa_movimento(sal_scenario):
    t = _login()
    ids = sal_scenario
    r = httpx.post(
        f"{BASE}/subappaltatori/assegnazioni/{ids['ass_id']}/avanzamenti/{ids['av_id']}/convalida",
        headers=_h(t), timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["pagamento_importo"] == 5000.0, body
    assert body["pagamento_movimento_id"], body

    # Verifica movimento in DB
    async def _check():
        db = _db()
        return await db.commesse_cassa.find_one({"id": body["pagamento_movimento_id"]}, {"_id": 0})
    mov = asyncio.run(_check())
    assert mov is not None
    assert mov["tipo"] == "uscita"
    assert mov["stato_pagamento"] == "programmato"
    assert mov["importo"] == 5000.0
    assert mov["beneficiario_tipo"] == "subappaltatore"
    assert mov["beneficiario_nome"] == "Test Sub SAL"
    assert mov["commessa_id"] == ids["com_id"]
    assert mov["auto_generated"] is True

    # Idempotenza
    r2 = httpx.post(
        f"{BASE}/subappaltatori/assegnazioni/{ids['ass_id']}/avanzamenti/{ids['av_id']}/convalida",
        headers=_h(t), timeout=15,
    )
    assert r2.status_code == 200
    assert r2.json().get("already_validated") is True


@pytest.fixture()
def sal_delta_scenario():
    """Sub con 1 avanzamento già convalidato al 30% + 1 nuovo al 60%."""
    ids = {}
    async def _seed():
        db = _db()
        sub_id = f"sub-{uuid.uuid4().hex[:8]}"
        await db.subappaltatori.insert_one({"id": sub_id, "nome": "Sub Delta", "tipo": "subappaltatore"})
        com_id = f"com-{uuid.uuid4().hex[:8]}"
        await db.commesse.insert_one({"id": com_id, "numero": "COM-DELTA", "stato": "in_corso", "cliente": {}})
        ass_id = f"ass-{uuid.uuid4().hex[:10]}"
        av1 = f"av-{uuid.uuid4().hex[:8]}"; av2 = f"av-{uuid.uuid4().hex[:8]}"
        await db.subapp_assegnazioni.insert_one({
            "id": ass_id, "commessa_id": com_id, "subappaltatore_id": sub_id, "importo_pattuito": 10000.0,
            "avanzamenti": [
                {"id": av1, "descrizione": "Step1", "percentuale": 30, "convalidato": True,
                 "convalidato_il": "2026-01-15T00:00:00+00:00", "pagamento_movimento_id": "fake-old", "pagamento_importo": 3000.0},
                {"id": av2, "descrizione": "Step2", "percentuale": 60, "convalidato": False},
            ],
        })
        ids.update({"sub_id": sub_id, "com_id": com_id, "ass_id": ass_id, "av_id": av2})

    asyncio.run(_seed())
    yield ids

    async def _clean():
        db = _db()
        await db.commesse_cassa.delete_many({"commessa_id": ids["com_id"]})
        await db.subapp_assegnazioni.delete_one({"id": ids["ass_id"]})
        await db.commesse.delete_one({"id": ids["com_id"]})
        await db.subappaltatori.delete_one({"id": ids["sub_id"]})
    asyncio.run(_clean())


def test_sal_convalida_solo_delta_perc(sal_delta_scenario):
    """Convalidando al 60% mentre 30% era già pagato → genera solo Δ 30% = 3.000€."""
    t = _login()
    ids = sal_delta_scenario
    r = httpx.post(
        f"{BASE}/subappaltatori/assegnazioni/{ids['ass_id']}/avanzamenti/{ids['av_id']}/convalida",
        headers=_h(t), timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["pagamento_importo"] == 3000.0, body
    assert body["delta_percentuale"] == 30.0
