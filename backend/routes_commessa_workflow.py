"""Round 26 — Workflow Commessa completo.

Endpoint per gestire l'intero ciclo: contratto → documenti → scelta materiali → computo metrico
→ richieste preventivi artigiani (con AI analisi) → fasi cantiere → cassa & marginalità → resoconto.

Tutto in un singolo router montato su /api/commesse/{cid}/workflow/...
"""
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid
import os
import base64

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel

UPLOADS_DIR = "/app/backend/uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)


def build_commessa_workflow_router(db, get_current_user):
    r = APIRouter()

    NOW = lambda: datetime.now(timezone.utc).isoformat()
    UID = lambda: str(uuid.uuid4())

    # ---------- Helpers ----------
    async def _commessa(cid: str):
        c = await db.commesse.find_one({"id": cid}, {"_id": 0})
        if not c:
            raise HTTPException(404, "Commessa non trovata")
        return c

    async def _voci_byid() -> Dict[str, Dict]:
        docs = await db.voci_backoffice.find({}, {"_id": 0}).to_list(5000)
        return {d["id"]: d for d in docs if d.get("id")}

    async def _notifica(target_role: Optional[str], target_user_id: Optional[str], tipo: str, oggetto: str, link: str, payload: Dict[str, Any] = None):
        await db.notifiche.insert_one({
            "id": UID(), "tipo": tipo, "oggetto": oggetto, "link": link,
            "target_role": target_role, "target_user_id": target_user_id,
            "letta": False, "created_at": NOW(), "payload": payload or {},
        })

    # ---------- 1. CONTRATTO CLIENTE ----------
    class ContrattoIn(BaseModel):
        url: Optional[str] = None
        testo: Optional[str] = None
        firmato: bool = False
        firma_data: Optional[str] = None
        note: Optional[str] = None

    @r.post("/commesse/{cid}/workflow/contratto")
    async def set_contratto(cid: str, body: ContrattoIn, user=Depends(get_current_user)):
        c = await _commessa(cid)
        contratto = {
            "id": c.get("contratto", {}).get("id") or UID(),
            "url": body.url, "testo": body.testo,
            "firmato": body.firmato, "firma_data": body.firma_data,
            "note": body.note,
            "updated_at": NOW(), "updated_by": user.get("id"),
        }
        await db.commesse.update_one({"id": cid}, {"$set": {"contratto": contratto}})
        return contratto

    # ---------- 2. DOCUMENTI (multipli) ----------
    class DocumentoWfIn(BaseModel):
        tipo: str  # "progetto" | "tavola" | "doc_casa" | "doc_cliente" | "altro"
        name: str
        url: Optional[str] = None
        note: Optional[str] = None

    @r.post("/commesse/{cid}/workflow/documenti")
    async def add_documento(cid: str, body: DocumentoWfIn, user=Depends(get_current_user)):
        await _commessa(cid)
        doc = {"id": UID(), "tipo": body.tipo, "name": body.name, "url": body.url, "note": body.note,
               "uploaded_at": NOW(), "uploaded_by": user.get("id"), "commessa_id": cid}
        await db.commesse_documenti.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.delete("/commesse/{cid}/workflow/documenti/{doc_id}")
    async def del_documento(cid: str, doc_id: str, user=Depends(get_current_user)):
        await db.commesse_documenti.delete_one({"id": doc_id, "commessa_id": cid})
        return {"ok": True}

    # ---------- 3. SCELTA MATERIALI ----------
    class MaterialiSceltaIn(BaseModel):
        items: List[Dict[str, Any]]  # [{voce_id, name, qty, unit, prezzo, note}]
        firmato_cliente: bool = False
        firma_data: Optional[str] = None

    @r.post("/commesse/{cid}/workflow/materiali")
    async def set_materiali(cid: str, body: MaterialiSceltaIn, user=Depends(get_current_user)):
        await _commessa(cid)
        materiali = {"items": body.items, "firmato_cliente": body.firmato_cliente, "firma_data": body.firma_data,
                     "updated_at": NOW(), "updated_by": user.get("id")}
        await db.commesse.update_one({"id": cid}, {"$set": {"materiali_scelta": materiali}})
        return materiali

    # ---------- 4. COMPUTO METRICO (auto-genera dal preventivo) ----------
    @r.post("/commesse/{cid}/workflow/computo")
    async def gen_computo(cid: str, user=Depends(get_current_user)):
        c = await _commessa(cid)
        prev_id = c.get("preventivo_id")
        if not prev_id:
            raise HTTPException(400, "Commessa senza preventivo collegato")
        prev = await db.preventivi.find_one({"id": prev_id}, {"_id": 0})
        if not prev:
            raise HTTPException(404, "Preventivo non trovato")
        # Normalizza voci preventivo in computo metrico
        # Le voci possono essere in: 'items' (formato standard PreventivoIn) o
        # nei legacy 'voci_dettaglio' / 'computo'. Usiamo il primo non-vuoto.
        voci_prev = (
            prev.get("items")
            or prev.get("voci_dettaglio")
            or prev.get("computo")
            or []
        )
        items = []
        for v in voci_prev:
            qty = float(v.get("qty") or v.get("quantita") or v.get("qty_richiesta") or 0)
            prezzo_unit = float(
                v.get("unit_price")
                or v.get("prezzo_rivendita")
                or v.get("prezzo")
                or 0
            )
            totale = float(v.get("total") or v.get("totale") or 0)
            if totale == 0 and qty > 0 and prezzo_unit > 0:
                totale = round(qty * prezzo_unit, 2)
            items.append({
                "id": UID(),
                "voce_id": v.get("voce_id") or v.get("id"),
                "name": v.get("name") or v.get("descrizione") or "—",
                "qty": qty,
                "unit": v.get("unit") or "pz",
                "prezzo_unit": prezzo_unit,
                "totale": totale,
                "category": v.get("category") or "",
                "stato_assegnazione": "da_assegnare",  # da_assegnare | artigiano | interno | autorizzato
                "artigiano_id": None,
                "artigiano_nome": None,
                "note_assegnazione": None,
            })
        computo = {"items": items, "totale": prev.get("totale_iva_incl") or prev.get("totale") or 0,
                   "generated_at": NOW(), "generated_by": user.get("id")}
        await db.commesse.update_one({"id": cid}, {"$set": {"computo_metrico": computo}})
        return computo

    # ---------- 4b. ASSEGNAZIONE VOCI COMPUTO METRICO ----------
    class AssegnaVoceIn(BaseModel):
        stato_assegnazione: str  # "artigiano" | "interno" | "autorizzato"
        artigiano_nome: Optional[str] = None
        artigiano_id: Optional[str] = None
        note_assegnazione: Optional[str] = None

    @r.patch("/commesse/{cid}/workflow/computo/{voce_id}/assegna")
    async def assegna_voce_computo(cid: str, voce_id: str, payload: AssegnaVoceIn, user=Depends(get_current_user)):
        com = await db.commesse.find_one({"id": cid})
        if not com:
            raise HTTPException(404, "Commessa non trovata")
        if payload.stato_assegnazione not in ("artigiano", "interno", "autorizzato", "da_assegnare"):
            raise HTTPException(400, "stato_assegnazione non valido")
        cm = com.get("computo_metrico") or {"items": []}
        items = cm.get("items") or []
        idx = next((i for i, it in enumerate(items) if it.get("id") == voce_id), -1)
        if idx < 0:
            raise HTTPException(404, "Voce computo non trovata")
        items[idx]["stato_assegnazione"] = payload.stato_assegnazione
        items[idx]["artigiano_nome"] = payload.artigiano_nome
        items[idx]["artigiano_id"] = payload.artigiano_id
        items[idx]["note_assegnazione"] = payload.note_assegnazione
        items[idx]["assigned_at"] = NOW()
        items[idx]["assigned_by"] = user.get("id")
        cm["items"] = items
        await db.commesse.update_one({"id": cid}, {"$set": {"computo_metrico": cm}})
        return {"ok": True, "item": items[idx]}


    # ---------- 5. PREVENTIVI ARTIGIANI (+ AI analisi + autorizzazione) ----------
    class PrevArtigianoIn(BaseModel):
        artigiano_nome: str
        artigiano_id: Optional[str] = None
        voci_riferite: List[str] = []  # id voci computo metrico oggetto del preventivo
        importo_offerto: float
        url_pdf: Optional[str] = None
        testo_estratto: Optional[str] = None
        note: Optional[str] = None
        modalita: str = "artigiano"  # "artigiano" | "interno"

    async def _ai_analizza(prev_data: Dict, voci_riferimento: List[Dict]) -> Dict[str, Any]:
        """SOLO confronto matematico (no AI). Ritorna giudizio: ok / warning / blocco."""
        ref_acquisto = sum((float(v.get("prezzo_acquisto") or 0) * float(v.get("qty") or 1)) for v in voci_riferimento)
        ref_rivendita = sum((float(v.get("prezzo_rivendita") or 0) * float(v.get("qty") or 1)) for v in voci_riferimento)
        offerto = float(prev_data.get("importo_offerto") or 0)
        scarto_pct_su_acquisto = (offerto - ref_acquisto) / ref_acquisto * 100 if ref_acquisto > 0 else None
        scarto_pct_su_rivendita = (offerto - ref_rivendita) / ref_rivendita * 100 if ref_rivendita > 0 else None
        # Stato in base a soglia matematica
        # OK:       offerto ≤ rivendita+10%
        # WARNING:  offerto > rivendita+10% ma ≤ rivendita+25%
        # BLOCCO:   offerto > rivendita+25% (richiede autorizzazione)
        if scarto_pct_su_rivendita is None:
            esito = "warning"
            giudizio = "Riferimento mancante: le voci di computo non hanno prezzo. Verifica manualmente."
        elif scarto_pct_su_rivendita <= -5:
            esito = "ok"
            giudizio = f"Eccellente: l'offerta è {abs(round(scarto_pct_su_rivendita, 1))}% sotto il prezzo di rivendita interno."
        elif scarto_pct_su_rivendita <= 10:
            esito = "ok"
            giudizio = f"OK: scarto +{round(scarto_pct_su_rivendita, 1)}% (≤10%, accettabile)."
        elif scarto_pct_su_rivendita <= 25:
            esito = "warning"
            giudizio = f"WARNING: +{round(scarto_pct_su_rivendita, 1)}% sopra rivendita. Margine ridotto, considera trattativa."
        else:
            esito = "blocco"
            giudizio = f"BLOCCO: +{round(scarto_pct_su_rivendita, 1)}% sopra rivendita (>25%). Richiede autorizzazione."
        return {
            "accettabile": esito != "blocco",
            "esito": esito,
            "giudizio": giudizio,
            "ref_acquisto": round(ref_acquisto, 2), "ref_rivendita": round(ref_rivendita, 2),
            "offerto": offerto,
            "scarto_pct_su_acquisto": round(scarto_pct_su_acquisto or 0, 2) if scarto_pct_su_acquisto is not None else None,
            "scarto_pct_su_rivendita": round(scarto_pct_su_rivendita or 0, 2) if scarto_pct_su_rivendita is not None else None,
            "differenza_eur": round(offerto - ref_rivendita, 2) if ref_rivendita else None,
        }

    @r.post("/commesse/{cid}/workflow/artigiani-preventivi")
    async def add_prev_artigiano(cid: str, body: PrevArtigianoIn, user=Depends(get_current_user)):
        c = await _commessa(cid)
        # Carica voci riferite dal computo
        computo = c.get("computo_metrico") or {}
        voci_map = {it.get("id"): it for it in (computo.get("items") or [])}
        voci_riferimento = []
        for vid in body.voci_riferite:
            it = voci_map.get(vid)
            if not it: continue
            # Recupera prezzo_acquisto dalla voce backoffice
            voce_back = None
            if it.get("voce_id"):
                voce_back = await db.voci_backoffice.find_one({"id": it["voce_id"]}, {"_id": 0})
            ref = {**it, "prezzo_acquisto": float((voce_back or {}).get("prezzo_acquisto") or 0),
                   "prezzo_rivendita": float(it.get("prezzo_unit") or 0)}
            voci_riferimento.append(ref)
        # AI analisi (controllo matematico)
        ai_result = await _ai_analizza({**body.dict()}, voci_riferimento)
        # Stato basato su esito matematico
        esito = ai_result.get("esito", "warning")
        if body.modalita == "interno":
            stato = "interno"
        elif esito == "blocco":
            stato = "da_autorizzare"
        elif esito == "warning":
            stato = "warning"
        else:
            stato = "ok"
        prev_doc = {
            "id": UID(), "commessa_id": cid,
            "artigiano_nome": body.artigiano_nome, "artigiano_id": body.artigiano_id,
            "modalita": body.modalita,
            "voci_riferite": body.voci_riferite,
            "importo_offerto": body.importo_offerto,
            "url_pdf": body.url_pdf, "testo_estratto": body.testo_estratto, "note": body.note,
            "ai_analisi": ai_result, "stato": stato,
            "created_at": NOW(), "created_by": user.get("id"),
        }
        await db.commesse_artigiani_preventivi.insert_one(prev_doc)
        # Aggiorna stato_assegnazione delle voci nel computo
        if body.modalita == "interno" or stato == "ok":
            new_state = "interno" if body.modalita == "interno" else "artigiano"
            for vid in body.voci_riferite:
                if vid in voci_map:
                    voci_map[vid]["stato_assegnazione"] = new_state
                    voci_map[vid]["preventivo_artigiano_id"] = prev_doc["id"]
            new_items = list(voci_map.values()) + [it for it in (computo.get("items") or []) if it.get("id") not in voci_map]
            # Mantieni l'ordine originale
            ordered = [voci_map.get(it.get("id"), it) for it in (computo.get("items") or [])]
            await db.commesse.update_one({"id": cid}, {"$set": {"computo_metrico.items": ordered}})
        # Notifica responsabile se da autorizzare
        if stato == "da_autorizzare":
            await _notifica(
                target_role="admin", target_user_id=None,
                tipo="autorizzazione_preventivo_artigiano",
                oggetto=f"Preventivo artigiano '{body.artigiano_nome}' supera la soglia (+{ai_result.get('scarto_pct_su_rivendita')}%) — Commessa {c.get('numero')}",
                link=f"/commesse/{cid}/workflow",
                payload={"commessa_id": cid, "preventivo_id": prev_doc["id"], "scarto_pct": ai_result.get("scarto_pct_su_rivendita")},
            )
        # Pop _id from prev_doc before returning
        prev_doc.pop("_id", None)
        return prev_doc

    @r.post("/commesse/{cid}/workflow/artigiani-preventivi/{pid}/autorizza")
    async def autorizza_prev_artigiano(cid: str, pid: str, user=Depends(get_current_user)):
        if user.get("role") != "admin" and (user.get("venditore_level") not in ("responsabile", "area_manager")):
            raise HTTPException(403, "Solo Admin/Responsabile/Area Manager possono autorizzare")
        await db.commesse_artigiani_preventivi.update_one(
            {"id": pid, "commessa_id": cid},
            {"$set": {"stato": "autorizzato", "autorizzato_da": user.get("id"), "autorizzato_at": NOW()}},
        )
        # Aggiorna anche il computo metrico
        prev_doc = await db.commesse_artigiani_preventivi.find_one({"id": pid}, {"_id": 0})
        if prev_doc:
            c = await _commessa(cid)
            computo = c.get("computo_metrico") or {}
            items = computo.get("items") or []
            for it in items:
                if it.get("id") in (prev_doc.get("voci_riferite") or []):
                    it["stato_assegnazione"] = "artigiano"
                    it["preventivo_artigiano_id"] = pid
            await db.commesse.update_one({"id": cid}, {"$set": {"computo_metrico.items": items}})
        return {"ok": True}

    @r.get("/commesse/{cid}/workflow/artigiani-preventivi")
    async def list_prev_artigiani(cid: str, user=Depends(get_current_user)):
        rows = await db.commesse_artigiani_preventivi.find({"commessa_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
        return rows

    # ---------- 6. FASI CANTIERE (chi fa cosa quando) ----------
    class FaseIn(BaseModel):
        titolo: str
        voce_ids: List[str] = []
        eseguito_da: str = "interno"  # "interno" | artigiano_id
        artigiano_nome: Optional[str] = None
        data_inizio: Optional[str] = None
        data_fine: Optional[str] = None
        stato: str = "da_iniziare"  # "da_iniziare" | "in_corso" | "completata" | "sospesa"
        note: Optional[str] = None

    @r.post("/commesse/{cid}/workflow/fasi")
    async def add_fase(cid: str, body: FaseIn, user=Depends(get_current_user)):
        await _commessa(cid)
        fase = {"id": UID(), "commessa_id": cid, **body.dict(), "created_at": NOW()}
        await db.commesse_fasi.insert_one(fase)
        fase.pop("_id", None)
        return fase

    @r.put("/commesse/{cid}/workflow/fasi/{fid}")
    async def update_fase(cid: str, fid: str, body: FaseIn, user=Depends(get_current_user)):
        await db.commesse_fasi.update_one({"id": fid, "commessa_id": cid}, {"$set": body.dict()})
        return await db.commesse_fasi.find_one({"id": fid}, {"_id": 0})

    @r.delete("/commesse/{cid}/workflow/fasi/{fid}")
    async def del_fase(cid: str, fid: str, user=Depends(get_current_user)):
        await db.commesse_fasi.delete_one({"id": fid, "commessa_id": cid})
        return {"ok": True}

    @r.get("/commesse/{cid}/workflow/fasi")
    async def list_fasi(cid: str, user=Depends(get_current_user)):
        return await db.commesse_fasi.find({"commessa_id": cid}, {"_id": 0}).sort("data_inizio", 1).to_list(500)

    # ---------- 7. CASSA (incassi/uscite) ----------
    class MovCassaIn(BaseModel):
        tipo: str  # "incasso" | "uscita"
        importo: float
        data: str
        descrizione: str
        fase_id: Optional[str] = None
        artigiano_id: Optional[str] = None
        artigiano_nome: Optional[str] = None
        metodo: Optional[str] = None  # "bonifico" | "contanti" | "assegno"
        # Pagamenti multipli / scadenze
        data_scadenza: Optional[str] = None  # ISO date — quando è prevista la scadenza
        stato_pagamento: Optional[str] = "pagato"  # "pagato" | "programmato"
        beneficiario_tipo: Optional[str] = None  # "cliente" | "subappaltatore" | "fornitore" | "interno"
        beneficiario_id: Optional[str] = None
        beneficiario_nome: Optional[str] = None
        categoria: Optional[str] = None  # "acconto" | "avanzamento" | "saldo" | "materiali" | "extra"

    @r.post("/commesse/{cid}/workflow/cassa")
    async def add_movimento(cid: str, body: MovCassaIn, user=Depends(get_current_user)):
        await _commessa(cid)
        m = {"id": UID(), "commessa_id": cid, **body.dict(), "created_at": NOW(), "created_by": user.get("id")}
        await db.commesse_cassa.insert_one(m)
        m.pop("_id", None)
        return m

    class MovCassaPatch(BaseModel):
        stato_pagamento: Optional[str] = None
        data: Optional[str] = None
        data_scadenza: Optional[str] = None
        metodo: Optional[str] = None
        importo: Optional[float] = None
        descrizione: Optional[str] = None

    @r.patch("/commesse/{cid}/workflow/cassa/{mid}")
    async def patch_movimento(cid: str, mid: str, body: MovCassaPatch, user=Depends(get_current_user)):
        upd = {k: v for k, v in body.dict().items() if v is not None}
        upd["updated_at"] = NOW()
        await db.commesse_cassa.update_one({"id": mid, "commessa_id": cid}, {"$set": upd})
        m = await db.commesse_cassa.find_one({"id": mid, "commessa_id": cid}, {"_id": 0})
        return m or {"ok": True}

    @r.get("/commesse/{cid}/workflow/cassa")
    async def list_movimenti(cid: str, user=Depends(get_current_user)):
        return await db.commesse_cassa.find({"commessa_id": cid}, {"_id": 0}).sort("data", -1).to_list(2000)

    @r.delete("/commesse/{cid}/workflow/cassa/{mid}")
    async def del_movimento(cid: str, mid: str, user=Depends(get_current_user)):
        await db.commesse_cassa.delete_one({"id": mid, "commessa_id": cid})
        return {"ok": True}

    # ---------- 8. MARGINALITÀ (live) ----------
    @r.get("/commesse/{cid}/workflow/marginalita")
    async def get_marginalita(cid: str, user=Depends(get_current_user)):
        c = await _commessa(cid)
        ricavo_preventivato = float(c.get("totale_preventivo") or 0)
        # Costo previsionale = somma prezzo_acquisto delle voci computo
        computo = c.get("computo_metrico") or {}
        items = computo.get("items") or []
        voci_map = await _voci_byid()
        costo_previsionale = 0.0
        for it in items:
            v = voci_map.get(it.get("voce_id") or "")
            if v:
                costo_previsionale += float(v.get("prezzo_acquisto") or 0) * float(it.get("qty") or 0)
        # Costo confermato = somma importi preventivi artigiani in stato ok|autorizzato + voci interne (a costo acquisto)
        prev_artigiani = await db.commesse_artigiani_preventivi.find({"commessa_id": cid, "stato": {"$in": ["ok", "autorizzato", "interno"]}}, {"_id": 0}).to_list(1000)
        costo_confermato = sum(float(p.get("importo_offerto") or 0) for p in prev_artigiani if p.get("modalita") == "artigiano")
        # Per voci interne, conto il costo_acquisto
        for p in prev_artigiani:
            if p.get("modalita") == "interno":
                for vid in (p.get("voci_riferite") or []):
                    it = next((x for x in items if x.get("id") == vid), None)
                    if it:
                        v = voci_map.get(it.get("voce_id") or "")
                        if v:
                            costo_confermato += float(v.get("prezzo_acquisto") or 0) * float(it.get("qty") or 0)
        # Cassa effettiva — conta solo movimenti pagati (stato_pagamento != "programmato")
        movimenti = await db.commesse_cassa.find({"commessa_id": cid}, {"_id": 0}).to_list(5000)
        def _paid(m): return (m.get("stato_pagamento") or "pagato") == "pagato"
        incassato = sum(float(m.get("importo") or 0) for m in movimenti if m.get("tipo") == "incasso" and _paid(m))
        uscito = sum(float(m.get("importo") or 0) for m in movimenti if m.get("tipo") == "uscita" and _paid(m))
        # Da incassare / da pagare (programmate)
        da_incassare_scadenze = sum(float(m.get("importo") or 0) for m in movimenti if m.get("tipo") == "incasso" and not _paid(m))
        da_pagare_scadenze = sum(float(m.get("importo") or 0) for m in movimenti if m.get("tipo") == "uscita" and not _paid(m))
        margine_previsionale = ricavo_preventivato - costo_previsionale
        margine_attuale = ricavo_preventivato - max(costo_confermato, costo_previsionale)
        margine_cassa = incassato - uscito  # solo a titolo informativo
        return {
            "ricavo_preventivato": round(ricavo_preventivato, 2),
            "costo_previsionale": round(costo_previsionale, 2),
            "costo_confermato": round(costo_confermato, 2),
            "incassato": round(incassato, 2),
            "uscito": round(uscito, 2),
            "margine_previsionale": round(margine_previsionale, 2),
            "margine_attuale": round(margine_attuale, 2),
            "margine_pct_previsionale": round(margine_previsionale / ricavo_preventivato * 100, 2) if ricavo_preventivato > 0 else 0,
            "margine_pct_attuale": round(margine_attuale / ricavo_preventivato * 100, 2) if ricavo_preventivato > 0 else 0,
            "saldo_cassa": round(margine_cassa, 2),
            "saldo_residuo_cliente": round(ricavo_preventivato - incassato, 2),
            "da_incassare_scadenze": round(da_incassare_scadenze, 2),
            "da_pagare_scadenze": round(da_pagare_scadenze, 2),
        }

    # ---------- 9. RESOCONTO FINALE ----------
    @r.get("/commesse/{cid}/workflow/resoconto")
    async def get_resoconto(cid: str, user=Depends(get_current_user)):
        c = await _commessa(cid)
        marg = await get_marginalita(cid, user)
        prev_artigiani = await db.commesse_artigiani_preventivi.find({"commessa_id": cid}, {"_id": 0}).to_list(1000)
        fasi = await db.commesse_fasi.find({"commessa_id": cid}, {"_id": 0}).to_list(500)
        return {
            "commessa": {"id": cid, "numero": c.get("numero"), "cliente": c.get("cliente"), "stato": c.get("stato")},
            "partenza": {
                "totale_preventivato": marg["ricavo_preventivato"],
                "costo_previsto": marg["costo_previsionale"],
                "margine_atteso": marg["margine_previsionale"],
                "margine_pct_atteso": marg["margine_pct_previsionale"],
            },
            "arrivo": {
                "incassato": marg["incassato"],
                "uscite": marg["uscito"],
                "saldo": marg["saldo_cassa"],
                "margine_attuale": marg["margine_attuale"],
                "margine_pct_attuale": marg["margine_pct_attuale"],
                "delta_margine": round(marg["margine_attuale"] - marg["margine_previsionale"], 2),
            },
            "artigiani_count": len(prev_artigiani),
            "artigiani_da_autorizzare": len([p for p in prev_artigiani if p.get("stato") == "da_autorizzare"]),
            "fasi_completate": len([f for f in fasi if f.get("stato") == "completata"]),
            "fasi_totali": len(fasi),
        }

    # ---------- 10. NOTIFICHE (per autorizzazioni) ----------
    @r.get("/notifiche/me")
    async def list_notifiche(user=Depends(get_current_user)):
        q = {"$or": [{"target_user_id": user["id"]}, {"target_role": user.get("role"), "target_user_id": None}]}
        rows = await db.notifiche.find(q, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
        return rows

    @r.post("/notifiche/{nid}/letta")
    async def mark_letta(nid: str, user=Depends(get_current_user)):
        await db.notifiche.update_one({"id": nid}, {"$set": {"letta": True}})
        return {"ok": True}

    # ---------- 12. UPLOAD FILE BINARI ----------
    @r.post("/uploads")
    async def upload_file(file: UploadFile = File(...), commessa_id: Optional[str] = Form(None), tipo: Optional[str] = Form(None), user=Depends(get_current_user)):
        # Limite 20 MB
        content = await file.read()
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(413, "File troppo grande (max 20 MB)")
        ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
        fid = uuid.uuid4().hex
        safe_name = f"{fid}.{ext}"
        path = os.path.join(UPLOADS_DIR, safe_name)
        with open(path, "wb") as f:
            f.write(content)
        meta = {
            "id": fid, "name": file.filename, "size": len(content),
            "content_type": file.content_type or "application/octet-stream",
            "url": f"/api/uploads/{safe_name}",
            "commessa_id": commessa_id, "tipo": tipo,
            "uploaded_at": NOW(), "uploaded_by": user.get("id"),
        }
        await db.uploads.insert_one(dict(meta))
        meta.pop("_id", None)
        return meta

    @r.get("/uploads/{filename}")
    async def get_upload(filename: str):
        path = os.path.join(UPLOADS_DIR, filename)
        if not os.path.exists(path):
            raise HTTPException(404, "File non trovato")
        return FileResponse(path)

    # ---------- 11. WORKFLOW STATE (snapshot completo per UI) ----------
    @r.get("/commesse/{cid}/workflow")
    async def get_workflow(cid: str, user=Depends(get_current_user)):
        c = await _commessa(cid)
        documenti = await db.commesse_documenti.find({"commessa_id": cid}, {"_id": 0}).sort("uploaded_at", -1).to_list(500)
        prev_artigiani = await db.commesse_artigiani_preventivi.find({"commessa_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
        fasi = await db.commesse_fasi.find({"commessa_id": cid}, {"_id": 0}).sort("data_inizio", 1).to_list(500)
        movimenti = await db.commesse_cassa.find({"commessa_id": cid}, {"_id": 0}).sort("data", -1).to_list(2000)
        marg = await get_marginalita(cid, user)
        return {
            "commessa": {**c, "_id": None},
            "contratto": c.get("contratto"),
            "documenti": documenti,
            "materiali_scelta": c.get("materiali_scelta"),
            "computo_metrico": c.get("computo_metrico"),
            "artigiani_preventivi": prev_artigiani,
            "fasi": fasi,
            "cassa": movimenti,
            "marginalita": marg,
        }

    return r
