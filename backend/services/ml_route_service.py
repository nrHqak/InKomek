from math import sqrt

from models.schemas import Coordinates, DisabilityType, RouteSegment


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


def build_route(
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

