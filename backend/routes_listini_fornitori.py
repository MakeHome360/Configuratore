"""
Listini Fornitori — gestione dei cataloghi prezzi NETTI dei fornitori esterni.
Distinti dalle voci backoffice "tradizionali" (muratura/manodopera) perché:
- Hanno un fornitore specifico
- Hanno prodotti dettagliati (codice, descrizione, attributi)
- Si caricano in massa via Excel/CSV
- Ricarico configurabile (default per listino, override per prodotto)
- Vengono inclusi nei pacchetti come singolo prodotto / fascia di prezzo / categoria

I prodotti di un listino possono essere selezionati nel preventivo Composite
e nei pacchetti, con flag "modificabile dal venditore".
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Body
from pydantic import BaseModel, ConfigDict


# Modelli (a livello modulo per evitare problemi di parsing body con FastAPI)
class ProdottoIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    codice: Optional[str] = ""
    nome: str
    descrizione: Optional[str] = ""
    unit: str = "pz"
    prezzo_netto: float = 0
    ricarico: Optional[float] = None
    categoria_dettaglio: Optional[str] = ""
    attributi: Optional[Dict[str, Any]] = None
    attivo: bool = True


class ListinoIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    fornitore_id: Optional[str] = ""
    fornitore_nome: str
    categoria: str
    nome: str
    ricarico_default: float = 1.8
    valuta: str = "EUR"
    note: Optional[str] = ""
    attivo: bool = True


def NOW() -> str:
    return datetime.now(timezone.utc).isoformat()


def UID() -> str:
    return uuid.uuid4().hex


def _fascia_prezzo(prezzo: float) -> str:
    """Categorizza un prodotto per fascia di prezzo (low/medium/high)."""
    if prezzo <= 0:
        return "low"
    if prezzo < 50:
        return "low"
    if prezzo < 200:
        return "medium"
    return "high"


def _normalize_prodotto(p: dict, ricarico_default: float) -> dict:
    """Calcola prezzo_rivendita e fascia_prezzo coerenti."""
    netto = float(p.get("prezzo_netto") or 0)
    ricarico = float(p.get("ricarico") if p.get("ricarico") is not None else ricarico_default or 1.8)
    p["ricarico"] = ricarico
    p["prezzo_rivendita"] = round(netto * ricarico, 2)
    p["fascia_prezzo"] = _fascia_prezzo(p["prezzo_rivendita"])
    return p


def register(api_router: APIRouter, db, get_current_user) -> None:
    r = api_router

    # ---------- CRUD Listini ----------
    @r.get("/fornitori-listini")
    async def list_listini(categoria: Optional[str] = None, user=Depends(get_current_user)):
        q: Dict[str, Any] = {}
        if categoria:
            q["categoria"] = categoria
        rows = await db.fornitori_listini.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
        # Aggiungi conteggio prodotti
        for row in rows:
            row["n_prodotti"] = len(row.get("prodotti") or [])
            row["n_prodotti_attivi"] = sum(1 for p in (row.get("prodotti") or []) if p.get("attivo", True))
        return rows

    @r.get("/fornitori-listini/{lid}")
    async def get_listino(lid: str, user=Depends(get_current_user)):
        row = await db.fornitori_listini.find_one({"id": lid}, {"_id": 0})
        if not row:
            raise HTTPException(404, "Listino non trovato")
        return row

    @r.post("/fornitori-listini")
    async def create_listino(body: ListinoIn, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin può creare listini")
        doc = {
            "id": UID(),
            **body.dict(),
            "prodotti": [],
            "created_at": NOW(),
            "updated_at": NOW(),
            "created_by": user.get("id"),
        }
        await db.fornitori_listini.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.put("/fornitori-listini/{lid}")
    async def update_listino(lid: str, body: ListinoIn, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        cur = await db.fornitori_listini.find_one({"id": lid}, {"_id": 0})
        if not cur:
            raise HTTPException(404)
        upd = {**body.dict(), "updated_at": NOW()}
        # Se cambia ricarico_default, ricalcola prezzi rivendita per prodotti senza override
        new_ricarico = body.ricarico_default
        prodotti = cur.get("prodotti") or []
        for p in prodotti:
            if p.get("ricarico") is None or abs(float(p.get("ricarico") or 0) - float(cur.get("ricarico_default") or 1.8)) < 0.0001:
                _normalize_prodotto(p, new_ricarico)
        upd["prodotti"] = prodotti
        await db.fornitori_listini.update_one({"id": lid}, {"$set": upd})
        return await db.fornitori_listini.find_one({"id": lid}, {"_id": 0})

    @r.delete("/fornitori-listini/{lid}")
    async def delete_listino(lid: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403)
        await db.fornitori_listini.delete_one({"id": lid})
        return {"ok": True}

    # ---------- CRUD Prodotti ----------
    @r.post("/fornitori-listini/{lid}/prodotti")
    async def add_prodotto(lid: str, body: ProdottoIn, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403)
        lst = await db.fornitori_listini.find_one({"id": lid}, {"_id": 0})
        if not lst:
            raise HTTPException(404)
        prodotto = {"id": UID(), **body.dict()}
        _normalize_prodotto(prodotto, lst.get("ricarico_default") or 1.8)
        await db.fornitori_listini.update_one(
            {"id": lid},
            {"$push": {"prodotti": prodotto}, "$set": {"updated_at": NOW()}},
        )
        return prodotto

    @r.put("/fornitori-listini/{lid}/prodotti/{pid}")
    async def update_prodotto(lid: str, pid: str, body: ProdottoIn, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403)
        lst = await db.fornitori_listini.find_one({"id": lid}, {"_id": 0})
        if not lst:
            raise HTTPException(404)
        prodotti = lst.get("prodotti") or []
        found = False
        for i, p in enumerate(prodotti):
            if p.get("id") == pid:
                merged = {**p, **body.dict(), "id": pid}
                _normalize_prodotto(merged, lst.get("ricarico_default") or 1.8)
                prodotti[i] = merged
                found = True
                break
        if not found:
            raise HTTPException(404, "Prodotto non trovato")
        await db.fornitori_listini.update_one(
            {"id": lid}, {"$set": {"prodotti": prodotti, "updated_at": NOW()}}
        )
        return prodotti[i]

    @r.delete("/fornitori-listini/{lid}/prodotti/{pid}")
    async def delete_prodotto(lid: str, pid: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403)
        await db.fornitori_listini.update_one(
            {"id": lid},
            {"$pull": {"prodotti": {"id": pid}}, "$set": {"updated_at": NOW()}},
        )
        return {"ok": True}

    # ---------- Bulk: cancella tutti i prodotti di un listino ----------
    @r.post("/fornitori-listini/{lid}/clear")
    async def clear_prodotti(lid: str, user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403)
        await db.fornitori_listini.update_one(
            {"id": lid}, {"$set": {"prodotti": [], "updated_at": NOW()}}
        )
        return {"ok": True}

    # ---------- Import Excel/CSV ----------
    @r.post("/fornitori-listini/{lid}/import")
    async def import_listino(
        lid: str,
        file: UploadFile = File(...),
        mode: str = "append",  # append | replace
        col_codice: str = "codice",
        col_nome: str = "nome",
        col_descrizione: str = "descrizione",
        col_prezzo: str = "prezzo_netto",
        col_unit: str = "unit",
        col_categoria: str = "categoria",
        user=Depends(get_current_user),
    ):
        if user.get("role") != "admin":
            raise HTTPException(403)
        lst = await db.fornitori_listini.find_one({"id": lid}, {"_id": 0})
        if not lst:
            raise HTTPException(404, "Listino non trovato")
        content = await file.read()
        filename = (file.filename or "").lower()
        rows: List[Dict[str, Any]] = []
        try:
            if filename.endswith(".csv") or filename.endswith(".txt"):
                import csv
                text = content.decode("utf-8", errors="ignore")
                # Auto-detect separator
                sample = text[:2048]
                sep = ";" if sample.count(";") > sample.count(",") else ","
                reader = csv.DictReader(io.StringIO(text), delimiter=sep)
                for r_ in reader:
                    rows.append({k.strip().lower(): (v or "").strip() for k, v in r_.items() if k})
            elif filename.endswith(".xlsx") or filename.endswith(".xls"):
                from openpyxl import load_workbook
                wb = load_workbook(io.BytesIO(content), data_only=True)
                ws = wb.active
                headers = [str(c.value or "").strip().lower() for c in ws[1]]
                for row in ws.iter_rows(min_row=2, values_only=True):
                    if all(v is None or str(v).strip() == "" for v in row):
                        continue
                    d = {}
                    for i, v in enumerate(row):
                        if i >= len(headers) or not headers[i]:
                            continue
                        d[headers[i]] = v
                    rows.append(d)
            else:
                raise HTTPException(400, "Formato file non supportato (usa .xlsx, .xls o .csv)")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, f"Errore parsing file: {e}")

        # Mappa colonne -> campi
        def _val(d: dict, key: str, default=""):
            for k in [key, key.lower(), key.upper(), key.capitalize()]:
                if k in d:
                    return d[k]
            return default

        ricarico_default = float(lst.get("ricarico_default") or 1.8)
        prodotti_new: List[Dict[str, Any]] = []
        skipped = 0
        for d in rows:
            nome = str(_val(d, col_nome) or "").strip()
            if not nome:
                skipped += 1
                continue
            try:
                prezzo_raw = _val(d, col_prezzo, 0)
                # Pulizia stringa prezzo (€, , .)
                if isinstance(prezzo_raw, str):
                    pulito = prezzo_raw.replace("€", "").replace(" ", "").strip()
                    if "," in pulito and "." in pulito:
                        # 1.234,56 → 1234.56
                        pulito = pulito.replace(".", "").replace(",", ".")
                    elif "," in pulito:
                        pulito = pulito.replace(",", ".")
                    prezzo = float(pulito) if pulito else 0
                else:
                    prezzo = float(prezzo_raw or 0)
            except Exception:
                prezzo = 0
            prod = {
                "id": UID(),
                "codice": str(_val(d, col_codice) or "").strip(),
                "nome": nome,
                "descrizione": str(_val(d, col_descrizione) or "").strip(),
                "unit": str(_val(d, col_unit) or lst.get("default_unit") or "pz").strip(),
                "prezzo_netto": prezzo,
                "ricarico": None,
                "categoria_dettaglio": str(_val(d, col_categoria) or "").strip(),
                "attributi": {},
                "attivo": True,
            }
            _normalize_prodotto(prod, ricarico_default)
            prodotti_new.append(prod)

        if mode == "replace":
            final = prodotti_new
        else:
            final = (lst.get("prodotti") or []) + prodotti_new

        await db.fornitori_listini.update_one(
            {"id": lid},
            {"$set": {"prodotti": final, "updated_at": NOW(), "ultimo_import": NOW()}},
        )
        return {"ok": True, "imported": len(prodotti_new), "skipped": skipped, "total": len(final)}

    # ---------- Lookup helpers (per pacchetti/composite) ----------
    @r.get("/fornitori-listini-categorie")
    async def list_categorie(user=Depends(get_current_user)):
        """Ritorna le categorie principali con conteggio listini per ciascuna."""
        cats = [
            {"key": "porte_interne", "label": "Porte interne", "icon": "🚪"},
            {"key": "porte_blindate", "label": "Porte blindate", "icon": "🔒"},
            {"key": "infissi", "label": "Infissi (finestre/persiane)", "icon": "🪟"},
            {"key": "piastrelle", "label": "Piastrelle e rivestimenti", "icon": "🧱"},
            {"key": "sanitari", "label": "Sanitari", "icon": "🚿"},
            {"key": "rubinetterie", "label": "Rubinetterie e miscelatori", "icon": "🚰"},
            {"key": "vasche_box_doccia", "label": "Vasche e box doccia", "icon": "🛁"},
            {"key": "termo_arredo", "label": "Termo arredi e radiatori", "icon": "♨️"},
            {"key": "elettrodomestici", "label": "Elettrodomestici", "icon": "🔌"},
            {"key": "cucina", "label": "Cucine componibili", "icon": "🍳"},
            {"key": "parquet_pavimenti", "label": "Parquet e pavimenti tecnici", "icon": "🪵"},
            {"key": "controsoffitti", "label": "Controsoffitti", "icon": "🏠"},
            {"key": "vernici_pitture", "label": "Vernici e pitture", "icon": "🎨"},
            {"key": "altro", "label": "Altro / Generico", "icon": "📦"},
        ]
        for c in cats:
            c["n_listini"] = await db.fornitori_listini.count_documents({"categoria": c["key"]})
        return cats

    @r.get("/fornitori-listini-prodotti/cerca")
    async def cerca_prodotti(
        categoria: Optional[str] = None,
        q: Optional[str] = None,
        fascia: Optional[str] = None,  # low | medium | high
        max_results: int = 100,
        user=Depends(get_current_user),
    ):
        """Ricerca prodotti trasversale tutti i listini (per il composite/pacchetti)."""
        filt: Dict[str, Any] = {"attivo": True}
        if categoria:
            filt["categoria"] = categoria
        listini = await db.fornitori_listini.find(filt, {"_id": 0}).to_list(500)
        out: List[Dict[str, Any]] = []
        q_low = (q or "").lower().strip()
        for lst in listini:
            for p in (lst.get("prodotti") or []):
                if not p.get("attivo", True):
                    continue
                if q_low:
                    blob = f"{p.get('nome','')} {p.get('codice','')} {p.get('descrizione','')} {p.get('categoria_dettaglio','')}".lower()
                    if q_low not in blob:
                        continue
                if fascia and p.get("fascia_prezzo") != fascia:
                    continue
                out.append({
                    **p,
                    "listino_id": lst["id"],
                    "listino_nome": lst.get("nome"),
                    "fornitore_nome": lst.get("fornitore_nome"),
                    "categoria": lst.get("categoria"),
                })
                if len(out) >= max_results:
                    return out
        return out
