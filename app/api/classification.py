from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.models import AccessibilityClassificationResponse
from app.services.classification_service import AccessibilityClassificationService

router = APIRouter()

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
        return AccessibilityClassificationResponse.model_validate(result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to classify image: {exc}",
        ) from exc
