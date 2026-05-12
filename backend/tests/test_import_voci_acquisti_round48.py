"""Round 48 — Test import Voci e Acquisti dal Computo Metrico."""
import os
import uuid
import asyncio
import httpx
import pytest
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("API_BASE", "http://localhost:8001/api")
ADMIN = ("admin@admin.it", "admin")


def _login():
    r = httpx.post(f"{BASE}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
    if r.status_code != 200:
        r = httpx.post(f"{BASE}/auth/login", json={"email": "admin@ristruttura.app", "password": "Admin12345!"}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _h(t): return {"Authorization": f"Bearer {t}"}


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture()
def commessa_con_computo():
    """Crea voci_backoffice + commessa con computo metrico già popolato."""
    ids = {}
    async def _seed():
        db = _db()
        # Crea 3 voci backoffice con prezzo_acquisto noto
        v1 = {"id": f"vb-{uuid.uuid4().hex[:6]}", "name": "Demolizione muro", "unit": "m²", "category": "MURATURA",
              "prezzo_acquisto": 20.0, "prezzo_rivendita": 30.0, "ricarico_pct": 50}
        v2 = {"id": f"vb-{uuid.uuid4().hex[:6]}", "name": "Tinteggiatura", "unit": "m²", "category": "DECORAZIONE",
              "prezzo_acquisto": 6.0, "prezzo_rivendita": 10.0, "ricarico_pct": 66}
        v3 = {"id": f"vb-{uuid.uuid4().hex[:6]}", "name": "Punto presa", "unit": "pz", "category": "ELETTRICO",
              "prezzo_acquisto": 35.0, "prezzo_rivendita": 60.0, "ricarico_pct": 71}
        await db.voci_backoffice.insert_many([v1, v2, v3])

        com_id = f"com-{uuid.uuid4().hex[:8]}"
        await db.commesse.insert_one({
            "id": com_id, "numero": "COM-IMPORT", "stato": "in_corso",
            "cliente": {"nome": "Test"},
            "computo_metrico": {
                "items": [
                    {"id": f"cm-{uuid.uuid4().hex[:6]}", "voce_id": v1["id"], "name": v1["name"],
                     "qty": 10, "unit": "m²", "prezzo_unit": 30.0, "totale": 300.0, "category": "MURATURA",
                     "stato_assegnazione": "artigiano", "artigiano_nome": "Mario Rossi Sub"},
                    {"id": f"cm-{uuid.uuid4().hex[:6]}", "voce_id": v2["id"], "name": v2["name"],
                     "qty": 50, "unit": "m²", "prezzo_unit": 10.0, "totale": 500.0, "category": "DECORAZIONE",
                     "stato_assegnazione": "da_assegnare"},
                    {"id": f"cm-{uuid.uuid4().hex[:6]}", "voce_id": v3["id"], "name": v3["name"],
                     "qty": 8, "unit": "pz", "prezzo_unit": 60.0, "totale": 480.0, "category": "ELETTRICO",
                     "stato_assegnazione": "interno"},
                ],
                "totale": 1280.0,
            },
        })
        ids.update({"com_id": com_id, "v1": v1["id"], "v2": v2["id"], "v3": v3["id"]})

    asyncio.run(_seed())
    yield ids

    async def _clean():
        db = _db()
        await db.commesse.delete_one({"id": ids["com_id"]})
        await db.voci_backoffice.delete_many({"id": {"$in": [ids["v1"], ids["v2"], ids["v3"]]}})
    asyncio.run(_clean())


def test_import_all_voci_da_computo(commessa_con_computo):
    """Importa tutte le 3 voci, calcola stima_backoffice = prezzo_acquisto × qty, mantiene assegnazioni sub."""
    t = _login()
    ids = commessa_con_computo
    r = httpx.post(
        f"{BASE}/commesse/{ids['com_id']}/workflow/voci-acquisti/import-from-computo",
        json={"only_assigned": False, "merge": True},
        headers=_h(t), timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added"] == 3, body
    assert body["skipped"] == 0, body
    assert body["total"] == 3

    # Verifica i dati salvati in DB
    async def _get():
        return await _db().commesse.find_one({"id": ids["com_id"]}, {"_id": 0})
    com = asyncio.run(_get())
    va = com.get("voci_acquisti") or []
    assert len(va) == 3

    # Voce 1: 10 × 20 = 200€ stima, sub = Mario Rossi Sub
    v1 = next(v for v in va if v["voce_id"] == ids["v1"])
    assert v1["qty"] == 10
    assert v1["stima_backoffice"] == 200.0
    assert v1["subappaltatore"] == "Mario Rossi Sub"
    assert v1["from_computo"] is True
    assert v1["category"] == "MURATURA"
    assert v1["preventivato"] == 0
    assert v1["pagato"] is False

    # Voce 2: 50 × 6 = 300€, sub vuoto (da_assegnare)
    v2 = next(v for v in va if v["voce_id"] == ids["v2"])
    assert v2["stima_backoffice"] == 300.0
    assert v2["subappaltatore"] == ""

    # Voce 3: 8 × 35 = 280€, sub vuoto (interno non è artigiano/autorizzato)
    v3 = next(v for v in va if v["voce_id"] == ids["v3"])
    assert v3["stima_backoffice"] == 280.0


def test_import_solo_assegnate(commessa_con_computo):
    """only_assigned=True salta le voci 'da_assegnare'."""
    t = _login()
    ids = commessa_con_computo
    r = httpx.post(
        f"{BASE}/commesse/{ids['com_id']}/workflow/voci-acquisti/import-from-computo",
        json={"only_assigned": True, "merge": True},
        headers=_h(t), timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    # Solo 2 voci sono assegnate (artigiano + interno); 1 da_assegnare saltata
    assert body["added"] == 2, body
    assert body["skipped"] == 1, body


def test_import_merge_evita_duplicati(commessa_con_computo):
    """Importando 2 volte con merge=True le voci non vengono duplicate."""
    t = _login()
    ids = commessa_con_computo
    r1 = httpx.post(
        f"{BASE}/commesse/{ids['com_id']}/workflow/voci-acquisti/import-from-computo",
        json={"merge": True}, headers=_h(t), timeout=15,
    )
    assert r1.status_code == 200 and r1.json()["added"] == 3
    r2 = httpx.post(
        f"{BASE}/commesse/{ids['com_id']}/workflow/voci-acquisti/import-from-computo",
        json={"merge": True}, headers=_h(t), timeout=15,
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["added"] == 0, body
    assert body["skipped"] == 3, body
    assert body["total"] == 3  # nessun duplicato


def test_import_computo_vuoto_400(commessa_con_computo):
    """Se non c'è computo metrico, ritorna 400."""
    t = _login()
    async def _empty():
        await _db().commesse.update_one({"id": commessa_con_computo["com_id"]}, {"$set": {"computo_metrico": {"items": []}}})
    asyncio.run(_empty())
    r = httpx.post(
        f"{BASE}/commesse/{commessa_con_computo['com_id']}/workflow/voci-acquisti/import-from-computo",
        json={}, headers=_h(t), timeout=15,
    )
    assert r.status_code == 400, r.text
    assert "Computo metrico vuoto" in r.text or "vuoto" in r.text.lower()
