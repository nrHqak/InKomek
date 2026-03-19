from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from models.schemas import AlertCreateRequest, AlertOut
from services.alerts_service import create_alert, get_alerts
from services.dependencies import get_current_user, get_db
from services.ml_anomaly_service import detect_anomaly

router = APIRouter()


@router.post("/alerts", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
async def create_alert_endpoint(
    payload: AlertCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertOut:
    # Создание alert + quick anomaly detection.
    # Вход: {type, message, location, user_id?, vibration_values?, speed_values?} + Bearer JWT.
    # Выход: сохраненный alert.
    # Если detect_anomaly=True, тип/сообщение переопределяются как anomaly.
    is_anomaly = detect_anomaly(payload.vibration_values, payload.speed_values)
    alert_type = "anomaly_detected" if is_anomaly else payload.type
    message = "Possible stuck/anomaly detected by ML service" if is_anomaly else payload.message

    target_user_id = str(payload.user_id) if payload.user_id else str(current_user["id"])
    data = create_alert(
        db=db,
        alert_type=alert_type,
        message=message,
        location=payload.location,
        user_id=target_user_id,
    )
    return AlertOut(**data)


@router.get("/alerts", response_model=list[AlertOut])
async def get_alerts_endpoint(
    user_id: str | None = Query(default=None),
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AlertOut]:
    # Получение alerts (всех или по user_id).
    # Вход: optional query ?user_id=<uuid> + Bearer JWT.
    # Выход: массив актуальных предупреждений.
    return [AlertOut(**item) for item in get_alerts(db, user_id)]

