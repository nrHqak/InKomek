from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.classification import router as classification_router
from app.api.gps import router as gps_router
from app.api.navigation import router as navigation_router
from app.core.config import get_settings
from app.services.classification_service import AccessibilityClassificationService
from app.services.gps_service import GPSAnomalyService
from app.services.navigation_service import NavigationService

logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(navigation_router)
app.include_router(gps_router)
app.include_router(classification_router)

_navigation_service: NavigationService | None = None
_gps_service: GPSAnomalyService | None = None
_classification_service: AccessibilityClassificationService | None = None


def get_navigation_service_instance() -> NavigationService | None:
    return _navigation_service


def get_gps_service_instance() -> GPSAnomalyService | None:
    return _gps_service


def get_classification_service_instance() -> AccessibilityClassificationService | None:
    return _classification_service


@app.on_event("startup")
def startup() -> None:
    global _navigation_service, _gps_service, _classification_service
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )

    graph_path = Path(settings.graph_file)
    model_dir = Path(settings.model_dir)
    if not graph_path.exists():
        logger.warning("Graph artifact not found at %s. Train navigation models first.", graph_path)
    elif not (model_dir / "gb_accessibility_wheelchair.joblib").exists():
        logger.warning("Model artifacts not found in %s. Train navigation models first.", model_dir)
    else:
        _navigation_service = NavigationService(
            graph_path=graph_path,
            model_dir=model_dir,
            city_name=settings.city_name,
        )
        logger.info("Navigation service initialized successfully.")

    gps_model_file = Path(settings.gps_model_file)
    gps_metadata_file = Path(settings.gps_metadata_file)
    if gps_model_file.exists() and gps_metadata_file.exists():
        _gps_service = GPSAnomalyService(model_path=gps_model_file, metadata_path=gps_metadata_file)
        logger.info("GPS anomaly service initialized successfully.")
    else:
        logger.warning(
            "GPS artifacts missing. Expected model=%s metadata=%s.",
            gps_model_file,
            gps_metadata_file,
        )

    if settings.gemini_api_key:
        _classification_service = AccessibilityClassificationService(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
        )
        logger.info("Classification service initialized successfully with model=%s.", settings.gemini_model)
    else:
        logger.warning("GEMINI_API_KEY is not set. /classify endpoint will return 503.")


@app.get("/")
def root(request: Request) -> dict[str, str]:
    base_url = str(request.base_url).rstrip("/")
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "base_url": base_url,
        "docs": f"{base_url}/docs",
        "health": f"{base_url}/health",
    }


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    from fastapi.responses import Response
    return Response(status_code=204)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
