"""WebSocket Routes — /ws/jobs/{id}."""

from fastapi import APIRouter

router = APIRouter(tags=["websocket"])


@router.get("/ws/health")
async def ws_health() -> dict:
    return {"ws": "ok"}