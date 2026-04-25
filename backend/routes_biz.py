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
        from packages_seed import DEFAULT_PACKAGES, DEFAULT_OPTIONAL
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
        if await db.packages.count_documents({}) == 0:
            for p in DEFAULT_PACKAGES:
                doc = {"id": p["id"], "name": p["name"], "subtitle": p["subtitle"],
                       "price_per_m2": p["price_per_m2"], "color": p["color"], "description": p["description"],
                       "items": [{"voce_id": vid, "qty_ratio": meta["qty_ratio"], "unit_price_pkg": meta["unit_price_pkg"]} for vid, meta in p["included"].items()]}
                await db.packages.insert_one(doc)
        if await db.optional_pkg.count_documents({}) == 0:
            await db.optional_pkg.insert_many([dict(o) for o in DEFAULT_OPTIONAL])

    # ---------- Packages CRUD ----------
    @r.post("/packages")
    async def create_pkg(body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None)
        if not body.get("id"):
            body["id"] = f"pkg-{uuid.uuid4().hex[:8]}"
        body.setdefault("items", [])
        await db.packages.insert_one(body)
        body.pop("_id", None)
        return body

    @r.put("/packages/{pid}")
    async def update_pkg(pid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None); body.pop("id", None)
        await db.packages.update_one({"id": pid}, {"$set": body})
        doc = await db.packages.find_one({"id": pid}, {"_id": 0})
        return doc

    @r.delete("/packages/{pid}")
    async def delete_pkg(pid: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        await db.packages.delete_one({"id": pid})
        return {"ok": True}

    # ---------- Sync voci → packages (NO-OP: i prezzi sono ora SEMPRE live dal backoffice) ----------
    @r.post("/voci-backoffice/sync")
    async def sync_voci(user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        # I prezzi vengono ora calcolati live dal backoffice — questo endpoint è solo per compatibilità.
        return {"ok": True, "packages_updated": 0, "message": "I prezzi sono già aggiornati automaticamente"}

    # ---------- Optional CRUD ----------
    @r.get("/optional")
    async def list_optional_pkg(package_id: Optional[str] = None, user=Depends(get_current_user)):
        await ensure_global_seeds()
        q = {}
        if package_id:
            q = {"package_ids": package_id}
        return await db.optional_pkg.find(q, {"_id": 0}).to_list(500)

    @r.post("/optional")
    async def create_optional(body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None)
        if not body.get("id"):
            body["id"] = f"opt-{uuid.uuid4().hex[:8]}"
        body.setdefault("package_ids", [])
        await db.optional_pkg.insert_one(body)
        body.pop("_id", None)
        return body

    @r.put("/optional/{oid}")
    async def update_optional(oid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None); body.pop("id", None)
        await db.optional_pkg.update_one({"id": oid}, {"$set": body})
        return {"ok": True}

    @r.delete("/optional/{oid}")
    async def delete_optional(oid: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        await db.optional_pkg.delete_one({"id": oid})
        return {"ok": True}

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
        # Sort: DEMOLIZIONE first, then MURATURA, IMPIANTI, INFISSI, SERVIZI
        cat_order = {"MURATURA": 2, "IMPIANTI": 3, "INFISSI": 4, "SERVIZI": 5}
        def keyf(v):
            n = (v.get("name") or "").lower()
            is_demo = ("demoliz" in n) or ("smaltim" in n) or ("rimoz" in n)
            primary = 1 if is_demo else cat_order.get(v.get("category"), 9)
            return (primary, v.get("category", ""), v.get("name", ""))
        docs.sort(key=keyf)
        return docs

    class VoceIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        category: str
        name: str
        prezzo_acquisto: float
        ricarico: float
        unit: str
        modificabile_dal_venditore: Optional[bool] = False
        soglia_inclusa: Optional[float] = None  # prezzo unitario sotto al quale è incluso nel pacchetto, sopra diventa extra

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

    @r.post("/voci-backoffice/bulk-import")
    async def bulk_import_voci(body: Dict[str, Any], user=Depends(get_current_user)):
        """CSV header: name,category,unit,prezzo_acquisto,ricarico (id optional).
        Categorie ammesse: MURATURA / IMPIANTI / INFISSI / SERVIZI."""
        import csv as _csv, io as _io
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        text = body.get("csv", "")
        if not text.strip():
            raise HTTPException(400, "CSV vuoto")
        reader = _csv.DictReader(_io.StringIO(text))
        rows = []
        for r in reader:
            if not r.get("name"):
                continue
            cat = (r.get("category") or "MURATURA").upper().strip()
            if cat not in ("MURATURA", "IMPIANTI", "INFISSI", "SERVIZI"):
                cat = "MURATURA"
            rows.append({
                "id": (r.get("id") or "").strip() or f"voce-{uuid.uuid4().hex[:8]}",
                "name": r["name"].strip(),
                "category": cat,
                "unit": (r.get("unit") or "pz").strip(),
                "prezzo_acquisto": float(r.get("prezzo_acquisto") or 0),
                "ricarico": float(r.get("ricarico") or 1.8),
            })
        if not rows:
            raise HTTPException(400, "Nessuna riga valida")
        if body.get("replace"):
            await db.voci_backoffice.delete_many({})
        await db.voci_backoffice.insert_many(rows)
        return {"ok": True, "imported": len(rows)}

    @r.post("/voci-backoffice/seed-missing")
    async def seed_missing_voci(user=Depends(get_current_user)):
        """Aggiunge le voci default mancanti senza toccare quelle esistenti."""
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        existing_ids = {v["id"] async for v in db.voci_backoffice.find({}, {"id": 1})}
        existing_names = {v["name"].strip().lower() async for v in db.voci_backoffice.find({}, {"name": 1})}
        added = []
        for v in DEFAULT_VOCI_BACKOFFICE:
            if v["id"] in existing_ids: continue
            if v["name"].strip().lower() in existing_names: continue
            await db.voci_backoffice.insert_one(dict(v))
            added.append(v["name"])
        return {"ok": True, "added": added, "count": len(added)}

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

    @r.post("/fasi-commessa/reorder")
    async def reorder_fasi(body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        ids = body.get("ordered_ids") or []
        for idx, fid in enumerate(ids):
            await db.fasi_commessa.update_one({"id": fid}, {"$set": {"order": idx + 1}})
        return {"ok": True, "updated": len(ids)}

    @r.post("/fasi-commessa")
    async def create_fase(body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None)
        if not body.get("id"):
            body["id"] = f"fase-{uuid.uuid4().hex[:8]}"
        if not body.get("order"):
            body["order"] = await db.fasi_commessa.count_documents({}) + 1
        body.setdefault("has_doc", False)
        body.setdefault("obbligatoria", True)
        body.setdefault("description", "")
        await db.fasi_commessa.insert_one(body)
        body.pop("_id", None)
        return body

    @r.delete("/fasi-commessa/{fase_id}")
    async def delete_fase(fase_id: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        await db.fasi_commessa.delete_one({"id": fase_id})
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
        # Only admin/venditore can convert preventivi into commesse, and preventivo must be theirs (unless admin)
        if user.get("role") not in ("admin", "venditore"):
            raise HTTPException(403, "Solo admin o venditore possono creare commesse")
        q = {"id": body.preventivo_id}
        if user.get("role") != "admin":
            q["user_id"] = user["id"]
        prev = await db.preventivi.find_one(q, {"_id": 0})
        if not prev:
            raise HTTPException(404, "Preventivo non trovato")
        fasi = await db.fasi_commessa.find({}, {"_id": 0}).sort("order", 1).to_list(200)
        checklist = [
            {"fase_id": f["id"], "order": f["order"], "name": f["name"], "description": f["description"],
             "has_doc": f.get("has_doc", False), "completata": False, "data_completamento": None}
            for f in fasi
        ]
        # Se il preventivo contiene infissi (PreventivoInfissi o extras infissi nel pacchetto),
        # aggiungi la voce specifica "Conferma misure dopo rilievo" PRIMA della produzione
        has_infissi = (
            prev.get("tipo") == "infissi"
            or any(it.get("from_infissi") or "Infisso" in (it.get("name") or "") or "infisso" in (it.get("name") or "").lower() for it in (prev.get("items") or []))
            or len(prev.get("infissi_extras") or []) > 0
        )
        if has_infissi:
            misure_originali = []
            for it in (prev.get("items") or []):
                if it.get("from_infissi") and it.get("infisso_meta"):
                    m = it["infisso_meta"]
                    misure_originali.append({
                        "id": str(uuid.uuid4()),
                        "descrizione": it.get("name"),
                        "L_originale": m.get("larghezza"), "H_originale": m.get("altezza"),
                        "L_definitiva": None, "H_definitiva": None,
                        "tolleranza_pct": None, "stato": "da_rilevare",
                    })
            for ext in (prev.get("infissi_extras") or []):
                m = ext.get("infisso_meta") or {}
                misure_originali.append({
                    "id": str(uuid.uuid4()),
                    "descrizione": ext.get("name"),
                    "L_originale": m.get("larghezza"), "H_originale": m.get("altezza"),
                    "L_definitiva": None, "H_definitiva": None,
                    "tolleranza_pct": None, "stato": "da_rilevare",
                })
            insert_pos = next((i for i, c in enumerate(checklist) if "produzione" in (c.get("name") or "").lower() or "ordine" in (c.get("name") or "").lower()), len(checklist))
            checklist.insert(insert_pos, {
                "fase_id": "rilievo-misure",
                "order": insert_pos,
                "name": "Conferma rilievo misure infissi",
                "description": "Verifica le misure rilevate sul posto. Tolleranza ±5% accettata, 5-8% richiede conferma, >8% blocca produzione.",
                "has_doc": True,
                "completata": False,
                "data_completamento": None,
                "rilievo_misure": misure_originali,
            })
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
        existing = await db.commesse.find_one({"id": cid}, {"_id": 0, "data_inizio": 1})
        if not existing:
            raise HTTPException(404, "Commessa non trovata")
        upd = {"stato": stato, "updated_at": now_iso()}
        if stato == "in_corso" and not existing.get("data_inizio"):
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

    @r.post("/leads/ai-suggest")
    async def ai_suggest(body: Dict[str, Any], user=Depends(get_current_user)):
        """Genera con AI un consiglio personalizzato per il lead.
        Body: {nome, mq, esigenze: [{key,val}], pacchetto_consigliato}
        """
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import os
        key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not key:
            return {"ok": False, "text": "AI non configurata"}
        try:
            esig = "\n".join([f"- {e.get('key')}: {e.get('val')}" for e in (body.get("esigenze") or [])])
            prompt = f"""Sei un consulente di ristrutturazioni esperto e amichevole.
Cliente: {body.get('nome', 'N/D')}
Superficie: {body.get('mq', 0)} mq
Pacchetto consigliato: {body.get('pacchetto_consigliato', 'N/D')}

Esigenze rilevate:
{esig}

In 4-5 righe scrivi un messaggio personalizzato, caldo e professionale che:
1. Saluti il cliente per nome
2. Spieghi PERCHÉ il pacchetto consigliato è perfetto per la sua situazione
3. Menzioni 2-3 vantaggi concreti per le sue esigenze specifiche
4. Inviti a prendere appuntamento per un sopralluogo gratuito

Tono: amichevole, italiano, mai corporate. Niente saluti formali tipo 'Gentile'.
"""
            chat = LlmChat(api_key=key, session_id=f"lead-{uuid.uuid4().hex[:8]}",
                          system_message="Sei un consulente di ristrutturazioni amichevole.").with_model("gemini", "gemini-2.5-flash")
            resp = await chat.send_message(UserMessage(text=prompt))
            return {"ok": True, "text": str(resp)}
        except Exception as e:
            return {"ok": False, "text": f"Errore AI: {e}"}

    return r
