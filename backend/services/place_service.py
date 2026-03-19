from sqlalchemy import text
from sqlalchemy.orm import Session

from models.schemas import Coordinates


def create_place(
    db: Session,
    name: str,
    place_type: str,
    location: Coordinates,
    accessibility_info: str,
) -> dict:
    row = db.execute(
        text(
            """
            INSERT INTO places (name, type, location, accessibility_info)
            VALUES (
                :name,
                :type,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :accessibility_info
            )
            RETURNING
                id,
                name,
                type,
                ST_Y(location::geometry) AS lat,
                ST_X(location::geometry) AS lng,
                accessibility_info,
                created_at
            """
        ),
        {
            "name": name,
            "type": place_type,
            "lat": location.lat,
            "lng": location.lng,
            "accessibility_info": accessibility_info,
        },
    ).mappings().first()
    db.commit()
    return _to_place_dict(row)


def get_places(db: Session, place_type: str | None = None) -> list[dict]:
    if place_type:
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    type,
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lng,
                    accessibility_info,
                    created_at
                FROM places
                WHERE type = :type
                ORDER BY created_at DESC
                """
            ),
            {"type": place_type},
        ).mappings().all()
    else:
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    type,
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lng,
                    accessibility_info,
                    created_at
                FROM places
                ORDER BY created_at DESC
                """
            )
        ).mappings().all()
    return [_to_place_dict(row) for row in rows]


def _to_place_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "location": {"lat": float(row["lat"]), "lng": float(row["lng"])},
        "accessibility_info": row["accessibility_info"],
        "created_at": row["created_at"],
    }

