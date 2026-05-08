"""Round 26 — Test E2E Workflow Commessa (contratto, computo, artigiani+AI, autorizzazione, cassa, marginalità)."""
import os
import uuid
import asyncio
import httpx
import pytest

BASE = os.environ.get("API_BASE", "http://localhost:8001/api")
ADMIN = ("admin@admin.it", "admin")


def _login(email, pwd):
    r = httpx.post(f"{BASE}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture()
def commessa_test():
    """Crea preventivo + commessa di test e ritorna cid."""
    from motor.motor_asyncio import AsyncIOMotorClient
    cid = str(uuid.uuid4())
    pid = str(uuid.uuid4())

    async def _seed():
        cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = cli[os.environ["DB_NAME"]]
        voce = await db.voci_backoffice.find_one({"cad_category": "ELETTRICO"}, {"_id": 0})
        await db.preventivi.insert_one({
            "id": pid, "numero": "P-WF-T", "tipo": "standard",
            "cliente": {"nome": "Test", "cognome": "WF"}, "mq": 80,
            "totale": 30000, "totale_iva_incl": 33000,
            "voci_dettaglio": [
                {"voce_id": (voce or {}).get("id", "v1"), "name": "X", "qty": 10, "unit": "pz", "prezzo_rivendita": 100, "totale": 1000},
                {"voce_id": (voce or {}).get("id", "v1"), "name": "Y", "qty": 5, "unit": "mq", "prezzo_rivendita": 200, "totale": 1000},
            ],
            "created_at": "2026-02-01T10:00:00+00:00",
        })
        await db.commesse.insert_one({
            "id": cid, "numero": f"WF-{uuid.uuid4().hex[:6]}", "cliente": {"nome": "Test"},
            "mq": 80, "stato": "in_corso", "totale_preventivo": 33000,
            "preventivo_id": pid, "created_at": "2026-02-01T10:00:00+00:00",
        })

    async def _clean():
        cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = cli[os.environ["DB_NAME"]]
        await db.commesse.delete_one({"id": cid})
        await db.preventivi.delete_one({"id": pid})
        await db.commesse_documenti.delete_many({"commessa_id": cid})
        await db.commesse_artigiani_preventivi.delete_many({"commessa_id": cid})
        await db.commesse_fasi.delete_many({"commessa_id": cid})
        await db.commesse_cassa.delete_many({"commessa_id": cid})
        await db.notifiche.delete_many({"payload.commessa_id": cid})

    asyncio.run(_seed())
    yield cid
    asyncio.run(_clean())


def test_workflow_completo(commessa_test):
    cid = commessa_test
    t = _login(*ADMIN)
    # 1. Contratto
    r = httpx.post(f"{BASE}/commesse/{cid}/workflow/contratto", headers=_h(t), json={"firmato": True}, timeout=15)
    assert r.status_code == 200 and r.json()["firmato"]
    # 2. Documento
    r = httpx.post(f"{BASE}/commesse/{cid}/workflow/documenti", headers=_h(t), json={"tipo": "progetto", "name": "Tav PT", "url": "https://x"}, timeout=15)
    assert r.status_code == 200
    # 3. Computo
    r = httpx.post(f"{BASE}/commesse/{cid}/workflow/computo", headers=_h(t), timeout=20)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 2
    # 4. Artigiano OK
    r = httpx.post(f"{BASE}/commesse/{cid}/workflow/artigiani-preventivi", headers=_h(t),
                   json={"artigiano_nome": "OkSquad", "voci_riferite": [it["id"] for it in items], "importo_offerto": 1900, "modalita": "artigiano"},
                   timeout=30)
    assert r.status_code == 200
    assert r.json()["stato"] == "ok"
    # 5. Artigiano sopra soglia → da_autorizzare + notifica
    r = httpx.post(f"{BASE}/commesse/{cid}/workflow/artigiani-preventivi", headers=_h(t),
                   json={"artigiano_nome": "Costosa", "voci_riferite": [it["id"] for it in items], "importo_offerto": 5000, "modalita": "artigiano"},
                   timeout=30)
    assert r.status_code == 200
    assert r.json()["stato"] == "da_autorizzare"
    # Notifica creata
    n = httpx.get(f"{BASE}/notifiche/me", headers=_h(t), timeout=15).json()
    assert any(x.get("tipo") == "autorizzazione_preventivo_artigiano" and x.get("payload", {}).get("commessa_id") == cid for x in n)
    # 6. Autorizza
    pid_art = r.json()["id"]
    r = httpx.post(f"{BASE}/commesse/{cid}/workflow/artigiani-preventivi/{pid_art}/autorizza", headers=_h(t), timeout=15)
    assert r.status_code == 200
    # 7. Cassa
    httpx.post(f"{BASE}/commesse/{cid}/workflow/cassa", headers=_h(t), json={"tipo": "incasso", "importo": 10000, "data": "2026-02-10", "descrizione": "Acconto"}, timeout=15)
    # 8. Fase
    httpx.post(f"{BASE}/commesse/{cid}/workflow/fasi", headers=_h(t), json={"titolo": "Demo", "eseguito_da": "interno", "stato": "in_corso"}, timeout=15)
    # 9. Marginalità
    marg = httpx.get(f"{BASE}/commesse/{cid}/workflow/marginalita", headers=_h(t), timeout=15).json()
    assert marg["incassato"] == 10000
    assert marg["ricavo_preventivato"] == 33000
    # 10. Resoconto
    res = httpx.get(f"{BASE}/commesse/{cid}/workflow/resoconto", headers=_h(t), timeout=15).json()
    assert res["partenza"]["totale_preventivato"] == 33000
    assert res["arrivo"]["incassato"] == 10000
    assert res["fasi_totali"] == 1
