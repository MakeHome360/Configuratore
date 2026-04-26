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

    DEFAULT_PROMPTS = {
        "isometric_dollhouse": (
            "Convert this 2D architectural floorplan into a photorealistic isometric 3D dollhouse render, "
            "as if cut at ceiling level showing all rooms from above-angle 30°. "
            "Apply: warm wood floors (parquet) in living areas, ceramic tiles in kitchen and bath, "
            "modern Italian-design furniture (sofa, dining table, beds with linens, kitchen cabinets, bathroom fixtures), "
            "soft warm interior lighting from floor lamps and ceiling fixtures, "
            "wood deck terrace, white interior walls with subtle shadows, beige exterior walls, "
            "studio-quality lighting on white background, sharp focus, architectural visualization style, "
            "no people, no text labels."
        ),
        "interior_room": (
            "Convert this 2D floorplan room into a photorealistic interior 3D rendering at human eye level. "
            "Modern Italian interior design, warm lighting, wood floor, white walls, designer furniture, "
            "natural light from windows, photorealistic, 4k quality."
        ),
        "exterior": (
            "Convert this 2D floorplan into a photorealistic exterior 3D rendering of the building. "
            "Modern architecture, beige stucco walls, large windows, wood deck terrace, garden with grass, "
            "afternoon sunlight, blue sky, photorealistic architectural visualization."
        ),
    }

    @r.post("/render/3d")
    async def render_3d(body: RenderIn, user=Depends(get_current_user)):
        """Genera un rendering 3D fotorealistico dalla pianta 2D usando Gemini Nano Banana."""
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(500, "EMERGENT_LLM_KEY non configurato sul server")

        prompt = body.prompt or DEFAULT_PROMPTS.get(body.style, DEFAULT_PROMPTS["isometric_dollhouse"])
        # Pulisci eventuale prefisso data URI dall'input
        img_b64 = body.image_base64
        if img_b64.startswith("data:"):
            img_b64 = img_b64.split(",", 1)[-1]

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            session_id = f"render-{uuid.uuid4().hex[:10]}"
            chat = LlmChat(api_key=api_key, session_id=session_id, system_message="You are an expert architectural visualizer. Generate ONE photorealistic 3D rendering image based on the user's 2D floorplan reference.")
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
