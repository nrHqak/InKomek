import logging

from fastapi import FastAPI

from routes.alerts import router as alerts_router
from routes.auth import router as auth_router
from routes.photos import router as photos_router
from routes.places import router as places_router
from routes.reports import router as reports_router
from routes.route_navigation import router as route_router
from services.db import init_db

logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="Inclusive City Backend",
    version="1.0.0",
    description="Backend for Inclusive City (FastAPI + Supabase/Postgres).",
)


@app.on_event("startup")
def on_startup() -> None:
    try:
        init_db()
    except Exception as exc:
        logger.error("Database init failed on startup: %s", exc)
        logger.error("App started without DB init. Check DATABASE_URL / DNS / Supabase network settings.")


app.include_router(auth_router, tags=["auth"])
app.include_router(reports_router, tags=["reports"])
app.include_router(places_router, tags=["places"])
app.include_router(route_router, tags=["route"])
app.include_router(alerts_router, tags=["alerts"])
app.include_router(photos_router, tags=["photos"])
