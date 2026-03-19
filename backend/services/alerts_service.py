from sqlalchemy import text
from sqlalchemy.orm import Session

from models.schemas import Coordinates


def create_alert(
    db: Session,
    alert_type: str,
    message: str,
    location: Coordinates,
    user_id: str | None,
) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO alerts (type, message, location, user_id)
            VALUES (
                :type,
                :message,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :user_id
            )
            RETURNING
                id,
                type,
                message,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                user_id,
                created_at
            """
        ),
        {
            "type": alert_type,
            "message": message,
            "lat": location.lat,
            "lng": location.lng,
            "user_id": user_id,
        },
    ).mappings().first()
    db.commit()
    return _to_alert_dict(row)


def get_alerts(db: Session, user_id: str | None = None) -> list[dict]:
    if user_id:
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    type,
                    message,
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lng,
                    user_id,
                    created_at
                FROM alerts
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                """
            ),
            {"user_id": user_id},
        ).mappings().all()
    else:
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    type,
                    message,
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lng,
                    user_id,
                    created_at
                FROM alerts
                ORDER BY created_at DESC
                """
            )
        ).mappings().all()
    return [_to_alert_dict(row) for row in rows]


def _to_alert_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "type": row["type"],
        "message": row["message"],
        "location": {"lat": float(row["lat"]), "lng": float(row["lng"])},
        "user_id": row["user_id"],
        "created_at": row["created_at"],
    }

