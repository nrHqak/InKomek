from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class DisabilityType(str, Enum):
    wheelchair = "wheelchair"
    blind = "blind"
    elderly = "elderly"


class ReportStatus(str, Enum):
    pending = "pending"
    reviewed = "reviewed"


class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    type_of_disability: DisabilityType


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    type_of_disability: DisabilityType
    created_at: datetime


class ReportCreateRequest(BaseModel):
    type: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=2000)
    location: Coordinates


class ReportUpdateStatusRequest(BaseModel):
    status: ReportStatus


class ReportOut(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    description: str
    location: Coordinates
    status: ReportStatus
    created_at: datetime


class PlaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)
    type: str = Field(..., min_length=1, max_length=120)
    location: Coordinates
    accessibility_info: str = Field(..., min_length=1, max_length=2000)


class PlaceOut(BaseModel):
    id: UUID
    name: str
    type: str
    location: Coordinates
    accessibility_info: str
    created_at: datetime


class RouteSegment(BaseModel):
    start: Coordinates
    end: Coordinates
    accessibility_weight: float = Field(..., ge=0, le=1)


class RouteOut(BaseModel):
    type: DisabilityType
    path: list[Coordinates]
    segments: list[RouteSegment]


class AlertCreateRequest(BaseModel):
    type: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=2000)
    location: Coordinates
    user_id: UUID | None = None
    vibration_values: list[float] | None = None
    speed_values: list[float] | None = None


class AlertOut(BaseModel):
    id: UUID
    type: str
    message: str
    location: Coordinates
    user_id: UUID | None
    created_at: datetime


class PhotoReportOut(BaseModel):
    id: UUID
    user_id: UUID
    location: Coordinates
    result: str
    created_at: datetime


class RouteQuery(BaseModel):
    from_: str = Field(..., alias="from")
    to: str
    type: DisabilityType

    @staticmethod
    def _parse_pair(value: str) -> tuple[float, float]:
        parts = [x.strip() for x in value.split(",")]
        if len(parts) != 2:
            raise ValueError("Value must be 'lat,lng'")
        return float(parts[0]), float(parts[1])

    @field_validator("from_")
    @classmethod
    def validate_from(cls, value: str) -> str:
        cls._parse_pair(value)
        return value

    @field_validator("to")
    @classmethod
    def validate_to(cls, value: str) -> str:
        cls._parse_pair(value)
        return value

