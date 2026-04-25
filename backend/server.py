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
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
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


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str = "user"


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
async def register(body: RegisterReq, response: Response):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": body.name,
        "role": "user",
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    # seed default catalog for user
    await seed_user_catalog(user_id)
    return {"id": user_id, "email": email, "name": body.name, "role": "user", "access_token": access, "refresh_token": refresh}


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
    await db.login_attempts.delete_one({"identifier": ident})
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user.get("role", "user"), "access_token": access, "refresh_token": refresh}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user.get("role", "user")}


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


# ---------------- Projects ----------------
@api.get("/projects")
async def list_projects(user: Dict[str, Any] = Depends(get_current_user)):
    docs = await db.projects.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)
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
    project_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": f"Progetto {nome_cliente} ({prev.get('numero', '')})",
        "data": {"mq": prev.get("mq", 70), "rooms": [], "walls": [], "doors": [], "windows": [], "items": [], "electrical": [], "plumbing": [], "gas": [], "hvac": [], "stairs": [], "texts": [], "demolitions": [], "tiling": [], "roomHeight": 270},
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
    doc = await db.projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
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
    result = await db.projects.update_one({"id": project_id, "user_id": user["id"]}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Progetto non trovato")
    # Sync inverso preventivi.project_id
    if body.preventivo_id:
        await db.preventivi.update_one({"id": body.preventivo_id, "user_id": user["id"]}, {"$set": {"project_id": project_id}})
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return doc


@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    await db.projects.delete_one({"id": project_id, "user_id": user["id"]})
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
    """Analyze a floorplan image and extract rooms + walls as CAD project_data (cm)."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurata")
    img_b64 = body.get("image_base64", "")
    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]
    if not img_b64:
        raise HTTPException(400, "Immagine mancante")
    session_id = f"floorplan-{user['id']}-{uuid.uuid4().hex[:8]}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=(
            "You are a CAD assistant that converts floorplan images into structured JSON.\n"
            "Output ONLY valid JSON, no prose, no markdown fences.\n"
            "Coordinates in CENTIMETERS, origin top-left. Estimate realistic apartment dimensions (typical room 300-500cm).\n"
            "Schema: {\"rooms\":[{\"name\":\"Cucina\",\"points\":[{\"x\":0,\"y\":0},{\"x\":400,\"y\":0},{\"x\":400,\"y\":350},{\"x\":0,\"y\":350}],\"floorMaterial\":\"floor-ceramic\",\"electrical\":true,\"plumbing\":false}]}\n"
            "Use rectangular polygons unless the room is clearly L-shaped. Identify rooms by labels (Cucina, Bagno, Camera, Soggiorno, Ingresso, Corridoio, Studio) when visible.\n"
            "Use floor-ceramic for kitchens/bathrooms, floor-parquet for bedrooms/livingroom.\n"
            "Set plumbing=true for bathrooms/kitchens.\n"
            "Place rooms adjacent (no gaps) to mimic the source layout. Limit to 2-8 rooms total."
        ),
    ).with_model("gemini", "gemini-2.5-pro")
    try:
        msg = UserMessage(text="Analizza questa pianta e ritorna il JSON strutturato delle stanze.", file_contents=[ImageContent(img_b64)])
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
    out_rooms = []
    out_walls = []
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
    return {
        "project_data": {
            "rooms": out_rooms,
            "walls": out_walls,
            "doors": [], "windows": [], "items": [],
            "electrical": [], "plumbing": [], "gas": [], "hvac": [],
            "demolitions": [], "tiling": [],
            "roomHeight": 270, "currency": "EUR",
        },
        "rooms_count": len(out_rooms),
    }


# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"message": "Ristruttura CAD API online", "version": "2.0"}


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
                })
            items.sort(key=_voci_sort_key)
            out.append({"id": p["id"], "name": p["name"], "subtitle": p["subtitle"], "price_per_m2": p["price_per_m2"], "color": p["color"], "description": p["description"], "items": items})
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
            })
        items.sort(key=_voci_sort_key)
        out.append({"id": p["id"], "name": p["name"], "subtitle": p.get("subtitle", ""), "price_per_m2": p["price_per_m2"], "color": p.get("color", "#475569"), "description": p.get("description", ""), "items": items})
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
    return doc


async def next_preventivo_number() -> str:
    year = datetime.now(timezone.utc).year
    count = await db.preventivi.count_documents({})
    return f"PRV-{year}-{count + 1:04d}"


@api.get("/preventivi")
async def list_preventivi(user: Dict[str, Any] = Depends(get_current_user)):
    docs = await db.preventivi.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.get("/preventivi/{prev_id}")
async def get_preventivo(prev_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.preventivi.find_one({"id": prev_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    return doc


@api.put("/preventivi/{prev_id}")
async def update_preventivo(prev_id: str, body: PreventivoIn, user: Dict[str, Any] = Depends(get_current_user)):
    update_doc = {**body.model_dump(exclude_none=False), "updated_at": datetime.now(timezone.utc).isoformat()}
    update_doc.pop("id", None)
    await db.preventivi.update_one({"id": prev_id, "user_id": user["id"]}, {"$set": update_doc})
    doc = await db.preventivi.find_one({"id": prev_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Preventivo non trovato")
    return doc


@api.delete("/preventivi/{prev_id}")
async def delete_preventivo(prev_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    await db.preventivi.delete_one({"id": prev_id, "user_id": user["id"]})
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
    return {"ok": True, "stato": stato}


app.include_router(api)

# Business/CRM/Commesse router
_biz = build_biz_router(db, get_current_user)
app.include_router(_biz, prefix="/api")
_r10 = build_round10_router(db, get_current_user, create_access_token)
app.include_router(_r10, prefix="/api")

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
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
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
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
