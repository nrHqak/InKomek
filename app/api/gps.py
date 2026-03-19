from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.ml.anomaly.feature_engineering import GPSPoint
from app.models import GPSCheckRequest, GPSCheckResponse
from app.services.gps_service import GPSAnomalyService

router = APIRouter()


def get_gps_service() -> GPSAnomalyService:
    from app.main import get_gps_service_instance

    service = get_gps_service_instance()
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GPS anomaly service not initialized. Train model and restart API.",
        )
    return service


@router.post("/gps/check", response_model=GPSCheckResponse)
def gps_check(
    payload: GPSCheckRequest,
    service: GPSAnomalyService = Depends(get_gps_service),
) -> GPSCheckResponse:
    try:
        points = [GPSPoint(lat=p.lat, lon=p.lon, ts=p.ts) for p in payload.points]
        result = service.check(points=points, expected_route=payload.expected_route)
        return GPSCheckResponse(user_id=payload.user_id, **result)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to evaluate GPS anomaly: {exc}",
        ) from exc
