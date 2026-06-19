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
    subcategoria: Optional[str] = ""  # override manuale: forza la sub-categoria del prodotto
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


# Detection regole nome/descrizione → sub-categoria effettiva
# (importante perché un fornitore "Garofoli" può stare nella categoria "porte_blindate" del listino
# ma contenere ANCHE porte interne come "Matriz", "Pannello", "Skin", ecc. che NON sono blindate)
_SUBCAT_RULES = [
    # ── PORTE ──
    ("porte_blindate", [
        "porta blindata", "porte blindate", "blindata", "blindato", "blindati",
        "porta corazzat", "corazzata", "corazzato",
        "antiscasso", "anti-scasso", "anti scasso",
        "classe rc", " rc2", " rc3", " rc4",
    ]),
    ("porte_interne", [
        # Modelli Garofoli/famosi che sono SEMPRE interne
        "matriz", "skin ", "skin\t", "skin-", "skin,", "skin.", "skin\n",
        "pannello porta", "pannello blindato",  # è il rivestimento interno
        "porta interna", "porte interne", "porta scrigno", "scrigno",
        "porta scorrevole", "porta rasomuro", "rasomuro", "raso muro",
        "porta battente",
        "porta a libro", "porta a soffietto", "porta a vetro",
        # Fallback generico: qualsiasi "porta X" o "porte X" → interna (le blindate sono già state catturate prima)
        "porta ", "porte ", "porta-", "porte-",
    ]),
    # ── INFISSI ──
    ("infissi", [
        "finestra", "finestre", "anta vasistas", "vasistas",
        "infisso", "infissi", "serramento", "serramenti",
        "persiana", "persiane", "scuretto", "scuri",
        "tapparella", "avvolgibile", "zanzariera",
    ]),
    # ── RUBINETTERIE (before sanitari: "miscelatore lavabo" is rubinetteria, not sanitario) ──
    ("rubinetterie", [
        "miscelatore", "rubinetto", "rubinetti", "rubinetteria",
        "soffione doccia", "doccia a soffione",
        "deviatore", "termostatico",
    ]),
    # ── SANITARI ──
    ("sanitari", [
        "wc ", "wc\t", "wc-", "wc,", "vaso wc",
        "bidet", "lavabo", "lavandino", "piatto doccia",
        "vasca da bagno", "vaschetta wc", "monoblocco",
        "sanitario", "sanitari",
    ]),
    # ── VASCHE / BOX DOCCIA ──
    ("vasche_box_doccia", [
        "box doccia", "cabina doccia", "porta doccia",
        "vasca idromassagg", "vasca freestanding",
    ]),
    # ── TERMO_ARREDO ──
    ("termo_arredo", [
        "radiatore", "termoarredo", "scaldasalviette", "termo-arredo",
        "calorifero",
    ]),
    # ── ELETTRODOMESTICI ──
    ("elettrodomestici", [
        "frigorifero", "frigo ", "congelator", "lavatrice", "lavastoviglie",
        "forno ", "piano cottura", "cappa cucina", "cappa aspirante",
        "microonde", "asciugatrice",
    ]),
    # ── PARQUET / PAVIMENTI ──
    ("parquet_pavimenti", [
        "parquet", "lvt ", "spc ", "laminato",
        "pavimento legno", "pavimentazione legno",
    ]),
    ("piastrelle", [
        "piastrell", "gres porcellanato", "ceramica", "mosaico",
        "rivestimento ceramico", "rivestimento bagno",
    ]),
    # ── CONTROSOFFITTI / CARTONGESSO ──
    ("controsoffitti", [
        "controsoffit", "cartongesso", "knauf", "fassaplas",
    ]),
    # ── VERNICI ──
    ("vernici_pitture", [
        "pittura", "smalto", "vernice", "tempera",
        "primer ", "fondo per", "idropittura",
    ]),
    # ── CUCINA ──
    ("cucina", [
        "cucina ", "anta cucina", "base cucina", "pensile",
        "top cucina", "composizione cucina",
    ]),
]


