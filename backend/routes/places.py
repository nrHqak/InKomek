from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from models.schemas import PlaceCreateRequest, PlaceOut
from services.dependencies import get_current_user, get_db
from services.place_service import create_place, get_places

router = APIRouter()


@router.post("/places", response_model=PlaceOut, status_code=status.HTTP_201_CREATED)
async def create_place_endpoint(
    payload: PlaceCreateRequest,
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlaceOut:
    # Добавление inclusive-friendly места.
    # Вход: {name, type, location:{lat,lng}, accessibility_info} + Bearer JWT.
    # Выход: сохраненный объект места.
    data = create_place(
        db=db,
        name=payload.name,
        place_type=payload.type,
        location=payload.location,
        accessibility_info=payload.accessibility_info,
    )
    return PlaceOut(**data)


@router.get("/places", response_model=list[PlaceOut])
async def get_places_endpoint(
    type: str | None = Query(default=None),
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PlaceOut]:
    # Получение списка мест (с фильтром по type при необходимости).
    # Вход: optional query ?type=cafe + Bearer JWT.
    # Выход: массив мест с координатами и accessibility_info.
    return [PlaceOut(**item) for item in get_places(db, type)]

