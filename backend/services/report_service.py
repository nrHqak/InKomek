from sqlalchemy import text
from sqlalchemy.orm import Session

from models.schemas import Coordinates, ReportStatus


def create_report(
    db: Session,
    user_id: str,
    report_type: str,
    description: str,
    location: Coordinates,
) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO reports (user_id, type, description, location, status)
            VALUES (
                :user_id,
                :type,
                :description,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                'pending'
            )
            RETURNING
                id,
                user_id,
                type,
                description,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                status,
                created_at
            """
        ),
        {
            "user_id": user_id,
            "type": report_type,
            "description": description,
            "lat": location.lat,
            "lng": location.lng,
        },
    ).mappings().first()
    db.commit()
    return _to_report_dict(row)


def get_reports(db: Session) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT
                id,
                user_id,
                type,
                description,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                status,
                created_at
            FROM reports
            ORDER BY created_at DESC
            """
        )
    ).mappings().all()
    return [_to_report_dict(row) for row in rows]


def update_report_status(db: Session, report_id: str, status: ReportStatus) -> dict | None:
    row = db.execute(
        text(
            """
            UPDATE reports
            SET status = :status
            WHERE id = :report_id
            RETURNING
                id,
                user_id,
                type,
                description,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                status,
                created_at
            """
        ),
        {"report_id": report_id, "status": status.value},
    ).mappings().first()
    db.commit()
    return _to_report_dict(row) if row else None


def _to_report_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "type": row["type"],
        "description": row["description"],
        "location": {"lat": float(row["lat"]), "lng": float(row["lng"])},
        "status": row["status"],
        "created_at": row["created_at"],
    }

