"""Audit Trail — log azioni critiche (preventivi, commesse, impostazioni, sconti, utenti).
Salva in collection `audit_logs`. Espone endpoint GET (admin only)."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request


async def audit_log(
    db,
    *,
    user: Optional[Dict[str, Any]],
    action: str,
    entity: str,
    entity_id: str = "",
    description: str = "",
    before: Optional[Dict[str, Any]] = None,
    after: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """Best-effort: errori loggati ma non sollevati per non bloccare il flusso business."""
    try:
        doc = {
            "id": str(uuid.uuid4()),
            "ts": datetime.now(timezone.utc).isoformat(),
            "user_id": (user or {}).get("id", ""),
            "user_email": (user or {}).get("email", ""),
            "user_role": (user or {}).get("role", ""),
            "action": action,
            "entity": entity,
            "entity_id": str(entity_id or ""),
            "description": description or "",
            "before": _sanitize(before),
            "after": _sanitize(after),
            "ip": _client_ip(request),
        }
        await db.audit_logs.insert_one(doc)
    except Exception as e:  # noqa
        import logging
        logging.getLogger(__name__).warning("[AUDIT] failed: %s", e)


def _sanitize(d):
    if d is None:
        return None
    if not isinstance(d, dict):
        return None
    # rimuovi campi sensibili e _id
    out = {}
    for k, v in d.items():
        if k in ("password", "password_hash", "_id"):
            continue
        out[k] = v
    return out


def _client_ip(request: Optional[Request]) -> str:
    if not request:
        return ""
    try:
        xf = request.headers.get("x-forwarded-for", "")
        if xf:
            return xf.split(",")[0].strip()
        return request.client.host if request.client else ""
    except Exception:
        return ""


def build_audit_router(db, get_current_user):
    r = APIRouter()

    @r.get("/audit-logs")
    async def list_audit_logs(
        entity: Optional[str] = None,
        entity_id: Optional[str] = None,
        action: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 200,
        user=Depends(get_current_user),
    ) -> List[Dict[str, Any]]:
        if (user.get("role") or "").lower() not in ("admin", "responsabile", "gestore"):
            raise HTTPException(403, "Solo admin/gestore può consultare l'audit trail")
        q: Dict[str, Any] = {}
        if entity:
            q["entity"] = entity
        if entity_id:
            q["entity_id"] = entity_id
        if action:
            q["action"] = action
        if user_id:
            q["user_id"] = user_id
        try:
            limit = max(1, min(int(limit), 1000))
        except Exception:
            limit = 200
        cur = db.audit_logs.find(q, {"_id": 0}).sort("ts", -1).limit(limit)
        return [doc async for doc in cur]

    @r.get("/audit-logs/entity/{entity}/{entity_id}")
    async def entity_audit_logs(entity: str, entity_id: str, user=Depends(get_current_user)):
        if (user.get("role") or "").lower() not in ("admin", "responsabile", "gestore"):
            raise HTTPException(403, "Solo admin/gestore")
        cur = db.audit_logs.find({"entity": entity, "entity_id": entity_id}, {"_id": 0}).sort("ts", -1).limit(500)
        return [doc async for doc in cur]

    return r
