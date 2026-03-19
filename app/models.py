from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

UserType = Literal["wheelchair", "blind", "elderly"]


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
