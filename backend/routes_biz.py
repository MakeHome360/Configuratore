"""
Business routes: leads, commesse, fasi, subappaltatori, negozi, voci backoffice,
dati azienda, impostazioni, template email, solo bagno, composite, infissi, dashboard.
Attached to the existing `api` router in server.py.
"""
import secrets
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, ConfigDict, EmailStr
from audit import audit_log

logger = logging.getLogger(__name__)

from packages_seed import (
    DEFAULT_VOCI_BACKOFFICE, DEFAULT_FASI_COMMESSA, DEFAULT_TEMPLATE_EMAIL,
    DEFAULT_NEGOZI, DEFAULT_IMPOSTAZIONI, DEFAULT_DATI_AZIENDA,
    COMPOSITE_SECTIONS, INFISSI_TIPOLOGIE, INFISSI_MATERIALI, INFISSI_VETRI,
    BATHROOM_TIERS, BATHROOM_MANODOPERA_BASE,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# Item base inclusi in ciascun tier bagno (sanitari + rubinetteria completa)
_SANITARI_TIER_BASE = [
    "Vaso WC sospeso",
    "Tavoletta WC soft-close",
    "Bidet sospeso",
    "Lavabo (no mobile)",
    "Piatto doccia",
    "Box doccia in cristallo",
    "Miscelatore doccia",
    "Miscelatore bidet",
    "Miscelatore lavabo",
]

def _default_included_items(tier_name: str) -> List[str]:
    """Ritorna gli item inclusi in un tier bagno (identici per Silver/Gold/Platinum, cambia la gamma qualitativa)."""
    suffix = {
        "SILVER": " (linea Standard)",
        "GOLD": " (linea Premium)",
        "PLATINUM": " (linea Luxury)",
    }.get(tier_name.upper(), "")
    return [f"{it}{suffix}" for it in _SANITARI_TIER_BASE]


def build_biz_router(db, get_current_user, hash_password=None, seed_user_catalog=None, compute_expires_at=None):
    r = APIRouter()
    # Fallback defaults if deps not provided (keeps backward compat)
    if hash_password is None:
        from passlib.context import CryptContext
        _pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        def hash_password(pwd): return _pwd.hash(pwd)  # noqa
    if seed_user_catalog is None:
        async def seed_user_catalog(_uid): return  # noqa
    if compute_expires_at is None:
        def compute_expires_at(_role, override=None): return override  # noqa

    # ---------- Seeds helpers ----------
    async def ensure_global_seeds():
        from packages_seed import DEFAULT_PACKAGES, DEFAULT_OPTIONAL
        if await db.voci_backoffice.count_documents({}) == 0:
            await db.voci_backoffice.insert_many([dict(v) for v in DEFAULT_VOCI_BACKOFFICE])
        else:
            # Backfill: aggiunge voci nuove (per id) anche se la collection è già popolata
            existing_ids = {d["id"] for d in await db.voci_backoffice.find({}, {"id": 1, "_id": 0}).to_list(5000)}
            missing = [dict(v) for v in DEFAULT_VOCI_BACKOFFICE if v.get("id") and v["id"] not in existing_ids]
            if missing:
                await db.voci_backoffice.insert_many(missing)
            # R87 MIGRATION: imposta subcategory sulle voci INFISSI esistenti senza il campo
            # Esterni (configuratore): tutte le voci con "esterni" nel nome o di tipo infissi/tapparelle/zanzariere/pellicolatura
            await db.voci_backoffice.update_many(
                {"category": "INFISSI", "subcategory": {"$exists": False},
                 "$or": [
                    {"name": {"$regex": "(esterni|tapparell|zanzarier|pellicolatur|griglia)", "$options": "i"}},
                    {"id": {"$in": ["voce-infissi-pvc", "voce-infissi-alluminio", "voce-infissi-legno",
                                    "voce-zanzariere", "voce-tapparelle", "voce-griglia-al", "voce-pellicolatura-pvc"]}},
                 ]},
                {"$set": {"subcategory": "esterno"}},
            )
            # Interni (default per il resto degli INFISSI): porte, pannelli blindata, cornici
            await db.voci_backoffice.update_many(
                {"category": "INFISSI", "subcategory": {"$exists": False}},
                {"$set": {"subcategory": "interno"}},
            )
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
        # R89 ter: ensure voce "Manodopera Bagno" esiste (usata dal preventivo Bagno + tab admin)
        existing_man = await db.voci_backoffice.find_one({"name": {"$regex": r"^\s*Manodopera\s+Bagno", "$options": "i"}})
        if not existing_man:
            await db.voci_backoffice.insert_one({
                "id": "voce-manodopera-bagno",
                "category": "IMPIANTI",
                "name": "Manodopera Bagno",
                "unit": "forfait",
                "prezzo_acquisto": 3000,
                "ricarico": 2.166667,
                "margine_eur": 3500,
                "margine_pct": 53.8,
                "prezzo_rivendita": 6500,
                "cad_category": "SANITARI",
                "cad_kind": "san.manodopera",
                "modificabile_dal_venditore": False,
                "soglia_inclusa": None,
            })
            print("[SEED] Inserita voce 'Manodopera Bagno' @ €6.500")

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
        # Filtro: admin vede tutto, gli altri ruoli vedono solo i propri dati
        is_admin = user.get("role") == "admin"
        prev_q = {} if is_admin else {"user_id": user["id"]}
        com_q = {} if is_admin else {"venditore_id": user["id"]}
        prev_total = await db.preventivi.count_documents(prev_q)
        prev_ok = await db.preventivi.count_documents({**prev_q, "stato": "accettato"})
        com_attive = await db.commesse.count_documents({**com_q, "stato": {"$in": ["in_corso", "da_iniziare"]}})
        fatturato = 0.0
        async for c in db.commesse.find(com_q, {"_id": 0, "fatturato": 1}):
            fatturato += float(c.get("fatturato") or 0)
        per_pkg = {}
        async for p in db.preventivi.find(prev_q, {"_id": 0, "package_id": 1, "tipo": 1}):
            pid = p.get("package_id") or "other"
            per_pkg[pid] = per_pkg.get(pid, 0) + 1
        stati_comm = {}
        async for c in db.commesse.find(com_q, {"_id": 0, "stato": 1}):
            s = c.get("stato") or "da_iniziare"
            stati_comm[s] = stati_comm.get(s, 0) + 1
        ultimi_prev = await db.preventivi.find(prev_q, {"_id": 0}).sort("created_at", -1).to_list(5)
        ultime_com = await db.commesse.find(com_q, {"_id": 0}).sort("created_at", -1).to_list(5)
        return {
            "preventivi_totali": prev_total,
            "preventivi_approvati": prev_ok,
            "commesse_attive": com_attive,
            "fatturato_totale": fatturato,
            "per_pacchetto": per_pkg,
            "stati_commesse": stati_comm,
            "ultimi_preventivi": ultimi_prev,
            "ultime_commesse": ultime_com,
            "scope": "all" if is_admin else "own",
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
        role = user.get("role")
        vl = (user.get("venditore_level") or "").lower()
        # Admin sempre; gestore (project manager) sempre; venditore solo se livello "responsabile" o "area_manager"
        allowed = (role == "admin") or (role == "gestore") or (role == "venditore" and vl in ("responsabile", "area_manager"))
        if not allowed:
            raise HTTPException(403, "Solo admin / gestore / venditore-responsabile")
        doc = body.model_dump()
        doc["id"] = f"voce-{uuid.uuid4().hex[:8]}"
        doc["created_by"] = user.get("id")
        doc["created_at"] = now_iso()
        await db.voci_backoffice.insert_one(doc)
        doc.pop("_id", None)
        await audit_log(db, user=user, action="create", entity="voce_backoffice", entity_id=doc["id"],
                        description=f"Creata voce backoffice: {doc.get('name')} ({doc.get('category')})",
                        after={"name": doc.get("name"), "category": doc.get("category"), "prezzo_rivendita": doc.get("prezzo_rivendita")})
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

    @r.post("/voci-backoffice/migrate-pavimentazione")
    async def migrate_pavimentazione_categories(user=Depends(get_current_user)):
        """Splitta le voci pavimentazione fuori da MURATURA in categorie dedicate:
        PAVIMENTAZIONE_GRES / PAVIMENTAZIONE_PARQUET / PAVIMENTAZIONE_LAMINATO / PAVIMENTAZIONE_MARMO / RIVESTIMENTO_PIASTRELLE.
        Aggiorna anche modificabile_dal_venditore=True (sono materiali).
        """
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        # Mappa esplicita id → categoria (più sicura del pattern matching su nome)
        mapping = {
            "voce-parquet": "PAVIMENTAZIONE_PARQUET",
            "voce-parquet-rovere-pl": "PAVIMENTAZIONE_PARQUET",
            "voce-parquet-noce-spina": "PAVIMENTAZIONE_PARQUET",
            "voce-laminato-ac4": "PAVIMENTAZIONE_LAMINATO",
            "voce-pvc-effetto-legno": "PAVIMENTAZIONE_LAMINATO",
            "voce-gres-cemento-60x60": "PAVIMENTAZIONE_GRES",
            "voce-gres-marmo-60x120": "PAVIMENTAZIONE_GRES",
            "voce-gres-legno-22x90": "PAVIMENTAZIONE_GRES",
            "voce-gres-pietra-80x80": "PAVIMENTAZIONE_GRES",
            "voce-gres-mono-30x60": "PAVIMENTAZIONE_GRES",
            "voce-marmo-naturale-25x150": "PAVIMENTAZIONE_MARMO",
            "voce-piast-mosaico-bagno": "RIVESTIMENTO_PIASTRELLE",
            "voce-piast-cucina-10x10": "RIVESTIMENTO_PIASTRELLE",
            "voce-piast-bagno-25x40": "RIVESTIMENTO_PIASTRELLE",
        }
        updated = []
        for vid, cat in mapping.items():
            res = await db.voci_backoffice.update_one(
                {"id": vid},
                {"$set": {"category": cat, "modificabile_dal_venditore": True}}
            )
            if res.modified_count > 0:
                updated.append({"id": vid, "category": cat})
        return {"ok": True, "updated": updated, "count": len(updated)}

    @r.post("/voci-backoffice/migrate-cad-categories")
    async def migrate_cad_categories(user=Depends(get_current_user)):
        """Assegna cad_category alle voci esistenti in base a category/name pattern.
        Categorie CAD: DEMOLIZIONI, COSTRUZIONI, ELETTRICO, TERMO_IDRAULICO, INFISSI, SANITARI, EXTRA
        """
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        all_voci = await db.voci_backoffice.find({}, {"_id": 0}).to_list(2000)
        updated = 0
        for v in all_voci:
            n = (v.get("name") or "").lower()
            cat = v.get("category", "")
            cad_cat = None
            cad_kind = None
            # DEMOLIZIONI
            if "demoliz" in n:
                cad_cat = "DEMOLIZIONI"
                if "muri" in n: cad_kind = "demoliz.muro"
                elif "pavim" in n: cad_kind = "demoliz.pavimento"
                elif "rivest" in n: cad_kind = "demoliz.rivestimento"
                elif "controsoff" in n: cad_kind = "demoliz.controsoffitto"
                else: cad_kind = "demoliz.generica"
            # COSTRUZIONI (muri/pavimenti/controsoffitto/finiture)
            elif any(s in n for s in ("muro", "cartongesso", "controparete", "controsoffitto", "battiscopa", "decoraz",
                                        "piastrelle", "posa", "massetto", "parquet", "pavimento", "rasatura",
                                        "pittura", "intonaco", "stucco", "velette", "rivestim")):
                cad_cat = "COSTRUZIONI"
                if "muro mattone" in n: cad_kind = "costr.muro_mattone"
                elif "cartongesso" in n: cad_kind = "costr.muro_cartongesso"
                elif "controsoff" in n or "controparete" in n: cad_kind = "costr.controsoffitto"
                elif "parquet" in n: cad_kind = "costr.parquet"
                elif "piastrelle pavim" in n: cad_kind = "costr.piastrelle_pav"
                elif "piastrelle rivest" in n: cad_kind = "costr.piastrelle_riv"
                elif "pavimento pvc" in n or "laminato" in n: cad_kind = "costr.pvc"
                elif "battiscopa" in n: cad_kind = "costr.battiscopa"
                elif "pittura" in n: cad_kind = "costr.pittura"
                elif "rasatura" in n: cad_kind = "costr.rasatura"
                elif "massetto" in n: cad_kind = "costr.massetto"
                elif "intonaco" in n: cad_kind = "costr.intonaco"
                else: cad_kind = "costr.generica"
            # ELETTRICO
            elif any(s in n for s in ("elettrico", "punto luce", "punto presa", "punto interruttore",
                                        "quadro", "tv ", "dati", "citofon", "antenn", "led")):
                cad_cat = "ELETTRICO"
                if "completo" in n or "appartamento" in n: cad_kind = "elec.impianto_mq"
                elif "luce" in n: cad_kind = "elec.luce"
                elif "presa" in n: cad_kind = "elec.presa"
                elif "interruttore" in n: cad_kind = "elec.interruttore"
                elif "quadro" in n: cad_kind = "elec.quadro"
                elif "tv" in n or "antenn" in n: cad_kind = "elec.tv"
                elif "dati" in n or "rete" in n: cad_kind = "elec.dati"
                elif "citofon" in n: cad_kind = "elec.citofono"
                else: cad_kind = "elec.generico"
            # TERMO_IDRAULICO (riscaldamento + climatizzazione + idraulico bagno)
            elif any(s in n for s in ("idraulico", "punto acqua", "punto scarico", "punto gas",
                                        "radiator", "termosif", "termoarredo", "pavimento", "soffitto rad",
                                        "caldai", "pompa di calor", "scaldabagn", "boiler",
                                        "climatizz", "split", "canalizz", "vmc", "ventilaz",
                                        "fotovolta", "predispos", "unit\u00e0 esterna", "unita esterna", "ue")):
                cad_cat = "TERMO_IDRAULICO"
                if "completo" in n and "idraul" in n: cad_kind = "termo.impianto_mq"
                elif "punto acqua" in n: cad_kind = "termo.punto_acqua"
                elif "punto scarico" in n: cad_kind = "termo.punto_scarico"
                elif "punto gas" in n: cad_kind = "termo.punto_gas"
                elif "pavimento" in n and ("radiant" in n or "riscald" in n): cad_kind = "termo.pavimento_radiante"
                elif "soffitto" in n and ("radiant" in n or "riscald" in n): cad_kind = "termo.soffitto_radiante"
                elif "collettore" in n: cad_kind = "termo.collettore"
                elif "radiator" in n or "termosif" in n: cad_kind = "termo.termosifone"
                elif "termoarredo" in n: cad_kind = "termo.termoarredo"
                elif "caldai" in n and "ibrid" in n: cad_kind = "termo.caldaia_ibrida"
                elif "caldai" in n: cad_kind = "termo.caldaia"
                elif "pompa di calor" in n: cad_kind = "termo.pompa_calore"
                elif "scaldabagn" in n or "boiler" in n: cad_kind = "termo.scaldabagno"
                elif "fotovolta" in n: cad_kind = "termo.fotovoltaico"
                elif "vmc" in n or "ventilaz" in n: cad_kind = "termo.vmc"
                elif "canalizz" in n: cad_kind = "termo.canalizzato"
                elif "trial" in n: cad_kind = "termo.trial_split"
                elif "dual" in n: cad_kind = "termo.dual_split"
                elif "mono" in n: cad_kind = "termo.mono_split"
                elif "predispos" in n: cad_kind = "termo.predisposizione"
                elif "unit" in n and ("esterna" in n or " ue" in n) or n.endswith("(ue)"): cad_kind = "termo.unita_esterna"
                else: cad_kind = "termo.generico"
            # INFISSI
            elif any(s in n for s in ("infiss", "porta", "porte interne", "blinda", "zanzariere",
                                        "tapparell", "griglia", "cornice")):
                cad_cat = "INFISSI"
                if "blinda" in n: cad_kind = "inf.porta_blindata"
                elif "porte interne" in n: cad_kind = "inf.porte_interne"
                elif "infissi pvc" in n: cad_kind = "inf.pvc"
                elif "infissi alluminio" in n: cad_kind = "inf.alluminio"
                elif "infissi legno" in n: cad_kind = "inf.legno"
                elif "zanzar" in n: cad_kind = "inf.zanzariera"
                elif "tapparell" in n: cad_kind = "inf.tapparella"
                elif "griglia" in n: cad_kind = "inf.griglia"
                else: cad_kind = "inf.generico"
            # SANITARI / ARREDI
            elif any(s in n for s in ("sanitari", "wc", "bidet", "lavabo", "box doccia", "mobile bagno", "vasca")):
                cad_cat = "SANITARI"
                if "sanitari" in n: cad_kind = "san.sanitari"
                elif "box doccia" in n: cad_kind = "san.box_doccia"
                elif "mobile bagno" in n: cad_kind = "san.mobile_bagno"
                else: cad_kind = "san.generico"
            else:
                cad_cat = "EXTRA"
                cad_kind = "extra.generico"
            patch = {}
            if v.get("cad_category") != cad_cat: patch["cad_category"] = cad_cat
            if v.get("cad_kind") != cad_kind: patch["cad_kind"] = cad_kind
            if patch:
                await db.voci_backoffice.update_one({"id": v["id"]}, {"$set": patch})
                updated += 1
        return {"ok": True, "updated": updated, "categorie": ["DEMOLIZIONI", "COSTRUZIONI", "ELETTRICO", "TERMO_IDRAULICO", "INFISSI", "SANITARI", "EXTRA"]}

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

    @r.get("/negozi/{neg_id}")
    async def get_negozio(neg_id: str, user=Depends(get_current_user)):
        doc = await db.negozi.find_one({"id": neg_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Negozio non trovato")
        return doc

    @r.get("/negozi/{neg_id}/dashboard")
    async def negozio_dashboard(neg_id: str, user=Depends(get_current_user)):
        """Dashboard negozio: venditori che lavorano nel negozio + performance individuali."""
        neg = await db.negozi.find_one({"id": neg_id}, {"_id": 0})
        if not neg:
            raise HTTPException(404, "Negozio non trovato")
        # Venditori del negozio (campo `store_id` o `negozio_id` su user)
        venditori = await db.users.find(
            {"role": "venditore", "$or": [{"store_id": neg_id}, {"negozio_id": neg_id}]},
            {"_id": 0, "password_hash": 0},
        ).to_list(200)
        # Per ogni venditore calcola KPI
        from datetime import datetime as _dt, timedelta
        sett_fa = (_dt.now() - timedelta(days=7)).isoformat()
        mese_fa = (_dt.now() - timedelta(days=30)).isoformat()
        venditori_kpi = []
        for v in venditori:
            vid = v.get("id")
            lead_count = await db.leads.count_documents({"venditore_id": vid})
            lead_vinti = await db.leads.count_documents({"venditore_id": vid, "stato": "vinto"})
            prev_tot = await db.preventivi.count_documents({"venditore_id": vid})
            prev_mese = await db.preventivi.count_documents({"venditore_id": vid, "created_at": {"$gte": mese_fa}})
            com_attive = await db.commesse.count_documents({"venditore_id": vid, "stato": {"$nin": ["chiuso", "annullato", "concluso"]}})
            com_concluse = await db.commesse.count_documents({"venditore_id": vid, "stato": {"$in": ["chiuso", "concluso"]}})
            # Fatturato venduto = somma totale_iva_escl dei preventivi accettati
            cur = db.preventivi.find({"venditore_id": vid, "stato": "accettato"}, {"_id": 0, "totale_iva_escl": 1, "totale_iva_incl": 1})
            fatturato = 0.0
            async for p in cur:
                fatturato += float(p.get("totale_iva_escl") or p.get("totale_iva_incl") or 0)
            conv_rate = round((lead_vinti / lead_count * 100), 1) if lead_count > 0 else 0.0
            venditori_kpi.append({
                "id": vid,
                "name": v.get("name") or v.get("nome") or v.get("email"),
                "email": v.get("email"),
                "telefono": v.get("telefono"),
                "active": v.get("active", True),
                "kpi": {
                    "lead_count": lead_count,
                    "lead_vinti": lead_vinti,
                    "conversion_rate": conv_rate,
                    "preventivi_totali": prev_tot,
                    "preventivi_ultimo_mese": prev_mese,
                    "commesse_attive": com_attive,
                    "commesse_concluse": com_concluse,
                    "fatturato_venduto": round(fatturato, 2),
                },
            })
        # Aggregati negozio
        tot = {
            "lead_count": sum(v["kpi"]["lead_count"] for v in venditori_kpi),
            "lead_vinti": sum(v["kpi"]["lead_vinti"] for v in venditori_kpi),
            "preventivi_totali": sum(v["kpi"]["preventivi_totali"] for v in venditori_kpi),
            "commesse_attive": sum(v["kpi"]["commesse_attive"] for v in venditori_kpi),
            "commesse_concluse": sum(v["kpi"]["commesse_concluse"] for v in venditori_kpi),
            "fatturato_venduto": round(sum(v["kpi"]["fatturato_venduto"] for v in venditori_kpi), 2),
            "num_venditori": len(venditori_kpi),
            "num_venditori_attivi": sum(1 for v in venditori_kpi if v["active"]),
        }
        tot["conversion_rate"] = round((tot["lead_vinti"] / tot["lead_count"] * 100), 1) if tot["lead_count"] > 0 else 0.0
        return {"negozio": neg, "venditori": venditori_kpi, "totali": tot}

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
        doc = await db.impostazioni.find_one({}, {"_id": 0}) or {}
        # Backfill: garantisce che i nuovi campi (provvigioni) siano presenti per l'admin UI
        from packages_seed import DEFAULT_IMPOSTAZIONI as _DI
        missing = {k: v for k, v in _DI.items() if k not in doc}
        if missing:
            await db.impostazioni.update_one({}, {"$set": missing}, upsert=True)
            doc = await db.impostazioni.find_one({}, {"_id": 0}) or {}
        return doc

    @r.put("/impostazioni")
    async def update_imp(body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        body.pop("_id", None)
        before = await db.impostazioni.find_one({}, {"_id": 0})
        await db.impostazioni.update_one({}, {"$set": body}, upsert=True)
        doc = await db.impostazioni.find_one({}, {"_id": 0})
        await audit_log(db, user=user, action="update", entity="impostazioni", entity_id="global",
                        description="Aggiornate impostazioni aziendali",
                        before=before, after=body)
        return doc

    # ------- Calcolo marginalità (costi fissi globali + provvigione venditore) -------
    @r.post("/marginalita/calcola")
    async def calcola_marginalita(body: Dict[str, Any], user=Depends(get_current_user)):
        """Calcolo unificato della marginalità (per pacchetti, preventivi composite, commesse).
        Input: { totale_iva_escl, costi_diretti (somma materiali+lavorazioni), ruolo_venditore (semplice/responsabile/area_manager) }
        Output: { ricavo, costi_diretti, costi_fissi_breakdown[], provvigione_venditore,
                  totale_costi, utile_netto, margine_pct, margine_lordo, dettaglio[] }
        """
        await ensure_global_seeds()
        imp = await db.impostazioni.find_one({}, {"_id": 0}) or {}
        ricavo = float(body.get("totale_iva_escl") or 0)
        costi_diretti = float(body.get("costi_diretti") or 0)
        ruolo = (body.get("ruolo_venditore") or "semplice").lower()

        # 1) Costi fissi globali dalle impostazioni
        cfg_costi = imp.get("costi_fissi_globali") or []
        cf_breakdown = []
        cf_totale = 0.0
        for cf in cfg_costi:
            if not cf.get("attivo", True):
                continue
            valore_cfg = float(cf.get("valore") or 0)
            if cf.get("tipo") == "percentuale":
                importo = round(ricavo * valore_cfg / 100, 2)
            else:
                importo = valore_cfg
            cf_breakdown.append({
                "id": cf.get("id"),
                "nome": cf.get("nome"),
                "tipo": cf.get("tipo"),
                "valore_config": valore_cfg,
                "importo": importo,
            })
            cf_totale += importo

        # 2) Provvigione venditore (in base al ruolo)
        prov_map = {
            "semplice": float(imp.get("provvigione_semplice_pct") or 3.0),
            "responsabile": float(imp.get("provvigione_responsabile_pct") or 5.0),
            "area_manager": float(imp.get("provvigione_area_manager_pct") or 7.0),
        }
        prov_pct = prov_map.get(ruolo, prov_map["semplice"])
        provvigione = round(ricavo * prov_pct / 100, 2)

        # 3) Totali
        totale_costi = round(costi_diretti + cf_totale + provvigione, 2)
        utile = round(ricavo - totale_costi, 2)
        margine_pct = round((utile / ricavo) * 100, 2) if ricavo > 0 else 0.0
        margine_lordo = round(ricavo - costi_diretti, 2)
        margine_lordo_pct = round((margine_lordo / ricavo) * 100, 2) if ricavo > 0 else 0.0

        return {
            "ricavo": ricavo,
            "costi_diretti": costi_diretti,
            "margine_lordo": margine_lordo,
            "margine_lordo_pct": margine_lordo_pct,
            "costi_fissi_breakdown": cf_breakdown,
            "costi_fissi_totale": round(cf_totale, 2),
            "provvigione_venditore": provvigione,
            "provvigione_venditore_pct": prov_pct,
            "ruolo_venditore": ruolo,
            "totale_costi": totale_costi,
            "utile_netto": utile,
            "margine_pct": margine_pct,
            "soglia_margine_minimo": float(imp.get("margine_minimo") or 30.0),
            "sotto_soglia": margine_pct < float(imp.get("margine_minimo") or 30.0),
        }

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

    @r.get("/subappaltatori/{sub_id}")
    async def get_sub(sub_id: str, user=Depends(get_current_user)):
        doc = await db.subappaltatori.find_one({"id": sub_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Subappaltatore non trovato")
        return doc

    @r.get("/subappaltatori/{sub_id}/dashboard")
    async def sub_dashboard(sub_id: str, user=Depends(get_current_user)):
        """Dashboard completa subappaltatore: documenti aziendali (configurabili dall'admin),
        cantieri in corso, preventivi a noi, incassato vs da incassare."""
        sub = await db.subappaltatori.find_one({"id": sub_id}, {"_id": 0})
        if not sub:
            raise HTTPException(404, "Subappaltatore non trovato")

        # Carica configurazione documenti dalle impostazioni (Round 76 - configurabili)
        imp = await db.impostazioni.find_one({}, {"_id": 0}) or {}
        DOC_TIPI = imp.get("documenti_subappaltatore") or [
            {"tipo": "durc", "label": "DURC", "obbligatorio": True, "descrizione": "Documento Unico Regolarità Contributiva"},
            {"tipo": "visura", "label": "Visura Camerale", "obbligatorio": True, "descrizione": "Visura camerale aggiornata"},
            {"tipo": "cciaa", "label": "Iscrizione CCIAA", "obbligatorio": True, "descrizione": "Iscrizione Camera di Commercio"},
            {"tipo": "polizza_rc", "label": "Polizza RC", "obbligatorio": True, "descrizione": "Responsabilità Civile aziendale"},
            {"tipo": "idoneita_tecnica", "label": "Idoneità Tecnica", "obbligatorio": True, "descrizione": "Idoneità tecnico-professionale"},
            {"tipo": "contratto_subappalto", "label": "Contratto Subappalto", "obbligatorio": True, "descrizione": "Contratto firmato"},
        ]
        docs_sub = sub.get("documenti_aziendali") or []
        from datetime import datetime as _dt, timedelta
        oggi = _dt.now().date()
        check_docs = []
        for cfg in DOC_TIPI:
            tipo_key = cfg.get("tipo")
            label = cfg.get("label") or tipo_key
            descr = cfg.get("descrizione") or ""
            obbligatorio = cfg.get("obbligatorio", True)
            alert_gg = cfg.get("scadenza_alert_gg", 30)
            found = next((d for d in docs_sub if (d.get("tipo") or "").lower() == tipo_key), None)
            stato = "missing"
            scadenza_iso = None
            if found:
                scadenza_iso = found.get("scadenza")
                if scadenza_iso:
                    try:
                        sd = _dt.fromisoformat(scadenza_iso[:10]).date()
                        if sd < oggi:
                            stato = "expired"
                        elif (sd - oggi).days <= alert_gg:
                            stato = "expiring"
                        else:
                            stato = "valid"
                    except Exception:
                        stato = "valid"
                else:
                    stato = "valid"
            check_docs.append({
                "tipo": tipo_key, "label": label, "descrizione": descr,
                "stato": stato, "scadenza": scadenza_iso,
                "url": (found or {}).get("url"), "note": (found or {}).get("note"),
                "obbligatorio": obbligatorio,
            })

        # Cantieri (commesse) collegati al subappaltatore
        commesse = await db.commesse.find({"subappaltatori_ids": sub_id}, {"_id": 0}).to_list(500)
        commesse_attive = [c for c in commesse if c.get("stato") not in ("chiuso", "annullato", "concluso")]
        commesse_concluse = [c for c in commesse if c.get("stato") in ("chiuso", "annullato", "concluso")]

        # Preventivi/computi a nostro favore (voci_acquisti col fornitore = sub_id)
        # Cerca movimenti contabili: nei `commesse_movimenti` con fornitore=sub_id e nei `voci_acquisti`
        incassato = 0.0     # quello che IL SUB ha già preso da noi (uscite per noi)
        da_incassare = 0.0  # quello che IL SUB DEVE ancora prendere da noi
        preventivi_inviati = 0
        for c in commesse:
            for v in (c.get("voci_acquisti") or []):
                if (v.get("fornitore_id") or v.get("subappaltatore_id")) != sub_id:
                    continue
                tot = float(v.get("totale") or v.get("prezzo_totale") or 0)
                if v.get("pagato"):
                    incassato += tot
                else:
                    da_incassare += tot
            # preventivi fornitori
            for pf in (c.get("preventivi_fornitori") or []):
                if pf.get("fornitore_id") == sub_id or pf.get("subappaltatore_id") == sub_id:
                    preventivi_inviati += 1

        # Anche da contratti / movimenti
        movs = await db.commesse_movimenti.find({"fornitore_id": sub_id}, {"_id": 0}).to_list(500)
        for m in movs:
            if m.get("tipo") == "uscita":
                incassato += float(m.get("importo") or 0)

        # Compatto un riepilogo per ogni cantiere
        cantieri_summary = []
        for c in commesse:
            tot_lavori = 0.0
            tot_pagato = 0.0
            for v in (c.get("voci_acquisti") or []):
                if (v.get("fornitore_id") or v.get("subappaltatore_id")) != sub_id:
                    continue
                t = float(v.get("totale") or v.get("prezzo_totale") or 0)
                tot_lavori += t
                if v.get("pagato"):
                    tot_pagato += t
            cantieri_summary.append({
                "id": c.get("id"),
                "code": c.get("code"),
                "cliente_nome": (c.get("cliente") or {}).get("nome") or (c.get("cliente") or {}).get("ragione_sociale") or "—",
                "indirizzo": c.get("indirizzo") or (c.get("cliente") or {}).get("indirizzo") or "—",
                "stato": c.get("stato") or "aperta",
                "data_inizio": c.get("data_inizio"),
                "data_fine_prevista": c.get("data_fine_prevista"),
                "totale_lavori": round(tot_lavori, 2),
                "totale_pagato": round(tot_pagato, 2),
                "totale_residuo": round(tot_lavori - tot_pagato, 2),
            })

        return {
            "subappaltatore": sub,
            "documenti_check": check_docs,
            "documenti_critici_mancanti": [d for d in check_docs if d.get("obbligatorio") and d["stato"] in ("missing", "expired")],
            "kpi": {
                "num_cantieri_totali": len(commesse),
                "num_cantieri_attivi": len(commesse_attive),
                "num_cantieri_conclusi": len(commesse_concluse),
                "num_preventivi_inviati": preventivi_inviati,
                "incassato": round(incassato, 2),
                "da_incassare": round(da_incassare, 2),
                "fatturato_totale": round(incassato + da_incassare, 2),
            },
            "cantieri": cantieri_summary,
        }

    @r.post("/subappaltatori/{sub_id}/documenti")
    async def add_sub_documento(sub_id: str, body: Dict[str, Any], user=Depends(get_current_user)):
        """Aggiunge un documento aziendale (DURC/Visura/Polizza/…) al subappaltatore."""
        if user.get("role") not in ("admin", "gestore"):
            raise HTTPException(403, "Solo admin/gestore")
        sub = await db.subappaltatori.find_one({"id": sub_id})
        if not sub:
            raise HTTPException(404, "Subappaltatore non trovato")
        doc = {
            "id": str(uuid.uuid4()),
            "tipo": body.get("tipo") or "altro",
            "nome": body.get("nome") or body.get("tipo") or "Documento",
            "url": body.get("url"),
            "scadenza": body.get("scadenza"),  # ISO date
            "note": body.get("note"),
            "uploaded_at": now_iso(),
            "uploaded_by": user.get("id"),
        }
        await db.subappaltatori.update_one(
            {"id": sub_id},
            {"$push": {"documenti_aziendali": doc}, "$set": {"updated_at": now_iso()}},
        )
        return doc

    @r.delete("/subappaltatori/{sub_id}/documenti/{did}")
    async def del_sub_documento(sub_id: str, did: str, user=Depends(get_current_user)):
        if user.get("role") not in ("admin", "gestore"):
            raise HTTPException(403, "Solo admin/gestore")
        await db.subappaltatori.update_one({"id": sub_id}, {"$pull": {"documenti_aziendali": {"id": did}}})
        return {"ok": True}

    # ---------- Venditori (list users with role venditore) ----------
    @r.get("/venditori")
    async def list_venditori(user=Depends(get_current_user)):
        users = await db.users.find({"role": "venditore"}, {"_id": 0, "password_hash": 0}).to_list(200)
        for u in users:
            u["preventivi"] = await db.preventivi.count_documents({"venditore_id": u["id"]})
            u["commesse"] = await db.commesse.count_documents({"venditore_id": u["id"]})
        return users

    # ---------- Provvigioni & Dashboard Venditore ----------
    async def _imposta_provvigioni():
        """Carica le % provvigione, fallback sui default se mancanti."""
        from packages_seed import DEFAULT_IMPOSTAZIONI as _DI
        imp = await db.impostazioni.find_one({}, {"_id": 0}) or {}
        keys = [
            "provvigione_semplice_pct",
            "provvigione_responsabile_pct",
            "provvigione_area_manager_pct",
            "provvigione_responsabile_override_pct",
            "provvigione_area_manager_override_pct",
        ]
        return {k: float(imp.get(k, _DI.get(k, 0.0)) or 0.0) for k in keys}

    def _level_pct(level: str, settings: Dict[str, float]) -> float:
        if level == "area_manager":
            return settings["provvigione_area_manager_pct"]
        if level == "responsabile":
            return settings["provvigione_responsabile_pct"]
        return settings["provvigione_semplice_pct"]

    def _override_pct(level: str, settings: Dict[str, float]) -> float:
        if level == "area_manager":
            return settings["provvigione_area_manager_override_pct"]
        if level == "responsabile":
            return settings["provvigione_responsabile_override_pct"]
        return 0.0

    def _stato_provvigione(stato_commessa: str) -> str:
        return {
            "da_iniziare": "previsionale",
            "in_corso": "maturata",
            "completata": "maturata_completa",
            "sospesa": "sospesa",
        }.get(stato_commessa or "da_iniziare", "previsionale")

    async def _scope_venditore(target):
        """Ritorna (own_ids, team_ids) per un utente venditore.
        own_ids = id dell'utente target. team_ids = colleghi gestiti (escluso lui)."""
        own_id = target["id"]
        level = (target.get("venditore_level") or "semplice")
        team_ids: List[str] = []
        if level == "responsabile":
            negozio_id = target.get("negozio_id")
            if negozio_id:
                colls = await db.users.find(
                    {"negozio_id": negozio_id, "role": "venditore", "id": {"$ne": own_id}},
                    {"id": 1, "_id": 0},
                ).to_list(500)
                team_ids = [c["id"] for c in colls]
        elif level == "area_manager":
            negozi_ids = target.get("negozi_ids") or ([target["negozio_id"]] if target.get("negozio_id") else [])
            if negozi_ids:
                colls = await db.users.find(
                    {"negozio_id": {"$in": negozi_ids}, "role": "venditore", "id": {"$ne": own_id}},
                    {"id": 1, "_id": 0},
                ).to_list(2000)
                team_ids = [c["id"] for c in colls]
        return own_id, team_ids, level

    async def _build_dashboard_for(target):
        """Costruisce dashboard + provvigioni per un dato utente venditore (anche admin che impersona)."""
        settings = await _imposta_provvigioni()
        own_id, team_ids, level = await _scope_venditore(target)
        own_pct = _level_pct(level, settings)
        ovr_pct = _override_pct(level, settings)

        # Preventivi
        prev_own = await db.preventivi.find({"venditore_id": own_id}, {"_id": 0}).sort("created_at", -1).to_list(2000)
        prev_team = await db.preventivi.find({"venditore_id": {"$in": team_ids}}, {"_id": 0}).sort("created_at", -1).to_list(2000) if team_ids else []
        # Commesse
        comm_own = await db.commesse.find({"venditore_id": own_id}, {"_id": 0}).sort("created_at", -1).to_list(2000)
        comm_team = await db.commesse.find({"venditore_id": {"$in": team_ids}}, {"_id": 0}).sort("created_at", -1).to_list(2000) if team_ids else []

        def _sum(items, key):
            return float(sum((x.get(key) or 0) for x in items))

        # Provvigioni: una riga per commessa
        prov_rows: List[Dict[str, Any]] = []
        for c in comm_own:
            tot = float(c.get("totale_preventivo") or 0)
            prov_rows.append({
                "commessa_id": c.get("id"),
                "commessa_numero": c.get("numero"),
                "cliente": (c.get("cliente") or {}),
                "totale_commessa": tot,
                "tipo": "diretta",
                "venditore_id": own_id,
                "pct": own_pct,
                "importo": round(tot * own_pct / 100.0, 2),
                "stato_commessa": c.get("stato") or "da_iniziare",
                "stato": _stato_provvigione(c.get("stato")),
                "data": c.get("data_inizio") or c.get("created_at"),
            })
        # Override sui colleghi (solo manager)
        if ovr_pct > 0:
            # Mappa id->nome venditore per leggibilità
            tids = team_ids
            colls = await db.users.find({"id": {"$in": tids}}, {"id": 1, "name": 1, "_id": 0}).to_list(2000) if tids else []
            cmap = {c["id"]: c.get("name") for c in colls}
            for c in comm_team:
                tot = float(c.get("totale_preventivo") or 0)
                vid = c.get("venditore_id")
                prov_rows.append({
                    "commessa_id": c.get("id"),
                    "commessa_numero": c.get("numero"),
                    "cliente": (c.get("cliente") or {}),
                    "totale_commessa": tot,
                    "tipo": "override",
                    "venditore_id": vid,
                    "venditore_nome": cmap.get(vid, "—"),
                    "pct": ovr_pct,
                    "importo": round(tot * ovr_pct / 100.0, 2),
                    "stato_commessa": c.get("stato") or "da_iniziare",
                    "stato": _stato_provvigione(c.get("stato")),
                    "data": c.get("data_inizio") or c.get("created_at"),
                })

        # Stats aggregate
        prov_totale = round(sum(p["importo"] for p in prov_rows), 2)
        prov_maturate = round(sum(p["importo"] for p in prov_rows if p["stato"] in ("maturata", "maturata_completa")), 2)
        prov_previsionali = round(sum(p["importo"] for p in prov_rows if p["stato"] == "previsionale"), 2)

        ranking_team: List[Dict[str, Any]] = []
        if team_ids:
            # Ranking per fatturato totale per ogni venditore del team (incluso target)
            all_ids = [own_id] + team_ids
            users_map_docs = await db.users.find({"id": {"$in": all_ids}}, {"id": 1, "name": 1, "venditore_level": 1, "negozio_id": 1, "_id": 0}).to_list(2000)
            users_map = {u["id"]: u for u in users_map_docs}
            stat_by_v: Dict[str, Dict[str, float]] = {uid: {"fatturato": 0.0, "commesse": 0, "preventivi": 0} for uid in all_ids}
            for c in comm_own + comm_team:
                vid = c.get("venditore_id")
                if vid in stat_by_v:
                    stat_by_v[vid]["fatturato"] += float(c.get("totale_preventivo") or 0)
                    stat_by_v[vid]["commesse"] += 1
            for p in prev_own + prev_team:
                vid = p.get("venditore_id")
                if vid in stat_by_v:
                    stat_by_v[vid]["preventivi"] += 1
            for uid, s in stat_by_v.items():
                ranking_team.append({
                    "venditore_id": uid,
                    "name": (users_map.get(uid) or {}).get("name") or "—",
                    "level": (users_map.get(uid) or {}).get("venditore_level") or "semplice",
                    "fatturato": round(s["fatturato"], 2),
                    "commesse": s["commesse"],
                    "preventivi": s["preventivi"],
                    "is_self": uid == own_id,
                })
            ranking_team.sort(key=lambda x: x["fatturato"], reverse=True)

        return {
            "venditore": {
                "id": target.get("id"),
                "name": target.get("name"),
                "email": target.get("email"),
                "level": level,
                "negozio_id": target.get("negozio_id"),
                "negozi_ids": target.get("negozi_ids") or [],
            },
            "settings": {**settings, "own_pct": own_pct, "override_pct": ovr_pct},
            "stats": {
                "preventivi_propri": len(prev_own),
                "preventivi_team": len(prev_team),
                "commesse_proprie": len(comm_own),
                "commesse_team": len(comm_team),
                "fatturato_proprio": round(_sum(comm_own, "totale_preventivo"), 2),
                "fatturato_team": round(_sum(comm_team, "totale_preventivo"), 2),
                "provvigioni_totali": prov_totale,
                "provvigioni_maturate": prov_maturate,
                "provvigioni_previsionali": prov_previsionali,
            },
            "provvigioni": prov_rows,
            "ranking_team": ranking_team,
            "ultimi_preventivi": (prev_own + prev_team)[:8],
            "ultime_commesse": (comm_own + comm_team)[:8],
        }

    @r.get("/venditori/me/dashboard")
    async def venditore_my_dashboard(user=Depends(get_current_user)):
        if user.get("role") not in ("venditore", "admin"):
            raise HTTPException(403, "Riservato a venditori e admin")
        # Admin senza venditore_level → vede aggregato globale come area_manager su tutti i negozi
        if user.get("role") == "admin" and not user.get("venditore_level"):
            target = {
                "id": user["id"],
                "name": user.get("name") or "Amministratore",
                "email": user.get("email"),
                "venditore_level": "area_manager",
                "negozi_ids": [n["id"] async for n in db.negozi.find({}, {"id": 1, "_id": 0})],
                "negozio_id": None,
            }
            return await _build_dashboard_for(target)
        return await _build_dashboard_for(user)

    @r.get("/venditori/{vid}/dashboard")
    async def venditore_dashboard_admin(vid: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        target = await db.users.find_one({"id": vid}, {"_id": 0})
        if not target:
            raise HTTPException(404, "Venditore non trovato")
        return await _build_dashboard_for(target)

    @r.get("/provvigioni/me")
    async def provvigioni_me(user=Depends(get_current_user)):
        if user.get("role") not in ("venditore", "admin"):
            raise HTTPException(403, "Riservato a venditori e admin")
        d = await _build_dashboard_for(user)
        return {"rows": d["provvigioni"], "totale": d["stats"]["provvigioni_totali"]}

    # ---------- Users management (admin) ----------
    @r.get("/users")
    async def list_users(user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
        return users

    @r.get("/users/pending")
    async def list_pending_users(user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        return await db.users.find({"status": "pending"}, {"_id": 0, "password_hash": 0}).to_list(500)

    class UserRoleUpdate(BaseModel):
        role: str

    @r.get("/users/{user_id}")
    async def get_user(user_id: str, user=Depends(get_current_user)):
        # Restituisce dati pubblici di un utente (per mostrare "incaricato" sui preventivi)
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "password": 0})
        if not u:
            raise HTTPException(404, "Utente non trovato")
        # Filtra campi sensibili
        return {
            "id": u.get("id"),
            "name": u.get("name") or u.get("nome") or "",
            "cognome": u.get("cognome") or "",
            "email": u.get("email"),
            "telefono": u.get("telefono") or u.get("phone") or "",
            "role": u.get("role"),
            "avatar": u.get("avatar"),
            "qualifica": u.get("qualifica") or "",
        }

    @r.put("/users/{user_id}/role")
    async def set_role(user_id: str, body: UserRoleUpdate, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        if body.role not in ("admin", "venditore", "gestore", "cliente", "subappaltatore"):
            raise HTTPException(400, "Ruolo non valido")
        await db.users.update_one({"id": user_id}, {"$set": {"role": body.role}})
        return {"ok": True}

    @r.put("/users/{user_id}")
    async def update_user_attrs(user_id: str, body: dict, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        allowed = {k: v for k, v in (body or {}).items() if k in (
            "name", "negozio_id", "negozi_ids", "subappaltatore_id", "phone",
            "active", "venditore_level", "expires_at", "status", "role",
        )}
        # validazioni semplici
        if "role" in allowed and allowed["role"] not in ("admin", "venditore", "gestore", "cliente", "subappaltatore"):
            raise HTTPException(400, "Ruolo non valido")
        if "status" in allowed and allowed["status"] not in ("pending", "active", "rejected", "expired"):
            raise HTTPException(400, "Status non valido")
        if "venditore_level" in allowed and allowed["venditore_level"] not in (None, "", "semplice", "responsabile", "area_manager"):
            raise HTTPException(400, "Livello venditore non valido")
        if not allowed:
            return {"ok": True}
        await db.users.update_one({"id": user_id}, {"$set": allowed})
        return {"ok": True, "updated": list(allowed.keys())}

    # --- Approve / Reject pending user ---
    class ApproveUserReq(BaseModel):
        role: str
        expires_at: Optional[str] = None  # ISO datetime, None = no expiry (or default)
        venditore_level: Optional[str] = None
        negozio_id: Optional[str] = None
        negozi_ids: Optional[List[str]] = None
        subappaltatore_id: Optional[str] = None

    @r.post("/users/{user_id}/approve")
    async def approve_user(user_id: str, body: ApproveUserReq, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        if body.role not in ("venditore", "gestore", "cliente", "subappaltatore", "admin"):
            raise HTTPException(400, "Ruolo non valido")
        target = await db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(404, "Utente non trovato")
        expiry = compute_expires_at(body.role, body.expires_at)
        update = {
            "role": body.role,
            "status": "active",
            "approved_by": user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expiry,
        }
        if body.venditore_level:
            update["venditore_level"] = body.venditore_level
        if body.negozio_id is not None:
            update["negozio_id"] = body.negozio_id
        if body.negozi_ids is not None:
            update["negozi_ids"] = body.negozi_ids
        if body.subappaltatore_id is not None:
            update["subappaltatore_id"] = body.subappaltatore_id
        await db.users.update_one({"id": user_id}, {"$set": update})
        # Seed default catalog for approved user
        try:
            await seed_user_catalog(user_id)
        except Exception:
            pass
        return {"ok": True, "user_id": user_id, "role": body.role, "expires_at": expiry}

    @r.post("/users/{user_id}/reject")
    async def reject_user(user_id: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        await db.users.update_one({"id": user_id}, {"$set": {
            "status": "rejected",
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejected_by": user["id"],
        }})
        return {"ok": True}

    # --- Invite user directly from admin (creates with temp password) ---
    class InviteUserReq(BaseModel):
        email: EmailStr
        name: str
        role: str
        phone: Optional[str] = None
        expires_at: Optional[str] = None
        venditore_level: Optional[str] = None
        negozio_id: Optional[str] = None
        negozi_ids: Optional[List[str]] = None
        subappaltatore_id: Optional[str] = None

    @r.post("/users/invite")
    async def invite_user(body: InviteUserReq, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        if body.role not in ("venditore", "gestore", "cliente", "subappaltatore", "admin"):
            raise HTTPException(400, "Ruolo non valido")
        email = body.email.lower()
        existing = await db.users.find_one({"email": email})
        if existing:
            raise HTTPException(400, "Email già registrata")
        temp_password = secrets.token_urlsafe(9)  # 12+ chars, random
        uid = str(uuid.uuid4())
        expiry = compute_expires_at(body.role, body.expires_at)
        doc = {
            "id": uid,
            "email": email,
            "name": body.name,
            "role": body.role,
            "status": "active",
            "phone": body.phone or "",
            "password_hash": hash_password(temp_password),
            "must_change_password": True,
            "expires_at": expiry,
            "invited_by": user["id"],
            "invited_at": datetime.now(timezone.utc).isoformat(),
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if body.venditore_level:
            doc["venditore_level"] = body.venditore_level
        if body.negozio_id:
            doc["negozio_id"] = body.negozio_id
        if body.negozi_ids:
            doc["negozi_ids"] = body.negozi_ids
        if body.subappaltatore_id:
            doc["subappaltatore_id"] = body.subappaltatore_id
        await db.users.insert_one(doc)
        try:
            await seed_user_catalog(uid)
        except Exception:
            pass
        await audit_log(db, user=user, action="invite_user", entity="user", entity_id=uid,
                        description=f"Invitato {body.role} {email} ({body.name})",
                        after={"email": email, "role": body.role, "name": body.name, "venditore_level": doc.get("venditore_level")})
        # Invio email di invito con password temporanea
        try:
            from email_service import send_invite_email
            await send_invite_email(
                to=email,
                name=body.name,
                role=body.role,
                temp_password=temp_password,
                custom_message=getattr(body, "custom_message", "") or "",
            )
        except Exception as e:
            logger.warning(f"[EMAIL invite] errore invio: {e}")
        return {
            "ok": True,
            "user_id": uid,
            "email": email,
            "temporary_password": temp_password,
            "role": body.role,
            "expires_at": expiry,
            "login_url": "/login",
        }

    @r.delete("/users/{user_id}")
    async def delete_user(user_id: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        if user_id == user.get("id"):
            raise HTTPException(400, "Non puoi cancellare te stesso")
        target = await db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(404, "Utente non trovato")
        # Non cancellare il fallback rescue admin
        if target.get("email") == "admin@admin.it":
            raise HTTPException(400, "Non puoi cancellare l'admin di sistema")
        await db.users.delete_one({"id": user_id})
        await audit_log(db, user=user, action="delete", entity="user", entity_id=user_id,
                        description=f"Eliminato utente {target.get('email')} ({target.get('role')})",
                        before={"email": target.get("email"), "role": target.get("role"), "name": target.get("name")})
        return {"ok": True}

    # --- Extend / modify expiration ---
    class ExpiryUpdate(BaseModel):
        expires_at: Optional[str] = None  # ISO datetime; null = rimuove scadenza

    @r.patch("/users/{user_id}/expiry")
    async def set_expiry(user_id: str, body: ExpiryUpdate, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        # Se era expired e ora rinnoviamo, riattiva
        update = {"expires_at": body.expires_at}
        target = await db.users.find_one({"id": user_id})
        if target and target.get("status") == "expired" and body.expires_at:
            update["status"] = "active"
        await db.users.update_one({"id": user_id}, {"$set": update})
        return {"ok": True, "expires_at": body.expires_at}

    # ---------- Configurazioni riferimento ----------
    @r.get("/composite-sections")
    async def composite(source: str = "backoffice", user=Depends(get_current_user)):
        """Sezioni del PreventivoComposite. Di default ora le serve dal `voci_backoffice`
        raggruppate per categoria; passa `source=hardcoded` per il vecchio comportamento.
        Per ogni voce viene fornito: id, name, unit, price, modificabile_dal_venditore.
        """
        if source == "hardcoded":
            return COMPOSITE_SECTIONS
        # Source = backoffice (default). Raggruppa per category, ordinando per tipo (DEMOLIZIONI prima)
        voci = await db.voci_backoffice.find({}, {"_id": 0}).to_list(3000)
        # Etichette user-friendly per categoria
        CAT_LABELS = {
            "MURATURA": "Muratura",
            "IMPIANTI": "Impianti",
            "INFISSI": "Infissi",
            "SERVIZI": "Servizi e Pratiche",
            "PAVIMENTAZIONE_GRES": "Pavimentazione Gres",
            "PAVIMENTAZIONE_PARQUET": "Pavimentazione Parquet",
            "PAVIMENTAZIONE_LAMINATO": "Pavimentazione Laminato",
            "PAVIMENTAZIONE_MARMO": "Pavimentazione Marmo",
            "RIVESTIMENTO_PIASTRELLE": "Rivestimento Piastrelle",
            "TERMO_IDRAULICO": "Termo-Idraulico",
            "ELETTRICO": "Elettrico",
            "DEMOLIZIONI": "Demolizioni",
        }
        # Ordine preferito delle sezioni
        ORDER = ["DEMOLIZIONI", "MURATURA", "IMPIANTI", "TERMO_IDRAULICO", "ELETTRICO",
                 "INFISSI", "PAVIMENTAZIONE_GRES", "PAVIMENTAZIONE_PARQUET",
                 "PAVIMENTAZIONE_LAMINATO", "PAVIMENTAZIONE_MARMO",
                 "RIVESTIMENTO_PIASTRELLE", "SERVIZI"]

        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for v in voci:
            cat = v.get("category") or "ALTRO"
            # R87: per la sezione INFISSI nel composite, FILTRA via gli esterni (sono nel Configuratore Infissi).
            # Mostriamo solo `subcategory != "esterno"` (porte interne, blindate, accessori interni).
            if cat == "INFISSI" and (v.get("subcategory") == "esterno"):
                continue
            # Estrai voci di "demolizione" in una sezione virtuale dedicata
            name_lc = (v.get("name") or "").lower()
            if any(k in name_lc for k in ("demoliz", "smaltim", "rimoz")) and cat == "MURATURA":
                cat = "DEMOLIZIONI"
            prezzo_riv = v.get("prezzo_rivendita")
            if prezzo_riv is None or prezzo_riv == 0:
                prezzo_riv = round(float(v.get("prezzo_acquisto") or 0) * float(v.get("ricarico") or 1.8), 2)
            grouped.setdefault(cat, []).append({
                "id": v.get("id"),
                "name": v.get("name") or "—",
                "unit": v.get("unit") or "pz",
                "price": prezzo_riv,
                "prezzo_acquisto": v.get("prezzo_acquisto"),
                "ricarico": v.get("ricarico"),
                "modificabile_dal_venditore": bool(v.get("modificabile_dal_venditore")),
                "category": v.get("category"),
                "cad_category": v.get("cad_category"),
                "subcategory": v.get("subcategory"),
            })
        # Ordina voci dentro ogni sezione per nome
        for cat in grouped:
            grouped[cat].sort(key=lambda x: (x.get("name") or "").lower())
        # Build sections array ordinato
        sections = []
        added = set()
        for cat in ORDER:
            if cat in grouped:
                sections.append({"id": f"sec-{cat.lower()}", "name": CAT_LABELS.get(cat, cat.title()), "category": cat, "voci": grouped[cat]})
                added.add(cat)
        # Aggiungi eventuali categorie non in ORDER (per non perdere voci)
        for cat in grouped:
            if cat not in added:
                sections.append({"id": f"sec-{cat.lower()}", "name": CAT_LABELS.get(cat, cat.title()), "category": cat, "voci": grouped[cat]})
        return sections

    @r.get("/infissi-config")
    async def infissi_conf(user=Depends(get_current_user)):
        """Configuratore infissi.
        I `base_per_mq` dei materiali sono **derivati dinamicamente dalle Voci Backoffice INFISSI**
        (Source of Truth). Mapping:
          - PVC bianco           → voce-infissi-pvc       (prezzo_rivendita)
          - PVC effetto legno    → PVC bianco × 1.15      (variante estetica)
          - Alluminio t. termico → voce-infissi-alluminio
          - Legno/Alluminio      → voce-infissi-legno
        Se l'admin modifica il prezzo della voce backoffice, il configuratore si allinea automaticamente.
        Multiplier materiale forzato a 1.0 (la differenza è già nel base_per_mq specifico).
        """
        await ensure_global_seeds()
        infissi_voci = await db.voci_backoffice.find(
            {"id": {"$in": ["voce-infissi-pvc", "voce-infissi-alluminio", "voce-infissi-legno"]}}, {"_id": 0}
        ).to_list(10)
        prices = {}
        for v in infissi_voci:
            acquisto = float(v.get("prezzo_acquisto") or 0)
            ricarico = float(v.get("ricarico") or 0)
            prices[v["id"]] = round(acquisto * ricarico, 2)
        pvc_base = prices.get("voce-infissi-pvc") or 504.0
        al_base = prices.get("voce-infissi-alluminio") or 828.0
        materiali = [
            {"id": "mat-pvc",      "name": "PVC bianco",                "multiplier": 1.0, "base_per_mq": pvc_base,                       "voce_id": "voce-infissi-pvc"},
            {"id": "mat-pvc-nog",  "name": "PVC effetto legno",         "multiplier": 1.0, "base_per_mq": round(pvc_base * 1.15, 2),      "voce_id": "voce-infissi-pvc",       "variant_factor": 1.15},
            {"id": "mat-pvc-bic",  "name": "PVC bicolore (bianco/RAL)", "multiplier": 1.0, "base_per_mq": round(pvc_base * 1.20, 2),      "voce_id": "voce-infissi-pvc",       "variant_factor": 1.20},
            {"id": "mat-al",       "name": "Alluminio taglio termico",  "multiplier": 1.0, "base_per_mq": al_base,                        "voce_id": "voce-infissi-alluminio"},
            {"id": "mat-al-bic",   "name": "Alluminio bicolore (int/ext)", "multiplier": 1.0, "base_per_mq": round(al_base * 1.15, 2),   "voce_id": "voce-infissi-alluminio", "variant_factor": 1.15},
            {"id": "mat-legno-al", "name": "Legno/Alluminio",           "multiplier": 1.0, "base_per_mq": prices.get("voce-infissi-legno") or 1116.0, "voce_id": "voce-infissi-legno"},
        ]
        return {"tipologie": INFISSI_TIPOLOGIE, "materiali": materiali, "vetri": INFISSI_VETRI}

    # ── R89 bis: voci_backoffice come SORGENTE UNICA DI VERITÀ per prezzi bagno ──
    _VOCE_MANODOPERA_MATCH = {"name": {"$regex": r"^\s*Manodopera\s+Bagno", "$options": "i"}}
    _VOCE_TIER_MATCHES = [
        ("bagno-silver", "SILVER", "#94A3B8", {"name": {"$regex": r"Pacchetto\s+Silver", "$options": "i"}}),
        ("bagno-gold", "GOLD", "#F59E0B", {"name": {"$regex": r"Pacchetto\s+Gold", "$options": "i"}}),
        ("bagno-platinum", "PLATINUM", "#0A0A0A", {"name": {"$regex": r"Pacchetto\s+Platinum", "$options": "i"}}),
    ]

    async def _load_bagno_from_voci() -> Dict[str, Any]:
        """Costruisce la config bagno leggendo da voci_backoffice (source of truth).
        Safety net: se la voce 'Manodopera Bagno' non esiste, la crea con €6.500 (idempotente).
        """
        # Manodopera — safety net: crea al volo se mancante
        v_man = await db.voci_backoffice.find_one(_VOCE_MANODOPERA_MATCH, {"_id": 0})
        if not v_man:
            new_voce = {
                "id": "voce-manodopera-bagno",
                "category": "IMPIANTI",
                "name": "Manodopera Bagno",
                "unit": "forfait",
                "prezzo_acquisto": 3000,
                "ricarico": 2.166667,
                "margine_eur": 3500,
                "margine_pct": 53.8,
                "prezzo_rivendita": 6500,
                "cad_category": "SANITARI",
                "cad_kind": "san.manodopera",
                "modificabile_dal_venditore": False,
                "soglia_inclusa": None,
            }
            await db.voci_backoffice.insert_one(new_voce)
            v_man = new_voce
        manodopera_price = float((v_man or {}).get("prezzo_rivendita") or 6500)
        manodopera_voce_id = (v_man or {}).get("id")
        # Metadati aggiuntivi (description, included_items) restano su bathroom_config
        meta = await db.bathroom_config.find_one({"id": "global"}, {"_id": 0}) or {}
        # Tiers dalle voci_backoffice
        tiers = []
        meta_tiers = {t.get("id"): t for t in (meta.get("tiers") or [])}
        for tier_id, tier_label, tier_color, match in _VOCE_TIER_MATCHES:
            v = await db.voci_backoffice.find_one(match, {"_id": 0})
            if not v:
                continue
            m = meta_tiers.get(tier_id, {})
            tiers.append({
                "id": tier_id,
                "name": m.get("name") or tier_label,
                "price": float(v.get("prezzo_rivendita") or 0),
                "color": m.get("color") or tier_color,
                "description": m.get("description") or v.get("name") or "",
                "included_items": m.get("included_items") or [],
                "voce_id": v.get("id"),  # riferimento per il PUT
                "voce_name": v.get("name"),
            })
        return {
            "tiers": tiers,
            "manodopera_base": manodopera_price,
            "manodopera_voce_id": manodopera_voce_id,
            "manodopera_description": meta.get("manodopera_description") or (v_man or {}).get("name") or "Manodopera bagno",
            "manodopera_included_items": meta.get("manodopera_included_items") or [
                "Demolizione bagno esistente", "Sostituzione impianto idraulico",
                "Sostituzione impianto elettrico bagno", "Massetto e impermeabilizzazione",
                "Posa piastrelle pavimento e rivestimento", "Rasatura e pittura pareti/soffitto",
                "Installazione sanitari e miscelatori", "Smaltimento macerie",
            ],
        }

    @r.get("/bagno-config")
    async def bagno_conf(user=Depends(get_current_user)):
        """Ritorna la configurazione bagno leggendo prezzi da voci_backoffice (source of truth).
        Metadati (descrizioni, colori, included_items) sono su `bathroom_config`.
        """
        return await _load_bagno_from_voci()

    class BagnoConfigTierIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        id: str
        name: str
        price: float  # → aggiorna prezzo_rivendita su voci_backoffice
        color: Optional[str] = "#94A3B8"
        description: Optional[str] = ""
        included_items: Optional[List[str]] = None
        voce_id: Optional[str] = None  # se assente, matcha per name

    class BagnoConfigIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        tiers: List[BagnoConfigTierIn]
        manodopera_base: float
        manodopera_description: Optional[str] = ""
        manodopera_included_items: Optional[List[str]] = None
        manodopera_voce_id: Optional[str] = None

    async def _set_voce_prezzo(voce_match: Dict[str, Any], new_price: float):
        """Aggiorna il prezzo effettivo di una voce backoffice.
        Poiché prezzo_rivendita è ricalcolato al GET come prezzo_acquisto*ricarico,
        aggiorniamo `ricarico` per conservare il margine sul prezzo_acquisto esistente.
        Se prezzo_acquisto è 0, forziamo prezzo_acquisto=new_price con ricarico=1.
        """
        v = await db.voci_backoffice.find_one(voce_match, {"_id": 0})
        if not v:
            return None
        pa = float(v.get("prezzo_acquisto") or 0)
        upd = {"prezzo_rivendita": float(new_price), "updated_at": now_iso()}
        if pa > 0:
            upd["ricarico"] = round(float(new_price) / pa, 6)
        else:
            upd["prezzo_acquisto"] = float(new_price)
            upd["ricarico"] = 1.0
        await db.voci_backoffice.update_one({"id": v["id"]}, {"$set": upd})
        return v["id"]

    @r.put("/bagno-config")
    async def update_bagno_config(body: BagnoConfigIn, user=Depends(get_current_user)):
        """Aggiorna:
        1) i prezzi_rivendita su voci_backoffice (source of truth) — aggiorna il `ricarico` per mantenere il prezzo_acquisto
        2) i metadati (descrizioni, colori, included_items) su bathroom_config
        3) sincronizza gli optional composite 'opt-bagno-silver/gold/platinum' con lo stesso prezzo tier
        Solo admin.
        """
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin può modificare la configurazione bagno")
        # 1) Update voci_backoffice: manodopera
        await _set_voce_prezzo(_VOCE_MANODOPERA_MATCH, float(body.manodopera_base or 0))
        # 2) Update voci_backoffice: tiers
        for t in body.tiers:
            match = None
            if t.voce_id:
                match = {"id": t.voce_id}
            else:
                for tid, _, _, m in _VOCE_TIER_MATCHES:
                    if tid == t.id:
                        match = m
                        break
            if not match:
                continue
            await _set_voce_prezzo(match, float(t.price or 0))
        # 3) Save metadata in bathroom_config
        meta = {
            "id": "global",
            "tiers": [{
                "id": t.id, "name": t.name, "price": float(t.price or 0),
                "color": t.color, "description": t.description or "",
                "included_items": t.included_items or [],
            } for t in body.tiers],
            "manodopera_base": float(body.manodopera_base or 0),
            "manodopera_description": body.manodopera_description or "",
            "manodopera_included_items": body.manodopera_included_items or [],
            "updated_at": now_iso(),
        }
        await db.bathroom_config.update_one({"id": "global"}, {"$set": meta}, upsert=True)
        # 4) Sync optional composite (bagni aggiuntivi) — allinea prezzi al tier
        tier_price_map = {t.id: float(t.price or 0) for t in body.tiers}
        for tid in ["bagno-silver", "bagno-gold", "bagno-platinum"]:
            price = tier_price_map.get(tid, 0)
            if price > 0:
                await db.optional_pkg.update_one(
                    {"id": f"opt-{tid}"},
                    {"$set": {
                        "price_listino": price,
                        "price_scontato": price,  # niente sconto: prezzo unico coerente
                    }},
                )
        try:
            await audit_log(db, user, "bathroom_config_update", "bathroom_config", "global",
                            {"tiers_count": len(body.tiers), "manodopera_base": body.manodopera_base})
        except Exception:
            pass
        # Re-read fresh
        return {"ok": True, **(await _load_bagno_from_voci())}

    # ---------- Commesse ----------
    def _build_allegato_a_from_preventivo(prev: dict) -> dict:
        """Inizializza l'Allegato A (piano pagamenti) dalle scelte fatte in preventivo.
        Se il preventivo ha modalita_pagamento.rate, converte le % in importi assoluti
        usando totale_iva_incl. Altrimenti ritorna allegato vuoto."""
        mp = prev.get("modalita_pagamento") or {}
        rate_pct = mp.get("rate") or []
        if not rate_pct:
            return {"preset_id": "", "rate": [], "firmato": False, "firma_data": None, "note": ""}
        totale = float(prev.get("totale_iva_incl") or 0)
        rate = []
        for i, r in enumerate(rate_pct):
            pct = float(r.get("pct") or 0)
            rate.append({
                "id": f"r-{uuid.uuid4().hex[:8]}",
                "descrizione": r.get("descrizione") or f"Rata {i+1}",
                "pct": pct,
                "importo": round(totale * pct / 100, 2),
                "data_prevista": "",
                "fase_cantiere_id": "",
                "stato": "previsto",
            })
        return {
            "preset_id": mp.get("preset_id") or "",
            "preset_label": mp.get("label") or "",
            "rate": rate,
            "firmato": False,
            "firma_data": None,
            "note": "",
            "auto_generato": True,
            "generato_il": now_iso(),
        }

    class CommessaIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        preventivo_id: str
        fasi_attive_ids: Optional[List[str]] = None  # se None → usa tutte le fasi globali

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
        # Cherry-pick: se l'utente ha specificato fasi_attive_ids, filtra solo quelle.
        if body.fasi_attive_ids is not None and len(body.fasi_attive_ids) > 0:
            attive_set = set(body.fasi_attive_ids)
            fasi = [f for f in fasi if f["id"] in attive_set]
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
            # Allegato A pre-popolato dalla modalità di pagamento del preventivo
            "allegato_a": _build_allegato_a_from_preventivo(prev),
        }
        await db.commesse.insert_one(doc)
        await db.preventivi.update_one({"id": prev["id"]}, {"$set": {"commessa_id": doc["id"]}})
        # Auto-genera computo metrico
        try:
            # Voci principali dal preventivo (escludendo quelle che il venditore ha rimosso)
            raw_items = prev.get("items") or prev.get("voci_dettaglio") or prev.get("computo") or []
            voci_prev = [it for it in raw_items if not (isinstance(it, dict) and it.get("excluded"))]
            # OPTIONAL: aggiungi al computo come voci dedicate
            for op in (prev.get("optional") or []):
                q = float(op.get("qty") or 0)
                pu = float(op.get("unit_price") or 0)
                if q <= 0 and pu <= 0:
                    continue
                voci_prev.append({
                    "voce_id": op.get("id"),
                    "name": (op.get("name") or "Optional") + " (optional)",
                    "qty": q if q > 0 else 1,
                    "unit": op.get("unit") or "pz",
                    "unit_price": pu,
                    "total": round((q if q > 0 else 1) * pu, 2),
                    "category": "OPTIONAL",
                })
            # COMPOSITE: deriva da composite_selections (può essere LIST [{voce_id, qty, ...}] o DICT legacy {voce_id: {qty, ...}})
            if not voci_prev and prev.get("composite_selections"):
                csel = prev.get("composite_selections") or {}
                # Normalizza: accetta sia list che dict
                if isinstance(csel, list):
                    items_iter = []
                    for s in csel:
                        if not isinstance(s, dict):
                            continue
                        items_iter.append((s.get("voce_id") or s.get("id") or "", s))
                elif isinstance(csel, dict):
                    items_iter = list(csel.items())
                else:
                    items_iter = []
                voci_prev = []
                for vid, sel in items_iter:
                    qty = float(sel.get("qty") or 0)
                    pu = float(sel.get("price") or sel.get("unit_price") or 0)
                    if qty <= 0:
                        continue
                    voci_prev.append({
                        "voce_id": vid,
                        "name": sel.get("name") or vid,
                        "qty": qty,
                        "unit": sel.get("unit") or "pz",
                        "unit_price": pu,
                        "total": round(qty * pu, 2),
                        "category": sel.get("category") or "",
                    })
                # Aggiungi anche infissi_extras
                for inf in (prev.get("infissi_extras") or []):
                    qty = float(inf.get("qty") or 1)
                    pu = float(inf.get("unit_price") or inf.get("price") or 0)
                    voci_prev.append({
                        "voce_id": inf.get("id") or inf.get("voce_id"),
                        "name": inf.get("name") or "Infisso",
                        "qty": qty,
                        "unit": inf.get("unit") or "pz",
                        "unit_price": pu,
                        "total": round(qty * pu, 2),
                        "category": "INFISSI",
                    })
            # Se preventivo PACCHETTO senza items[] esplicite → deriva dal package
            if not voci_prev and prev.get("package_id"):
                pkg = await db.packages.find_one({"id": prev["package_id"]}, {"_id": 0})
                if pkg and pkg.get("items"):
                    mq = float(prev.get("mq") or pkg.get("mq_base") or 80)
                    derived = []
                    for it in pkg["items"]:
                        qm = it.get("qty_mode", "fixed")
                        if qm == "per_mq":
                            qty = mq * float(it.get("qty_ratio") or 1)
                        else:
                            qty = float(it.get("qty_value") or it.get("qty") or 1)
                        pu = float(it.get("unit_price_pkg") or it.get("prezzo_rivendita") or 0)
                        derived.append({
                            "voce_id": it.get("id"),
                            "name": it.get("name") or "—",
                            "qty": qty,
                            "unit": it.get("unit") or "pz",
                            "unit_price": pu,
                            "total": round(qty * pu, 2),
                            "category": it.get("category") or "",
                        })
                    voci_prev = derived
            # LISTINI FORNITORI (aggiunti SEMPRE dopo derive, per composite e pacchetto)
            # Combina selezioni del venditore + pre-inclusi nel pacchetto (snapshot al preventivo)
            listini_all = []
            listini_all.extend(prev.get("listini_selections") or [])
            listini_all.extend(prev.get("package_listini_items") or [])
            seen_ls = set()
            for ls in listini_all:
                key = (ls.get("listino_id"), ls.get("id"))
                if key in seen_ls:
                    continue
                seen_ls.add(key)
                qty = float(ls.get("qty") or 1)
                pu = float(ls.get("prezzo_rivendita") or 0)
                voci_prev.append({
                    "voce_id": ls.get("id"),
                    "listino_id": ls.get("listino_id"),
                    "fornitore_nome": ls.get("fornitore_nome"),
                    "name": ls.get("nome") or "Prodotto da listino",
                    "qty": qty,
                    "unit": ls.get("unit") or "pz",
                    "unit_price": pu,
                    "prezzo_netto": float(ls.get("prezzo_netto") or 0),
                    "ricarico": float(ls.get("ricarico") or 1.8),
                    "total": round(qty * pu, 2),
                    "category": (ls.get("categoria") or "FORNITURA").upper(),
                    "from_listino": True,
                })
            cm_items = []
            for v in voci_prev:
                qty = float(v.get("qty") or v.get("quantita") or v.get("qty_richiesta") or 0)
                pu = float(v.get("unit_price") or v.get("prezzo_rivendita") or v.get("prezzo") or 0)
                tot = float(v.get("total") or v.get("totale") or 0)
                if tot == 0 and qty and pu:
                    tot = round(qty * pu, 2)
                cm_item = {
                    "id": uuid.uuid4().hex,
                    "voce_id": v.get("voce_id") or v.get("id"),
                    "name": v.get("name") or v.get("descrizione") or "—",
                    "qty": qty,
                    "unit": v.get("unit") or "pz",
                    "prezzo_unit": pu,
                    "totale": tot,
                    "category": v.get("category") or "",
                    "stato_assegnazione": "da_assegnare",
                    "artigiano_id": None, "artigiano_nome": None, "note_assegnazione": None,
                }
                # Propaga metadati listino fornitore (per Voci & Acquisti e per riconciliazione)
                if v.get("from_listino"):
                    cm_item["from_listino"] = True
                    cm_item["listino_id"] = v.get("listino_id")
                    cm_item["fornitore_nome"] = v.get("fornitore_nome")
                    cm_item["prezzo_netto"] = float(v.get("prezzo_netto") or 0)
                    cm_item["ricarico"] = float(v.get("ricarico") or 1.8)
                    # Pre-assegna fornitore come default
                    cm_item["artigiano_nome"] = v.get("fornitore_nome")
                cm_items.append(cm_item)
            if cm_items:
                cm = {"items": cm_items, "totale": round(sum(i["totale"] for i in cm_items), 2), "generated_at": now_iso(), "generated_from_preventivo_id": prev["id"]}
                await db.commesse.update_one({"id": doc["id"]}, {"$set": {"computo_metrico": cm}})
                doc["computo_metrico"] = cm
        except Exception as ex:
            import traceback
            print(f"[create_commessa] auto-gen computo failed: {ex}")
            traceback.print_exc()
        doc.pop("_id", None)
        await audit_log(db, user=user, action="create", entity="commessa", entity_id=doc["id"],
                        description=f"Creata commessa {doc.get('codice') or doc.get('id')} — cliente: {(doc.get('cliente') or {}).get('nome', '')}",
                        after={"codice": doc.get("codice"), "preventivo_id": doc.get("preventivo_id"), "totale_lavori": doc.get("totale_lavori")})
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
        # Log conciso: solo chiavi modificate (no full body per non saturare)
        await audit_log(db, user=user, action="update", entity="commessa", entity_id=cid,
                        description=f"Aggiornata commessa {(doc or {}).get('codice', cid)} (campi: {', '.join(list(body.keys())[:10])})",
                        after={k: body[k] for k in list(body.keys())[:8] if k != "checklist"})
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
        await audit_log(db, user=user, action="update_stato", entity="commessa", entity_id=cid,
                        description=f"Stato commessa → {stato}",
                        after={"stato": stato})
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
        return await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

    @r.get("/leads/{lid}")
    async def get_lead(lid: str, user=Depends(get_current_user)):
        doc = await db.leads.find_one({"id": lid}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Lead non trovato")
        return doc

    @r.post("/leads")
    async def create_lead(body: LeadIn, user=Depends(get_current_user)):
        doc = body.model_dump()
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = now_iso()
        doc["updated_at"] = now_iso()
        doc.setdefault("note_history", [])
        await db.leads.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.put("/leads/{lid}")
    async def update_lead(lid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        body.pop("_id", None); body.pop("id", None)
        body["updated_at"] = now_iso()
        await db.leads.update_one({"id": lid}, {"$set": body})
        doc = await db.leads.find_one({"id": lid}, {"_id": 0})
        return doc or {"ok": True}

    @r.post("/leads/{lid}/note")
    async def add_lead_note(lid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        """Aggiunge una nota di follow-up timestampata alla cronologia del lead."""
        testo = (body.get("testo") or "").strip()
        if not testo:
            raise HTTPException(400, "Testo nota obbligatorio")
        nota = {
            "id": str(uuid.uuid4()),
            "testo": testo,
            "tipo": body.get("tipo") or "nota",  # nota | chiamata | email | sms | meeting
            "esito": body.get("esito") or "",
            "created_at": now_iso(),
            "user_id": user.get("id"),
            "user_nome": user.get("name") or user.get("email") or "Utente",
        }
        await db.leads.update_one(
            {"id": lid},
            {"$push": {"note_history": {"$each": [nota], "$position": 0}},
             "$set": {"updated_at": now_iso(), "ultimo_contatto": nota["created_at"]}},
        )
        return nota

    @r.delete("/leads/{lid}/note/{nid}")
    async def del_lead_note(lid: str, nid: str, user=Depends(get_current_user)):
        await db.leads.update_one({"id": lid}, {"$pull": {"note_history": {"id": nid}}})
        return {"ok": True}

    @r.post("/leads/import")
    async def import_leads(file: UploadFile = File(...), source: str = Form("import"), dedupe: bool = Form(True), user=Depends(get_current_user)):
        """Importa una lista di lead da file CSV o Excel.

        Mapping colonne auto (case-insensitive, accenti rimossi):
          nome | first_name | firstname           → nome
          cognome | last_name | lastname | surname → cognome
          telefono | phone | cellulare | mobile    → telefono
          email | mail | e-mail                    → email
          citta | city | comune | localita         → citta
          indirizzo | address | via                 → indirizzo
          mq | metri | superficie                   → mq
          tipo_immobile | tipologia | property      → tipo_immobile
          note | notes | commento                   → note

        De-dupe per email+telefono (case-insensitive). Source viene salvato per tracciabilità.
        """
        import io
        import re
        import pandas as pd
        content = await file.read()
        fname = (file.filename or "").lower()
        try:
            if fname.endswith(".csv") or fname.endswith(".txt"):
                # auto-detect separator
                sample = content[:4096].decode("utf-8", errors="ignore")
                sep = ";" if sample.count(";") > sample.count(",") else ","
                df = pd.read_csv(io.BytesIO(content), sep=sep, dtype=str, keep_default_na=False)
            elif fname.endswith(".xlsx") or fname.endswith(".xls"):
                df = pd.read_excel(io.BytesIO(content), dtype=str)
                df = df.fillna("")
            else:
                raise HTTPException(400, "Formato non supportato. Usa .csv .xlsx .xls")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, f"Errore lettura file: {e}")

        def norm(s: str) -> str:
            s = (s or "").strip().lower()
            s = re.sub(r"[àáâä]", "a", s)
            s = re.sub(r"[èéêë]", "e", s)
            s = re.sub(r"[ìíîï]", "i", s)
            s = re.sub(r"[òóôö]", "o", s)
            s = re.sub(r"[ùúûü]", "u", s)
            s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
            return s

        COL_MAP = {
            "nome": ["nome", "name", "first_name", "firstname", "first"],
            "cognome": ["cognome", "surname", "last_name", "lastname", "last"],
            "telefono": ["telefono", "phone", "cellulare", "mobile", "tel", "cell"],
            "email": ["email", "mail", "e_mail"],
            "citta": ["citta", "city", "comune", "localita", "town"],
            "indirizzo": ["indirizzo", "address", "via", "street"],
            "mq": ["mq", "metri", "superficie", "metri_quadri", "sqm"],
            "tipo_immobile": ["tipo_immobile", "tipologia", "property", "tipo", "immobile"],
            "note": ["note", "notes", "commento", "comment", "descrizione", "messaggio", "message"],
            "anno_costruzione": ["anno_costruzione", "anno", "year"],
            "piano": ["piano", "floor"],
        }
        # invert
        col_lookup = {}
        for canonical, aliases in COL_MAP.items():
            for a in aliases:
                col_lookup[a] = canonical
        # Build dataframe column mapping
        mapping = {}
        for col in df.columns:
            n = norm(col)
            if n in col_lookup:
                mapping[col] = col_lookup[n]

        # Carica leads esistenti per dedupe
        existing_emails = set()
        existing_phones = set()
        if dedupe:
            async for row in db.leads.find({}, {"email": 1, "telefono": 1, "_id": 0}):
                if row.get("email"):
                    existing_emails.add(row["email"].strip().lower())
                if row.get("telefono"):
                    existing_phones.add(re.sub(r"\D", "", row["telefono"]))

        imported = 0
        skipped_dup = 0
        errors = []
        batch_seen_emails = set()
        batch_seen_phones = set()
        rows_to_insert = []
        for idx, row in df.iterrows():
            try:
                lead = {
                    "id": str(uuid.uuid4()),
                    "stato": "nuovo",
                    "source": source,
                    "imported_at": now_iso(),
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                    "note_history": [],
                }
                for src_col, canonical in mapping.items():
                    val = str(row[src_col]).strip()
                    if not val or val.lower() in ("nan", "none"):
                        continue
                    if canonical == "mq":
                        try:
                            lead["mq"] = float(val.replace(",", "."))
                        except Exception:
                            pass
                    elif canonical == "anno_costruzione":
                        try:
                            lead["anno_costruzione"] = int(val)
                        except Exception:
                            pass
                    else:
                        lead[canonical] = val
                if not lead.get("nome") and not lead.get("telefono") and not lead.get("email"):
                    errors.append({"riga": int(idx) + 2, "motivo": "Riga vuota (manca nome/telefono/email)"})
                    continue
                if not lead.get("nome"):
                    lead["nome"] = lead.get("email") or lead.get("telefono") or f"Lead riga {idx + 2}"
                # dedupe
                em = (lead.get("email") or "").strip().lower()
                ph = re.sub(r"\D", "", lead.get("telefono") or "")
                is_dup = False
                if dedupe:
                    if em and (em in existing_emails or em in batch_seen_emails):
                        is_dup = True
                    if ph and (ph in existing_phones or ph in batch_seen_phones):
                        is_dup = True
                if is_dup:
                    skipped_dup += 1
                    continue
                if em:
                    batch_seen_emails.add(em)
                if ph:
                    batch_seen_phones.add(ph)
                rows_to_insert.append(lead)
            except Exception as e:
                errors.append({"riga": int(idx) + 2, "motivo": str(e)})

        if rows_to_insert:
            await db.leads.insert_many(rows_to_insert)
            imported = len(rows_to_insert)

        return {
            "imported": imported,
            "skipped_duplicates": skipped_dup,
            "errors": errors[:50],
            "total_rows": int(len(df)),
            "columns_detected": list(mapping.values()),
            "columns_unmapped": [c for c in df.columns if c not in mapping],
        }

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