def _detect_subcategoria(nome: str, descrizione: str = "", categoria_listino: str = "") -> Optional[str]:
    """Auto-rileva la sub-categoria effettiva di un prodotto a partire dal nome/descrizione.
    Restituisce la chiave canonica (porte_interne/porte_blindate/infissi/...) oppure None se non rileva.
    Logica: prima match wins; in caso di conflitto su porte, prevale il match più specifico (blindata > interna).
    """
    blob = f" {(nome or '').lower()} {(descrizione or '').lower()} ".replace("\u00a0", " ")
    matched = []
    for key, words in _SUBCAT_RULES:
        for w in words:
            if w in blob:
                matched.append(key)
                break
    if not matched:
        return None
    # Priorità: se compaiono SIA porte_blindate SIA porte_interne, vince porte_interne (perché "matriz/skin" sono SEMPRE interne anche se in listino blindate)
    if "porte_interne" in matched and "porte_blindate" in matched:
        # se nel nome c'è esplicitamente "blindata" o "rc2/rc3" il vero match è blindato
        if any(t in blob for t in ["blindata", "blindato", " rc2", " rc3", " rc4", "antiscasso", "corazzat"]):
            return "porte_blindate"
        return "porte_interne"
    return matched[0]


def _normalize_prodotto(p: dict, ricarico_default: float, categoria_listino: str = "") -> dict:
    """Calcola prezzo_rivendita, fascia_prezzo e subcategoria_effettiva coerenti."""
    netto = float(p.get("prezzo_netto") or 0)
    ricarico = float(p.get("ricarico") if p.get("ricarico") is not None else ricarico_default or 1.8)
    p["ricarico"] = ricarico
    p["prezzo_rivendita"] = round(netto * ricarico, 2)
    p["fascia_prezzo"] = _fascia_prezzo(p["prezzo_rivendita"])
    # Subcategoria effettiva: detection da nome/descrizione, override esplicito vince
    explicit = (p.get("subcategoria") or "").strip().lower()
    if explicit:
        p["subcategoria_effettiva"] = explicit
    else:
        det = _detect_subcategoria(p.get("nome", ""), p.get("descrizione", ""), categoria_listino)
        p["subcategoria_effettiva"] = det or (categoria_listino or "")
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
                _normalize_prodotto(p, new_ricarico, body.categoria)
            else:
                # Anche se il ricarico non cambia, ri-detect subcategoria (in caso fosse mancante)
                if not p.get("subcategoria_effettiva"):
                    _normalize_prodotto(p, new_ricarico, body.categoria)
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
        _normalize_prodotto(prodotto, lst.get("ricarico_default") or 1.8, lst.get("categoria") or "")
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
                _normalize_prodotto(merged, lst.get("ricarico_default") or 1.8, lst.get("categoria") or "")
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
            _normalize_prodotto(prod, ricarico_default, lst.get("categoria") or "")
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
        # Conteggio listini per categoria (livello listino)
        listini = await db.fornitori_listini.find({}, {"_id": 0, "categoria": 1, "prodotti": 1}).to_list(1000)
        # Conteggio prodotti per subcategoria_effettiva (livello prodotto — più importante per l'UX)
        prod_counts: Dict[str, int] = {}
        for lst in listini:
            for p in (lst.get("prodotti") or []):
                if not p.get("attivo", True):
                    continue
                sub = (p.get("subcategoria_effettiva") or "").lower()
                if not sub:
                    sub = _detect_subcategoria(p.get("nome", ""), p.get("descrizione", ""), lst.get("categoria") or "") or (lst.get("categoria") or "")
                if sub:
                    prod_counts[sub] = prod_counts.get(sub, 0) + 1
        for c in cats:
            c["n_listini"] = sum(1 for l in listini if (l.get("categoria") or "") == c["key"])
            c["n_prodotti"] = prod_counts.get(c["key"], 0)
        return cats

    @r.get("/fornitori-listini-prodotti/cerca")
    async def cerca_prodotti(
        categoria: Optional[str] = None,
        q: Optional[str] = None,
        fascia: Optional[str] = None,  # low | medium | high
        max_results: int = 100,
        strict_categoria: bool = True,  # se True usa subcategoria_effettiva (default), se False usa categoria del listino
        user=Depends(get_current_user),
    ):
        """Ricerca prodotti trasversale tutti i listini (per il composite/pacchetti).

        Importante: ora il filtro per `categoria` usa per default la `subcategoria_effettiva` di OGNI prodotto
        (auto-rilevata dal nome). Così una "Porta Matriz" presente in un listino "Porte blindate" del fornitore
        Garofoli viene mostrata sotto "Porte interne" (è una porta interna, non blindata) — coerente con le macrocategorie del programma.
        """
        # NON pre-filtriamo per listino: dobbiamo poter restituire prodotti la cui subcategoria_effettiva
        # è diversa dalla categoria del listino padre. Carichiamo tutto e filtriamo a livello prodotto.
        listini = await db.fornitori_listini.find({}, {"_id": 0}).to_list(500)
        out: List[Dict[str, Any]] = []
        q_low = (q or "").lower().strip()
        for lst in listini:
            for p in (lst.get("prodotti") or []):
                if not p.get("attivo", True):
                    continue
                # Subcategoria effettiva (auto-detect se manca, fallback sulla categoria del listino)
                sub = (p.get("subcategoria_effettiva") or "").lower()
                if not sub:
                    det = _detect_subcategoria(p.get("nome", ""), p.get("descrizione", ""), lst.get("categoria") or "")
                    sub = det or (lst.get("categoria") or "")
                # Filtro per categoria richiesta
                if categoria:
                    if strict_categoria:
                        if sub != categoria:
                            continue
                    else:
                        if (lst.get("categoria") or "") != categoria:
                            continue
                if q_low:
                    blob = f"{p.get('nome','')} {p.get('codice','')} {p.get('descrizione','')} {p.get('categoria_dettaglio','')}".lower()
                    if q_low not in blob:
                        continue
                if fascia and p.get("fascia_prezzo") != fascia:
                    continue
                out.append({
                    **p,
                    "subcategoria_effettiva": sub,
                    "listino_id": lst["id"],
                    "listino_nome": lst.get("nome"),
                    "fornitore_nome": lst.get("fornitore_nome"),
                    # `categoria` esposta nel risultato = subcategoria effettiva del prodotto
                    # (l'UI raggruppa correttamente "Matriz" sotto "Porte interne")
                    "categoria": sub or (lst.get("categoria") or ""),
                    "categoria_listino": lst.get("categoria"),  # mantenuto per debug
                })
                if len(out) >= max_results:
                    return out
        return out

    @r.post("/fornitori-listini/{lid}/riclassifica")
    async def riclassifica_prodotti(lid: str, user=Depends(get_current_user)):
        """Ri-applica la detection di subcategoria_effettiva su tutti i prodotti del listino.
        Utile dopo un import storico o un cambio della categoria del listino padre.
        Solo admin.
        """
        if user.get("role") != "admin":
            raise HTTPException(403)
        lst = await db.fornitori_listini.find_one({"id": lid}, {"_id": 0})
        if not lst:
            raise HTTPException(404)
        prodotti = lst.get("prodotti") or []
        cambi: Dict[str, int] = {}
        for p in prodotti:
            old = (p.get("subcategoria_effettiva") or lst.get("categoria") or "")
            # Ricalcola SEMPRE (anche se c'è subcategoria, perché potrebbe essere stata ereditata da listino sbagliato)
            det = _detect_subcategoria(p.get("nome", ""), p.get("descrizione", ""), lst.get("categoria") or "")
            new = det or (lst.get("categoria") or "")
            p["subcategoria_effettiva"] = new
            if new != old:
                cambi[new] = cambi.get(new, 0) + 1
        await db.fornitori_listini.update_one({"id": lid}, {"$set": {"prodotti": prodotti, "updated_at": NOW()}})
        return {"ok": True, "n_prodotti": len(prodotti), "cambi_per_categoria": cambi}

    @r.post("/fornitori-listini-riclassifica-tutti")
    async def riclassifica_tutti(user=Depends(get_current_user)):
        """Ri-applica detection di subcategoria su TUTTI i listini esistenti (one-shot).
        Solo admin."""
        if user.get("role") != "admin":
            raise HTTPException(403)
        listini = await db.fornitori_listini.find({}, {"_id": 0}).to_list(2000)
        total_prod = 0
        total_listini = 0
        for lst in listini:
            prodotti = lst.get("prodotti") or []
            if not prodotti:
                continue
            for p in prodotti:
                det = _detect_subcategoria(p.get("nome", ""), p.get("descrizione", ""), lst.get("categoria") or "")
                p["subcategoria_effettiva"] = det or (lst.get("categoria") or "")
            await db.fornitori_listini.update_one({"id": lst["id"]}, {"$set": {"prodotti": prodotti, "updated_at": NOW()}})
            total_listini += 1
            total_prod += len(prodotti)
        return {"ok": True, "listini_aggiornati": total_listini, "prodotti_aggiornati": total_prod}
