from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status

from app.core.config import get_settings
from app.models import AccessibilityClassificationResponse
from app.services.classification_service import AccessibilityClassificationService

router = APIRouter()
settings = get_settings()

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def get_classification_service() -> AccessibilityClassificationService:
    from app.main import get_classification_service_instance

    service = get_classification_service_instance()
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Classification service not initialized. Set GEMINI_API_KEY and restart API.",
        )
    return service


@router.post("/classify", response_model=AccessibilityClassificationResponse)
async def classify_image(
    image: UploadFile = File(...),
    lat: float | None = Form(default=None),
    lng: float | None = Form(default=None),
    authorization: str | None = Header(default=None),
    service: AccessibilityClassificationService = Depends(get_classification_service),
) -> AccessibilityClassificationResponse:
    mime_type = (image.content_type or "").lower()
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported media type: {mime_type}. Use JPEG, PNG, or WEBP.",
        )

    image_bytes = await image.read()
    max_size_bytes = 8 * 1024 * 1024
    if len(image_bytes) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image too large. Max size is 8MB.",
        )

    try:
        result = service.classify(image_bytes=image_bytes, mime_type=mime_type)
        # Optional persistence bridge to backend /photos.
        if settings.backend_api_url and authorization and lat is not None and lng is not None:
            files = {
                "file": (
                    image.filename or "image.jpg",
                    image_bytes,
                    mime_type,
                )
            }
            data = {"lat": str(lat), "lng": str(lng)}
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    bridge_resp = await client.post(
                        f"{settings.backend_api_url.rstrip('/')}/photos",
                        headers={"Authorization": authorization},
                        data=data,
                        files=files,
                    )
                if bridge_resp.status_code >= 400:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Backend photo bridge failed ({bridge_resp.status_code}).",
                    )
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Backend photo bridge request failed: {exc}",
                ) from exc

        return AccessibilityClassificationResponse.model_validate(result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to classify image: {exc}",
        ) from exc
