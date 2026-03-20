from __future__ import annotations

import httpx
from uuid import UUID
from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import get_settings
from app.models import AlertRequest, AlertResponse

router = APIRouter()
settings = get_settings()


def _is_valid_uuid(raw: str | None) -> bool:
    if not raw:
        return False
    try:
        UUID(str(raw))
        return True
    except Exception:
        return False


@router.post("/alert", response_model=AlertResponse)
async def create_alert(
    payload: AlertRequest,
    authorization: str | None = Header(default=None),
) -> AlertResponse:
    # Compatibility endpoint for clients that send SOS alerts directly to ML API.
    # If BACKEND_API_URL is configured, forward to backend /alerts for persistence.
    if settings.backend_api_url and authorization:
        bridge_payload = {
            "type": payload.type,
            "message": "SOS signal from ML API bridge",
            "location": {"lat": payload.location[0], "lng": payload.location[1]},
        }
        if _is_valid_uuid(payload.user_id):
            bridge_payload["user_id"] = payload.user_id
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(
                    f"{settings.backend_api_url.rstrip('/')}/alerts",
                    json=bridge_payload,
                    headers={"Authorization": authorization},
                )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Backend alert bridge request failed: {exc}",
            ) from exc
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Backend alert bridge failed ({response.status_code}).",
            )

    return AlertResponse(
        status="ok",
        user_id=payload.user_id,
        alert_type=payload.type,
        location=payload.location,
    )
