from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

UserType = Literal["wheelchair", "blind", "elderly"]
AnomalyType = Literal["none", "stuck", "circling", "off_route", "unknown"]
AccessibilityCategory = Literal[
    "no_ramp",
    "broken_elevator",
    "high_curb",
    "dangerous_zone",
    "other",
    "no_problem",
]


class NavigationRequest(BaseModel):
    user_type: UserType
    start_coords: tuple[float, float] = Field(description="(latitude, longitude)")
    end_coords: tuple[float, float] = Field(description="(latitude, longitude)")

    @field_validator("start_coords", "end_coords")
    @classmethod
    def validate_coords(cls, value: tuple[float, float]) -> tuple[float, float]:
        lat, lon = value
        if not (-90.0 <= lat <= 90.0):
            raise ValueError("Latitude must be between -90 and 90.")
        if not (-180.0 <= lon <= 180.0):
            raise ValueError("Longitude must be between -180 and 180.")
        return value


class RouteSummary(BaseModel):
    total_length_m: float
    total_accessibility_cost: float
    node_count: int
    edge_count: int


class NavigationResponse(BaseModel):
    user_type: UserType
    city: str
    route_coords: list[tuple[float, float]]
    node_ids: list[str]
    summary: RouteSummary


class GPSPointPayload(BaseModel):
    lat: float
    lon: float
    ts: float

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, value: float) -> float:
        if not (-90.0 <= value <= 90.0):
            raise ValueError("Latitude must be between -90 and 90.")
        return value

    @field_validator("lon")
    @classmethod
    def validate_lon(cls, value: float) -> float:
        if not (-180.0 <= value <= 180.0):
            raise ValueError("Longitude must be between -180 and 180.")
        return value


class GPSCheckRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    points: list[GPSPointPayload] = Field(min_length=6, max_length=120)
    expected_route: list[tuple[float, float]] | None = None

    @field_validator("points")
    @classmethod
    def validate_points_time_order(cls, points: list[GPSPointPayload]) -> list[GPSPointPayload]:
        timestamps = [p.ts for p in points]
        if any(timestamps[i] >= timestamps[i + 1] for i in range(len(timestamps) - 1)):
            raise ValueError("Point timestamps must be strictly increasing.")
        return points


class GPSCheckResponse(BaseModel):
    user_id: str
    is_anomaly: bool
    anomaly_type: AnomalyType
    score: float
    location: tuple[float, float]
    features: dict[str, float]


class AccessibilityClassificationResponse(BaseModel):
    category: AccessibilityCategory
    confidence: float = Field(ge=0.0, le=1.0)
    description: str = Field(min_length=1, max_length=300)
    model: str
