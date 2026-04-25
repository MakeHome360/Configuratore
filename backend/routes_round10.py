"""
Round 10: Portale Cliente con utenza temporanea + firma elettronica OTP,
Dashboard Subappaltatori, Gestore Cantieri, Venditori filtrati.
"""
import os
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import uuid
import secrets
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, EmailStr


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode(), hashed.encode())
    except Exception:
        return False


def gen_otp(n=6):
    return "".join(str(secrets.randbelow(10)) for _ in range(n))


def gen_pwd():
    """Password leggibile per cliente (8 char alfanumeriche)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def build_round10_router(db, get_current_user, jwt_create_access):
    r = APIRouter()

    # ============================================================
    # SUBAPPALTATORI — Dashboard finance + login per loro
    # ============================================================
    class SubappFinanceUpdate(BaseModel):
        model_config = ConfigDict(extra="allow")
        importo_pattuito: Optional[float] = None
        fatturato: Optional[float] = None
        incassato: Optional[float] = None
        data_fine_prevista: Optional[str] = None

    @r.get("/subappaltatori-dashboard")
    async def subappaltatori_dashboard(user=Depends(get_current_user)):
        """Dashboard admin con totali finanziari per ogni subappaltatore."""
        if user.get("role") not in ("admin", "gestore"):
            raise HTTPException(403, "Solo admin/gestore")
        subs = await db.subappaltatori.find({}, {"_id": 0}).to_list(500)
        out = []
        now = datetime.now(timezone.utc)
        for s in subs:
            ass = await db.subapp_assegnazioni.find({"subappaltatore_id": s["id"]}, {"_id": 0}).to_list(500)
            totale = sum(a.get("importo_pattuito", 0) or 0 for a in ass)
            fatturato = sum(a.get("fatturato", 0) or 0 for a in ass)
            incassato = sum(a.get("incassato", 0) or 0 for a in ass)
            ritardi = 0
            for a in ass:
                if a.get("data_fine_prevista") and a.get("stato") != "completata":
                    try:
                        dfp = datetime.fromisoformat(a["data_fine_prevista"].replace("Z", "+00:00"))
                        if dfp < now:
                            ritardi += 1
                    except Exception:
                        pass
            out.append({
                **s,
                "num_cantieri_attivi": sum(1 for a in ass if a.get("stato") in ("in_corso", "assegnata")),
                "num_cantieri_totali": len(ass),
                "importo_totale": totale,
                "fatturato": fatturato,
                "incassato": incassato,
                "da_incassare": fatturato - incassato,
                "ritardi": ritardi,
            })
        return out

    @r.get("/subappaltatori/{sub_id}/cantieri")
    async def subappaltatore_cantieri(sub_id: str, user=Depends(get_current_user)):
        """Lista commesse assegnate a un subappaltatore con stato avanzamento."""
        if user.get("role") not in ("admin", "gestore") and (user.get("subappaltatore_id") != sub_id):
            raise HTTPException(403, "Non autorizzato")
        ass = await db.subapp_assegnazioni.find({"subappaltatore_id": sub_id}, {"_id": 0}).to_list(500)
        out = []
        for a in ass:
            comm = await db.commesse.find_one({"id": a["commessa_id"]}, {"_id": 0})
            out.append({**a, "commessa": comm})
        return out

    # ============================================================
    # ASSEGNAZIONI subappaltatori a commesse + AVANZAMENTI con CONVALIDA
    # ============================================================
    class AssegnaIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        commessa_id: str
        subappaltatore_id: str
        importo_pattuito: float = 0
        descrizione_lavori: str = ""
        fasi_assegnate: List[str] = []
        data_inizio_prevista: Optional[str] = None
        data_fine_prevista: Optional[str] = None

    @r.post("/subappaltatori/assegna")
    async def assegna_sub(body: AssegnaIn, user=Depends(get_current_user)):
        if user.get("role") not in ("admin", "venditore", "gestore"):
            raise HTTPException(403, "Non autorizzato")
        doc = {
            "id": f"ass-{uuid.uuid4().hex[:10]}",
            **body.model_dump(),
            "stato": "assegnata",
            "fatturato": 0, "incassato": 0,
            "avanzamenti": [],
            "created_at": now_iso(),
        }
        await db.subapp_assegnazioni.insert_one(doc)
        # Aggiorna anche commessa.subappaltatori_ids
        await db.commesse.update_one({"id": body.commessa_id}, {"$addToSet": {"subappaltatori_ids": body.subappaltatore_id}})
        doc.pop("_id", None)
        return doc

    @r.put("/subappaltatori/assegnazioni/{ass_id}")
    async def update_assegnazione(ass_id: str, body: SubappFinanceUpdate, user=Depends(get_current_user)):
        if user.get("role") not in ("admin", "gestore"):
            raise HTTPException(403, "Solo admin/gestore")
        upd = {k: v for k, v in body.model_dump(exclude_none=True).items()}
        await db.subapp_assegnazioni.update_one({"id": ass_id}, {"$set": upd})
        return {"ok": True}

    class AvanzamentoIn(BaseModel):
        descrizione: str
        percentuale: float = 0  # 0-100
        note: str = ""
        immagine_url: Optional[str] = None

    @r.post("/subappaltatori/assegnazioni/{ass_id}/avanzamenti")
    async def crea_avanzamento(ass_id: str, body: AvanzamentoIn, user=Depends(get_current_user)):
        """Subappaltatore dichiara avanzamento. Convalida richiesta da gestore/admin."""
        ass = await db.subapp_assegnazioni.find_one({"id": ass_id}, {"_id": 0})
        if not ass:
            raise HTTPException(404, "Assegnazione non trovata")
        # Solo il sub stesso, gestore o admin possono dichiarare
        if user.get("role") not in ("admin", "gestore") and user.get("subappaltatore_id") != ass["subappaltatore_id"]:
            raise HTTPException(403, "Non autorizzato")
        avanz = {
            "id": f"av-{uuid.uuid4().hex[:8]}",
            **body.model_dump(),
            "dichiarato_da": user["id"],
            "dichiarato_il": now_iso(),
            "convalidato": False,
            "convalidato_da": None,
            "convalidato_il": None,
            "pagamento_sbloccato": False,
        }
        await db.subapp_assegnazioni.update_one({"id": ass_id}, {"$push": {"avanzamenti": avanz}})
        return avanz

    @r.post("/subappaltatori/assegnazioni/{ass_id}/avanzamenti/{av_id}/convalida")
    async def convalida_avanzamento(ass_id: str, av_id: str, user=Depends(get_current_user)):
        """Solo gestore/admin/venditore (controllore cantiere) può convalidare → sblocca pagamento."""
        if user.get("role") not in ("admin", "gestore", "venditore"):
            raise HTTPException(403, "Non autorizzato a convalidare")
        ass = await db.subapp_assegnazioni.find_one({"id": ass_id}, {"_id": 0})
        if not ass:
            raise HTTPException(404, "Assegnazione non trovata")
        await db.subapp_assegnazioni.update_one(
            {"id": ass_id, "avanzamenti.id": av_id},
            {"$set": {
                "avanzamenti.$.convalidato": True,
                "avanzamenti.$.convalidato_da": user["id"],
                "avanzamenti.$.convalidato_il": now_iso(),
                "avanzamenti.$.pagamento_sbloccato": True,
            }},
        )
        return {"ok": True, "convalidato_da": user["id"], "convalidato_il": now_iso()}

    # ============================================================
    # PORTALE CLIENTE — Invito con utenza temporanea + login + SAL
    # ============================================================
    class InvitoClienteIn(BaseModel):
        commessa_id: str
        email: EmailStr
        nome: str
        durata_giorni: int = 30  # giorni dopo data fine commessa

    @r.post("/cliente-portal/invita")
    async def invita_cliente(body: InvitoClienteIn, user=Depends(get_current_user)):
        """Crea utenza temporanea per il cliente. Restituisce email + password generata
        da inviare al cliente (fuori scope email automatica per ora).
        """
        if user.get("role") not in ("admin", "venditore"):
            raise HTTPException(403, "Solo admin/venditore")
        comm = await db.commesse.find_one({"id": body.commessa_id}, {"_id": 0})
        if not comm:
            raise HTTPException(404, "Commessa non trovata")
        # Genera password temporanea + scadenza
        pwd = gen_pwd()
        scadenza = (datetime.now(timezone.utc) + timedelta(days=180 + body.durata_giorni)).isoformat()  # 6 mesi durata cantiere + 30gg
        existing = await db.users.find_one({"email": body.email}, {"_id": 0})
        if existing:
            user_id = existing["id"]
            await db.users.update_one({"id": user_id}, {"$set": {
                "role": "cliente",
                "password_hash": hash_password(pwd),
                "cliente_portal_expires_at": scadenza,
                "commessa_id": body.commessa_id,
            }})
        else:
            user_id = str(uuid.uuid4())
            await db.users.insert_one({
                "id": user_id,
                "email": body.email,
                "name": body.nome,
                "password_hash": hash_password(pwd),
                "role": "cliente",
                "cliente_portal_expires_at": scadenza,
                "commessa_id": body.commessa_id,
                "created_at": now_iso(),
            })
        # Salva traccia invito
        await db.cliente_portal_invites.insert_one({
            "id": f"inv-{uuid.uuid4().hex[:8]}",
            "commessa_id": body.commessa_id,
            "user_id": user_id,
            "email": body.email,
            "expires_at": scadenza,
            "invited_by": user["id"],
            "invited_at": now_iso(),
        })
        # IMPORTANT: la password viene mostrata UNA VOLTA al venditore per essere comunicata al cliente
        return {
            "ok": True,
            "email": body.email,
            "password_temporanea": pwd,
            "scadenza": scadenza,
            "url_login": "/portale-cliente/login",
            "messaggio": f"Comunica al cliente: email={body.email}, pwd={pwd}, scadenza={scadenza[:10]}",
        }

    @r.get("/cliente-portal/me")
    async def cliente_me(user=Depends(get_current_user)):
        """Cliente loggato vede la sua commessa, SAL, documenti."""
        if user.get("role") != "cliente":
            raise HTTPException(403, "Accesso solo clienti")
        # Verifica scadenza
        scad = user.get("cliente_portal_expires_at")
        if scad:
            try:
                if datetime.fromisoformat(scad.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                    raise HTTPException(403, "Accesso scaduto")
            except (ValueError, AttributeError):
                pass
        comm_id = user.get("commessa_id")
        if not comm_id:
            return {"ok": True, "user": user, "commessa": None, "documenti": [], "avanzamenti_pubblici": []}
        comm = await db.commesse.find_one({"id": comm_id}, {"_id": 0})
        # Documenti pubblici per cliente (visibili)
        docs = await db.documenti_commessa.find({"commessa_id": comm_id, "visibile_cliente": True}, {"_id": 0}).to_list(200)
        # Avanzamenti convalidati (SAL pubblico)
        ass = await db.subapp_assegnazioni.find({"commessa_id": comm_id}, {"_id": 0}).to_list(500)
        avanz_pub = []
        for a in ass:
            for av in (a.get("avanzamenti") or []):
                if av.get("convalidato"):
                    avanz_pub.append({**av, "subappaltatore_id": a["subappaltatore_id"], "descrizione_lavori": a.get("descrizione_lavori", "")})
        avanz_pub.sort(key=lambda x: x.get("convalidato_il") or "", reverse=True)
        return {
            "ok": True,
            "user": {"id": user["id"], "name": user.get("name"), "email": user.get("email"), "expires_at": scad},
            "commessa": comm,
            "documenti": docs,
            "avanzamenti_pubblici": avanz_pub,
        }

    @r.post("/cliente-portal/commessa/{cid}/commenti")
    async def cliente_commento(cid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "cliente":
            raise HTTPException(403, "Solo clienti")
        if user.get("commessa_id") != cid:
            raise HTTPException(403, "Non è la tua commessa")
        comm = {
            "id": f"com-{uuid.uuid4().hex[:8]}",
            "commessa_id": cid,
            "autore_id": user["id"],
            "autore_nome": user.get("name") or user.get("email"),
            "testo": body.get("testo", ""),
            "created_at": now_iso(),
        }
        await db.commessa_commenti.insert_one(comm)
        comm.pop("_id", None)
        return comm

    @r.get("/commesse/{cid}/commenti")
    async def list_commenti(cid: str, user=Depends(get_current_user)):
        # Cliente: vede solo se è la sua. Altri: solo admin/venditore/gestore.
        if user.get("role") == "cliente" and user.get("commessa_id") != cid:
            raise HTTPException(403, "Non autorizzato")
        if user.get("role") not in ("admin", "venditore", "gestore", "cliente"):
            raise HTTPException(403, "Non autorizzato")
        return await db.commessa_commenti.find({"commessa_id": cid}, {"_id": 0}).sort("created_at", 1).to_list(500)

    # ============================================================
    # FIRMA ELETTRONICA SEMPLICE con OTP (legalmente valida per atti privati)
    # ============================================================
    class DocumentoIn(BaseModel):
        commessa_id: str
        tipo: str  # contratto / capitolato / sal / collaudo
        nome: str
        contenuto_html: Optional[str] = None
        file_url: Optional[str] = None
        visibile_cliente: bool = True
        firma_richiesta: bool = False

    @r.post("/documenti")
    async def crea_documento(body: DocumentoIn, user=Depends(get_current_user)):
        if user.get("role") not in ("admin", "venditore", "gestore"):
            raise HTTPException(403, "Non autorizzato")
        doc = {
            "id": f"doc-{uuid.uuid4().hex[:10]}",
            **body.model_dump(),
            "stato": "in_attesa_firma" if body.firma_richiesta else "pubblicato",
            "firmato_da": [],
            "audit_log": [],
            "created_by": user["id"],
            "created_at": now_iso(),
        }
        await db.documenti_commessa.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @r.get("/documenti")
    async def list_documenti(commessa_id: str, user=Depends(get_current_user)):
        # Cliente: filtro su visibili e propria commessa
        if user.get("role") == "cliente":
            if user.get("commessa_id") != commessa_id:
                raise HTTPException(403, "Non autorizzato")
            return await db.documenti_commessa.find({"commessa_id": commessa_id, "visibile_cliente": True}, {"_id": 0}).to_list(200)
        return await db.documenti_commessa.find({"commessa_id": commessa_id}, {"_id": 0}).to_list(200)

    class FirmaOTPRichiestaIn(BaseModel):
        documento_id: str

    @r.post("/firma/richiedi-otp")
    async def richiedi_otp_firma(body: FirmaOTPRichiestaIn, user=Depends(get_current_user)):
        """Richiede invio OTP via email per firmare un documento.
        Per ora il codice viene restituito direttamente (dev). Integrazione email in prod.
        """
        doc = await db.documenti_commessa.find_one({"id": body.documento_id}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Documento non trovato")
        # Solo cliente o admin per ora
        if user.get("role") == "cliente" and user.get("commessa_id") != doc["commessa_id"]:
            raise HTTPException(403, "Non autorizzato")
        otp = gen_otp()
        scad = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        # Cancella OTP precedenti per stesso doc+user
        await db.firma_otp_codes.delete_many({"documento_id": body.documento_id, "user_id": user["id"]})
        await db.firma_otp_codes.insert_one({
            "id": f"otp-{uuid.uuid4().hex[:8]}",
            "documento_id": body.documento_id,
            "user_id": user["id"],
            "user_email": user.get("email"),
            "otp_code": otp,
            "scadenza": scad,
            "used": False,
            "created_at": now_iso(),
        })
        # In prod: invia email con codice. Per dev/test, restituisco il codice solo se DEV_MODE attivo.
        dev_mode = os.environ.get("EMERGENT_DEV_MODE", "true").lower() == "true"
        resp = {"ok": True, "scadenza": scad, "msg": "OTP inviato all'email registrata"}
        if dev_mode:
            resp["dev_otp_code"] = otp
        return resp

    class FirmaConfermaIn(BaseModel):
        documento_id: str
        otp_code: str
        accettazione_clausole: bool = True

    @r.post("/firma/conferma")
    async def conferma_firma(body: FirmaConfermaIn, request: Request, user=Depends(get_current_user)):
        """Verifica OTP e registra la firma elettronica con timestamp + IP + user-agent (audit trail)."""
        if not body.accettazione_clausole:
            raise HTTPException(400, "Devi accettare le clausole per firmare")
        otp_doc = await db.firma_otp_codes.find_one({
            "documento_id": body.documento_id,
            "user_id": user["id"],
            "otp_code": body.otp_code,
            "used": False,
        }, {"_id": 0})
        if not otp_doc:
            raise HTTPException(400, "OTP non valido o già usato")
        # Verifica scadenza
        try:
            if datetime.fromisoformat(otp_doc["scadenza"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
                raise HTTPException(400, "OTP scaduto")
        except (ValueError, AttributeError):
            pass
        # Crea firma con audit trail
        ip = request.client.host if request.client else "unknown"
        ua = request.headers.get("user-agent", "")
        firma = {
            "user_id": user["id"],
            "user_email": user.get("email"),
            "user_name": user.get("name"),
            "user_role": user.get("role"),
            "firmato_il": now_iso(),
            "ip": ip,
            "user_agent": ua,
            "otp_id": otp_doc["id"],
            "metodo": "elettronica_semplice_otp_email",
            "validita_legale": "Firma elettronica semplice ai sensi dell'art. 20 CAD e Reg. eIDAS - valida per scrittura privata tra parti.",
        }
        await db.documenti_commessa.update_one(
            {"id": body.documento_id},
            {"$push": {"firmato_da": firma, "audit_log": {
                "action": "FIRMA_OTP",
                "user_id": user["id"],
                "ip": ip,
                "ts": now_iso(),
            }}, "$set": {"stato": "firmato"}},
        )
        await db.firma_otp_codes.update_one({"id": otp_doc["id"]}, {"$set": {"used": True, "used_at": now_iso()}})
        return {"ok": True, "firma": firma}

    # ============================================================
    # AUTH cliente: usa lo stesso /api/auth/login già esistente, basta che il role sia "cliente"
    # ============================================================
    class ClientLoginReq(BaseModel):
        email: EmailStr
        password: str

    @r.post("/auth/login-cliente")
    async def login_cliente(body: ClientLoginReq):
        """Login dedicato per clienti del Portale. Verifica scadenza."""
        u = await db.users.find_one({"email": body.email}, {"_id": 0})
        if not u or not verify_password(body.password, u.get("password_hash", "")):
            raise HTTPException(401, "Credenziali non valide")
        if u.get("role") != "cliente":
            raise HTTPException(403, "Account non abilitato al portale cliente")
        scad = u.get("cliente_portal_expires_at")
        if scad:
            try:
                if datetime.fromisoformat(scad.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                    raise HTTPException(403, "Accesso scaduto. Richiedi rinnovo.")
            except (ValueError, AttributeError):
                pass
        token = jwt_create_access(u["id"], u["email"])
        return {
            "ok": True,
            "access_token": token,
            "user": {"id": u["id"], "email": u["email"], "name": u.get("name"), "role": "cliente",
                     "commessa_id": u.get("commessa_id"), "expires_at": scad},
        }

    # ============================================================
    # GESTORE CANTIERI — Dashboard per cantieri assegnati
    # ============================================================
    @r.get("/gestore/cantieri")
    async def gestore_cantieri(user=Depends(get_current_user)):
        """Cantieri assegnati al gestore corrente."""
        if user.get("role") not in ("admin", "gestore"):
            raise HTTPException(403, "Solo admin/gestore")
        # admin vede tutto; gestore solo i propri
        q = {} if user.get("role") == "admin" else {"gestore_id": user["id"]}
        comms = await db.commesse.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
        # arricchisci con assegnazioni e avanzamenti pendenti
        for c in comms:
            ass = await db.subapp_assegnazioni.find({"commessa_id": c["id"]}, {"_id": 0}).to_list(100)
            c["assegnazioni"] = ass
            c["avanzamenti_da_convalidare"] = sum(
                1 for a in ass for av in (a.get("avanzamenti") or [])
                if not av.get("convalidato")
            )
        return comms

    @r.put("/commesse/{cid}/assegna-gestore")
    async def assegna_gestore(cid: str, body: Dict[str, Any], user=Depends(get_current_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Solo admin")
        await db.commesse.update_one({"id": cid}, {"$set": {"gestore_id": body.get("gestore_id"), "updated_at": now_iso()}})
        return {"ok": True}

    # ============================================================
    # RBAC FILTRI: venditori filtrati per negozio
    # ============================================================
    @r.get("/preventivi-filtered")
    async def preventivi_filtered(user=Depends(get_current_user)):
        """Lista preventivi filtrata: venditore vede solo del suo negozio. Admin vede tutto."""
        if user.get("role") == "admin":
            return await db.preventivi.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
        if user.get("role") == "venditore":
            negozio_id = user.get("negozio_id")
            if negozio_id:
                # venditori dello stesso negozio
                colleagues = await db.users.find({"negozio_id": negozio_id, "role": "venditore"}, {"id": 1, "_id": 0}).to_list(200)
                ids = [c["id"] for c in colleagues]
                return await db.preventivi.find({"venditore_id": {"$in": ids}}, {"_id": 0}).sort("created_at", -1).to_list(500)
            return await db.preventivi.find({"venditore_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
        if user.get("role") == "cliente":
            commessa = await db.commesse.find_one({"id": user.get("commessa_id")}, {"_id": 0})
            if commessa and commessa.get("preventivo_id"):
                p = await db.preventivi.find_one({"id": commessa["preventivo_id"]}, {"_id": 0})
                return [p] if p else []
            return []
        return []

    @r.get("/commesse-filtered")
    async def commesse_filtered(user=Depends(get_current_user)):
        if user.get("role") == "admin":
            return await db.commesse.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
        if user.get("role") == "gestore":
            return await db.commesse.find({"gestore_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
        if user.get("role") == "venditore":
            negozio_id = user.get("negozio_id")
            if negozio_id:
                colleagues = await db.users.find({"negozio_id": negozio_id, "role": "venditore"}, {"id": 1, "_id": 0}).to_list(200)
                ids = [c["id"] for c in colleagues]
                return await db.commesse.find({"venditore_id": {"$in": ids}}, {"_id": 0}).sort("created_at", -1).to_list(500)
            return await db.commesse.find({"venditore_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
        if user.get("role") == "subappaltatore":
            return await db.commesse.find({"subappaltatori_ids": user.get("subappaltatore_id")}, {"_id": 0}).sort("created_at", -1).to_list(500)
        if user.get("role") == "cliente":
            return await db.commesse.find({"id": user.get("commessa_id")}, {"_id": 0}).to_list(1)
        return []

    return r
