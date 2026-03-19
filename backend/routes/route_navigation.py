from fastapi import APIRouter, Depends, HTTPException, Query, status

from models.schemas import Coordinates, DisabilityType, RouteOut
from services.dependencies import get_current_user
from services.ml_route_service import build_route

router = APIRouter()


def _parse_lat_lng(raw_value: str) -> Coordinates:
    parts = [item.strip() for item in raw_value.split(",")]
    if len(parts) != 2:
        raise ValueError("Coordinates must be in format lat,lng")
    lat = float(parts[0])
    lng = float(parts[1])
    return Coordinates(lat=lat, lng=lng)


@router.get("/route", response_model=RouteOut)
async def get_route_endpoint(
    from_: str = Query(..., alias="from"),
    to: str = Query(...),
    type: DisabilityType = Query(...),
    _: dict = Depends(get_current_user),
) -> RouteOut:
    # Построение персонализированного маршрута (готовая точка интеграции с OSMnx/NetworkX/GBM).
    # Вход: /route?from=41.31,69.24&to=41.29,69.21&type=wheelchair + Bearer JWT.
    # Выход: path координат и accessibility_weight для каждого участка.
    try:
        from_point = _parse_lat_lng(from_)
        to_point = _parse_lat_lng(to)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    path, segments = build_route(from_point, to_point, type)
    return RouteOut(type=type, path=path, segments=segments)

