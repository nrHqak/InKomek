from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models.schemas import ReportCreateRequest, ReportOut, ReportUpdateStatusRequest
from services.dependencies import get_current_user, get_db
from services.report_service import create_report, get_reports, update_report_status

router = APIRouter()


@router.post("/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def create_report_endpoint(
    payload: ReportCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    # Создание репорта о городской проблеме.
    # Вход: {type, description, location:{lat,lng}} + Bearer JWT.
    # Выход: полный объект репорта.
    # Пример запроса:
    # {"type":"broken_ramp","description":"Пандус сломан","location":{"lat":41.31,"lng":69.24}}
    data = create_report(
        db=db,
        user_id=str(current_user["id"]),
        report_type=payload.type,
        description=payload.description,
        location=payload.location,
    )
    return ReportOut(**data)


@router.get("/reports", response_model=list[ReportOut])
async def get_reports_endpoint(
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReportOut]:
    # Получение всех репортов.
    # Вход: Bearer JWT.
    # Выход: массив репортов со всеми полями.
    return [ReportOut(**item) for item in get_reports(db)]


@router.patch("/reports/{report_id}", response_model=ReportOut)
async def update_report_status_endpoint(
    report_id: str,
    payload: ReportUpdateStatusRequest,
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    # Обновление статуса репорта.
    # Вход: report_id + {status:"pending|reviewed"} + Bearer JWT.
    # Выход: обновленный объект репорта.
    data = update_report_status(db, report_id, payload.status)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return ReportOut(**data)

