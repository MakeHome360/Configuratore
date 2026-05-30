from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import base64
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from bson import ObjectId

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from packages_seed import LAVORAZIONI_CATALOG, DEFAULT_PACKAGES, DEFAULT_OPTIONAL, BATHROOM_TIERS
from routes_biz import build_biz_router
from routes_round10 import build_round10_router
from routes_render import build_render_router
from audit import build_audit_router, audit_log

# ---------------- Setup ----------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Ristruttura CAD API")
api = APIRouter(prefix="/api")

JWT_ALGO = "HS256"
JWT_SECRET_KEY_NAME = "JWT_SECRET"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------------- Auth helpers ----------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def jwt_secret() -> str:
    return os.environ[JWT_SECRET_KEY_NAME]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        "type": "access",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGO)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGO)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGO])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------- Models ----------------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str
    requested_role: str = "cliente"  # cliente, venditore, subappaltatore, gestore
    phone: Optional[str] = None
    message: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str = "cliente"


# Allowed roles in the system
ALLOWED_ROLES = ("admin", "venditore", "subappaltatore", "cliente", "gestore")
# Default account expiry (days) per role; None = no expiry
DEFAULT_EXPIRY_DAYS = {
    "cliente": 180,
    "subappaltatore": 365,
    "venditore": None,
    "gestore": None,
    "admin": None,
}


def compute_expires_at(role: str, override_iso: Optional[str] = None) -> Optional[str]:
    if override_iso:
        return override_iso
    days = DEFAULT_EXPIRY_DAYS.get(role)
    if days is None:
        return None
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _user_is_expired(user: Dict[str, Any]) -> bool:
    exp = user.get("expires_at")
    if not exp:
        return False
    try:
        return datetime.fromisoformat(exp) < datetime.now(timezone.utc)
    except Exception:
        return False


class ProjectIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str
    data: Dict[str, Any]
    thumbnail: Optional[str] = None
    preventivo_id: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    user_id: str
    name: str
    data: Dict[str, Any]
    thumbnail: Optional[str] = None
    created_at: str
    updated_at: str


class MaterialItem(BaseModel):
    id: str
    category: str       # floor, wall, ceiling, plumbing, electrical, furniture, fixture, appliance, light
    name: str
    unit: str           # m2, ml, pz
    price: float
    color: Optional[str] = "#D4D4D8"


class AIRenderReq(BaseModel):
    image_base64: str
    prompt: str
    style: Optional[str] = "photorealistic interior"


# ---------------- Default Catalog ----------------
DEFAULT_CATALOG: List[Dict[str, Any]] = [
    # Floors (€/m²)
    {"id": "floor-parquet", "category": "floor", "name": "Parquet in rovere", "unit": "m2", "price": 85.0, "color": "#B48A60"},
    {"id": "floor-ceramic", "category": "floor", "name": "Gres porcellanato", "unit": "m2", "price": 45.0, "color": "#E4E4E7"},
    {"id": "floor-tile-3060", "category": "floor", "name": "Piastrelle 30x60 cm", "unit": "m2", "price": 32.0, "color": "#D4D4D8"},
    {"id": "floor-tile-6060", "category": "floor", "name": "Piastrelle 60x60 cm", "unit": "m2", "price": 38.0, "color": "#E4E4E7"},
    {"id": "floor-tile-60120", "category": "floor", "name": "Piastrelle 60x120 cm (effetto marmo)", "unit": "m2", "price": 58.0, "color": "#F4F4F5"},
    {"id": "floor-tile-8080", "category": "floor", "name": "Piastrelle 80x80 cm", "unit": "m2", "price": 52.0, "color": "#E7E5E4"},
    {"id": "floor-tile-225x90", "category": "floor", "name": "Piastrelle 22.5x90 cm (effetto legno)", "unit": "m2", "price": 42.0, "color": "#C9A37B"},
    {"id": "floor-tile-25x150", "category": "floor", "name": "Piastrelle 25x150 cm (effetto legno XL)", "unit": "m2", "price": 56.0, "color": "#B48A60"},
    {"id": "floor-marble", "category": "floor", "name": "Marmo Carrara", "unit": "m2", "price": 180.0, "color": "#F4F4F5"},
    {"id": "floor-laminate", "category": "floor", "name": "Laminato", "unit": "m2", "price": 28.0, "color": "#C9A37B"},
    {"id": "floor-concrete", "category": "floor", "name": "Resina / Microcemento", "unit": "m2", "price": 95.0, "color": "#A1A1AA"},
    # Wall tiles
    {"id": "wall-tile-bagno", "category": "wall", "name": "Piastrelle bagno 25x40 cm", "unit": "m2", "price": 32.0, "color": "#DCE4EC"},
    {"id": "wall-tile-cucina", "category": "wall", "name": "Piastrelle cucina 10x10 cm", "unit": "m2", "price": 42.0, "color": "#E7E5E4"},
    # Walls (€/m²)
    {"id": "wall-paint", "category": "wall", "name": "Pittura lavabile", "unit": "m2", "price": 12.0, "color": "#FFFFFF"},
    {"id": "wall-wallpaper", "category": "wall", "name": "Carta da parati", "unit": "m2", "price": 35.0, "color": "#E7D9C4"},
    {"id": "wall-tile", "category": "wall", "name": "Rivestimento ceramico", "unit": "m2", "price": 55.0, "color": "#DCE4EC"},
    {"id": "wall-woodpanel", "category": "wall", "name": "Boiserie in legno", "unit": "m2", "price": 120.0, "color": "#8B6A43"},
    # Ceiling
    {"id": "ceil-paint", "category": "ceiling", "name": "Tinteggio soffitto", "unit": "m2", "price": 10.0, "color": "#FFFFFF"},
    {"id": "ceil-plaster", "category": "ceiling", "name": "Cartongesso controsoffitto", "unit": "m2", "price": 42.0, "color": "#F4F4F5"},
    # Systems (€/m² room)
    {"id": "sys-electrical", "category": "electrical", "name": "Rifacimento impianto elettrico", "unit": "m2", "price": 55.0, "color": "#FBBF24"},
    {"id": "sys-plumbing", "category": "plumbing", "name": "Impianto idraulico", "unit": "m2", "price": 65.0, "color": "#3B82F6"},
    # Furniture (per piece)
    {"id": "furn-sofa", "category": "furniture", "name": "Divano", "unit": "pz", "price": 1200.0, "color": "#71717A"},
    {"id": "furn-bed", "category": "furniture", "name": "Letto matrimoniale", "unit": "pz", "price": 900.0, "color": "#A8A29E"},
    {"id": "furn-table", "category": "furniture", "name": "Tavolo", "unit": "pz", "price": 450.0, "color": "#8B6A43"},
    {"id": "furn-chair", "category": "furniture", "name": "Sedia", "unit": "pz", "price": 120.0, "color": "#52525B"},
    {"id": "furn-wardrobe", "category": "furniture", "name": "Armadio", "unit": "pz", "price": 800.0, "color": "#78716C"},
    {"id": "furn-kitchen", "category": "furniture", "name": "Cucina lineare", "unit": "ml", "price": 650.0, "color": "#D6D3D1"},
    # Fixtures
    {"id": "fix-toilet", "category": "fixture", "name": "WC sospeso", "unit": "pz", "price": 380.0, "color": "#FFFFFF"},
    {"id": "fix-sink", "category": "fixture", "name": "Lavabo", "unit": "pz", "price": 220.0, "color": "#FFFFFF"},
    {"id": "fix-shower", "category": "fixture", "name": "Box doccia", "unit": "pz", "price": 650.0, "color": "#E0F2FE"},
    {"id": "fix-bathtub", "category": "fixture", "name": "Vasca da bagno", "unit": "pz", "price": 780.0, "color": "#FFFFFF"},
    # Appliances
    {"id": "app-fridge", "category": "appliance", "name": "Frigorifero", "unit": "pz", "price": 850.0, "color": "#A1A1AA"},
    {"id": "app-oven", "category": "appliance", "name": "Forno", "unit": "pz", "price": 420.0, "color": "#27272A"},
    {"id": "app-hob", "category": "appliance", "name": "Piano cottura", "unit": "pz", "price": 380.0, "color": "#18181B"},
    {"id": "app-dishwasher", "category": "appliance", "name": "Lavastoviglie", "unit": "pz", "price": 520.0, "color": "#D4D4D8"},
    # Lights
    {"id": "light-ceiling", "category": "light", "name": "Plafoniera LED", "unit": "pz", "price": 95.0, "color": "#FEF3C7"},
    {"id": "light-pendant", "category": "light", "name": "Sospensione design", "unit": "pz", "price": 240.0, "color": "#FEF3C7"},
    {"id": "light-spot", "category": "light", "name": "Faretto incasso", "unit": "pz", "price": 38.0, "color": "#FEF3C7"},
    {"id": "light-wall", "category": "light", "name": "Applique da parete", "unit": "pz", "price": 85.0, "color": "#FEF3C7"},
]


# ---------------- Auth routes ----------------
@api.post("/auth/register")
async def register(body: RegisterReq):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    requested_role = (body.requested_role or "cliente").lower()
    if requested_role not in ALLOWED_ROLES or requested_role == "admin":
        raise HTTPException(status_code=400, detail="Ruolo richiesto non valido")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": body.name,
        "role": "pending",
        "status": "pending",
        "requested_role": requested_role,
        "phone": body.phone or "",
        "message": body.message or "",
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    # Email di benvenuto all'utente + notifica admin per approvazione
    try:
        from email_service import send_welcome_email, send_email, _wrap, _btn, _cfg
        await send_welcome_email(email, body.name, requested_role)
        # Notifica admin
        admin_users = await db.users.find({"role": "admin"}, {"_id": 0, "email": 1, "name": 1}).to_list(20)
        if admin_users:
            cfgv = _cfg()
            html = _wrap(
                f"<p>Nuova richiesta di registrazione su Sa di casa:</p>"
                f"<ul><li><strong>Nome:</strong> {body.name}</li>"
                f"<li><strong>Email:</strong> {email}</li>"
                f"<li><strong>Ruolo richiesto:</strong> {requested_role}</li>"
                f"<li><strong>Telefono:</strong> {body.phone or '—'}</li>"
                f"<li><strong>Messaggio:</strong> {body.message or '—'}</li></ul>"
                f"<p style='margin:24px 0;'>{_btn('Approva o rifiuta', cfgv['app_url'] + '/adminutenti')}</p>",
                "Nuova registrazione da approvare"
            )
            for a in admin_users:
                if a.get("email"):
                    await send_email(a["email"], f"Nuova registrazione: {body.name} ({requested_role})", html)
    except Exception as e:
        logger.warning(f"[EMAIL register] errore: {e}")
    # NON fa auto-login: deve attendere approvazione admin
    return {
        "ok": True,
        "status": "pending",
        "message": "Richiesta ricevuta. L'amministratore ti contatterà dopo l'approvazione.",
    }


@api.post("/auth/login")
async def login(body: LoginReq, response: Response, request: Request):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    ident = f"{ip}:{email}"
    # Brute force check
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= 5:
        last = attempt.get("last_attempt")
        if last:
            last_dt = datetime.fromisoformat(last)
            if datetime.now(timezone.utc) - last_dt < timedelta(minutes=15):
                raise HTTPException(status_code=429, detail="Troppi tentativi. Riprova tra 15 minuti.")
            else:
                await db.login_attempts.delete_one({"identifier": ident})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    # Check status — account workflow pending/approval
    status = user.get("status", "active")
    if status == "pending":
        raise HTTPException(status_code=403, detail="Account in attesa di approvazione dall'amministratore.")
    if status == "rejected":
        raise HTTPException(status_code=403, detail="Richiesta di accesso rifiutata. Contatta l'amministratore.")
    if status == "expired" or _user_is_expired(user):
        if not _user_is_expired(user) and status != "expired":
            pass
        else:
            await db.users.update_one({"id": user["id"]}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=403, detail="Il tuo accesso è scaduto. Contatta l'amministratore per un rinnovo.")
    await db.login_attempts.delete_one({"identifier": ident})
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    await audit_log(db, user=user, action="login", entity="auth", entity_id=user["id"], description=f"Login {email}", request=request)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "cliente"),
        "must_change_password": bool(user.get("must_change_password")),
        "expires_at": user.get("expires_at"),
        "venditore_level": user.get("venditore_level"),
        "access_token": access,
        "refresh_token": refresh,
    }


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


class ChangePasswordReq(BaseModel):
    current_password: Optional[str] = None
    new_password: str


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordReq, user: Dict[str, Any] = Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nuova password deve essere di almeno 6 caratteri")
    full = await db.users.find_one({"id": user["id"]})
    if not full:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    # Se NON è un primo-accesso forzato, chiediamo la password attuale
    if not full.get("must_change_password"):
        if not body.current_password or not verify_password(body.current_password, full["password_hash"]):
            raise HTTPException(status_code=403, detail="Password attuale errata")
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "password_hash": hash_password(body.new_password),
        "must_change_password": False,
        "password_changed_at": datetime.now(timezone.utc).isoformat(),
    }})
    return {"ok": True}


@api.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "venditore_level": user.get("venditore_level"),
        "negozio_id": user.get("negozio_id"),
        "subappaltatore_id": user.get("subappaltatore_id"),
    }


