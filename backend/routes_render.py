"""
Round 12: AI Rendering 3D fotorealistico (Archsynth-style) usando Gemini Nano Banana
via Emergent LLM Key.
Riceve la pianta 2D come PNG base64 e restituisce un rendering isometrico dollhouse fotorealistico.
"""
import os
import base64
import uuid
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import Optional

load_dotenv()


def build_render_router(db, get_current_user):
    r = APIRouter()

    class RenderIn(BaseModel):
        model_config = ConfigDict(extra="allow")
        image_base64: str  # PNG base64 della pianta 2D (senza prefix "data:image/png;base64,")
        prompt: Optional[str] = None
        style: Optional[str] = "isometric_dollhouse"  # isometric_dollhouse | interior_room | exterior
        project_id: Optional[str] = None
        project_summary: Optional[dict] = None  # {rooms: [{name, area_m2, floor, walls_color}], total_m2, ...}

    def _build_floorplan_prompt(style: str, summary: dict, custom: Optional[str]) -> str:
        rooms_desc = ""
        if summary and isinstance(summary.get("rooms"), list):
            lines = []
            for r in summary["rooms"][:30]:  # limita a 30 stanze max per non saturare il prompt
                nm = r.get("name") or "Room"
                area = r.get("area_m2")
                floor = r.get("floor") or "default floor"
                walls = r.get("walls_color") or ""
                bits = [f'"{nm}"']
                if area: bits.append(f"~{area:.1f} m²")
                bits.append(f"floor: {floor}")
                if walls: bits.append(f"walls: {walls}")
                lines.append("- " + " · ".join(bits))
            if lines:
                rooms_desc = "\n\nFLOORPLAN STRUCTURE (use these EXACT rooms with EXACT proportions):\n" + "\n".join(lines)
        total = (summary or {}).get("total_m2")
        total_line = f"\nTotal floor area: {total:.1f} m².\n" if total else ""

        base_strict = (
            "STRICT INSTRUCTIONS — your output MUST faithfully reproduce the 2D floorplan provided as reference image:\n"
            "1. PRESERVE the exact wall positions, room shapes, room counts and proportions of the 2D plan.\n"
            "2. PRESERVE the exact position of doors and windows on each wall.\n"
            "3. DO NOT add or remove rooms. DO NOT add or remove walls. DO NOT change wall orientations.\n"
            "4. Use the 2D image as the architectural ground-truth — it is NOT inspiration, it is a TECHNICAL DRAWING to follow precisely.\n"
        )

        style_block = {
            "isometric_dollhouse": (
                "Produce a PHOTOREALISTIC isometric 3D dollhouse render of the SAME floorplan from above-angle ~30°, "
                "as if the ceiling were cut to reveal all rooms. White background, studio lighting. "
                "Apply realistic finishes consistent with the room types: kitchen → ceramic tiles, bathroom → tiles + sanitary fixtures, "
                "bedrooms → wood/parquet + bed, living → parquet + sofa + TV. Furniture must be Italian modern design, properly scaled. "
                "No text labels, no people, no captions. Sharp focus, architectural visualization, 4K quality."
            ),
            "interior_room": (
                "Produce a PHOTOREALISTIC interior 3D rendering at human eye level of the LARGEST room in the floorplan, "
                "keeping its real wall positions, windows and door openings as shown in the 2D plan. "
                "Modern Italian interior design, warm natural lighting, photorealistic 4K quality. No text labels."
            ),
            "exterior": (
                "Produce a PHOTOREALISTIC 3D exterior rendering of the building described by the floorplan footprint. "
                "Preserve the perimeter shape exactly. Modern architecture, beige walls, large windows, wood deck. "
                "Afternoon sunlight, photorealistic. No text labels, no people."
            ),
        }.get(style, "")

        custom_line = f"\nUSER EXTRA INSTRUCTIONS: {custom}\n" if custom else ""
        return base_strict + total_line + rooms_desc + "\n\n" + style_block + custom_line

    @r.post("/render/3d")
    async def render_3d(body: RenderIn, user=Depends(get_current_user)):
        """Genera un rendering 3D fotorealistico dalla pianta 2D usando Gemini Nano Banana."""
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(500, "EMERGENT_LLM_KEY non configurato sul server")

        prompt = _build_floorplan_prompt(body.style or "isometric_dollhouse", body.project_summary or {}, body.prompt)
        # Pulisci eventuale prefisso data URI dall'input
        img_b64 = body.image_base64
        if img_b64.startswith("data:"):
            img_b64 = img_b64.split(",", 1)[-1]

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            session_id = f"render-{uuid.uuid4().hex[:10]}"
            chat = LlmChat(api_key=api_key, session_id=session_id, system_message="You are an expert architectural visualizer. Your sole task is to produce ONE photorealistic 3D rendering that FAITHFULLY reproduces the provided 2D floorplan reference. Treat the 2D image as a TECHNICAL DRAWING that must be respected in every wall position, room shape and opening location. Do not invent rooms or walls that are not in the plan.")
            chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
            msg = UserMessage(text=prompt, file_contents=[ImageContent(img_b64)])
            text, images = await chat.send_message_multimodal_response(msg)
        except Exception as e:
            raise HTTPException(502, f"Errore servizio AI rendering: {str(e)[:200]}")

        if not images:
            raise HTTPException(502, "AI non ha generato immagini. Riprova con un prompt diverso o una pianta più dettagliata.")

        out = images[0]
        # Salva log in DB (opzionale, per audit)
        try:
            await db.renders.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user.get("id"),
                "project_id": body.project_id,
                "style": body.style,
                "prompt_used": prompt[:500],
                "size_bytes": len(out.get("data") or ""),
                "mime_type": out.get("mime_type") or "image/png",
                "created_at": __import__("datetime").datetime.utcnow().isoformat(),
            })
        except Exception:
            pass

        return {
            "ok": True,
            "image_base64": out["data"],
            "mime_type": out.get("mime_type") or "image/png",
            "text": (text or "")[:500] if text else None,
            "style": body.style,
        }

    return r
