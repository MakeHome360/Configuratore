"""Round 58 — Test auto-popolamento commessa da preventivo accettato + template materiali."""
import os
import uuid
import asyncio
import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("API_BASE", "http://localhost:8001/api")


def _login(email="admin@admin.it", pwd="admin"):
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    if r.status_code != 200:
        r = httpx.post(f"{BASE}/auth/login", json={"email": "admin@ristruttura.app", "password": "Admin12345!"}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _h(t): return {"Authorization": f"Bearer {t}"}


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def test_materiali_template_crud():
    """Admin può creare, listare, aggiornare, cancellare un template materiali."""
    t = _login()
    # Crea
    payload = {
        "nome": "TEST Template Bagno",
        "is_default": True,
        "voci": [
            {"name": "Piastrelle", "category": "piastrelle", "unit": "m²", "qty_default": 12, "prezzo_default": 35, "finiture": ["Grigio", "Beige"]},
            {"name": "WC sospeso", "category": "sanitari", "unit": "pz", "qty_default": 1, "prezzo_default": 280, "finiture": ["Bianco", "Nero"]},
        ],
    }
    r = httpx.post(f"{BASE}/admin/materiali-template", json=payload, headers=_h(t), timeout=15)
    assert r.status_code == 200, r.text
    tpl = r.json()
    assert tpl["nome"] == "TEST Template Bagno"
    assert tpl["is_default"] is True
    assert len(tpl["voci"]) == 2
    tpl_id = tpl["id"]
    # Lista
    r = httpx.get(f"{BASE}/admin/materiali-template", headers=_h(t), timeout=15)
    assert r.status_code == 200
    assert any(x["id"] == tpl_id for x in r.json())
    # Aggiorna (rimuovi default)
    payload["is_default"] = False
    payload["voci"].append({"name": "Lavabo", "category": "sanitari", "unit": "pz", "qty_default": 1, "prezzo_default": 320, "finiture": []})
    r = httpx.put(f"{BASE}/admin/materiali-template/{tpl_id}", json=payload, headers=_h(t), timeout=15)
    assert r.status_code == 200
    assert len(r.json()["voci"]) == 3
    assert r.json()["is_default"] is False
    # Cleanup
    r = httpx.delete(f"{BASE}/admin/materiali-template/{tpl_id}", headers=_h(t), timeout=15)
    assert r.status_code == 200


@pytest.fixture()
def preventivo_completo():
    """Crea un preventivo bozza con righe + 1 template default materiali."""
    ids = {}
    async def _seed():
        db = _db()
        # Voce backoffice
        vb_id = f"vb-{uuid.uuid4().hex[:6]}"
        await db.voci_backoffice.insert_one({"id": vb_id, "name": "Demolizione muro", "unit": "m²", "category": "MURATURA", "prezzo_acquisto": 18, "prezzo_rivendita": 30, "ricarico_pct": 66})
        # Trovo user_id dell'admin
        admin = await db.users.find_one({"email": "admin@admin.it"}, {"_id": 0}) or await db.users.find_one({"email": "admin@ristruttura.app"}, {"_id": 0})
        user_id = admin["id"]
        # Template materiali default
        tpl_id = f"mt-{uuid.uuid4().hex[:6]}"
        await db.materiali_template.insert_one({
            "id": tpl_id, "nome": "Default Test", "is_default": True,
            "voci": [
                {"name": "Piastrelle test", "category": "piastrelle", "unit": "m²", "qty_default": 15, "prezzo_default": 40, "finiture": ["Bianco", "Nero"]},
                {"name": "WC test", "category": "sanitari", "unit": "pz", "qty_default": 1, "prezzo_default": 300, "finiture": ["Standard"]},
            ],
        })
        # Preventivo bozza
        prev_id = f"prev-{uuid.uuid4().hex[:8]}"
        await db.preventivi.insert_one({
            "id": prev_id, "user_id": user_id, "stato": "bozza", "numero": "P-TEST-001",
            "cliente": {"nome": "Test", "cognome": "Cliente", "email": "test@x.it"},
            "items": [
                {"voce_id": vb_id, "name": "Demolizione muro", "qty": 8, "unit": "m²", "prezzo_unit": 30},
            ],
            "extra_voci": [
                {"name": "Smaltimento extra", "qty": 1, "unit": "pz", "prezzo_unit": 250},
            ],
            "totale_iva_escl": 490,
            "totale_iva_incl": 597.8,
        })
        ids.update({"prev_id": prev_id, "vb_id": vb_id, "tpl_id": tpl_id, "user_id": user_id})

    asyncio.run(_seed())
    yield ids

    async def _clean():
        db = _db()
        await db.preventivi.delete_one({"id": ids["prev_id"]})
        await db.commesse.delete_many({"preventivo_id": ids["prev_id"]})
        await db.voci_backoffice.delete_one({"id": ids["vb_id"]})
        await db.materiali_template.delete_one({"id": ids["tpl_id"]})
    asyncio.run(_clean())


def test_accetta_preventivo_auto_popola_commessa(preventivo_completo):
    """Accettare un preventivo crea commessa + computo metrico + tabella materiali bozza dal template."""
    t = _login()
    ids = preventivo_completo
    # Patch preventivo → accettato
    r = httpx.patch(f"{BASE}/preventivi/{ids['prev_id']}/stato", json={"stato": "accettato"}, headers=_h(t), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["stato"] == "accettato"
    assert body.get("auto_commessa") is not None, body
    assert body["auto_commessa"].get("created") is True
    com_id = body["auto_commessa"]["commessa_id"]
    # Verifica commessa
    async def _get():
        return await _db().commesse.find_one({"id": com_id}, {"_id": 0})
    com = asyncio.run(_get())
    assert com is not None
    assert com["preventivo_id"] == ids["prev_id"]
    # Computo metrico generato dal preventivo (2 voci: items + extra_voci)
    cm_items = (com.get("computo_metrico") or {}).get("items") or []
    assert len(cm_items) == 2, f"Expected 2 cm items, got {len(cm_items)}: {cm_items}"
    assert all(it["auto_from_preventivo"] for it in cm_items)
    totale_cm = (com["computo_metrico"]).get("totale")
    assert totale_cm == 490.0, f"Computo totale = {totale_cm}, expected 490"
    # Tabella materiali: usa template default (Piastrelle + WC)
    mat_items = (com.get("materiali_scelta") or {}).get("items") or []
    assert len(mat_items) == 2, f"Expected 2 mat items from template, got {len(mat_items)}"
    assert any(m["name"] == "Piastrelle test" for m in mat_items)
    assert all(m.get("from_template") is True for m in mat_items)
    # Finiture disponibili presenti
    piastrelle = next(m for m in mat_items if m["name"] == "Piastrelle test")
    assert piastrelle["finiture_disponibili"] == ["Bianco", "Nero"]
    assert piastrelle["finitura"] == ""  # da scegliere


def test_accetta_preventivo_idempotente(preventivo_completo):
    """Riaccettando il preventivo non duplica la commessa (no overwrite)."""
    t = _login()
    ids = preventivo_completo
    r1 = httpx.patch(f"{BASE}/preventivi/{ids['prev_id']}/stato", json={"stato": "accettato"}, headers=_h(t), timeout=15)
    com_id = r1.json()["auto_commessa"]["commessa_id"]
    # Manualmente vuoto materiali per test "updated" branch
    async def _empty():
        db = _db()
        await db.commesse.update_one({"id": com_id}, {"$set": {"materiali_scelta": {"items": []}}})
    asyncio.run(_empty())
    r2 = httpx.patch(f"{BASE}/preventivi/{ids['prev_id']}/stato", json={"stato": "accettato"}, headers=_h(t), timeout=15)
    assert r2.status_code == 200
    body = r2.json()
    assert body["auto_commessa"]["commessa_id"] == com_id, "Stessa commessa, no duplicata"
    assert body["auto_commessa"].get("materiali_added") is True


def test_preventivo_senza_template_usa_voci_preventivo(preventivo_completo):
    """Senza template default attivo, la tabella materiali viene popolata dalle voci del preventivo."""
    t = _login()
    ids = preventivo_completo
    # Disattiva il template default
    async def _disable():
        await _db().materiali_template.update_one({"id": ids["tpl_id"]}, {"$set": {"is_default": False}})
    asyncio.run(_disable())
    r = httpx.patch(f"{BASE}/preventivi/{ids['prev_id']}/stato", json={"stato": "accettato"}, headers=_h(t), timeout=15)
    assert r.status_code == 200, r.text
    com_id = r.json()["auto_commessa"]["commessa_id"]
    async def _fetch():
        return await _db().commesse.find_one({"id": com_id}, {"_id": 0})
    com = asyncio.run(_fetch())
    mat_items = (com.get("materiali_scelta") or {}).get("items") or []
    assert all(m.get("from_preventivo") is True for m in mat_items)
    assert len(mat_items) >= 1
