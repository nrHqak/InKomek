import logging
from math import sqrt

import httpx

from models.schemas import Coordinates, DisabilityType, RouteSegment
from services.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _linspace(start: float, end: float, num: int) -> list[float]:
    if num <= 1:
        return [start]
    step = (end - start) / (num - 1)
    return [start + i * step for i in range(num)]


def _disability_multiplier(disability_type: DisabilityType) -> float:
    if disability_type == DisabilityType.wheelchair:
        return 0.9
    if disability_type == DisabilityType.blind:
        return 0.85
    return 0.8


def build_route_local(
    from_point: Coordinates,
    to_point: Coordinates,
    disability_type: DisabilityType,
) -> tuple[list[Coordinates], list[RouteSegment]]:
    # Stub route generation for easy replacement with OSMnx + NetworkX path in ML service.
    lat_points = _linspace(from_point.lat, to_point.lat, 6)
    lng_points = _linspace(from_point.lng, to_point.lng, 6)
    path = [Coordinates(lat=lat_points[i], lng=lng_points[i]) for i in range(6)]

    segments: list[RouteSegment] = []
    multiplier = _disability_multiplier(disability_type)
    for idx in range(len(path) - 1):
        start = path[idx]
        end = path[idx + 1]
        distance = sqrt((end.lat - start.lat) ** 2 + (end.lng - start.lng) ** 2)
        base = max(0.25, 1.0 - min(distance * 10, 0.6))
        weight = round(min(1.0, max(0.0, base * multiplier)), 3)
        segments.append(RouteSegment(start=start, end=end, accessibility_weight=weight))
    return path, segments


def _build_segments(path: list[Coordinates], disability_type: DisabilityType) -> list[RouteSegment]:
    segments: list[RouteSegment] = []
    multiplier = _disability_multiplier(disability_type)
    for idx in range(len(path) - 1):
        start = path[idx]
        end = path[idx + 1]
        distance = sqrt((end.lat - start.lat) ** 2 + (end.lng - start.lng) ** 2)
        base = max(0.25, 1.0 - min(distance * 10, 0.6))
        weight = round(min(1.0, max(0.0, base * multiplier)), 3)
        segments.append(RouteSegment(start=start, end=end, accessibility_weight=weight))
    return segments


async def build_route(
    from_point: Coordinates,
    to_point: Coordinates,
    disability_type: DisabilityType,
) -> tuple[list[Coordinates], list[RouteSegment]]:
    payload = {
        "user_type": disability_type.value,
        "start_coords": [from_point.lat, from_point.lng],
        "end_coords": [to_point.lat, to_point.lng],
    }
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.post(f"{settings.ml_service_url}/navigate", json=payload)
        response.raise_for_status()
        data = response.json()
        route_coords = data.get("route_coords") or []
        path = [Coordinates(lat=float(item[0]), lng=float(item[1])) for item in route_coords if len(item) == 2]
        if len(path) < 2:
            raise ValueError("ML service returned too short route")
        return path, _build_segments(path, disability_type)
    except Exception as exc:
        logger.warning("ML route service unavailable, using local fallback: %s", exc)
        return build_route_local(from_point, to_point, disability_type)

