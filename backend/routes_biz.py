"""
Business routes: leads, commesse, fasi, subappaltatori, negozi, voci backoffice,
dati azienda, impostazioni, template email, solo bagno, composite, infissi, dashboard.
Attached to the existing `api` router in server.py.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from packages_seed import (
    DEFAULT_VOCI_BACKOFFICE, DEFAULT_FASI_COMMESSA, DEFAULT_TEMPLATE_EMAIL,
    DEFAULT_NEGOZI, DEFAULT_IMPOSTAZIONI, DEFAULT_DATI_AZIENDA,
    COMPOSITE_SECTIONS, INFISSI_TIPOLOGIE, INFISSI_MATERIALI, INFISSI_VETRI,
    BATHROOM_TIERS, BATHROOM_MANODOPERA_BASE,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_biz_router(db, get_current_user):
    r = APIRouter()

    # ---------- Seeds helpers ----------
    async def ensure_global_seeds():
        if await db.voci_backoffice.count_documents({}) == 0:
            await db.voci_backoffice.insert_many([dict(v) for v in DEFAULT_VOCI_BACKOFFICE])
        if await db.fasi_commessa.count_documents({}) == 0:
            await db.fasi_commessa.insert_many([dict(f) for f in DEFAULT_FASI_COMMESSA])
        if await db.template_email.count_documents({}) == 0:
            await db.template_email.insert_many([dict(t) for t in DEFAULT_TEMPLATE_EMAIL])
        if await db.negozi.count_documents({}) == 0:
            await db.negozi.insert_many([dict(n) for n in DEFAULT_NEGOZI])
        if await db.dati_azienda.count_documents({}) == 0:
            await db.dati_azienda.insert_one(dict(DEFAULT_DATI_AZIENDA))
        if await db.impostazioni.count_documents({}) == 0:
            await db.impostazioni.insert_one({"id": "main", **DEFAULT_IMPOSTAZIONI})

    # ---------- Dashboard stats ----------
    @r.get("/stats/dashboard")
    async def dashboard_stats(user=Depends(get_current_user)):
        await ensure_global_seeds()
        prev_total = await db.preventivi.count_documents({})
        prev_ok = await db.preventivi.count_documents({"stato": "accettato"})
        com_attive = await db.commesse.count_documents({"stato": {"$in": ["in_corso", "da_iniziare"]}})
        fatturato = 0.0
        async for c in db.commesse.find({}, {"_id": 0, "fatturato": 1}):
            fatturato += float(c.get("fatturato") or 0)
        per_pkg = {}
        async for p in db.preventivi.find({}, {"_id": 0, "package_id": 1, "tipo": 1}):
            pid = p.get("package_id") or "other"
            per_pkg[pid] = per_pkg.get(pid, 0) + 1
        stati_comm = {}
        async for c in db.commesse.find({}, {"_id": 0, "stato": 1}):
            s = c.get("stato") or "da_iniziare"
            stati_comm[s] = stati_comm.get(s, 0) + 1
        ultimi_prev = await db.preventivi.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
        ultime_com = await db.commesse.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
        return {
            "preventivi_totali": prev_total,
            "preventivi_approvati": prev_ok,
            "commesse_attive": com_attive,
            "fatturato_totale": fatturato,
            "per_pacchetto": per_pkg,
            "stati_commesse": stati_comm,
            "ultimi_preventivi": ultimi_prev,
            "ultime_commesse": ultime_com,
        }

    # ---------- Voci Backoffice (Prezzario) ----------
    @r.get("/voci-backoffice")
    async def list_voci(user=Depends(get_current_user)):
        await ensure_global_seeds()
        docs = await db.voci_backoffice.find({}, {"_id": 0}).to_list(2000)
        for d in docs:
            d["prezzo_rivendita"] = round(d["prezzo_acquisto"] * d["ricarico"], 2)
            d["margine_eur"] = round(d["prezzo_rivendita"] - d["prezzo_acquisto"], 2)
            d["margine_pct"] = round((d["margine_eur"] / d["prezzo_rivendita"] * 100) if d["prezzo_rivendita"] else 0, 1)
        return docs

    class VoceIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        category: str
        name: str
        prezzo_acquisto: float
        ricarico: float
        unit: str

    @r.post("/voci-backoffice")
    async def create_voce(body: VoceIn, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        doc = body.model_dump()
        doc["id"] = f"voce-{uuid.uuid4().hex[:8]}"
        await db.voci_backoffice.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.put("/voci-backoffice/{voce_id}")
    async def update_voce(voce_id: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None); body.pop("id", None)
        await db.voci_backoffice.update_one({"id": voce_id}, {"$set": body})
        return {"ok": True}

    @r.delete("/voci-backoffice/{voce_id}")
    async def delete_voce(voce_id: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        await db.voci_backoffice.delete_one({"id": voce_id})
        return {"ok": True}

    # ---------- Fasi Commessa ----------
    @r.get("/fasi-commessa")
    async def list_fasi(user=Depends(get_current_user)):
        await ensure_global_seeds()
        return await db.fasi_commessa.find({}, {"_id": 0}).sort("order", 1).to_list(200)

    @r.put("/fasi-commessa/{fase_id}")
    async def update_fase(fase_id: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None); body.pop("id", None)
        await db.fasi_commessa.update_one({"id": fase_id}, {"$set": body})
        return {"ok": True}

    # ---------- Template Email ----------
    @r.get("/template-email")
    async def list_templates(user=Depends(get_current_user)):
        await ensure_global_seeds()
        return await db.template_email.find({}, {"_id": 0}).to_list(100)

    @r.put("/template-email/{t_id}")
    async def update_template(t_id: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None); body.pop("id", None)
        await db.template_email.update_one({"id": t_id}, {"$set": body})
        return {"ok": True}

    # ---------- Negozi ----------
    @r.get("/negozi")
    async def list_negozi(user=Depends(get_current_user)):
        await ensure_global_seeds()
        return await db.negozi.find({}, {"_id": 0}).to_list(100)

    class NegozioIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        name: str
        code: str
        active: bool = True

    @r.post("/negozi")
    async def create_negozio(body: NegozioIn, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        doc = body.model_dump()
        doc["id"] = f"store-{uuid.uuid4().hex[:8]}"
        await db.negozi.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.put("/negozi/{neg_id}")
    async def update_negozio(neg_id: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None); body.pop("id", None)
        await db.negozi.update_one({"id": neg_id}, {"$set": body})
        return {"ok": True}

    # ---------- Dati Azienda ----------
    @r.get("/dati-azienda")
    async def get_dati(user=Depends(get_current_user)):
        await ensure_global_seeds()
        doc = await db.dati_azienda.find_one({}, {"_id": 0})
        return doc or {}

    @r.put("/dati-azienda")
    async def update_dati(body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None)
        await db.dati_azienda.update_one({}, {"$set": body}, upsert=True)
        doc = await db.dati_azienda.find_one({}, {"_id": 0})
        return doc

    # ---------- Impostazioni ----------
    @r.get("/impostazioni")
    async def get_imp(user=Depends(get_current_user)):
        await ensure_global_seeds()
        doc = await db.impostazioni.find_one({}, {"_id": 0})
        return doc or {}

    @r.put("/impostazioni")
    async def update_imp(body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None)
        await db.impostazioni.update_one({}, {"$set": body}, upsert=True)
        doc = await db.impostazioni.find_one({}, {"_id": 0})
        return doc

    # ---------- Subappaltatori / Fornitori ----------
    class SubappIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        tipo: str = "subappaltatore"  # or "fornitore"
        nome: str
        categoria: Optional[str] = None
        telefono: Optional[str] = None
        email: Optional[str] = None
        attivo: bool = True

    @r.get("/subappaltatori")
    async def list_sub(tipo: Optional[str] = None, user=Depends(get_current_user)):
        q = {"tipo": tipo} if tipo else {}
        docs = await db.subappaltatori.find(q, {"_id": 0}).to_list(500)
        for d in docs:
            d["num_cantieri"] = await db.commesse.count_documents({"subappaltatori_ids": d["id"]})
        return docs

    @r.post("/subappaltatori")
    async def create_sub(body: SubappIn, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        doc = body.model_dump()
        doc["id"] = f"sub-{uuid.uuid4().hex[:8]}"
        doc["created_at"] = now_iso()
        await db.subappaltatori.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.put("/subappaltatori/{sub_id}")
    async def update_sub(sub_id: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None); body.pop("id", None)
        await db.subappaltatori.update_one({"id": sub_id}, {"$set": body})
        return {"ok": True}

    @r.delete("/subappaltatori/{sub_id}")
    async def delete_sub(sub_id: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        await db.subappaltatori.delete_one({"id": sub_id})
        return {"ok": True}

    # ---------- Venditori (list users with role venditore) ----------
    @r.get("/venditori")
    async def list_venditori(user=Depends(get_current_user)):
        users = await db.users.find({"role": "venditore"}, {"_id": 0, "password_hash": 0}).to_list(200)
        for u in users:
            u["preventivi"] = await db.preventivi.count_documents({"venditore_id": u["id"]})
            u["commesse"] = await db.commesse.count_documents({"venditore_id": u["id"]})
        return users

    # ---------- Users management (admin) ----------
    @r.get("/users")
    async def list_users(user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)

    class UserRoleUpdate(BaseModel):
        role: str

    @r.put("/users/{user_id}/role")
    async def set_role(user_id: str, body: UserRoleUpdate, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        if body.role not in ("admin", "venditore", "cliente", "subappaltatore", "user"):
            raise HTTPException(400, "Ruolo non valido")
        await db.users.update_one({"id": user_id}, {"$set": {"role": body.role}})
        return {"ok": True}

    # ---------- Configurazioni riferimento ----------
    @r.get("/composite-sections")
    async def composite(user=Depends(get_current_user)):
        return COMPOSITE_SECTIONS

    @r.get("/infissi-config")
    async def infissi_conf(user=Depends(get_current_user)):
        return {"tipologie": INFISSI_TIPOLOGIE, "materiali": INFISSI_MATERIALI, "vetri": INFISSI_VETRI}

    @r.get("/bagno-config")
    async def bagno_conf(user=Depends(get_current_user)):
        return {"tiers": BATHROOM_TIERS, "manodopera_base": BATHROOM_MANODOPERA_BASE}

    # ---------- Commesse ----------
    class CommessaIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        preventivo_id: str

    async def next_commessa_number() -> str:
        now = datetime.now(timezone.utc)
        count = await db.commesse.count_documents({}) + 1
        suffix = uuid.uuid4().hex[:4].upper()
        return f"COM-{now.year}{now.month:02d}-{suffix}"

    @r.post("/commesse")
    async def create_commessa(body: CommessaIn, user=Depends(get_current_user)):
        prev = await db.preventivi.find_one({"id": body.preventivo_id}, {"_id": 0})
        if not prev:
            raise HTTPException(404, "Preventivo non trovato")
        fasi = await db.fasi_commessa.find({}, {"_id": 0}).sort("order", 1).to_list(200)
        checklist = [
            {"fase_id": f["id"], "order": f["order"], "name": f["name"], "description": f["description"],
             "has_doc": f.get("has_doc", False), "completata": False, "data_completamento": None}
            for f in fasi
        ]
        doc = {
            "id": str(uuid.uuid4()),
            "numero": await next_commessa_number(),
            "preventivo_id": prev["id"],
            "cliente": prev.get("cliente"),
            "mq": prev.get("mq"),
            "package_id": prev.get("package_id"),
            "totale_preventivo": prev.get("totale_iva_incl") or 0,
            "fatturato": 0,
            "incassato": 0,
            "stato": "da_iniziare",
            "avanzamento_pct": 0,
            "checklist": checklist,
            "materiali": [],
            "voci_acquisti": [],
            "documenti": [],
            "venditore_id": prev.get("venditore_id"),
            "subappaltatori_ids": [],
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "data_inizio": None,
            "data_fine": None,
        }
        await db.commesse.insert_one(doc)
        await db.preventivi.update_one({"id": prev["id"]}, {"$set": {"commessa_id": doc["id"]}})
        doc.pop("_id", None)
        return doc

    @r.get("/commesse")
    async def list_commesse(user=Depends(get_current_user)):
        q = {}
        if user.get("role") == "cliente":
            q = {"cliente.user_id": user["id"]}
        elif user.get("role") == "subappaltatore":
            q = {"subappaltatori_ids": user["id"]}
        docs = await db.commesse.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
        return docs

    @r.get("/commesse/{cid}")
    async def get_commessa(cid: str, user=Depends(get_current_user)):
        doc = await db.commesse.find_one({"id": cid}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Commessa non trovata")
        return doc

    @r.put("/commesse/{cid}")
    async def update_commessa(cid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        body.pop("_id", None); body.pop("id", None)
        body["updated_at"] = now_iso()
        if "checklist" in body:
            total = len(body["checklist"]) or 1
            done = sum(1 for x in body["checklist"] if x.get("completata"))
            body["avanzamento_pct"] = round(done / total * 100, 1)
        await db.commesse.update_one({"id": cid}, {"$set": body})
        doc = await db.commesse.find_one({"id": cid}, {"_id": 0})
        return doc

    @r.patch("/commesse/{cid}/stato")
    async def update_commessa_stato(cid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        stato = body.get("stato")
        if stato not in ("da_iniziare", "in_corso", "completata", "sospesa"):
            raise HTTPException(400, "Stato non valido")
        upd = {"stato": stato, "updated_at": now_iso()}
        if stato == "in_corso" and not (await db.commesse.find_one({"id": cid}, {"data_inizio": 1})).get("data_inizio"):
            upd["data_inizio"] = now_iso()
        if stato == "completata":
            upd["data_fine"] = now_iso()
        await db.commesse.update_one({"id": cid}, {"$set": upd})
        return {"ok": True, "stato": stato}

    # ---------- Leads (CRM) ----------
    class LeadIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        nome: str
        cognome: Optional[str] = ""
        telefono: Optional[str] = ""
        email: Optional[str] = ""
        indirizzo: Optional[str] = ""
        citta: Optional[str] = ""
        mq: Optional[float] = 0
        tipo_immobile: Optional[str] = "Appartamento"
        anno_costruzione: Optional[int] = None
        piano: Optional[str] = ""
        tipo_muri: Optional[str] = "Muri portanti"
        stato_impianti: Optional[str] = "Da rifare"
        ascensore: Optional[bool] = False
        note: Optional[str] = ""
        esigenze: Optional[List[Dict[str, Any]]] = []
        pacchetto_consigliato: Optional[str] = None
        stato: Optional[str] = "nuovo"  # nuovo/contattato/preventivo/vinto/perso
        venditore_id: Optional[str] = None

    @r.get("/leads")
    async def list_leads(user=Depends(get_current_user)):
        return await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    @r.post("/leads")
    async def create_lead(body: LeadIn, user=Depends(get_current_user)):
        doc = body.model_dump()
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = now_iso()
        doc["updated_at"] = now_iso()
        await db.leads.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.put("/leads/{lid}")
    async def update_lead(lid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        body.pop("_id", None); body.pop("id", None)
        body["updated_at"] = now_iso()
        await db.leads.update_one({"id": lid}, {"$set": body})
        return {"ok": True}

    @r.delete("/leads/{lid}")
    async def delete_lead(lid: str, user=Depends(get_current_user)):
        await db.leads.delete_one({"id": lid})
        return {"ok": True}

    return r
