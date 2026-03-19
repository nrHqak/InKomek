from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI

from app.api.navigation import router as navigation_router
from app.core.config import get_settings
from app.services.navigation_service import NavigationService

logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.include_router(navigation_router)

_navigation_service: NavigationService | None = None


def get_navigation_service_instance() -> NavigationService | None:
    return _navigation_service


@app.on_event("startup")
def startup() -> None:
    global _navigation_service
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )

    graph_path = Path(settings.graph_file)
    model_dir = Path(settings.model_dir)
    if not graph_path.exists():
        logger.warning("Graph artifact not found at %s. Train navigation models first.", graph_path)
        return
    if not (model_dir / "gb_accessibility_wheelchair.joblib").exists():
        logger.warning("Model artifacts not found in %s. Train navigation models first.", model_dir)
        return

    _navigation_service = NavigationService(
        graph_path=graph_path,
        model_dir=model_dir,
        city_name=settings.city_name,
    )
    logger.info("Navigation service initialized successfully.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
