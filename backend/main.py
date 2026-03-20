import logging

from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {
        "app": "Inclusive City Backend",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=204)
