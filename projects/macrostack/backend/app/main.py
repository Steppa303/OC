"""FastAPI Application Entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import settings
from app.routes import jobs, ws


def create_app() -> FastAPI:
    app = FastAPI(
        title="MacroStack API",
        version=__version__,
        description="Fokus-Stacking API für Makrofotografie (max 30 Bilder)",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(jobs.router, prefix="/api")
    app.include_router(ws.router)

    @app.get("/api/health", tags=["health"])
    async def health() -> dict:
        return {"ok": True, "version": __version__, "env": settings.app_env}

    return app


app = create_app()