@api.post("/auth/refresh")
async def refresh_endpoint(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGO])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = create_access_token(user["id"], user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@api.post("/auth/admin-reseed")
async def admin_reseed(body: Dict[str, Any]):
    """Ricrea/aggiorna l'utente admin usando ADMIN_EMAIL/ADMIN_PASSWORD dall'env.
    Protetto dalla ADMIN_PASSWORD stessa (chi la conosce, può riparare)."""
    env_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    env_password = os.environ.get("ADMIN_PASSWORD", "").strip()
    if not env_email or not env_password:
        raise HTTPException(status_code=500, detail="ADMIN_EMAIL/ADMIN_PASSWORD non configurate")
    if body.get("password") != env_password:
        raise HTTPException(status_code=403, detail="Password master non valida")
    existing = await db.users.find_one({"email": env_email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": env_email,
            "name": "Admin",
            "role": "admin",
            "password_hash": hash_password(env_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await seed_user_catalog(uid)
        action = "created"
    else:
        await db.users.update_one({"email": env_email}, {"$set": {
            "password_hash": hash_password(env_password),
            "role": "admin",
        }})
        action = "updated"
    # Pulisce brute-force locks (così se eri bloccato, si sblocca)
    cleared = await db.login_attempts.delete_many({})
    return {"status": "ok", "action": action, "email": env_email, "brute_force_cleared": cleared.deleted_count}


@api.post("/auth/emergency-admin-setup")
async def emergency_admin_setup(body: Dict[str, Any], response: Response):
    """ENDPOINT DI EMERGENZA — bypassa tutto per far entrare l'owner.
    Autorizzazione: serve la MASTER_KEY (env EMERGENCY_KEY) o in fallback ADMIN_PASSWORD env.
    Body: {master_key, new_email, new_password}
    Azioni: elimina vecchio admin, crea nuovo con credenziali fornite, logga dentro setting cookie.
    """
    master_env = (os.environ.get("EMERGENCY_KEY") or os.environ.get("ADMIN_PASSWORD") or "").strip()
    provided = (body.get("master_key") or "").strip()
    if not master_env or not provided or provided != master_env:
        raise HTTPException(status_code=403, detail="master_key errata o non configurata")
    new_email = (body.get("new_email") or "").lower().strip()
    new_password = (body.get("new_password") or "").strip()
    if not new_email or "@" not in new_email:
        raise HTTPException(status_code=400, detail="new_email non valida")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="new_password minimo 6 caratteri")
    # Clean slate: pulisce brute-force, elimina utente esistente con stessa email, crea nuovo
    await db.login_attempts.delete_many({})
    await db.users.delete_many({"email": new_email})
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid,
        "email": new_email,
        "name": "Admin",
        "role": "admin",
        "password_hash": hash_password(new_password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await seed_user_catalog(uid)
    # Login immediato
    access = create_access_token(uid, new_email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {
        "ok": True,
        "message": f"Admin {new_email} ricreato e loggato.",
        "email": new_email,
        "role": "admin",
        "access_token": access,
        "refresh_token": refresh,
    }


@api.get("/auth/rescue")
async def rescue_admin():
    """RESCUE — endpoint GET pubblico senza auth. Ricrea admin@admin.it / admin,
    pulisce brute-force, elimina utenti orfani con stessa email. Usare quando
    tutto il resto è rotto."""
    email = "admin@admin.it"
    password = "admin"
    await db.login_attempts.delete_many({})
    await db.users.delete_many({"email": email})
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid,
        "email": email,
        "name": "Admin Rescue",
        "role": "admin",
        "password_hash": hash_password(password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await seed_user_catalog(uid)
    return {
        "ok": True,
        "message": "Admin resettato. Vai a /login e accedi con queste credenziali.",
        "email": email,
        "password": password,
        "login_url": "/login",
    }


@api.get("/auth/admin-status")
async def admin_status():
    """Debug: verifica se l'admin email dell'env esiste e quanti lock brute-force ci sono."""
    env_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    has_env_email = bool(env_email)
    has_env_password = bool(os.environ.get("ADMIN_PASSWORD", "").strip())
    user = await db.users.find_one({"email": env_email}) if env_email else None
    attempts = await db.login_attempts.count_documents({})
    return {
        "env_admin_email_set": has_env_email,
        "env_admin_password_set": has_env_password,
        "admin_exists": bool(user),
        "admin_role": user.get("role") if user else None,
        "brute_force_locks": attempts,
    }


# ---------------- Projects ----------------
@api.get("/projects")
async def list_projects(user: Dict[str, Any] = Depends(get_current_user)):
    # Admin vede tutti i progetti, altri solo i propri
    q = {} if user.get("role") == "admin" else {"user_id": user["id"]}
    docs = await db.projects.find(q, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return docs


@api.post("/projects")
async def create_project(body: ProjectIn, user: Dict[str, Any] = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name,
        "data": body.data,
        "thumbnail": body.thumbnail,
        "preventivo_id": body.preventivo_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.projects.insert_one(doc)
    doc.pop("_id", None)
    # Sync inverso: aggiungi project_id al preventivo
    if body.preventivo_id:
        await db.preventivi.update_one({"id": body.preventivo_id, "user_id": user["id"]}, {"$set": {"project_id": doc["id"]}})
    return doc


@api.post("/preventivi/{preventivo_id}/create-project")
async def create_project_from_preventivo(preventivo_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Crea un nuovo progetto CAD collegato a un preventivo esistente, con mq pre-popolato."""
    prev = await db.preventivi.find_one({"id": preventivo_id, "user_id": user["id"]}, {"_id": 0})
    if not prev:
        raise HTTPException(404, "Preventivo non trovato")
    if prev.get("project_id"):
        return {"id": prev["project_id"], "existed": True}
    now = datetime.now(timezone.utc).isoformat()
    nome_cliente = (prev.get("cliente") or {}).get("nome") or "Cliente"
    # Snapshot del preventivo per il CAD: l'editor potrà sottrarre questi
    # interventi già preventivati dagli extra calcolati live.
    baseline_preventivo = {
        "preventivo_id": preventivo_id,
        "numero": prev.get("numero"),
        "tipo": prev.get("tipo"),
        "package_id": prev.get("package_id"),
        "mq": prev.get("mq"),
        "totale_iva_incl": prev.get("totale_iva_incl"),
        "totale_iva_escl": prev.get("totale_iva_escl"),
        "package_base_total": prev.get("package_base_total"),
        "items": prev.get("items") or [],
        "extra_voci": prev.get("extra_voci") or [],
        "composite_selections": prev.get("composite_selections") or [],
        "infissi": prev.get("infissi") or [],
        "infissi_extras": prev.get("infissi_extras") or [],
        "optional": prev.get("optional") or [],
        "listini_selections": prev.get("listini_selections") or [],
        "package_listini_items": prev.get("package_listini_items") or [],
        "snapshot_at": now,
    }
    project_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": f"Progetto {nome_cliente} ({prev.get('numero', '')})",
        "data": {"mq": prev.get("mq", 70), "rooms": [], "walls": [], "doors": [], "windows": [], "items": [], "electrical": [], "plumbing": [], "gas": [], "hvac": [], "stairs": [], "texts": [], "demolitions": [], "tiling": [], "roomHeight": 270, "baseline_preventivo": baseline_preventivo},
        "thumbnail": None,
        "preventivo_id": preventivo_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.projects.insert_one(project_doc)
    project_doc.pop("_id", None)
    await db.preventivi.update_one({"id": preventivo_id, "user_id": user["id"]}, {"$set": {"project_id": project_doc["id"]}})
    return project_doc


@api.get("/projects/{project_id}")
async def get_project(project_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    q = {"id": project_id} if user.get("role") == "admin" else {"id": project_id, "user_id": user["id"]}
    doc = await db.projects.find_one(q, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    # Auto-link: se preventivo_id mancante, cerca un preventivo che punta a questo progetto
    if not doc.get("preventivo_id"):
        prev = await db.preventivi.find_one(
            {"project_id": project_id, "user_id": user["id"]},
            {"_id": 0, "id": 1},
            sort=[("created_at", -1)],
        )
        if prev:
            await db.projects.update_one({"id": project_id}, {"$set": {"preventivo_id": prev["id"]}})
            doc["preventivo_id"] = prev["id"]
    return doc


@api.put("/projects/{project_id}")
async def update_project(project_id: str, body: ProjectIn, user: Dict[str, Any] = Depends(get_current_user)):
    update_doc = {
        "name": body.name,
        "data": body.data,
        "thumbnail": body.thumbnail,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.preventivo_id is not None:
        update_doc["preventivo_id"] = body.preventivo_id
    # Admin può aggiornare progetti di chiunque; gli altri solo i propri
    q = {"id": project_id} if user.get("role") == "admin" else {"id": project_id, "user_id": user["id"]}
    result = await db.projects.update_one(q, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    # Sync inverso preventivi.project_id
    if body.preventivo_id:
        prev_q = {"id": body.preventivo_id} if user.get("role") == "admin" else {"id": body.preventivo_id, "user_id": user["id"]}
        await db.preventivi.update_one(prev_q, {"$set": {"project_id": project_id}})
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return doc


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    q = {"id": project_id} if user.get("role") == "admin" else {"id": project_id, "user_id": user["id"]}
    await db.projects.delete_one(q)
    return {"ok": True}


# ---------------- Materials ----------------
async def seed_user_catalog(user_id: str):
    count = await db.materials.count_documents({"user_id": user_id})
    if count == 0:
        items = [{**m, "user_id": user_id} for m in DEFAULT_CATALOG]
        await db.materials.insert_many(items)


@api.get("/materials")
async def get_materials(user: Dict[str, Any] = Depends(get_current_user)):
    await seed_user_catalog(user["id"])
    items = await db.materials.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(500)
    return items


@api.put("/materials/{material_id}")
async def update_material(material_id: str, body: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    body.pop("_id", None)
    body.pop("user_id", None)
    await db.materials.update_one({"id": material_id, "user_id": user["id"]}, {"$set": body})
    doc = await db.materials.find_one({"id": material_id, "user_id": user["id"]}, {"_id": 0, "user_id": 0})
    return doc


@api.post("/materials")
async def create_material(body: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    """Crea un nuovo materiale nel catalogo dell'utente (es. da AI generator)."""
    body.pop("_id", None)
    body.pop("user_id", None)
    new_id = body.get("id") or f"mat-{uuid.uuid4().hex[:8]}"
    doc = {
        "id": new_id,
        "category": body.get("category", "fixture"),
        "name": body.get("name", "Materiale"),
        "unit": body.get("unit", "€/pz"),
        "price": float(body.get("price", 0) or 0),
        "color": body.get("color", "#A1A1AA"),
        "thumb": body.get("thumb"),  # base64 data URL or null
        "description": body.get("description"),
        "user_id": user["id"],
    }
    await db.materials.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("user_id", "_id")}


@api.post("/materials/reset")
async def reset_materials(user: Dict[str, Any] = Depends(get_current_user)):
    await db.materials.delete_many({"user_id": user["id"]})
    items = [{**m, "user_id": user["id"]} for m in DEFAULT_CATALOG]
    await db.materials.insert_many(items)
    out = await db.materials.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(500)
    return out


@api.post("/materials/seed-missing")
async def seed_missing_materials(user: Dict[str, Any] = Depends(get_current_user)):
    """Aggiunge i materiali default mancanti per l'utente senza toccare quelli personalizzati."""
    existing = await db.materials.find({"user_id": user["id"]}, {"id": 1, "_id": 0}).to_list(2000)
    existing_ids = {m["id"] for m in existing}
    added = []
    for m in DEFAULT_CATALOG:
        if m["id"] in existing_ids:
            continue
        doc = {**m, "user_id": user["id"]}
        await db.materials.insert_one(doc)
        added.append(m["id"])
    return {"ok": True, "added": added, "count": len(added)}


@api.post("/materials/bulk-import")
async def bulk_import_materials(body: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    """Import materials from CSV. Body: {csv: '<text>', replace: bool}.
    CSV header (first line): id,category,name,unit,cost,color,thumb (id and color optional)."""
    import csv as _csv, io as _io, uuid as _uuid
    text = body.get("csv", "")
    if not text.strip():
        raise HTTPException(400, "CSV vuoto")
    reader = _csv.DictReader(_io.StringIO(text))
    rows = []
    for r in reader:
        if not (r.get("name") and r.get("category")):
            continue
        rows.append({
            "id": (r.get("id") or "").strip() or f"mat-{_uuid.uuid4().hex[:8]}",
            "category": r["category"].strip(),
            "name": r["name"].strip(),
            "unit": (r.get("unit") or "pz").strip(),
            "cost": float(r.get("cost") or 0),
            "color": (r.get("color") or "#94A3B8").strip(),
            "thumb": (r.get("thumb") or "").strip(),
            "user_id": user["id"],
        })
    if not rows:
        raise HTTPException(400, "Nessuna riga valida nel CSV")
    if body.get("replace"):
        await db.materials.delete_many({"user_id": user["id"]})
    await db.materials.insert_many(rows)
    return {"ok": True, "imported": len(rows)}


# ---------------- AI Render ----------------
@api.post("/ai-render")
async def ai_render(body: AIRenderReq, user: Dict[str, Any] = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurata")
    # Strip data URL prefix if present
    img_b64 = body.image_base64
    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]
    session_id = f"render-{user['id']}-{uuid.uuid4().hex[:8]}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message="You are an expert interior designer AI that transforms 3D massing previews into photorealistic renders.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    full_prompt = (
        f"Transform this 3D preview of an interior room into a {body.style} photograph. "
        f"Keep the exact layout, room proportions, wall positions, door and window placements. "
        f"Apply realistic materials, lighting, shadows, and textures. {body.prompt}. "
        f"Ultra-detailed, professional architectural photography, soft natural lighting."
    )
    try:
        msg = UserMessage(text=full_prompt, file_contents=[ImageContent(img_b64)])
        text, images = await chat.send_message_multimodal_response(msg)
    except Exception as e:
        logger.exception("AI render failed")
        raise HTTPException(status_code=500, detail=f"Errore rendering AI: {str(e)[:200]}")
    if not images:
        raise HTTPException(status_code=500, detail="Nessuna immagine generata")
    img = images[0]
    return {
        "mime_type": img.get("mime_type", "image/png"),
        "data_url": f"data:{img.get('mime_type', 'image/png')};base64,{img['data']}",
        "prompt": body.prompt,
    }


# ---------------- AI Floorplan Import ----------------
@api.post("/ai/floorplan-import")
async def ai_floorplan_import(body: dict, user: Dict[str, Any] = Depends(get_current_user)):
    """Analyze a floorplan image (or PDF) and extract rooms + walls as CAD project_data (cm)."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurata")
    img_b64 = body.get("image_base64", "")
    if "," in img_b64:
        # data URL: data:application/pdf;base64,... oppure data:image/png;base64,...
        header, img_b64 = img_b64.split(",", 1)
        body_mime = header.split(";")[0].replace("data:", "").lower() if "data:" in header else ""
    else:
        body_mime = (body.get("mime") or "").lower()
    if not img_b64:
        raise HTTPException(400, "File mancante")

    # Se il file è un PDF, converti la PRIMA pagina in JPEG (più compatto di PNG) via pypdfium2
    is_pdf = ("pdf" in body_mime) or img_b64.startswith("JVBERi0")  # %PDF- in base64
    if is_pdf:
        try:
            import base64 as _b64
            import pypdfium2 as pdfium
            import io as _io
            raw = _b64.b64decode(img_b64)
            pdf = pdfium.PdfDocument(raw)
            if len(pdf) == 0:
                raise HTTPException(400, "PDF senza pagine")
            page = pdf[0]
            # Scale: ridotto a 1.5 (~110 DPI) + max 1200px lato lungo + JPEG q=85 → payload molto più leggero,
            # tempo Gemini -50%, evita 504 gateway timeout.
            pil_image = page.render(scale=1.5).to_pil()
            max_side = 1200
            w, h = pil_image.size
            if max(w, h) > max_side:
                ratio = max_side / max(w, h)
                pil_image = pil_image.resize((int(w * ratio), int(h * ratio)))
            if pil_image.mode != "RGB":
                pil_image = pil_image.convert("RGB")
            buf = _io.BytesIO()
            pil_image.save(buf, format="JPEG", quality=85, optimize=True)
            img_b64 = _b64.b64encode(buf.getvalue()).decode("ascii")
            logger.info(f"[floorplan] PDF→JPEG {pil_image.size} ({len(img_b64)} bytes b64)")
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("PDF conversion failed")
            raise HTTPException(status_code=400, detail=f"Errore conversione PDF: {str(e)[:200]}. Salva la planimetria come JPG/PNG e riprova.")
    else:
        # Immagine non-PDF (PNG/JPG): downscale aggressivo per evitare 504 gateway timeout
        try:
            import base64 as _b64
            from PIL import Image as _PILImage
            import io as _io
            raw = _b64.b64decode(img_b64)
            pil_image = _PILImage.open(_io.BytesIO(raw))
            w, h = pil_image.size
            max_side = 1200
            if max(w, h) > max_side:
                ratio = max_side / max(w, h)
                pil_image = pil_image.resize((int(w * ratio), int(h * ratio)))
            if pil_image.mode not in ("RGB", "L"):
                pil_image = pil_image.convert("RGB")
            buf = _io.BytesIO()
            pil_image.save(buf, format="JPEG", quality=85, optimize=True)
            img_b64 = _b64.b64encode(buf.getvalue()).decode("ascii")
            logger.info(f"[floorplan] image→JPEG {pil_image.size} ({len(img_b64)} bytes b64)")
        except Exception as e:
            logger.warning(f"[floorplan] downscale fallback skipped: {e}")

    session_id = f"floorplan-{user['id']}-{uuid.uuid4().hex[:8]}"

    # Riferimenti dimensionali forniti dall'utente per calibrare
    # IMPORTANTE: known_area_m2 / known_width_cm / known_height_cm sono usati SOLO per il post-processing
    # (rescale finale a misure reali), NON vengono inseriti nel prompt sistema così che l'AI
    # lavori autonomamente e non sia influenzata dai valori dichiarati dall'utente.
    known_area_m2 = body.get("known_area_m2")
    known_width_cm = body.get("known_width_cm")
    known_height_cm = body.get("known_height_cm")
    # Reference visivi: vengono inseriti nel prompt SOLO come anchor visivi (porta std, piastrella WxL)
    reference_door_cm = body.get("reference_door_cm")  # opzionale (NON default)
    reference_tile_w_cm = body.get("reference_tile_w_cm")  # piastrella: lato corto
    reference_tile_l_cm = body.get("reference_tile_l_cm")  # piastrella: lato lungo
    extra_images_b64 = body.get("extra_images") or []
    if not isinstance(extra_images_b64, list):
        extra_images_b64 = []
    cleaned_extras = []
    for ex in extra_images_b64[:5]:
        if not isinstance(ex, str) or not ex:
            continue
        if "," in ex:
            ex = ex.split(",", 1)[1]
        if len(ex) > 50:
            # Downscale aggressivo foto extra a 1024px JPEG q=80 per non saturare il payload Gemini
            try:
                import base64 as _b64x
                from PIL import Image as _PILImageX
                import io as _ioX
                raw = _b64x.b64decode(ex)
                pil = _PILImageX.open(_ioX.BytesIO(raw))
                w, h = pil.size
                if max(w, h) > 1024:
                    ratio = 1024 / max(w, h)
                    pil = pil.resize((int(w * ratio), int(h * ratio)))
                if pil.mode not in ("RGB", "L"):
                    pil = pil.convert("RGB")
                bufx = _ioX.BytesIO()
                pil.save(bufx, format="JPEG", quality=80, optimize=True)
                ex = _b64x.b64encode(bufx.getvalue()).decode("ascii")
            except Exception as _err:
                logger.warning(f"[floorplan] extra-photo downscale skipped: {_err}")
            cleaned_extras.append(ex)

    # Prompt sistema — include SOLO anchor VISIVI dalle foto (non le dimensioni dichiarate)
    refs_lines = []
    if reference_door_cm:
        refs_lines.append(f"- Standard interior door width = {float(reference_door_cm):.0f} cm (use as visual scale anchor if visible in photos).")
    if reference_tile_w_cm and reference_tile_l_cm:
        refs_lines.append(f"- Floor tiles visible in photos are {float(reference_tile_w_cm):.0f}×{float(reference_tile_l_cm):.0f} cm (count them to derive room size).")
    elif reference_tile_w_cm:
        refs_lines.append(f"- Floor tiles visible in photos are square {float(reference_tile_w_cm):.0f} cm side (count them to derive room size).")
    if cleaned_extras:
        refs_lines.append(f"- {len(cleaned_extras)} ADDITIONAL PHOTOS of the actual rooms are attached. Use them to calibrate proportions: count visible doors/windows, count floor tiles, identify furniture (standard bed = 160×200cm, sofa = 200×90cm, toilet = 40×60cm, refrigerator = 60×60cm) and cross-check against the 2D plan.")
    refs_block = ("\n\nVISUAL CALIBRATION ANCHORS (only what's directly observable):\n" + "\n".join(refs_lines)) if refs_lines else ""

    system_msg = (
        "You are an expert CAD assistant that converts 2D architectural floorplan images into structured JSON.\n"
        "Output ONLY valid JSON, no prose, no markdown fences, no explanation.\n\n"
        "COORDINATES: centimeters, origin top-left, X right, Y down. Realistic apartment dimensions:\n"
        "- Typical room side: 280-500 cm (small bedroom 280×300, big living 500×600)\n"
        "- Typical full apartment: 6000-12000 cm wide × 5000-12000 cm deep\n"
        "- NEVER produce rooms smaller than 200×200 cm or apartments smaller than 4000 cm wide\n\n"
        "OUTPUT SCHEMA (must include ALL three arrays, even if empty):\n"
        "{\n"
        "  \"rooms\": [{\"name\":\"Cucina\",\"points\":[{\"x\":0,\"y\":0},{\"x\":400,\"y\":0},{\"x\":400,\"y\":350},{\"x\":0,\"y\":350}],\"floorMaterial\":\"floor-ceramic\",\"electrical\":true,\"plumbing\":false}],\n"
        "  \"doors\":   [{\"x\":200,\"y\":0,\"width\":80,\"rotation\":0,\"hinge\":\"left\",\"swing\":\"in\",\"kind\":\"interior\"}],\n"
        "  \"windows\": [{\"x\":150,\"y\":0,\"width\":120,\"height\":140,\"sillHeight\":90,\"rotation\":0,\"kind\":\"finestra\"}]\n"
        "}\n\n"
        "DETECTION RULES — IMPORTANTE:\n"
        "1. ROOMS: rectangular polygons clockwise (top-left → top-right → bottom-right → bottom-left). L-shaped only when explicitly visible.\n"
        "   Label by visible Italian text (Cucina, Bagno, Camera, Soggiorno, Ingresso, Corridoio, Studio, Cabina, Lavanderia, Ripostiglio).\n"
        "   floorMaterial: 'floor-ceramic' for kitchens/bathrooms/laundry, 'floor-parquet' for bedrooms/livingroom/study.\n"
        "   plumbing=true for bathrooms, kitchens, laundries. electrical=true for ALL rooms.\n"
        "   Rooms must be ADJACENT (share walls, no gaps).\n\n"
        "2. DOORS — ALWAYS look for the typical arc symbol (quarter-circle) at room openings:\n"
        "   - Position (x,y) is the HINGE point on the wall midline.\n"
        "   - Standard interior door width = 80 cm, entrance door = 90 cm, larger doorways visible in plan = up to 120 cm.\n"
        "   - rotation in degrees (0 = horizontal opening east-west, 90 = vertical).\n"
        "   - hinge: 'left' or 'right' (from inside the room).\n"
        "   - swing: 'in' (opens into the room) or 'out'.\n"
        "   - kind: 'entrance' (front/main door, typically thicker) or 'interior'.\n"
        "   - DETECT EVERY door visible — typically 5-10 doors in a normal apartment.\n\n"
        "3. WINDOWS — ALWAYS look for double parallel lines on perimeter walls (the typical window symbol):\n"
        "   - Position (x,y) is the MIDPOINT of the window on the wall midline.\n"
        "   - Standard width: 120-160 cm for single window, 240+ for sliding doors/glass doors.\n"
        "   - Height: 140 cm standard, 220 cm for porta-finestra (French door).\n"
        "   - sillHeight: 90 cm for standard window, 0 for porta-finestra (floor-to-ceiling).\n"
        "   - kind: 'finestra' (standard window), 'portafinestra' (French door), 'vetrina' (showroom display window — full-height storefront glass, usually on facade of commercial spaces).\n"
        "   - DETECT EVERY window AND vetrina visible — typically 3-8 windows in a normal apartment, multiple vetrine in commercial spaces.\n\n"
        "4. CONTINUOUS GLASS / VETRINE (typical of shops, showrooms, garages, verandas):\n"
        "   - Full-width opening on the perimeter wall, often with multiple panels.\n"
        "   - Set sillHeight=0, height=220-250, width=actual full opening width, kind='vetrina'.\n\n"
        "Output 2-15 rooms, 3-15 doors, 2-15 windows. If the image is truly empty, return all-empty arrays."
        + refs_block
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("gemini", "gemini-2.5-flash")
    try:
        # Costruisci il prompt utente. Se ci sono foto extra, le includiamo nel multimodal payload.
        user_text = (
            "Analizza la PIANTA 2D (primo allegato) e ritorna il JSON strutturato delle stanze in cm. "
            "Stima autonomamente le dimensioni reali in centimetri basandoti sulle proporzioni visibili. "
            "Se sono presenti FOTO AGGIUNTIVE del locale, usale per calibrare meglio le proporzioni reali "
            "contando elementi visibili (porte, piastrelle, mobili). "
            "Non inventare stanze non visibili nella pianta 2D."
        )
        attachments = [ImageContent(img_b64)] + [ImageContent(x) for x in cleaned_extras]
        msg = UserMessage(text=user_text, file_contents=attachments)
        response = await chat.send_message(msg)
    except Exception as e:
        logger.exception("AI floorplan import failed")
        raise HTTPException(status_code=500, detail=f"Errore AI: {str(e)[:200]}")
    # Clean response
    text = (response or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        # remove first line if it's "json"
        lines = text.split("\n", 1)
        if lines and lines[0].strip().lower().startswith("json"):
            text = lines[1] if len(lines) > 1 else ""
        text = text.strip("`").strip()
    # Find JSON braces
    import json as _json
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            data = _json.loads(text[start:end+1])
        else:
            data = _json.loads(text)
    except Exception:
        raise HTTPException(500, f"Risposta AI non parsabile: {text[:200]}")

    rooms_in = data.get("rooms", [])
    doors_in = data.get("doors", []) or []
    windows_in = data.get("windows", []) or []
    out_rooms = []
    out_walls = []
    # Raw doors/windows con coordinate (x,y) — snappiamo ai muri DOPO il rescale.
    raw_doors = []
    raw_windows = []
    for r in rooms_in:
        pts = r.get("points") or []
        if len(pts) < 3:
            continue
        room_id = uuid.uuid4().hex[:8]
        out_rooms.append({
            "id": room_id,
            "name": r.get("name", "Stanza"),
            "points": [{"x": float(p["x"]), "y": float(p["y"])} for p in pts],
            "floorMaterial": r.get("floorMaterial", "floor-ceramic"),
            "wallMaterial": r.get("wallMaterial", "wall-paint"),
            "ceilingMaterial": r.get("ceilingMaterial", "ceil-paint"),
            "electrical": bool(r.get("electrical", True)),
            "plumbing": bool(r.get("plumbing", False)),
        })
        # generate walls from points
        for i in range(len(pts)):
            a = pts[i]
            b = pts[(i + 1) % len(pts)]
            out_walls.append({
                "id": uuid.uuid4().hex[:8],
                "x1": float(a["x"]), "y1": float(a["y"]),
                "x2": float(b["x"]), "y2": float(b["y"]),
                "thickness": 10, "kind": "mattone",
            })
    # Sanitize doors/windows con (x,y) — sopravvivono al rescale come coordinate raw
    for d in doors_in:
        try:
            raw_doors.append({
                "x": float(d.get("x", 0)),
                "y": float(d.get("y", 0)),
                "width": float(d.get("width", 80)),
                "height": float(d.get("height", 210)),
                "hinge": str(d.get("hinge", "left")).lower(),
                "swing": str(d.get("swing", "in")).lower(),
                "kind": str(d.get("kind", "interior")).lower(),
            })
        except Exception:
            continue
    for w in windows_in:
        try:
            raw_windows.append({
                "x": float(w.get("x", 0)),
                "y": float(w.get("y", 0)),
                "width": float(w.get("width", 120)),
                "height": float(w.get("height", 140)),
                "sillHeight": float(w.get("sillHeight", 90)),
                "kind": str(w.get("kind", "finestra")).lower(),
            })
        except Exception:
            continue

    # ---- POST-PROCESSING: rescale finale per matchare le dimensioni note ----
    def _polygon_area_cm2(points):
        if len(points) < 3:
            return 0.0
        a = 0.0
        for i in range(len(points)):
            p1 = points[i]
            p2 = points[(i + 1) % len(points)]
            a += (p1["x"] * p2["y"] - p2["x"] * p1["y"])
        return abs(a / 2.0)

    def _apply_scale(scale_factor):
        if not scale_factor or abs(scale_factor - 1.0) < 0.01:
            return
        for r in out_rooms:
            for p in r["points"]:
                p["x"] = p["x"] * scale_factor
                p["y"] = p["y"] * scale_factor
        for w in out_walls:
            w["x1"] = w["x1"] * scale_factor; w["y1"] = w["y1"] * scale_factor
            w["x2"] = w["x2"] * scale_factor; w["y2"] = w["y2"] * scale_factor
        # Scala anche le coordinate raw di porte/finestre (la width rimane in cm coerente con il rescale)
        for d in raw_doors:
            d["x"] = d["x"] * scale_factor; d["y"] = d["y"] * scale_factor
            d["width"] = d["width"] * scale_factor
        for w in raw_windows:
            w["x"] = w["x"] * scale_factor; w["y"] = w["y"] * scale_factor
            w["width"] = w["width"] * scale_factor

    applied_scale = None
    if out_rooms:
        # Priorità: known_area_m2 > known_width_cm/known_height_cm > nessuno
        if known_area_m2:
            try:
                target_cm2 = float(known_area_m2) * 10000.0
                current_cm2 = sum(_polygon_area_cm2(r["points"]) for r in out_rooms)
                if current_cm2 > 100:  # almeno qualche cm² per evitare divisioni
                    # L'area scala con il quadrato della scala lineare
                    import math as _math
                    scale = _math.sqrt(target_cm2 / current_cm2)
                    _apply_scale(scale)
                    applied_scale = {"by": "area_m2", "factor": round(scale, 3), "target_m2": float(known_area_m2)}
            except Exception:
                logger.exception("rescale by area failed")
        elif known_width_cm or known_height_cm:
            try:
                xs = [p["x"] for r in out_rooms for p in r["points"]]
                ys = [p["y"] for r in out_rooms for p in r["points"]]
                cur_w = max(xs) - min(xs) if xs else 0
                cur_h = max(ys) - min(ys) if ys else 0
                scales = []
                if known_width_cm and cur_w > 10:
                    scales.append(float(known_width_cm) / cur_w)
                if known_height_cm and cur_h > 10:
                    scales.append(float(known_height_cm) / cur_h)
                if scales:
                    # Media dei fattori (mantiene proporzioni dichiarate)
                    scale = sum(scales) / len(scales)
                    _apply_scale(scale)
                    applied_scale = {"by": "bbox", "factor": round(scale, 3), "target_w_cm": known_width_cm, "target_h_cm": known_height_cm}
            except Exception:
                logger.exception("rescale by bbox failed")

    # ---- SNAP porte/finestre ai muri più vicini ----
    def _snap_to_wall(px, py):
        """Trova il muro più vicino al punto (px, py) e ritorna (wall_id, t in 0..1, dist)."""
        best = None
        for w in out_walls:
            x1, y1, x2, y2 = w["x1"], w["y1"], w["x2"], w["y2"]
            dx, dy = x2 - x1, y2 - y1
            L2 = dx * dx + dy * dy
            if L2 < 1:
                continue
            t = ((px - x1) * dx + (py - y1) * dy) / L2
            t = max(0.0, min(1.0, t))
            cx, cy = x1 + t * dx, y1 + t * dy
            d2 = (cx - px) ** 2 + (cy - py) ** 2
            if best is None or d2 < best[2]:
                best = (w["id"], t, d2)
        return best  # (wall_id, t, dist²) or None

    out_doors = []
    out_windows = []
    # Soglia massima distanza punto→muro per accettare lo snap: 200cm
    MAX_SNAP_CM = 200
    for d in raw_doors:
        snap = _snap_to_wall(d["x"], d["y"])
        if not snap:
            continue
        wall_id, t, d2 = snap
        if d2 > MAX_SNAP_CM ** 2:
            # troppo lontano da un muro → scartato
            continue
        out_doors.append({
            "id": uuid.uuid4().hex[:8],
            "wallId": wall_id,
            "t": round(float(t), 4),
            "width": d["width"],
            "height": d["height"],
            "hinge": "right" if d["hinge"] not in ("left", "right") and d["hinge"] != "left" else d["hinge"],
            "swing": "out" if d["swing"] == "out" else "in",
            "kind": "entrance" if d["kind"] in ("entrance", "ingresso", "front") else "interior",
        })
    for w in raw_windows:
        snap = _snap_to_wall(w["x"], w["y"])
        if not snap:
            continue
        wall_id, t, d2 = snap
        if d2 > MAX_SNAP_CM ** 2:
            continue
        kind = w["kind"]
        if kind in ("vetrina", "showroom", "storefront"):
            kind_out = "vetrina"
        elif kind in ("portafinestra", "porta-finestra", "frenchdoor", "french"):
            kind_out = "portafinestra"
        else:
            kind_out = "finestra"
        out_windows.append({
            "id": uuid.uuid4().hex[:8],
            "wallId": wall_id,
            "t": round(float(t), 4),
            "width": w["width"],
            "height": w["height"],
            "sillHeight": 0 if kind_out in ("vetrina", "portafinestra") else w["sillHeight"],
            "ante": 2,
            "kind": kind_out,
        })

    logger.info(f"[floorplan] parsed {len(out_rooms)} rooms, {len(out_doors)}/{len(raw_doors)} doors snapped, {len(out_windows)}/{len(raw_windows)} windows snapped")

    return {
        "project_data": {
            "rooms": out_rooms,
            "walls": out_walls,
            "doors": out_doors,
            "windows": out_windows,
            "items": [],
            "electrical": [], "plumbing": [], "gas": [], "hvac": [],
            "demolitions": [], "tiling": [],
            "roomHeight": 270, "currency": "EUR",
        },
        "rooms_count": len(out_rooms),
        "doors_count": len(out_doors),
        "windows_count": len(out_windows),
        "scale_applied": applied_scale,
        "extra_photos_used": len(cleaned_extras),
    }


# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"message": "Ristruttura CAD API online", "version": "2.0"}


# ---------------- AI CAD 2D Editor (modifica spazi/elementi via comando) ----------------
@api.post("/ai/cad-edit")
async def ai_cad_edit(body: dict, user: Dict[str, Any] = Depends(get_current_user)):
    """
    L'utente descrive in linguaggio naturale cosa vuole cambiare nel progetto CAD 2D
    (es. "togli il muro tra cucina e soggiorno", "aggiungi un punto luce a 1m da terra al centro della parete nord",
    "dividi il soggiorno in due stanze uguali", "metti una porta sul muro est della cucina").
    L'AI ritorna una LISTA DI OPERAZIONI strutturate che il frontend applicherà al project.data.
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurata")
    message = (body.get("message") or "").strip()
    project_data = body.get("project_data") or {}
    view_mode = body.get("view_mode") or "progetto"
    history = body.get("history") or []  # [{role: 'user'|'assistant', text: '...'}, ...]
    if not message:
        raise HTTPException(400, "Messaggio vuoto")

    # Costruisci un riassunto compatto del progetto per non saturare il context
    def _summarize(p):
        rooms = p.get("rooms", [])
        walls = p.get("walls", [])
        doors = p.get("doors", [])
        windows = p.get("windows", [])
        items = p.get("items", [])
        electrical = p.get("electrical", [])
        plumbing = p.get("plumbing", [])
        columns = p.get("columns", [])
        return {
            "view_mode": view_mode,
            "rooms": [{"id": r.get("id"), "name": r.get("name"), "phase": r.get("phase"), "points": r.get("points", [])[:8]} for r in rooms[:20]],
            "walls": [{"id": w.get("id"), "x1": w.get("x1"), "y1": w.get("y1"), "x2": w.get("x2"), "y2": w.get("y2"), "thickness": w.get("thickness"), "phase": w.get("phase"), "demolito": w.get("demolito")} for w in walls[:60]],
            "doors": [{"id": d.get("id"), "wallId": d.get("wallId"), "t": d.get("t"), "width": d.get("width")} for d in doors[:30]],
            "windows": [{"id": w.get("id"), "wallId": w.get("wallId"), "t": w.get("t"), "width": w.get("width"), "height": w.get("height")} for w in windows[:30]],
            "items_count": len(items),
            "electrical_count": len(electrical),
            "plumbing_count": len(plumbing),
            "columns_count": len(columns),
            "room_height": p.get("roomHeight", 270),
        }

    summary = _summarize(project_data)

    sys_msg = (
        "Sei un assistente CAD esperto in ristrutturazioni. Aiuti l'utente a modificare un progetto 2D "
        "(planimetria) attraverso comandi in italiano. Rispondi SOLO con JSON valido, mai testo libero.\n\n"
        "Formato risposta:\n"
        "{\n"
        '  "message": "breve spiegazione in italiano di cosa farai",\n'
        '  "suggestion": "eventuale suggerimento aggiuntivo opzionale o stringa vuota",\n'
        '  "ops": [ {operazioni} ]\n'
        "}\n\n"
        "Le coordinate (x, y) sono in CM, origine top-left, x cresce verso destra, y verso il basso.\n"
        "Operazioni disponibili (op = nome, params = parametri):\n"
        "- addWall: { x1, y1, x2, y2, thickness?=10, phase?=progetto }\n"
        "- removeWall: { id }\n"
        "- moveWall: { id, x1, y1, x2, y2 }\n"
        "- markWallDemolished: { id }     # marca un muro come demolito (in progetto)\n"
        "- addRoom: { name, points: [{x,y}, ...] (>=3 punti), phase?=progetto }\n"
        "- removeRoom: { id }\n"
        "- renameRoom: { id, name }\n"
        "- addDoor: { wallId, t: 0..1, width?=80, height?=210 }\n"
        "- addWindow: { wallId, t: 0..1, width?=120, height?=140, sillHeight?=90, ante?=2 }\n"
        "- moveDoor: { id, t }\n"
        "- moveWindow: { id, t }\n"
        "- removeDoor: { id }\n"
        "- removeWindow: { id }\n"
        "- addElectrical: { kind: 'presa'|'luce'|'interruttore'|'spia', x, y, wall_side?=-1|0|1, height_cm?=110 }\n"
        "- addPlumbing: { kind: 'acqua'|'scarico', x, y, wall_side?=-1|0|1 }\n"
        "- addColumn: { kind: 'cemento'|'mattone'|'cartongesso', x, y, width?=30, depth?=30 }\n"
        "- paintWall: { id, color: '#RRGGBB' }   # in modalità Progetto applica come override\n"
        "- paintAllWalls: { color: '#RRGGBB' }\n"
        "- splitRoomByLine: { roomId, x1, y1, x2, y2, name_a?, name_b? }   # divide la stanza con una nuova parete\n"
        "- noop: {}   # se la richiesta non è chiara o non è eseguibile, ritorna noop + message di chiarimento\n\n"
        "REGOLE:\n"
        "- Privilegia operazioni atomiche piccole.\n"
        "- Se l'utente dice 'togli il muro tra X e Y', identifica il muro condiviso dalle due stanze e usa removeWall (o markWallDemolished se viewMode=progetto).\n"
        "- Se viewMode='progetto' e si modificano elementi dello stato di fatto, considera markWallDemolished invece di removeWall così è reversibile.\n"
        "- Se la richiesta è ambigua, fai 'noop' e nel `message` chiedi chiarimenti.\n"
        "- NON inventare ID che non esistono; tutti gli id devono provenire dal summary fornito."
    )

    user_payload = (
        f"PROGETTO_SUMMARY:\n{summary}\n\n"
        f"VIEW_MODE: {view_mode}\n\n"
        f"STORIA_CONVERSAZIONE:\n{history}\n\n"
        f"RICHIESTA_UTENTE: {message}\n\n"
        "Rispondi con il JSON come da formato."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"cad-edit-{user.get('id', 'anon')}",
        system_message=sys_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    import json as _json
    try:
        resp = await chat.send_message(UserMessage(text=user_payload))
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")
    text = (resp or "").strip()
    if text.startswith("```"):
        # rimuovi eventuali fence markdown
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        parsed = _json.loads(text)
    except Exception:
        # fallback: cerca primo blocco json
        import re as _re
        m = _re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                parsed = _json.loads(m.group(0))
            except Exception:
                parsed = {"message": text or "Risposta non parsabile", "ops": [], "suggestion": ""}
        else:
            parsed = {"message": text or "Risposta non parsabile", "ops": [], "suggestion": ""}
    if not isinstance(parsed, dict):
        parsed = {"message": "Risposta non riconosciuta", "ops": [], "suggestion": ""}
    parsed.setdefault("message", "")
    parsed.setdefault("ops", [])
    parsed.setdefault("suggestion", "")
    return parsed


# ---------------- AI Material Generator ----------------
@api.post("/materials/ai-generate")
async def materials_ai_generate(body: dict, user: Dict[str, Any] = Depends(get_current_user)):
    """
    Genera un nuovo materiale (sanitario/piastrella/arredo/ecc.) da un prompt utente.
    Returns: { material: {name,description,category,unit,price,color}, image_data_url: 'data:image/png;base64,...' }
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurata")
    prompt = (body.get("prompt") or "").strip()
    category = body.get("category") or "fixture"
    if not prompt:
        raise HTTPException(400, "Prompt mancante")

    import json as _json
    # 1) Generazione testuale strutturata (Gemini text)
    text_session = f"matgen-text-{user['id']}-{uuid.uuid4().hex[:8]}"
    chat_text = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=text_session,
        system_message=(
            "Sei un esperto cataloghista di materiali edili e arredo italiani. "
            "Output ONLY valid JSON, no prose, no markdown fences.\n"
            "Schema: {\"name\": str (max 60 char, in italiano), \"description\": str (max 200 char, in italiano), "
            "\"category\": one of [floor, wall, ceiling, electrical, plumbing, furniture, fixture, appliance, light], "
            "\"unit\": one of [\"€/m²\", \"€/pz\", \"€/ml\"], \"price\": float (prezzo medio realistico per il mercato italiano), "
            "\"color\": hex color (#RRGGBB) rappresentativo del materiale}\n"
            "Prezzi realistici 2026: piastrelle gres 25-90 €/m², sanitari sospesi 180-650 €/pz, parquet 35-110 €/m², lampadari led 80-450 €/pz, mobili bagno 280-1200 €/pz."
        ),
    ).with_model("gemini", "gemini-2.5-flash")
    full_prompt = f"Genera un nuovo materiale per la categoria {category} a partire da: '{prompt}'."
    try:
        text_resp = await chat_text.send_message(UserMessage(text=full_prompt))
    except Exception as e:
        logger.exception("AI material text generation failed")
        raise HTTPException(500, f"Errore generazione testo: {str(e)[:200]}")

    raw = text_resp if isinstance(text_resp, str) else getattr(text_resp, "text", str(text_resp))
    try:
        s = raw.find("{"); e2 = raw.rfind("}")
        material = _json.loads(raw[s:e2+1] if s >= 0 and e2 > s else raw)
    except Exception:
        raise HTTPException(500, f"Risposta AI non parsabile: {raw[:200]}")

    # Sanitize
    material.setdefault("category", category)
    material.setdefault("unit", "€/pz" if category in ("furniture", "fixture", "appliance", "light") else "€/m²")
    material["price"] = float(material.get("price", 0) or 0)
    if not material.get("color", "").startswith("#"):
        material["color"] = "#A1A1AA"

    # 2) Generazione immagine (Nano Banana)
    img_session = f"matgen-img-{user['id']}-{uuid.uuid4().hex[:8]}"
    chat_img = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=img_session,
        system_message="You generate photorealistic product photography on plain neutral background.",
    )
    chat_img.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    img_prompt = (
        f"Photorealistic product photo of: {material['name']}. {material.get('description','')}. "
        "Plain neutral light gray background, soft studio lighting, centered, square frame, no text, no logos, no watermarks, e-commerce catalog style."
    )
    image_data_url = None
    try:
        _, images = await chat_img.send_message_multimodal_response(UserMessage(text=img_prompt))
        if images:
            img = images[0]
            mime = img.get("mime_type", "image/png")
            image_data_url = f"data:{mime};base64,{img['data']}"
    except Exception as e:
        logger.warning(f"AI material image generation failed (continuing without image): {str(e)[:200]}")
        # Don't fail the whole request just because image generation hiccups

    return {
        "material": material,
        "image_data_url": image_data_url,
    }



# ---------------- Packages / Preventivi ----------------
def _voci_sort_key(item):
    n = (item.get("name") or "").lower()
    is_demo = ("demoliz" in n) or ("smaltim" in n) or ("rimoz" in n)
    cat_order = {"MURATURA": 2, "IMPIANTI": 3, "INFISSI": 4, "SERVIZI": 5}
    return (1 if is_demo else cat_order.get(item.get("category"), 9), item.get("category", ""), item.get("name", ""))


def _voci_map() -> Dict[str, Dict[str, Any]]:
    from packages_seed import DEFAULT_VOCI_BACKOFFICE
    return {
        v["id"]: {"id": v["id"], "name": v["name"], "category": v["category"], "unit": v["unit"]}
        for v in DEFAULT_VOCI_BACKOFFICE
    }


@api.get("/packages")
async def list_packages(user: Dict[str, Any] = Depends(get_current_user)):
    # Voci backoffice = SOURCE OF TRUTH dei prezzi.
    # Il pacchetto contiene SOLO {voce_id, qty_mode, qty_ratio/qty_value}.
    # Il prezzo unitario viene SEMPRE da voci_backoffice (acquisto × ricarico).
    voci = {v["id"]: v for v in await db.voci_backoffice.find({}, {"_id": 0}).to_list(2000)}
    docs = await db.packages.find({}, {"_id": 0}).to_list(50)
    if not docs:
        # fallback to in-memory seed
        out = []
        for p in DEFAULT_PACKAGES:
            items = []
            for vid, meta in p["included"].items():
                v = voci.get(vid)
                if not v:
                    continue
                items.append({
                    "id": v["id"], "voce_id": v["id"], "name": v["name"], "category": v["category"], "unit": v["unit"],
                    "qty_mode": meta.get("qty_mode", "mq"),
                    "qty_ratio": meta.get("qty_ratio", 0),
                    "qty_value": meta.get("qty_value", 0),
                    "prezzo_acquisto": v["prezzo_acquisto"],
                    "ricarico": v["ricarico"],
                    "prezzo_rivendita": round(v["prezzo_acquisto"] * v["ricarico"], 2),
                    "unit_price_pkg": meta.get("unit_price_pkg"),
                    "modificabile_dal_venditore": bool(v.get("modificabile_dal_venditore")),
                })
            items.sort(key=_voci_sort_key)
            out.append({
                "id": p["id"], "name": p["name"], "subtitle": p["subtitle"],
                "price_per_m2": p["price_per_m2"], "color": p["color"],
                "description": p["description"], "items": items,
                "listini_items": [],
                "price_override": None,
            })
        return out
    out = []
    for p in docs:
        items = []
        for it in p.get("items", []):
            v = voci.get(it.get("voce_id"))
            if not v:
                continue
            items.append({
                "id": v["id"], "voce_id": v["id"], "name": v["name"], "category": v["category"], "unit": v["unit"],
                "qty_mode": it.get("qty_mode", "mq"),
                "qty_ratio": it.get("qty_ratio", 0),
                "qty_value": it.get("qty_value", 0),
                "prezzo_acquisto": v["prezzo_acquisto"],
                "ricarico": v["ricarico"],
                "prezzo_rivendita": round(v["prezzo_acquisto"] * v["ricarico"], 2),
                "unit_price_pkg": it.get("unit_price_pkg"),  # prezzo MAX coperto dal pacchetto (None = usa prezzo_rivendita standard)
                "modificabile_dal_venditore": bool(v.get("modificabile_dal_venditore")),
            })
        items.sort(key=_voci_sort_key)
        out.append({
            "id": p["id"], "name": p["name"], "subtitle": p.get("subtitle", ""),
            "price_per_m2": p["price_per_m2"], "color": p.get("color", "#475569"),
            "description": p.get("description", ""), "items": items,
            # NEW: prodotti pre-inclusi dai Listini Fornitori e override prezzo totale
            "listini_items": p.get("listini_items") or [],
            "price_override": p.get("price_override"),
        })
    return out


@api.get("/packages/bathroom-tiers")
async def bathroom_tiers(user: Dict[str, Any] = Depends(get_current_user)):
    return BATHROOM_TIERS


@api.get("/packages/optional")
async def list_packages_optional(package_id: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    docs = await db.optional_pkg.find({}, {"_id": 0}).to_list(500)
    if not docs:
        docs = [dict(o) for o in DEFAULT_OPTIONAL]
    if package_id:
        docs = [o for o in docs if package_id in (o.get("package_ids") or [])]
    return docs


@api.get("/lavorazioni")
async def list_lavorazioni(user: Dict[str, Any] = Depends(get_current_user)):
    return list(_voci_map().values())


class PreventivoIn(BaseModel):
    model_config = ConfigDict(extra="allow")
    tipo: str = "pacchetto"  # pacchetto | bagno | composite | infissi | cad
    cliente: Dict[str, Any]
    package_id: Optional[str] = None
    mq: float = 0
    items: List[Dict[str, Any]] = []
    optional: List[Dict[str, Any]] = []
    bathroom_tier: Optional[str] = None
    # bagno specifics
    manodopera_base: Optional[float] = None
    piastrelle_mq: Optional[float] = None
    piastrelle_prezzo_mq: Optional[float] = None
    extra_voci: Optional[List[Dict[str, Any]]] = None
    # composite specifics
    composite_selections: Optional[List[Dict[str, Any]]] = None
    sicurezza_pct: Optional[float] = None
    direzione_lavori_pct: Optional[float] = None
    # Listini Fornitori: prodotti scelti dai listini admin (porte/piastrelle/sanitari/...)
    listini_selections: Optional[List[Dict[str, Any]]] = None
    # Modalità di pagamento concordata col cliente
    modalita_pagamento: Optional[Dict[str, Any]] = None
    # infissi specifics
    infissi: Optional[List[Dict[str, Any]]] = None
    # shared
    note: Optional[str] = None
    sconto_pct: float = 0.0
    sconto_eur: float = 0.0
    iva_pct: float = 10.0
    totale_iva_incl: Optional[float] = None
    totale_iva_escl: Optional[float] = None
    venditore_id: Optional[str] = None
    negozio_id: Optional[str] = None


@api.post("/preventivi")
async def create_preventivo(body: PreventivoIn, user: Dict[str, Any] = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "numero": await next_preventivo_number(),
        "stato": "bozza",
        **body.model_dump(exclude_none=False),
        "created_at": now,
        "updated_at": now,
    }
    await db.preventivi.insert_one(doc)
    doc.pop("_id", None)
    await audit_log(db, user=user, action="create", entity="preventivo", entity_id=doc["id"],
                    description=f"Creato preventivo {doc.get('numero')} ({doc.get('tipo') or '?'}) cliente={(doc.get('cliente') or {}).get('nome', '')}",
                    after={"numero": doc.get("numero"), "tipo": doc.get("tipo"), "totale": doc.get("totale_iva_incl")})
    return doc


async def next_preventivo_number() -> str:
    year = datetime.now(timezone.utc).year
    count = await db.preventivi.count_documents({})
    return f"PRV-{year}-{count + 1:04d}"


@api.get("/preventivi")
async def list_preventivi(user: Dict[str, Any] = Depends(get_current_user)):
    # Admin vede tutti i preventivi del sistema; gli altri ruoli vedono solo i propri
    q = {} if user.get("role") == "admin" else {"user_id": user["id"]}
    docs = await db.preventivi.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.get("/preventivi/{prev_id}")
async def get_preventivo(prev_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    # Admin può leggere qualsiasi preventivo; gli altri solo i propri
    q = {"id": prev_id} if (user.get("role") or "").lower() == "admin" else {"id": prev_id, "user_id": user["id"]}
    doc = await db.preventivi.find_one(q, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    return doc


@api.get("/commesse/{cid}/preventivi")
async def list_preventivi_commessa(cid: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Lista TUTTI i preventivi collegati a una commessa: quello originale (preventivo_id su commessa)
    + tutti gli extra (preventivi con campo commessa_id=cid)."""
    com = await db.commesse.find_one({"id": cid}, {"_id": 0})
    if not com:
        raise HTTPException(404, "Commessa non trovata")
    out: List[Dict[str, Any]] = []
    seen = set()
    # 1) Preventivo principale
    if com.get("preventivo_id"):
        p = await db.preventivi.find_one({"id": com["preventivo_id"]}, {"_id": 0})
        if p:
            p["is_principale"] = True
            out.append(p)
            seen.add(p["id"])
    # 2) Preventivi extra (collegati per commessa_id)
    async for p in db.preventivi.find({"commessa_id": cid}, {"_id": 0}):
        if p["id"] in seen:
            continue
        p["is_principale"] = False
        out.append(p)
    # Sort: principale primo, poi per data creazione asc
    out.sort(key=lambda x: (0 if x.get("is_principale") else 1, x.get("created_at") or ""))
    return out


@api.post("/commesse/{cid}/preventivi/clone-from/{prev_id}")
async def clone_preventivo_for_commessa(cid: str, prev_id: str, body: Dict[str, Any] = None, user: Dict[str, Any] = Depends(get_current_user)):
    """Clona un preventivo esistente come EXTRA della commessa.
    Permette di gestire variazioni in corso d'opera senza modificare il preventivo originale accettato."""
    body = body or {}
    com = await db.commesse.find_one({"id": cid}, {"_id": 0})
    if not com:
        raise HTTPException(404, "Commessa non trovata")
    src = await db.preventivi.find_one({"id": prev_id}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Preventivo sorgente non trovato")
    # Copia preventivo
    new_prev = {**src}
    new_prev.pop("_id", None)
    new_id = str(uuid.uuid4())
    new_prev["id"] = new_id
    new_prev["commessa_id"] = cid
    new_prev["is_extra"] = True
    new_prev["parent_preventivo_id"] = prev_id
    new_prev["stato"] = "bozza"
    new_prev["created_at"] = datetime.now(timezone.utc).isoformat()
    new_prev["updated_at"] = new_prev["created_at"]
    titolo_extra = body.get("titolo") or f"Extra/Variante del {datetime.now().strftime('%d/%m/%Y')}"
    new_prev["note"] = f"[{titolo_extra}] {src.get('note') or ''}".strip()
    new_prev["user_id"] = user.get("id")
    # Rimuove eventuali firme e accettazioni dal clone (è una nuova proposta)
    for k in ("firma_otp", "firma_data", "firma_ip", "accepted_at"):
        new_prev.pop(k, None)
    await db.preventivi.insert_one(new_prev)
    new_prev.pop("_id", None)
    return new_prev


@api.put("/preventivi/{prev_id}")
async def update_preventivo(prev_id: str, body: PreventivoIn, user: Dict[str, Any] = Depends(get_current_user)):
    # R87 FIX BUG CRITICO: usa exclude_unset=True così aggiorna SOLO i campi effettivamente
    # passati dal frontend (es. PUT con solo {cliente: {...}} non azzera mq/voci/totali!).
    update_doc = {**body.model_dump(exclude_unset=True, exclude_none=False), "updated_at": datetime.now(timezone.utc).isoformat()}
    update_doc.pop("id", None)
    # Se il preventivo era accettato e l'utente lo modifica, richiede NUOVA accettazione (torna a bozza)
    existing = await db.preventivi.find_one({"id": prev_id, "user_id": user["id"]}, {"_id": 0})
    if existing and existing.get("stato") == "accettato":
        update_doc["stato"] = "bozza"
        update_doc["needs_reacceptance"] = True
    # R87 PROTEZIONE: snapshot della versione precedente prima di sovrascrivere (recoverable).
    if existing:
        try:
            snap = {k: v for k, v in existing.items() if k != "_id"}
            snap["snapshot_id"] = uuid.uuid4().hex
            snap["snapshot_of"] = prev_id
            snap["snapshot_taken_at"] = datetime.now(timezone.utc).isoformat()
            snap["snapshot_taken_by"] = user.get("id")
            snap["snapshot_reason"] = "pre-PUT"
            await db.preventivi_snapshots.insert_one(snap)
        except Exception:
            logger.exception("[PRV-SNAPSHOT] errore snapshot pre-PUT")
    await db.preventivi.update_one({"id": prev_id, "user_id": user["id"]}, {"$set": update_doc})
    doc = await db.preventivi.find_one({"id": prev_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    # Audit con snapshot FULL del before (oltre al diff sintetico)
    await audit_log(db, user=user, action="update", entity="preventivo", entity_id=prev_id,
                    description=f"Aggiornato preventivo {doc.get('numero')}",
                    before={
                        "totale_iva_incl": (existing or {}).get("totale_iva_incl"),
                        "totale_iva_escl": (existing or {}).get("totale_iva_escl"),
                        "tipo": (existing or {}).get("tipo"),
                        "mq": (existing or {}).get("mq"),
                        "stato": (existing or {}).get("stato"),
                        "package_id": (existing or {}).get("package_id"),
                        "package_name": (existing or {}).get("package_name"),
                        "n_composite_selections": len((existing or {}).get("composite_selections") or []),
                        "n_manual_extras": len((existing or {}).get("manual_extras") or []),
                        "n_listini_selections": len((existing or {}).get("listini_selections") or []),
                    },
                    after={
                        "totale_iva_incl": doc.get("totale_iva_incl"),
                        "tipo": doc.get("tipo"),
                        "stato": doc.get("stato"),
                    })
    return doc


@api.post("/preventivi/{prev_id}/ricostruisci-da-audit")
async def ricostruisci_preventivo_da_audit(prev_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """ULTIMA RISORSA: ricostruisce un preventivo wiped (totale=0) dall'audit_log storico.
    NON recupera le voci dettagliate (composite_selections, manual_extras, listini_selections)
    perché l'audit storico salvava solo i totali — recupera solo: tipo, totale, mq, package_id/name.
    Solo admin. Si usa quando NON c'è uno snapshot disponibile."""
    if (user.get("role") or "").lower() != "admin":
        raise HTTPException(403, "Solo admin può ricostruire preventivi")
    current = await db.preventivi.find_one({"id": prev_id}, {"_id": 0})
    if not current:
        raise HTTPException(404, "Preventivo non trovato")
    # Cerca il PIÙ RECENTE audit_log update su questo preventivo che abbia un totale > 0
    logs = await db.audit_logs.find(
        {"entity": "preventivo", "entity_id": prev_id, "action": {"$in": ["update", "create"]}},
        {"_id": 0},
        sort=[("ts", -1)],
    ).to_list(100)
    best = None
    for l in logs:
        before = l.get("before") or {}
        # Cerca prima nel "before" (lo stato prima della modifica), poi nell'"after" come fallback
        for src in (before, l.get("after") or {}):
            tot = src.get("totale_iva_incl") or src.get("totale") or 0
            if tot and float(tot) > 0:
                best = {"src": src, "log": l}
                break
        if best:
            break
    if not best:
        raise HTTPException(404, "Nessun valore storico recuperabile dall'audit log (potrebbe esserci solo log con totale 0)")
    s = best["src"]
    restore = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "ricostruito_da_audit": True,
        "ricostruito_il": datetime.now(timezone.utc).isoformat(),
        "ricostruito_da_audit_id": best["log"].get("id"),
        "ricostruito_riferimento_ts": best["log"].get("ts"),
        "note": (current.get("note") or "") + f"\n\n⚠ Preventivo ricostruito automaticamente dall'audit log del {best['log'].get('ts')[:10]}. Le voci dettagliate (composite/manuali/listini) sono andate perse e vanno ri-inserite manualmente.",
    }
    if s.get("totale_iva_incl"):
        restore["totale_iva_incl"] = float(s["totale_iva_incl"])
    elif s.get("totale"):
        restore["totale_iva_incl"] = float(s["totale"])
    if s.get("totale_iva_escl"):
        restore["totale_iva_escl"] = float(s["totale_iva_escl"])
    if s.get("tipo"):
        restore["tipo"] = s["tipo"]
    if s.get("mq") is not None:
        restore["mq"] = s["mq"]
    if s.get("package_id"):
        restore["package_id"] = s["package_id"]
    if s.get("package_name"):
        restore["package_name"] = s["package_name"]
    await db.preventivi.update_one({"id": prev_id}, {"$set": restore})
    doc = await db.preventivi.find_one({"id": prev_id}, {"_id": 0})
    await audit_log(db, user=user, action="restore_audit", entity="preventivo", entity_id=prev_id,
                    description=f"Preventivo {doc.get('numero')} ricostruito da audit log (ts={best['log'].get('ts')[:19]})",
                    before={"totale": current.get("totale_iva_incl"), "tipo": current.get("tipo")},
                    after={"totale": doc.get("totale_iva_incl"), "tipo": doc.get("tipo")})
    return {
        "ok": True,
        "preventivo": doc,
        "ricostruito_da_ts": best["log"].get("ts"),
        "warning": "Voci dettagliate (composite_selections, manual_extras, listini_selections) NON recuperate dall'audit storico — vanno ri-inserite manualmente nel preventivo.",
    }


@api.put("/preventivi/{prev_id}/admin-restore")
async def admin_restore_preventivo(prev_id: str, body: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    """Override admin per ripristinare manualmente i dati di un preventivo wiped, senza passare
    per il modello PreventivoIn (che applicherebbe default). Solo admin."""
    if (user.get("role") or "").lower() != "admin":
        raise HTTPException(403, "Solo admin")
    current = await db.preventivi.find_one({"id": prev_id}, {"_id": 0})
    if not current:
        raise HTTPException(404, "Preventivo non trovato")
    body = body or {}
    body.pop("_id", None); body.pop("id", None)
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    body["admin_restored_by"] = user.get("email")
    body["admin_restored_at"] = body["updated_at"]
    await db.preventivi.update_one({"id": prev_id}, {"$set": body})
    doc = await db.preventivi.find_one({"id": prev_id}, {"_id": 0})
    await audit_log(db, user=user, action="admin_restore", entity="preventivo", entity_id=prev_id,
                    description=f"Admin override restore su {doc.get('numero')} (campi: {', '.join(body.keys())})",
                    before={"totale": current.get("totale_iva_incl")}, after={"totale": doc.get("totale_iva_incl")})
    return {"ok": True, "preventivo": doc}


@api.post("/preventivi/{prev_id}/ripristina-snapshot")
async def ripristina_preventivo_snapshot(prev_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Ripristina il preventivo dall'ultimo snapshot disponibile in `preventivi_snapshots`.
    Solo admin oppure proprietario."""
    is_admin = (user.get("role") or "").lower() == "admin"
    q = {"id": prev_id} if is_admin else {"id": prev_id, "user_id": user["id"]}
    current = await db.preventivi.find_one(q, {"_id": 0})
    if not current:
        raise HTTPException(404, "Preventivo non trovato")
    # Cerca lo snapshot più recente per questo preventivo
    snap = await db.preventivi_snapshots.find_one(
        {"snapshot_of": prev_id},
        {"_id": 0},
        sort=[("snapshot_taken_at", -1)],
    )
    if not snap:
        raise HTTPException(404, "Nessun snapshot disponibile per questo preventivo")
    # Ricostruisci il documento dallo snapshot, eccetto i meta del snapshot stesso
    restore_doc = {k: v for k, v in snap.items() if not k.startswith("snapshot_")}
    restore_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    restore_doc["ripristinato_da_snapshot"] = snap.get("snapshot_id")
    restore_doc["ripristinato_il"] = restore_doc["updated_at"]
    restore_doc.pop("_id", None)
    restore_doc.pop("id", None)
    await db.preventivi.update_one(q, {"$set": restore_doc})
    doc = await db.preventivi.find_one(q, {"_id": 0})
    await audit_log(db, user=user, action="restore", entity="preventivo", entity_id=prev_id,
                    description=f"Ripristinato preventivo {doc.get('numero')} da snapshot {snap.get('snapshot_id')[:8]}",
                    before={"totale": current.get("totale_iva_incl"), "tipo": current.get("tipo")},
                    after={"totale": doc.get("totale_iva_incl"), "tipo": doc.get("tipo")})
    return {"ok": True, "preventivo": doc, "snapshot_taken_at": snap.get("snapshot_taken_at")}


@api.get("/preventivi/{prev_id}/snapshots")
async def list_preventivo_snapshots(prev_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Lista snapshot disponibili per un preventivo (admin only o proprietario)."""
    is_admin = (user.get("role") or "").lower() == "admin"
    q = {"id": prev_id} if is_admin else {"id": prev_id, "user_id": user["id"]}
    cur = await db.preventivi.find_one(q, {"_id": 0, "id": 1})
    if not cur:
        raise HTTPException(404, "Preventivo non trovato")
    snaps = await db.preventivi_snapshots.find(
        {"snapshot_of": prev_id},
        {"_id": 0, "snapshot_id": 1, "snapshot_taken_at": 1, "snapshot_reason": 1,
         "totale_iva_incl": 1, "tipo": 1, "mq": 1, "package_name": 1,
         "composite_selections": 1, "manual_extras": 1, "listini_selections": 1},
        sort=[("snapshot_taken_at", -1)],
    ).to_list(50)
    # Riassumi le voci per leggibilità senza esporre tutto
    out = []
    for s in snaps:
        out.append({
            "snapshot_id": s.get("snapshot_id"),
            "taken_at": s.get("snapshot_taken_at"),
            "reason": s.get("snapshot_reason"),
            "totale_iva_incl": s.get("totale_iva_incl"),
            "tipo": s.get("tipo"),
            "mq": s.get("mq"),
            "package_name": s.get("package_name"),
            "n_voci": len(s.get("composite_selections") or []),
            "n_manuali": len(s.get("manual_extras") or []),
            "n_listini": len(s.get("listini_selections") or []),
        })
    return out


@api.delete("/preventivi/{prev_id}")
async def delete_preventivo(prev_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    existing = await db.preventivi.find_one({"id": prev_id, "user_id": user["id"]}, {"_id": 0})
    await db.preventivi.delete_one({"id": prev_id, "user_id": user["id"]})
    await audit_log(db, user=user, action="delete", entity="preventivo", entity_id=prev_id,
                    description=f"Eliminato preventivo {(existing or {}).get('numero', prev_id)}",
                    before={"numero": (existing or {}).get("numero"), "totale": (existing or {}).get("totale_iva_incl")})
    return {"ok": True}


@api.patch("/preventivi/{prev_id}/stato")
async def update_stato(prev_id: str, body: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    stato = body.get("stato")
    if stato not in ["bozza", "inviato", "accettato", "rifiutato"]:
        raise HTTPException(status_code=400, detail="Stato non valido")
    await db.preventivi.update_one(
        {"id": prev_id, "user_id": user["id"]},
        {"$set": {"stato": stato, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    # AUTO-POPOLAMENTO COMMESSA + COMPUTO + TABELLA MATERIALI bozza quando il preventivo viene accettato
    auto_commessa_info = None
    if stato == "accettato":
        try:
            auto_commessa_info = await _auto_populate_commessa_from_preventivo(prev_id, user)
        except Exception as e:
            logger.exception(f"[auto-populate commessa] errore per preventivo {prev_id}: {e}")
    return {"ok": True, "stato": stato, "auto_commessa": auto_commessa_info}


# ====================== SCONTO RICHIESTA & AUTORIZZAZIONE ======================
# Soglia automatica per ruolo "venditore": fino al 5% non serve autorizzazione.
# Sopra il 5% il venditore deve aprire una richiesta che l'admin approva o rifiuta.

SOGLIA_SCONTO_AUTO = 5.0  # % massima auto-approvata per venditori


def _calc_marginalita_preventivo(prev: Dict[str, Any], voci_back: Dict[str, Any], sconto_simulato_pct: float = None) -> Dict[str, Any]:
    """Calcola marginalità live di un preventivo simulando uno sconto. Considera:
    - Ricavo: totale_iva_escl (o ricalcolato base + extras + optional + bagni - sconto)
    - Costo: somma di prezzo_acquisto × qty per ogni voce + costi bagni (silver=2000€, gold=3200€, platinum=5500€ stimati come costo netto interno)
    """
    items = prev.get("items") or []
    extra = prev.get("extra_voci") or []
    optional = prev.get("optional") or []
    bathrooms = prev.get("bathrooms") or []
    # Costi netti
    costo = 0.0
    for it in items + extra:
        vid = it.get("voce_id") or it.get("id")
        vb = voci_back.get(vid) or {}
        qty = float(it.get("qty") or it.get("included_qty") or 0)
        pa = float(vb.get("prezzo_acquisto") or 0)
        if pa == 0 and (it.get("unit_price") or it.get("prezzo_unit")):
            # Stima costo dall'unit_price diviso ricarico medio 1.8x
            pa = float(it.get("unit_price") or it.get("prezzo_unit") or 0) / 1.8
        costo += qty * pa
    for o in optional:
        # Optional: usa il prezzo_listino come ricavo, stima costo come ricavo / 1.6
        costo += float(o.get("total") or 0) / 1.6
    # Bagni: costi netti stimati interni (sanitari + posa + materiali)
    BATH_COSTS = {"bagno-silver": 2000.0, "bagno-gold": 3200.0, "bagno-platinum": 5500.0}
    for i, b in enumerate(bathrooms):
        tid = b.get("tier_id")
        if b.get("included"):
            # Solo upgrade differenza
            costo += max(0, BATH_COSTS.get(tid, 0) - BATH_COSTS.get("bagno-silver", 0))
        else:
            costo += BATH_COSTS.get(tid, 0)
    # Ricavo: totale_iva_escl come riferimento (già contiene sconto e maggiorazioni applicate dal frontend)
    ricavo_attuale = float(prev.get("totale_iva_escl") or 0)
    sconto_pct_attuale = float(prev.get("sconto_pct") or 0)
    # Subtotal (pre-sconto)
    subtotal = ricavo_attuale / max(0.0001, (1 - sconto_pct_attuale / 100)) if sconto_pct_attuale > 0 else ricavo_attuale
    # Se è stato richiesto uno sconto simulato, ricalcola ricavo
    if sconto_simulato_pct is not None:
        ricavo_simulato = subtotal * (1 - sconto_simulato_pct / 100)
    else:
        ricavo_simulato = ricavo_attuale
    margine_eur = ricavo_simulato - costo
    margine_pct = (margine_eur / ricavo_simulato * 100) if ricavo_simulato else 0
    return {
        "subtotal": round(subtotal, 2),
        "costo_netto_stimato": round(costo, 2),
        "ricavo_attuale": round(ricavo_attuale, 2),
        "ricavo_simulato": round(ricavo_simulato, 2),
        "sconto_pct_attuale": sconto_pct_attuale,
        "sconto_pct_simulato": sconto_simulato_pct,
        "margine_eur": round(margine_eur, 2),
        "margine_pct": round(margine_pct, 2),
    }


@api.post("/preventivi/{prev_id}/sconto-richiesta")
async def request_sconto(prev_id: str, body: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    """Venditore richiede uno sconto > 5%. Crea record pending.
    Body: { pct: float, motivo: str }"""
    pct = float(body.get("pct") or 0)
    motivo = (body.get("motivo") or "").strip()
    if pct <= SOGLIA_SCONTO_AUTO:
        raise HTTPException(400, f"Sconto fino al {SOGLIA_SCONTO_AUTO}% non richiede autorizzazione (puoi applicarlo direttamente).")
    if pct > 100 or pct < 0:
        raise HTTPException(400, "Percentuale sconto non valida")
    if not motivo:
        raise HTTPException(400, "Inserisci un motivo per la richiesta")
    prev = await db.preventivi.find_one({"id": prev_id, "user_id": user["id"]}, {"_id": 0}) if (user.get("role") or "").lower() != "admin" else await db.preventivi.find_one({"id": prev_id}, {"_id": 0})
    if not prev:
        raise HTTPException(404, "Preventivo non trovato")
    # Verifica se c'è già una richiesta pending per lo stesso preventivo → la sostituisce
    existing = await db.sconto_richieste.find_one({"preventivo_id": prev_id, "stato": "pending"}, {"_id": 0})
    rid = existing["id"] if existing else uuid.uuid4().hex
    doc = {
        "id": rid,
        "preventivo_id": prev_id,
        "preventivo_numero": prev.get("numero"),
        "cliente_nome": ((prev.get("cliente") or {}).get("nome") or "") + " " + ((prev.get("cliente") or {}).get("cognome") or ""),
        "pct_richiesto": pct,
        "motivo": motivo,
        "stato": "pending",
        "requested_by": user.get("id"),
        "requested_by_name": user.get("name") or user.get("email"),
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "decided_at": None,
        "admin_note": "",
        "decided_by": None,
    }
    if existing:
        await db.sconto_richieste.update_one({"id": rid}, {"$set": dict(doc)})
    else:
        await db.sconto_richieste.insert_one(dict(doc))
    doc.pop("_id", None)
    # NOTIFICA ADMIN via email
    try:
        from email_service import send_sconto_request_admin_email
        voci_back = {v["id"]: v for v in await db.voci_backoffice.find({}, {"_id": 0}).to_list(3000)}
        m_attuale = _calc_marginalita_preventivo(prev, voci_back)
        m_se = _calc_marginalita_preventivo(prev, voci_back, sconto_simulato_pct=pct)
        admin_users = await db.users.find({"role": "admin"}, {"_id": 0, "email": 1}).to_list(20)
        for a in admin_users:
            if a.get("email"):
                await send_sconto_request_admin_email(
                    to=a["email"],
                    venditore_nome=doc["requested_by_name"] or "Venditore",
                    preventivo_numero=doc["preventivo_numero"] or "—",
                    cliente_nome=doc["cliente_nome"] or "Cliente",
                    pct=pct,
                    motivo=motivo,
                    margine_attuale_pct=m_attuale.get("margine_pct") or 0,
                    margine_se_approvo_pct=m_se.get("margine_pct") or 0,
                )
    except Exception as e:
        logger.warning(f"[EMAIL sconto-request] errore: {e}")
    await audit_log(db, user=user, action="sconto_request", entity="preventivo", entity_id=prev_id,
                    description=f"Richiesto sconto {pct}% su {doc['preventivo_numero']} — motivo: {motivo[:80]}",
                    after={"pct_richiesto": pct, "motivo": motivo})
    return doc


@api.get("/sconto-richieste")
async def list_sconto_richieste(stato: Optional[str] = None, user: Dict[str, Any] = Depends(get_current_user)):
    """Admin vede tutte. Venditore vede solo le proprie."""
    q: Dict[str, Any] = {}
    if stato:
        q["stato"] = stato
    role = (user.get("role") or "").lower()
    if role != "admin":
        q["requested_by"] = user.get("id")
    rows = await db.sconto_richieste.find(q, {"_id": 0}).sort("requested_at", -1).to_list(500)
    # Per ogni richiesta arricchisce con marginalità live calcolata SUL MOMENTO
    voci_back = {v["id"]: v for v in await db.voci_backoffice.find({}, {"_id": 0}).to_list(3000)}
    out = []
    for r in rows:
        prev = await db.preventivi.find_one({"id": r["preventivo_id"]}, {"_id": 0})
        if prev:
            r["marginalita_live"] = _calc_marginalita_preventivo(prev, voci_back, sconto_simulato_pct=r.get("pct_richiesto"))
            r["marginalita_senza_sconto_extra"] = _calc_marginalita_preventivo(prev, voci_back)
        out.append(r)
    return out


@api.put("/sconto-richieste/{rid}/decide")
async def decide_sconto(rid: str, body: Dict[str, Any], user: Dict[str, Any] = Depends(get_current_user)):
    """Admin approva o rifiuta. Body: { stato: 'approvato'|'rifiutato', pct_approvato?: float, admin_note?: str }"""
    if (user.get("role") or "").lower() != "admin":
        raise HTTPException(403, "Solo l'admin può approvare/rifiutare richieste sconto")
    new_stato = body.get("stato")
    if new_stato not in ("approvato", "rifiutato"):
        raise HTTPException(400, "Stato non valido (approvato/rifiutato)")
    r = await db.sconto_richieste.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Richiesta non trovata")
    pct_finale = float(body.get("pct_approvato") if body.get("pct_approvato") is not None else r.get("pct_richiesto") or 0)
    update = {
        "stato": new_stato,
        "decided_at": datetime.now(timezone.utc).isoformat(),
        "decided_by": user.get("id"),
        "admin_note": (body.get("admin_note") or "").strip(),
        "pct_approvato": pct_finale if new_stato == "approvato" else None,
    }
    await db.sconto_richieste.update_one({"id": rid}, {"$set": update})
    # Se approvato → applica il nuovo sconto sul preventivo
    if new_stato == "approvato":
        await db.preventivi.update_one(
            {"id": r["preventivo_id"]},
            {"$set": {"sconto_pct": pct_finale, "sconto_autorizzato_da": user.get("id"), "sconto_autorizzato_il": update["decided_at"]}},
        )
    # NOTIFICA EMAIL al venditore con la decisione
    try:
        from email_service import send_sconto_decision_email
        venditore = await db.users.find_one({"id": r.get("requested_by")}, {"_id": 0, "email": 1, "name": 1})
        if venditore and venditore.get("email"):
            await send_sconto_decision_email(
                to=venditore["email"],
                venditore_nome=venditore.get("name") or r.get("requested_by_name") or "Venditore",
                preventivo_numero=r.get("preventivo_numero") or "—",
                cliente_nome=r.get("cliente_nome") or "Cliente",
                stato=new_stato,
                pct_approvato=pct_finale if new_stato == "approvato" else None,
                pct_richiesto=float(r.get("pct_richiesto") or 0),
                admin_note=update["admin_note"],
            )
    except Exception as e:
        logger.warning(f"[EMAIL sconto-decision] errore: {e}")
    await audit_log(db, user=user, action=f"sconto_{new_stato}", entity="preventivo", entity_id=r["preventivo_id"],
                    description=f"Sconto {new_stato} {pct_finale}% su {r.get('preventivo_numero')}",
                    before={"pct_richiesto": r.get("pct_richiesto")},
                    after={"pct_approvato": pct_finale, "stato": new_stato, "admin_note": update["admin_note"]})
    return {"ok": True, **update}


@api.post("/preventivi/{prev_id}/invia-email")
async def invia_preventivo_email(prev_id: str, body: Optional[Dict[str, Any]] = None, user: Dict[str, Any] = Depends(get_current_user)):
    """Invia al cliente il link al riepilogo stampabile del preventivo con un messaggio personalizzato.
    R87: usa il template professionale `send_preventivo_email` con branding completo."""
    q = {"id": prev_id} if (user.get("role") or "").lower() == "admin" else {"id": prev_id, "user_id": user["id"]}
    prev = await db.preventivi.find_one(q, {"_id": 0})
    if not prev:
        raise HTTPException(404, "Preventivo non trovato")
    cliente = prev.get("cliente") or {}
    body = body or {}
    # R87 fix: il frontend può passare un destinatario custom (es. cliente senza email salvata)
    to_email = (body.get("destinatario") or cliente.get("email") or "").strip()
    if not to_email:
        raise HTTPException(400, "Manca indirizzo email destinatario")
    # Combina dati azienda da impostazioni (sorgente nuova) + dati_azienda (legacy)
    imp = await db.impostazioni.find_one({}, {"_id": 0}) or {}
    da = await db.dati_azienda.find_one({}, {"_id": 0}) or {}
    azienda = {**da, **imp}
    incaricato = await db.users.find_one({"id": prev.get("user_id")}, {"_id": 0}) or {}
    custom = body.get("messaggio") or body.get("custom_message") or ""
    try:
        from email_service import send_preventivo_email
        ok = await send_preventivo_email(
            to=to_email,
            preventivo=prev,
            azienda=azienda,
            incaricato=incaricato,
            custom_message=custom,
        )
        # Traccia invio anche se SMTP ritorna False (così sai che è stato tentato)
        await db.preventivi.update_one(
            {"id": prev_id},
            {"$set": {"email_inviata_a": to_email, "email_inviata_il": datetime.now(timezone.utc).isoformat(), "email_inviata_ok": ok}},
        )
        return {"ok": ok, "sent_to": to_email}
    except Exception as e:
        logger.exception(f"[invia-preventivo-email] errore: {e}")
        raise HTTPException(500, f"Errore invio email: {e}")


async def _auto_populate_commessa_from_preventivo(prev_id: str, user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Quando un preventivo viene accettato, crea (se non esiste) una commessa collegata
    e ne pre-compila Computo Metrico + bozza Tabella Materiali dalle righe del preventivo.

    Pipeline:
      1. Se esiste già una commessa con `preventivo_id=prev_id`, ne aggiorna soltanto i campi mancanti
         (no overwrite). Altrimenti la crea.
      2. Computo Metrico: 1 item per ogni voce del preventivo (items/extra_voci/infissi/composite_selections)
         con qty/prezzo_unit/totale.
      3. Tabella Materiali bozza: applica il template `materiali_template` ATTIVO (se esiste); altrimenti
         estrae solo le voci del preventivo che hanno categoria "materiali"/"finiture" oppure unit in
         (m²,pz,ml,kg).
      4. Compila lo skeleton di documenti vuoti (contratto, capitolato, polizza) puntando ai
         `documenti_template` attivi se presenti.
    """
    prev = await db.preventivi.find_one({"id": prev_id, "user_id": user["id"]}, {"_id": 0})
    if not prev:
        return None
    cliente = prev.get("cliente") or {}
    # 1) Esiste commessa collegata?
    com = await db.commesse.find_one({"preventivo_id": prev_id}, {"_id": 0})
    now_iso_v = datetime.now(timezone.utc).isoformat()
    voci_back = {v["id"]: v for v in await db.voci_backoffice.find({}, {"_id": 0}).to_list(3000)}
    # 2) Estrai righe dal preventivo (items+extra+optional+composite+infissi+listini)
    righe = []
    for it in (prev.get("items") or []):
        # Skip voci esplicitamente escluse dal venditore
        if it.get("excluded"):
            continue
        # Pacchetto usa qty_richiesta / unit_price; fallback su qty / prezzo_unit per altri tipi
        qty_val = float(it.get("qty_richiesta") or it.get("qty") or 0)
        prezzo_val = float(it.get("unit_price") or it.get("prezzo_unit") or it.get("price") or 0)
        if qty_val <= 0 and prezzo_val <= 0:
            continue
        righe.append({
            "voce_id": it.get("voce_id") or it.get("id"),
            "name": it.get("name") or it.get("voce") or "Voce",
            "qty": qty_val,
            "unit": it.get("unit") or "pz",
            "prezzo_unit": prezzo_val,
            "category": it.get("category") or "",
        })
    for it in (prev.get("extra_voci") or []):
        righe.append({
            "voce_id": it.get("voce_id") or it.get("id"),
            "name": it.get("name") or "Extra",
            "qty": float(it.get("qty") or 0),
            "unit": it.get("unit") or "pz",
            "prezzo_unit": float(it.get("prezzo_unit") or it.get("price") or 0),
        })
    # Optional selezionati nel preventivo (climatizzatori, portoncini, ecc.)
    for op in (prev.get("optional") or []):
        q = float(op.get("qty") or 0)
        pu = float(op.get("unit_price") or 0)
        if q <= 0 and pu <= 0:
            continue
        righe.append({
            "voce_id": op.get("id"),
            "name": (op.get("name") or "Optional") + " (optional)",
            "qty": q if q > 0 else 1,
            "unit": op.get("unit") or "pz",
            "prezzo_unit": pu,
            "category": "OPTIONAL",
        })
    for inf in (prev.get("infissi") or []):
        righe.append({
            "voce_id": None,
            "name": f"Infisso {inf.get('tipologia', 'finestra')} {inf.get('larghezza', '')}x{inf.get('altezza', '')}",
            "qty": float(inf.get("qty") or 1),
            "unit": "pz",
            "prezzo_unit": float(inf.get("prezzo") or inf.get("prezzo_unit") or 0),
        })
    # Infissi extras dal modal del Pacchetto
    for inf in (prev.get("infissi_extras") or []):
        q = float(inf.get("qty") or 1)
        pu = float(inf.get("unit_price") or inf.get("price") or inf.get("prezzo") or 0)
        if q <= 0 and pu <= 0:
            continue
        righe.append({
            "voce_id": inf.get("id"),
            "name": inf.get("name") or "Infisso",
            "qty": q,
            "unit": inf.get("unit") or "pz",
            "prezzo_unit": pu,
            "category": "INFISSI",
        })
    # Composite selections (lista) — voci scelte voce-per-voce nel preventivo composite
    csel = prev.get("composite_selections") or []
    if isinstance(csel, dict):
        csel = [{"voce_id": k, **v} if isinstance(v, dict) else {"voce_id": k} for k, v in csel.items()]
    for sel in csel:
        if not isinstance(sel, dict):
            continue
        q = float(sel.get("qty") or 0)
        if q <= 0:
            continue
        righe.append({
            "voce_id": sel.get("voce_id") or sel.get("id"),
            "name": sel.get("name") or sel.get("descrizione") or "Voce",
            "qty": q,
            "unit": sel.get("unit") or "pz",
            "prezzo_unit": float(sel.get("price") or sel.get("unit_price") or sel.get("prezzo_unit") or 0),
            "category": sel.get("category") or "",
        })
    # Listini fornitori (porte, piastrelle, sanitari, ecc.) selezionati nel preventivo
    # Combina selezioni del venditore + pre-inclusi nel pacchetto (snapshot al salvataggio)
    listini_all = []
    listini_all.extend(prev.get("listini_selections") or [])
    listini_all.extend(prev.get("package_listini_items") or [])
    seen_ls_keys = set()
    for ls in listini_all:
        if not isinstance(ls, dict):
            continue
        key = (ls.get("listino_id"), ls.get("id"))
        if key in seen_ls_keys:
            continue
        seen_ls_keys.add(key)
        q = float(ls.get("qty") or 1)
        righe.append({
            "voce_id": ls.get("id"),
            "name": ls.get("nome") or "Prodotto da listino",
            "qty": q,
            "unit": ls.get("unit") or "pz",
            "prezzo_unit": float(ls.get("prezzo_rivendita") or 0),
            "category": (ls.get("categoria") or "FORNITURA").upper(),
            "from_listino": True,
            "listino_id": ls.get("listino_id"),
            "fornitore_nome": ls.get("fornitore_nome"),
            "prezzo_netto": float(ls.get("prezzo_netto") or 0),
            "ricarico": float(ls.get("ricarico") or 1.8),
        })
    # Costruisci computo_metrico items
    cm_items = []
    for r in righe:
        if r["qty"] <= 0 and r["prezzo_unit"] <= 0:
            continue
        vb = voci_back.get(r["voce_id"]) if r["voce_id"] else None
        item = {
            "id": f"cm-{uuid.uuid4().hex[:8]}",
            "voce_id": r["voce_id"] or "",
            "name": r["name"],
            "qty": r["qty"],
            "unit": r["unit"],
            "prezzo_unit": r["prezzo_unit"],
            "totale": round(r["qty"] * r["prezzo_unit"], 2),
            "category": r.get("category") or (vb or {}).get("category", ""),
            "stato_assegnazione": "da_assegnare",
            "auto_from_preventivo": True,
        }
        # Propaga metadati listino fornitore
        if r.get("from_listino"):
            item["from_listino"] = True
            item["listino_id"] = r.get("listino_id")
            item["fornitore_nome"] = r.get("fornitore_nome")
            item["prezzo_netto"] = r.get("prezzo_netto", 0)
            item["ricarico"] = r.get("ricarico", 1.8)
            item["artigiano_nome"] = r.get("fornitore_nome")
        cm_items.append(item)
    cm_totale = round(sum(x["totale"] for x in cm_items), 2)

    # 2b) UPGRADE TIER BAGNI: per ogni bagno con tier != silver, aggiungi voce computo con la differenza
    bathrooms = prev.get("bathrooms") or []
    if bathrooms:
        tiers = await db.bathroom_tiers.find({}, {"_id": 0}).sort("price", 1).to_list(20)
        if not tiers:
            # Fallback: prezzi default dei tier hardcoded in packages_seed
            tiers = [{"id": "bagno-silver", "name": "SILVER", "price": 3500.0},
                     {"id": "bagno-gold", "name": "GOLD", "price": 5500.0},
                     {"id": "bagno-platinum", "name": "PLATINUM", "price": 9000.0}]
        tiers_map = {t["id"]: t for t in tiers}
        silver_price = (tiers[0] or {}).get("price", 0) if tiers else 0
        for i, b in enumerate(bathrooms):
            tier = tiers_map.get(b.get("tier_id"))
            if not tier:
                continue
            if b.get("included"):
                diff = max(0, (tier.get("price", 0) - silver_price))
                if diff > 0:
                    cm_items.append({
                        "id": f"cm-{uuid.uuid4().hex[:8]}",
                        "voce_id": "",
                        "name": f"Upgrade Bagno #{i+1} → {tier.get('name')} (differenza vs SILVER)",
                        "qty": 1,
                        "unit": "forfait",
                        "prezzo_unit": diff,
                        "totale": diff,
                        "category": "bagno",
                        "stato_assegnazione": "da_assegnare",
                        "auto_from_preventivo": True,
                        "tier_bagno": tier.get("id"),
                    })
            else:
                price = tier.get("price", 0)
                cm_items.append({
                    "id": f"cm-{uuid.uuid4().hex[:8]}",
                    "voce_id": "",
                    "name": f"Bagno #{i+1} aggiuntivo {tier.get('name')} (completo, extra)",
                    "qty": 1,
                    "unit": "forfait",
                    "prezzo_unit": price,
                    "totale": price,
                    "category": "bagno",
                    "stato_assegnazione": "da_assegnare",
                    "auto_from_preventivo": True,
                    "tier_bagno": tier.get("id"),
                })
        cm_totale = round(sum(x["totale"] for x in cm_items), 2)
    # 3) Tabella Materiali bozza: usa template attivo se esiste, altrimenti estrai voci "materiali"
    mat_items = []
    template_doc = await db.materiali_template.find_one({"is_default": True}, {"_id": 0})
    if template_doc and template_doc.get("voci"):
        for tv in template_doc["voci"]:
            mat_items.append({
                "voce_id": tv.get("voce_id") or "",
                "name": tv.get("name", "Materiale"),
                "category": tv.get("category", "materiali"),
                "qty": tv.get("qty_default", 1),
                "unit": tv.get("unit", "pz"),
                "prezzo": tv.get("prezzo_default", 0),
                "finitura": "",  # da scegliere
                "finiture_disponibili": tv.get("finiture", []),
                "note": "",
                "from_template": True,
            })
    else:
        # Fallback: estrai voci del preventivo con category materiali/finiture/sanitari/cucina/arredo
        material_categories = {"materiali", "finiture", "sanitari", "cucina", "arredo", "piastrelle", "rivestimenti"}
        for r in righe:
            vb = voci_back.get(r["voce_id"]) if r["voce_id"] else None
            cat = ((vb or {}).get("category") or "").lower()
            unit = (r["unit"] or "").lower()
            if cat in material_categories or unit in ("m²", "m2", "mq", "pz", "ml"):
                mat_items.append({
                    "voce_id": r["voce_id"] or "",
                    "name": r["name"],
                    "category": cat or "materiali",
                    "qty": r["qty"],
                    "unit": r["unit"],
                    "prezzo": r["prezzo_unit"],
                    "finitura": "",
                    "note": "",
                    "from_preventivo": True,
                })
    # 4) Crea/aggiorna commessa
    if not com:
        com_id = f"com-{uuid.uuid4().hex[:8]}"
        next_num = await db.commesse.count_documents({}) + 1
        com = {
            "id": com_id,
            "numero": f"COM-{datetime.now(timezone.utc).year}-{next_num:04d}",
            "preventivo_id": prev_id,
            "stato": "in_corso",
            "cliente": cliente,
            "totale": prev.get("totale_iva_incl") or prev.get("totale_iva_escl") or cm_totale,
            "computo_metrico": {"items": cm_items, "totale": cm_totale, "auto_from_preventivo": True, "generato_il": now_iso_v},
            "materiali_scelta": {"items": mat_items, "firmato_cliente": False, "auto_bozza": True, "generato_il": now_iso_v},
            "voci_acquisti": [],
            "documenti": [],
            "auto_from_preventivo": True,
            "created_at": now_iso_v,
            "created_by": user["id"],
        }
        await db.commesse.insert_one(com)
        # Allinea anche eventuali Documenti Template virgine: copiali come documenti vuoti da firmare
        try:
            templates = await db.documenti_template.find({}, {"_id": 0}).to_list(50)
            doc_skel = []
            for t in templates:
                doc_skel.append({
                    "id": f"doc-{uuid.uuid4().hex[:8]}",
                    "nome": t.get("nome", "Documento"),
                    "tipo": t.get("tipo", "contratto"),
                    "file_url": t.get("file_url"),
                    "auto_from_template": True,
                    "stato": "da_compilare",
                })
            if doc_skel:
                await db.commesse.update_one({"id": com_id}, {"$set": {"documenti": doc_skel}})
        except Exception:
            pass
        return {"created": True, "commessa_id": com_id, "computo_items": len(cm_items), "materiali_items": len(mat_items)}
    else:
        # Esistente: aggiorna SOLO le sezioni vuote (no overwrite distruttivo)
        upd = {}
        if not (com.get("computo_metrico") or {}).get("items"):
            upd["computo_metrico"] = {"items": cm_items, "totale": cm_totale, "auto_from_preventivo": True, "generato_il": now_iso_v}
        if not (com.get("materiali_scelta") or {}).get("items"):
            upd["materiali_scelta"] = {"items": mat_items, "firmato_cliente": False, "auto_bozza": True, "generato_il": now_iso_v}
        if upd:
            await db.commesse.update_one({"id": com["id"]}, {"$set": upd})
        return {"updated": True, "commessa_id": com["id"], "computo_added": "computo_metrico" in upd, "materiali_added": "materiali_scelta" in upd}


# ============ MATERIALI TEMPLATE (admin) ============
class MaterialiTemplateVoceIn(BaseModel):
    voce_id: Optional[str] = None
    name: str
    category: str = "materiali"
    unit: str = "pz"
    qty_default: float = 1
    prezzo_default: float = 0
    finiture: List[str] = []


class MaterialiTemplateIn(BaseModel):
    nome: str
    is_default: bool = False
    voci: List[MaterialiTemplateVoceIn] = []


@api.get("/admin/materiali-template")
async def list_materiali_template(user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo admin")
    return await db.materiali_template.find({}, {"_id": 0}).sort("nome", 1).to_list(200)


@api.post("/admin/materiali-template")
async def create_materiali_template(body: MaterialiTemplateIn, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo admin")
    tpl_id = f"mt-{uuid.uuid4().hex[:10]}"
    doc = {"id": tpl_id, **body.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    if body.is_default:
        await db.materiali_template.update_many({"is_default": True}, {"$set": {"is_default": False}})
    await db.materiali_template.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/materiali-template/{tpl_id}")
async def update_materiali_template(tpl_id: str, body: MaterialiTemplateIn, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo admin")
    if body.is_default:
        await db.materiali_template.update_many({"is_default": True, "id": {"$ne": tpl_id}}, {"$set": {"is_default": False}})
    upd = body.model_dump()
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.materiali_template.update_one({"id": tpl_id}, {"$set": upd})
    return await db.materiali_template.find_one({"id": tpl_id}, {"_id": 0})


@api.delete("/admin/materiali-template/{tpl_id}")
async def delete_materiali_template(tpl_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo admin")
    await db.materiali_template.delete_one({"id": tpl_id})
    return {"ok": True}


# -----------------------------------------------------------------------------
# PUBLIC endpoints (no auth) — esposti al sito pubblico
# -----------------------------------------------------------------------------
@api.get("/public/packages")
async def public_packages():
    """Pacchetti pubblici per landing page del sito. Ritorna SOLO i campi sicuri da esporre:
    name, subtitle, price_per_m2, price_override, color, description, public_features.
    Esclude voci interne (items, listini, ricarichi)."""
    docs = await db.packages.find({"public": {"$ne": False}}, {"_id": 0}).sort("price_per_m2", 1).to_list(50)
    out = []
    for p in docs:
        out.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "subtitle": p.get("subtitle") or "",
            "description": p.get("description") or "",
            "price_per_m2": p.get("price_per_m2"),
            "price_override": p.get("price_override"),
            "color": p.get("color") or "#0A0A0A",
            "highlight": p.get("highlight", False),
            "public_features": p.get("public_features") or [],
        })
    return out



app.include_router(api)

# Business/CRM/Commesse router
_biz = build_biz_router(db, get_current_user, hash_password=hash_password, seed_user_catalog=seed_user_catalog, compute_expires_at=compute_expires_at)
app.include_router(_biz, prefix="/api")
_r10 = build_round10_router(db, get_current_user, create_access_token)
app.include_router(_r10, prefix="/api")
_render = build_render_router(db, get_current_user)
app.include_router(_render, prefix="/api")
from routes_commessa_workflow import build_commessa_workflow_router
_cwf = build_commessa_workflow_router(db, get_current_user)
app.include_router(_cwf, prefix="/api")

# Listini fornitori (catalogo prezzi netti porte/infissi/piastrelle/ecc + import Excel)
from fastapi import APIRouter as _APIRouterListini
import routes_listini_fornitori as _lf_mod
_lf_router = _APIRouterListini()
_lf_mod.register(_lf_router, db, get_current_user)
app.include_router(_lf_router, prefix="/api")

# Audit trail (admin only)
_audit_router = build_audit_router(db, get_current_user)
app.include_router(_audit_router, prefix="/api")


# ============ BLOG (pubblico + admin) ============
@app.get("/api/blog/posts")
async def blog_list(category: Optional[str] = None, limit: int = 100, skip: int = 0):
    """Lista pubblica articoli (solo pubblicati). Filtrabile per categoria."""
    q = {"published": True}
    if category:
        q["category"] = category
    posts = await db.blog_posts.find(q, {"_id": 0, "content_md": 0}).sort("published_at", -1).skip(skip).limit(limit).to_list(limit)
    return posts


@app.get("/api/blog/posts/{slug}")
async def blog_detail(slug: str):
    post = await db.blog_posts.find_one({"slug": slug, "published": True}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Articolo non trovato")
    try:
        await db.blog_posts.update_one({"slug": slug}, {"$inc": {"views": 1}})
    except Exception:
        pass
    return post


@app.get("/api/blog/categories")
async def blog_categories():
    cats = await db.blog_posts.distinct("category", {"published": True})
    return sorted(cats)


@app.get("/api/admin/blog/posts")
async def admin_blog_list(user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo admin")
    posts = await db.blog_posts.find({}, {"_id": 0}).sort("published_at", -1).to_list(500)
    return posts


@app.post("/api/admin/blog/posts")
async def admin_blog_create(body: dict, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo admin")
    slug = body.get("slug") or body.get("title", "").lower().replace(" ", "-")[:80]
    existing = await db.blog_posts.find_one({"slug": slug})
    if existing:
        raise HTTPException(409, "Slug già esistente")
    now = datetime.now(timezone.utc).isoformat()
    post = {
        "id": f"blog-{slug}", "slug": slug,
        "title": body.get("title", "Nuovo articolo"),
        "category": body.get("category", "Guide"),
        "tags": body.get("tags", []),
        "seo_keywords": body.get("seo_keywords", ""),
        "meta_description": body.get("meta_description", body.get("excerpt", "")[:160]),
        "excerpt": body.get("excerpt", ""),
        "hero_emoji": body.get("hero_emoji", "📝"),
        "content_md": body.get("content_md", ""),
        "published": body.get("published", False),
        "published_at": now if body.get("published") else None,
        "created_at": now, "updated_at": now, "views": 0,
        "author": user.get("name") or user.get("email") or "Admin",
    }
    await db.blog_posts.insert_one(dict(post))
    post.pop("_id", None)
    return post


@app.put("/api/admin/blog/posts/{slug}")
async def admin_blog_update(slug: str, body: dict, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo admin")
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    for k in ("_id", "id", "slug", "views", "created_at"):
        body.pop(k, None)
    if body.get("published") and not (await db.blog_posts.find_one({"slug": slug}, {"published_at": 1}) or {}).get("published_at"):
        body["published_at"] = body["updated_at"]
    await db.blog_posts.update_one({"slug": slug}, {"$set": body})
    return {"ok": True}


@app.delete("/api/admin/blog/posts/{slug}")
async def admin_blog_delete(slug: str, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Solo admin")
    await db.blog_posts.delete_one({"slug": slug})
    return {"ok": True}


@app.on_event("startup")
async def seed_blog_posts_on_startup():
    """Inserisce i 50 articoli SEO al primo avvio se la collection è vuota."""
    try:
        existing = await db.blog_posts.count_documents({})
        if existing < 50:
            from blog_seed import get_seed_posts
            posts = get_seed_posts()
            for p in posts:
                await db.blog_posts.update_one({"slug": p["slug"]}, {"$setOnInsert": p}, upsert=True)
            logger.info(f"[blog] seeded {len(posts)} articles (existing before: {existing})")
    except Exception as e:
        logger.warning(f"[blog] seed skipped: {e}")


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_origin_regex=r"https?://.*",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Startup ----------------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.projects.create_index("user_id")
    await db.projects.create_index("id", unique=True)
    await db.materials.create_index([("user_id", 1), ("id", 1)])
    await db.login_attempts.create_index("identifier")
    await db.preventivi.create_index([("user_id", 1), ("created_at", -1)])
    await db.preventivi.create_index("id", unique=True)
    # seed admin
    import logging as _log
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    _log.warning(f"[ADMIN_SEED] Starting seed — ADMIN_EMAIL env set: {bool(os.environ.get('ADMIN_EMAIL'))}, ADMIN_PASSWORD env set: {bool(os.environ.get('ADMIN_PASSWORD'))}, target email: {admin_email}")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": admin_email,
            "name": "Admin",
            "role": "admin",
            "password_hash": hash_password(admin_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await seed_user_catalog(uid)
        _log.warning(f"[ADMIN_SEED] CREATED admin user {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
        _log.warning(f"[ADMIN_SEED] UPDATED password for existing admin {admin_email}")
    else:
        _log.warning(f"[ADMIN_SEED] OK — admin {admin_email} exists with correct password")
    # === FALLBACK ADMIN HARDCODED (sempre disponibile, non dipende dalle env vars) ===
    fallback_email = "admin@admin.it"
    fallback_password = "admin"
    fallback_existing = await db.users.find_one({"email": fallback_email})
    if not fallback_existing:
        fuid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": fuid,
            "email": fallback_email,
            "name": "Admin",
            "role": "admin",
            "password_hash": hash_password(fallback_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await seed_user_catalog(fuid)
        _log.warning(f"[ADMIN_SEED] CREATED fallback admin {fallback_email}")
    elif not verify_password(fallback_password, fallback_existing["password_hash"]):
        await db.users.update_one({"email": fallback_email}, {"$set": {"password_hash": hash_password(fallback_password), "role": "admin"}})
        _log.warning(f"[ADMIN_SEED] UPDATED fallback admin password {fallback_email}")
    else:
        _log.warning(f"[ADMIN_SEED] OK — fallback admin {fallback_email} exists")
    # Pulisce brute-force locks al boot per evitare che lock stale bloccano dopo un redeploy
    cleared = await db.login_attempts.delete_many({})
    if cleared.deleted_count > 0:
        _log.warning(f"[ADMIN_SEED] Cleared {cleared.deleted_count} stale brute-force locks")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
