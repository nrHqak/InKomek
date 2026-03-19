from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from models.schemas import Coordinates
from services.config import get_settings

settings = get_settings()


def save_upload_file(file: UploadFile) -> str:
    upload_path = Path(settings.upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    extension = Path(file.filename or "photo.jpg").suffix or ".jpg"
    final_path = upload_path / f"{uuid4()}{extension}"
    with final_path.open("wb") as f:
        f.write(file.file.read())
    return str(final_path)


def create_photo_report(
    db: Session,
    user_id: str,
    location: Coordinates,
    result: str,
    image_path: str,
) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO photo_reports (user_id, location, result, image_path)
            VALUES (
                :user_id,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :result,
                :image_path
            )
            RETURNING
                id,
                user_id,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                result,
                created_at
            """
        ),
        {
            "user_id": user_id,
            "lat": location.lat,
            "lng": location.lng,
            "result": result,
            "image_path": image_path,
        },
    ).mappings().first()
    db.commit()
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "location": {"lat": float(row["lat"]), "lng": float(row["lng"])},
        "result": row["result"],
        "created_at": row["created_at"],
    }

