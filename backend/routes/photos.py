from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from models.schemas import Coordinates, PhotoReportOut
from services.dependencies import get_current_user, get_db
from services.ml_photo_service import classify_accessibility_photo
from services.photo_service import create_photo_report, save_upload_file

router = APIRouter()


@router.post("/photos", response_model=PhotoReportOut, status_code=status.HTTP_201_CREATED)
async def upload_photo_endpoint(
    file: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PhotoReportOut:
    # Фото-классификация доступности (интеграция с Gemini Vision).
    # Вход: multipart/form-data: file + lat + lng + Bearer JWT.
    # Выход: сохраненный photo_report с результатом классификации.
    # Пример ответа:
    # {"id":"...","user_id":"...","location":{"lat":41.31,"lng":69.24},"result":"ramp_present","created_at":"..."}
    location = Coordinates(lat=lat, lng=lng)
    image_path = save_upload_file(file)
    result = await classify_accessibility_photo(image_path)

    report = create_photo_report(
        db=db,
        user_id=str(current_user["id"]),
        location=location,
        result=result,
        image_path=image_path,
    )
    return PhotoReportOut(**report)

