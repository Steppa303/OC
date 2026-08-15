"""Job Routes — POST/GET/DELETE /api/jobs."""

from fastapi import APIRouter

router = APIRouter(tags=["jobs"])


@router.get("/jobs/health")
async def jobs_health() -> dict:
    return {"jobs": "ok"}