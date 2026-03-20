from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class GPSPoint(BaseModel):
    lat: float
    lon: float
    ts: int | None = None


class GPSCheckRequest(BaseModel):
    user_id: str | None = None
    points: list[GPSPoint] = Field(default_factory=list)


class GPSCheckResponse(BaseModel):
    is_anomaly: bool
    score: float
    anomaly_type: str | None = None


@router.post("/gps/check", response_model=GPSCheckResponse)
async def gps_check_compat(_: GPSCheckRequest) -> GPSCheckResponse:
    # Backward-compatible endpoint for PWA clients that expect /gps/check.
    # This backend does anomaly detection in /alerts flow, so we return safe defaults.
    return GPSCheckResponse(is_anomaly=False, score=0.0, anomaly_type=None)
