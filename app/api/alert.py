from __future__ import annotations

from fastapi import APIRouter

from app.models import AlertRequest, AlertResponse

router = APIRouter()


@router.post("/alert", response_model=AlertResponse)
def create_alert(payload: AlertRequest) -> AlertResponse:
    # Compatibility endpoint for clients that send SOS alerts directly to ML API.
    return AlertResponse(
        status="ok",
        user_id=payload.user_id,
        alert_type=payload.type,
        location=payload.location,
    )

