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
from pydantic import BaseModel, ConfigDict

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
    @r.post("/commesse-bulk-regen-computo")
    async def bulk_regen_computo(user=Depends(get_current_user)):
        """One-time: rigenera computo metrico per TUTTE le commesse senza computo. Solo admin."""
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        commesse = await db.commesse.find({}, {"_id": 0}).to_list(5000)
        fixed = 0; skipped = 0
        for c in commesse:
            if ((c.get("computo_metrico") or {}).get("items") or []):
                skipped += 1; continue
            prev_id = c.get("preventivo_id")
            if not prev_id:
                skipped += 1; continue
            try:
                res = await gen_computo(c["id"], user)
                if res.get("items"): fixed += 1
                else: skipped += 1
            except Exception:
                skipped += 1
        return {"fixed": fixed, "skipped": skipped, "total": len(commesse)}

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
        # Se PACCHETTO senza items → deriva dal package
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
        # Preserva le assegnazioni esistenti (matching su voce_id) per non perdere
        # il lavoro fatto dall'utente quando rigenera il computo.
        existing_cm = (c.get("computo_metrico") or {}).get("items") or []
        prev_assigns = {}  # voce_id (catalog) -> assignment data
        for ex in existing_cm:
            key = ex.get("voce_id")
            if key and ex.get("stato_assegnazione") and ex.get("stato_assegnazione") != "da_assegnare":
                prev_assigns[key] = {
                    "stato_assegnazione": ex.get("stato_assegnazione"),
                    "artigiano_id": ex.get("artigiano_id"),
                    "artigiano_nome": ex.get("artigiano_nome"),
                    "note_assegnazione": ex.get("note_assegnazione"),
                    "assigned_at": ex.get("assigned_at"),
                    "assigned_by": ex.get("assigned_by"),
                }
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
            cat_voce_id = v.get("voce_id") or v.get("id")
            kept = prev_assigns.get(cat_voce_id) or {}
            items.append({
                "id": UID(),
                "voce_id": cat_voce_id,
                "name": v.get("name") or v.get("descrizione") or "—",
                "qty": qty,
                "unit": v.get("unit") or "pz",
                "prezzo_unit": prezzo_unit,
                "totale": totale,
                "category": v.get("category") or "",
                "stato_assegnazione": kept.get("stato_assegnazione") or "da_assegnare",
                "artigiano_id": kept.get("artigiano_id"),
                "artigiano_nome": kept.get("artigiano_nome"),
                "note_assegnazione": kept.get("note_assegnazione"),
                "assigned_at": kept.get("assigned_at"),
                "assigned_by": kept.get("assigned_by"),
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

    # ---------- 4c. IMPORTA "VOCI E ACQUISTI" DAL COMPUTO METRICO ----------
    class ImportVociAcquistiIn(BaseModel):
        only_assigned: bool = False  # se True, importa solo le voci con stato_assegnazione != "da_assegnare"
        merge: bool = True  # se True, aggiunge solo voci non già presenti (match per voce_id); se False, sovrascrive
        category_filter: Optional[List[str]] = None  # filtra per categoria (es. ["MURATURA","IMPIANTI"])

    @r.post("/commesse/{cid}/workflow/voci-acquisti/import-from-computo")
    async def import_voci_acquisti(cid: str, body: ImportVociAcquistiIn, user=Depends(get_current_user)):
        """Auto-popola la lista 'Voci e Acquisti' a partire dagli item del Computo Metrico.
        - stima_backoffice = prezzo_acquisto (da voci_backoffice) × qty
        - preventivato = inizializzato a 0 (compilato a mano dopo il sub)
        - subappaltatore = artigiano_nome se la voce è stata già assegnata, altrimenti vuoto
        - merge=True (default): salta voci con voce_id già presenti in voci_acquisti
        - only_assigned=True: importa solo voci con stato_assegnazione != "da_assegnare"
        """
        com = await db.commesse.find_one({"id": cid}, {"_id": 0})
        if not com:
            raise HTTPException(404, "Commessa non trovata")
        cm_items = ((com.get("computo_metrico") or {}).get("items") or [])
        if not cm_items:
            raise HTTPException(400, "Computo metrico vuoto. Rigenera il computo prima di importare.")

        # Carica voci_backoffice una volta per recuperare prezzo_acquisto
        voci_back_list = await db.voci_backoffice.find({}, {"_id": 0}).to_list(2000)
        voci_back = {v["id"]: v for v in voci_back_list if v.get("id")}

        existing = list(com.get("voci_acquisti") or [])
        existing_voce_ids = {v.get("voce_id") for v in existing if v.get("voce_id")}

        added = 0
        skipped = 0
        out_items = list(existing) if body.merge else []

        for cm_it in cm_items:
            voce_id = cm_it.get("voce_id")
            qty = float(cm_it.get("qty") or 0)
            name = cm_it.get("name") or ""
            stato_ass = cm_it.get("stato_assegnazione") or "da_assegnare"
            categoria = (cm_it.get("category") or "")

            # Filtri
            if body.only_assigned and stato_ass == "da_assegnare":
                skipped += 1
                continue
            if body.category_filter and categoria and categoria not in body.category_filter:
                skipped += 1
                continue
            if body.merge and voce_id and voce_id in existing_voce_ids:
                skipped += 1
                continue

            # Recupera prezzo_acquisto da voci_backoffice; fallback a prezzo_unit del computo
            prezzo_acquisto = 0.0
            vb = voci_back.get(voce_id) if voce_id else None
            if vb:
                prezzo_acquisto = float(vb.get("prezzo_acquisto") or 0)
            if prezzo_acquisto == 0:
                # Fallback: usa il prezzo_unit dal computo (è prezzo_rivendita) — sovra-stimato ma meglio di 0
                prezzo_acquisto = float(cm_it.get("prezzo_unit") or 0)

            stima_backoffice = round(prezzo_acquisto * qty, 2)
            subappaltatore = cm_it.get("artigiano_nome") if stato_ass in ("artigiano", "autorizzato") else ""

            out_items.append({
                "voce_id": voce_id or "",
                "voce": name,
                "subappaltatore": subappaltatore or "",
                "qty": qty,
                "stima_backoffice": stima_backoffice,
                "preventivato": 0,
                "effettivo": 0,
                "pagato": False,
                "note": "",
                "from_computo": True,
                "computo_item_id": cm_it.get("id"),
                "category": categoria,
                "imported_at": NOW(),
            })
            existing_voce_ids.add(voce_id)
            added += 1

        await db.commesse.update_one({"id": cid}, {"$set": {"voci_acquisti": out_items}})
        return {"ok": True, "added": added, "skipped": skipped, "total": len(out_items)}


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
    # Template fasi pre-impostate per cantieri di ristrutturazione
    FASI_TEMPLATES = [
        {"key": "allestimento", "titolo": "Allestimento cantiere e protezioni", "durata_gg": 1, "ordine": 1, "color": "#71717A", "categoria": "preparazione"},
        {"key": "demolizioni", "titolo": "Demolizioni e rimozioni", "durata_gg": 3, "ordine": 2, "color": "#DC2626", "categoria": "demolizioni"},
        {"key": "smaltimenti", "titolo": "Smaltimento macerie", "durata_gg": 1, "ordine": 3, "color": "#52525B", "categoria": "smaltimenti"},
        {"key": "muratura", "titolo": "Muratura nuovi tramezzi", "durata_gg": 4, "ordine": 4, "color": "#A16207", "categoria": "muratura"},
        {"key": "tracce_impianti", "titolo": "Tracce impianti elettrico/idraulico", "durata_gg": 3, "ordine": 5, "color": "#7C3AED", "categoria": "impianti"},
        {"key": "impianto_idraulico", "titolo": "Impianto idraulico", "durata_gg": 5, "ordine": 6, "color": "#0EA5E9", "categoria": "impianti"},
        {"key": "impianto_elettrico", "titolo": "Impianto elettrico", "durata_gg": 5, "ordine": 7, "color": "#7C3AED", "categoria": "impianti"},
        {"key": "impianto_termico", "titolo": "Impianto termico/condizionamento (HVAC)", "durata_gg": 4, "ordine": 8, "color": "#14B8A6", "categoria": "impianti"},
        {"key": "intonaco", "titolo": "Intonaci e rasature", "durata_gg": 5, "ordine": 9, "color": "#D97706", "categoria": "finiture"},
        {"key": "massetto", "titolo": "Massetto per pavimenti", "durata_gg": 2, "ordine": 10, "color": "#92400E", "categoria": "finiture"},
        {"key": "rivestimenti_bagno", "titolo": "Rivestimenti bagno e cucina", "durata_gg": 5, "ordine": 11, "color": "#0F766E", "categoria": "finiture"},
        {"key": "pavimenti", "titolo": "Posa pavimenti", "durata_gg": 4, "ordine": 12, "color": "#15803D", "categoria": "finiture"},
        {"key": "controsoffitti", "titolo": "Controsoffitti in cartongesso", "durata_gg": 3, "ordine": 13, "color": "#0369A1", "categoria": "finiture"},
        {"key": "tinteggiatura", "titolo": "Tinteggiatura pareti e soffitti", "durata_gg": 4, "ordine": 14, "color": "#FBBF24", "categoria": "finiture"},
        {"key": "infissi", "titolo": "Sostituzione/posa infissi", "durata_gg": 2, "ordine": 15, "color": "#2563EB", "categoria": "infissi"},
        {"key": "porte_interne", "titolo": "Posa porte interne", "durata_gg": 1, "ordine": 16, "color": "#9333EA", "categoria": "infissi"},
        {"key": "sanitari", "titolo": "Posa sanitari e rubinetterie", "durata_gg": 1, "ordine": 17, "color": "#06B6D4", "categoria": "impianti"},
        {"key": "elettrodomestici", "titolo": "Installazione elettrodomestici", "durata_gg": 1, "ordine": 18, "color": "#EC4899", "categoria": "impianti"},
        {"key": "cucina", "titolo": "Montaggio cucina", "durata_gg": 2, "ordine": 19, "color": "#F97316", "categoria": "arredo"},
        {"key": "pulizia_finale", "titolo": "Pulizia finale cantiere", "durata_gg": 1, "ordine": 20, "color": "#10B981", "categoria": "consegna"},
        {"key": "consegna_cliente", "titolo": "Consegna chiavi al cliente", "durata_gg": 1, "ordine": 21, "color": "#1FAE52", "categoria": "consegna"},
    ]

    @r.get("/fasi-templates")
    async def list_fasi_templates(user=Depends(get_current_user)):
        return FASI_TEMPLATES

    class FaseIn(BaseModel):
        titolo: str
        template_key: Optional[str] = None
        categoria: Optional[str] = None
        color: Optional[str] = None
        voce_ids: List[str] = []
        # Tipo esecutore: interno (operai propri), cliente (lavori in economia), artigiano (sub-appaltatore), fornitore (es. cucinieri)
        eseguito_da_tipo: str = "artigiano"
        eseguito_da: str = "artigiano"  # legacy
        artigiano_id: Optional[str] = None
        artigiano_nome: Optional[str] = None
        fornitore_nome: Optional[str] = None
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

    # ---------- 12b. FOTO CANTIERE (raggruppate per giorno) ----------
    class FotoCantiereIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        data: str  # YYYY-MM-DD
        titolo: str = ""
        foto: List[Dict[str, Any]] = []  # [{url, name, content_type, size}]
        note: Optional[str] = ""

    @r.get("/commesse/{cid}/foto-cantiere")
    async def list_foto_cantiere(cid: str, user=Depends(get_current_user)):
        await _commessa(cid)  # auth check
        rows = await db.commesse_foto_cantiere.find({"commessa_id": cid}, {"_id": 0}).sort("data", -1).to_list(2000)
        return rows

    @r.post("/commesse/{cid}/foto-cantiere")
    async def create_foto_cantiere(cid: str, body: FotoCantiereIn, user=Depends(get_current_user)):
        await _commessa(cid)
        doc = {
            "id": uuid.uuid4().hex,
            "commessa_id": cid,
            "data": body.data,
            "titolo": body.titolo or "",
            "foto": body.foto or [],
            "note": body.note or "",
            "uploaded_at": NOW(),
            "uploaded_by": user.get("id"),
        }
        await db.commesse_foto_cantiere.insert_one(dict(doc))
        doc.pop("_id", None)
        return doc

    @r.put("/commesse/{cid}/foto-cantiere/{gid}")
    async def update_foto_cantiere(cid: str, gid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        await _commessa(cid)
        body.pop("_id", None); body.pop("id", None)
        await db.commesse_foto_cantiere.update_one({"id": gid, "commessa_id": cid}, {"$set": body})
        return {"ok": True}

    @r.delete("/commesse/{cid}/foto-cantiere/{gid}")
    async def delete_foto_cantiere(cid: str, gid: str, user=Depends(get_current_user)):
        await _commessa(cid)
        await db.commesse_foto_cantiere.delete_one({"id": gid, "commessa_id": cid})
        return {"ok": True}

    # ---------- 11. WORKFLOW STATE (snapshot completo per UI) ----------
    @r.get("/commesse/{cid}/workflow")
    async def get_workflow(cid: str, user=Depends(get_current_user)):
        c = await _commessa(cid)
        documenti = await db.commesse_documenti.find({"commessa_id": cid}, {"_id": 0}).sort("uploaded_at", -1).to_list(500)
        prev_artigiani = await db.commesse_artigiani_preventivi.find({"commessa_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
        fasi = await db.commesse_fasi.find({"commessa_id": cid}, {"_id": 0}).sort("data_inizio", 1).to_list(500)
        movimenti = await db.commesse_cassa.find({"commessa_id": cid}, {"_id": 0}).sort("data", -1).to_list(2000)
        marg = await get_marginalita(cid, user)
        foto_cantiere = await db.commesse_foto_cantiere.find({"commessa_id": cid}, {"_id": 0}).sort("data", -1).to_list(2000)
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
            "foto_cantiere": foto_cantiere,
        }

    # ---------- 12. DASHBOARD ALERTS — notifiche live cross-cantieri ----------
    @r.get("/dashboard-alerts")
    async def dashboard_alerts(user=Depends(get_current_user)):
        """Riepilogo intelligente per venditore/admin/gestore:
        - Pagamenti in scadenza ≤7gg (incassi e uscite)
        - Pagamenti scaduti (programmati con data passata)
        - Documenti sub-appaltatore in scadenza ≤30gg / scaduti
        - Checklist cantieri incomplete da >30gg
        """
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc).date()
        in7 = (today + timedelta(days=7)).isoformat()
        in30 = (today + timedelta(days=30)).isoformat()
        d30ago = (today - timedelta(days=30)).isoformat()
        today_iso = today.isoformat()

        # Filtra commesse per ruolo
        com_filter = {}
        if user.get("role") == "venditore":
            com_filter = {"venditore_id": user.get("id")}
        commesse = await db.commesse.find(com_filter, {"_id": 0}).to_list(2000)
        com_ids = [c.get("id") for c in commesse]
        com_by_id = {c.get("id"): c for c in commesse}

        # Pagamenti programmati su queste commesse
        mov = await db.commesse_cassa.find({
            "commessa_id": {"$in": com_ids},
            "stato_pagamento": "programmato",
        }, {"_id": 0}).to_list(5000)

        scadenze_imminenti = []
        scadenze_scadute = []
        for m in mov:
            sc = m.get("data_scadenza") or m.get("data")
            if not sc:
                continue
            entry = {
                "id": m.get("id"),
                "commessa_id": m.get("commessa_id"),
                "commessa_numero": (com_by_id.get(m.get("commessa_id")) or {}).get("numero"),
                "cliente_nome": ((com_by_id.get(m.get("commessa_id")) or {}).get("cliente") or {}).get("nome"),
                "direzione": m.get("tipo"),
                "beneficiario_nome": m.get("beneficiario_nome") or m.get("artigiano_nome"),
                "importo": float(m.get("importo") or 0),
                "data_scadenza": sc,
                "categoria": m.get("categoria"),
                "descrizione": m.get("descrizione"),
                "giorni_rimasti": (datetime.fromisoformat(sc.replace("Z", "+00:00")).date() - today).days if "T" not in sc else (datetime.fromisoformat(sc[:10]).date() - today).days,
            }
            if sc < today_iso:
                scadenze_scadute.append(entry)
            elif sc <= in7:
                scadenze_imminenti.append(entry)

        # Documenti sub-appaltatore in scadenza/scaduti
        sub_docs = await db.subapp_documenti.find({}, {"_id": 0}).to_list(5000)
        docs_alert = []
        sub_ids_with_docs = set()
        for d in sub_docs:
            ds = d.get("data_scadenza")
            if not ds:
                continue
            sub_ids_with_docs.add(d.get("subappaltatore_id"))
            if ds < today_iso:
                docs_alert.append({**d, "stato_alert": "scaduto"})
            elif ds <= in30:
                docs_alert.append({**d, "stato_alert": "in_scadenza", "giorni_rimasti": (datetime.fromisoformat(ds[:10]).date() - today).days})

        # Checklist incomplete da >30gg (commesse create da 30+ gg con cassa "incasso" presente ma documenti pratica edilizia mancanti)
        checklist_alerts = []
        for c in commesse:
            ca = c.get("created_at") or ""
            if not ca or ca[:10] > d30ago:
                continue
            if c.get("stato") in ("completata", "sospesa"):
                continue
            documenti_c = await db.commesse_documenti.find({"commessa_id": c.get("id")}, {"_id": 0}).to_list(200)
            mat = c.get("materiali_scelta") or {}
            cm = c.get("computo_metrico") or {}
            mancanti = []
            if not (c.get("contratto") or {}).get("firmato"):
                mancanti.append("Contratto firmato")
            if not any("cila" in (d.get("tipo") or d.get("name") or "").lower() or "scia" in (d.get("tipo") or d.get("name") or "").lower() or "permesso" in (d.get("tipo") or d.get("name") or "").lower() for d in documenti_c):
                mancanti.append("Pratica edilizia (CILA/SCIA)")
            if not (mat.get("items") or []):
                mancanti.append("Scelta materiali")
            if not (cm.get("items") or []):
                mancanti.append("Computo metrico")
            if mancanti:
                checklist_alerts.append({
                    "commessa_id": c.get("id"),
                    "commessa_numero": c.get("numero"),
                    "cliente_nome": (c.get("cliente") or {}).get("nome"),
                    "giorni_aperta": (today - datetime.fromisoformat(ca[:10]).date()).days,
                    "mancanti": mancanti,
                })

        # Riassunto per badge sidebar
        tot_alerts = len(scadenze_imminenti) + len(scadenze_scadute) + len([d for d in docs_alert if d["stato_alert"] == "scaduto"]) + len(checklist_alerts)

        return {
            "scadenze_imminenti": sorted(scadenze_imminenti, key=lambda x: x["data_scadenza"]),
            "scadenze_scadute": sorted(scadenze_scadute, key=lambda x: x["data_scadenza"]),
            "documenti_sub_alert": sorted(docs_alert, key=lambda x: x.get("data_scadenza") or ""),
            "checklist_alerts": checklist_alerts,
            "totale_alert_critici": tot_alerts,
            "generated_at": NOW(),
        }

    # ---------- 13. DOCUMENTI TEMPLATE AZIENDA (contratti/capitolati vergini) ----------
    DOC_TEMPLATE_TIPI = [
        {"id": "contratto_cliente", "label": "Contratto cliente"},
        {"id": "contratto_subappalto", "label": "Contratto subappalto"},
        {"id": "capitolato", "label": "Capitolato tecnico"},
        {"id": "privacy_gdpr", "label": "Privacy / GDPR"},
        {"id": "checklist_sopralluogo", "label": "Checklist sopralluogo"},
        {"id": "verbale_consegna", "label": "Verbale consegna lavori"},
        {"id": "sal_template", "label": "Stato Avanzamento Lavori"},
        {"id": "altro", "label": "Altro"},
    ]

    @r.get("/documenti-template/tipi")
    async def doc_template_tipi(user=Depends(get_current_user)):
        return DOC_TEMPLATE_TIPI

    @r.get("/documenti-template")
    async def doc_template_list(user=Depends(get_current_user)):
        rows = await db.documenti_template.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(500)
        return rows

    @r.post("/documenti-template")
    async def doc_template_upload(
        file: UploadFile = File(...),
        nome: str = Form(...),
        tipo: str = Form("altro"),
        descrizione: Optional[str] = Form(None),
        user=Depends(get_current_user),
    ):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin può caricare template aziendali")
        content = await file.read()
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(413, "File troppo grande (max 20 MB)")
        ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
        fid = UID()
        safe_name = f"tpl-{fid}.{ext}"
        path = os.path.join(UPLOADS_DIR, safe_name)
        with open(path, "wb") as f:
            f.write(content)
        meta = {
            "id": fid,
            "nome": nome,
            "tipo": tipo,
            "descrizione": descrizione or "",
            "filename_originale": file.filename,
            "size": len(content),
            "content_type": file.content_type or "application/octet-stream",
            "url": f"/api/uploads/{safe_name}",
            "uploaded_at": NOW(),
            "uploaded_by": user.get("id"),
            "uploaded_by_name": user.get("name") or user.get("email"),
        }
        await db.documenti_template.insert_one(dict(meta))
        meta.pop("_id", None)
        return meta

    @r.delete("/documenti-template/{tid}")
    async def doc_template_delete(tid: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin può eliminare template")
        doc = await db.documenti_template.find_one({"id": tid}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Template non trovato")
        # rimuovi file fisico
        try:
            url = doc.get("url") or ""
            fname = url.split("/")[-1]
            if fname:
                p = os.path.join(UPLOADS_DIR, fname)
                if os.path.exists(p):
                    os.remove(p)
        except Exception:
            pass
        await db.documenti_template.delete_one({"id": tid})
        return {"ok": True}

    return r
