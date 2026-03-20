from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.config import get_settings
from app.services.document_verification_service import DocumentVerificationService

router = APIRouter()
settings = get_settings()

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/api/verify-document")
async def verify_document(image: UploadFile = File(...)) -> dict:
    mime_type = (image.content_type or "").lower()
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported media type: {mime_type}. Use JPEG, PNG, or WEBP.",
        )

    image_bytes = await image.read()
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image too large. Max size is 8MB.",
        )
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image is empty.",
        )

    if not settings.gemini_api_key:
        return {
            "is_valid_document": False,
            "confidence": 0.5,
            "reason": "Verification service in demo mode. Set GEMINI_API_KEY for real document validation.",
            "model": "demo-fallback",
        }

    try:
        service = DocumentVerificationService(api_key=settings.gemini_api_key, model=settings.gemini_model)
        return service.verify(image_bytes=image_bytes, mime_type=mime_type)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to verify document: {exc}",
        ) from exc

