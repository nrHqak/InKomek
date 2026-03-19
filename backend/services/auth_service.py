import base64
import hashlib
import os
import uuid
from typing import Any

import httpx
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from sqlalchemy.orm import Session

from models.schemas import DisabilityType
from services.config import get_settings

settings = get_settings()


class AuthError(Exception):
    pass


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2_sha256${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def _extract_supabase_error(response: httpx.Response) -> tuple[str | None, str]:
    try:
        payload = response.json()
    except ValueError:
        return None, response.text
    code = payload.get("error_code")
    message = payload.get("msg") or payload.get("message") or response.text
    return code, message


def _upsert_profile(
    db: Session,
    user_id: str,
    name: str,
    email: str,
    password: str,
    type_of_disability: DisabilityType,
) -> None:
    password_hash = _hash_password(password)
    db.execute(
        text(
            """
            INSERT INTO users (id, name, email, password_hash, type_of_disability)
            VALUES (:id, :name, :email, :password_hash, :type_of_disability)
            ON CONFLICT (email) DO UPDATE SET
                id = EXCLUDED.id,
                name = EXCLUDED.name,
                password_hash = EXCLUDED.password_hash,
                type_of_disability = EXCLUDED.type_of_disability
            """
        ),
        {
            "id": str(user_id),
            "name": name,
            "email": email,
            "password_hash": password_hash,
            "type_of_disability": type_of_disability.value,
        },
    )
    db.commit()


def _supabase_headers(use_service_role: bool = False) -> dict[str, str]:
    key = settings.supabase_service_role_key if use_service_role else settings.supabase_anon_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


async def register_user(
    db: Session,
    name: str,
    email: str,
    password: str,
    type_of_disability: DisabilityType,
) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.supabase_url}/auth/v1/signup",
            headers=_supabase_headers(use_service_role=False),
            json={
                "email": email,
                "password": password,
                "data": {"name": name, "type_of_disability": type_of_disability.value},
            },
        )
    if response.status_code >= 400:
        error_code, error_message = _extract_supabase_error(response)
        if error_code == "user_already_exists":
            access_token = await login_user(email, password)
            supabase_user = await get_supabase_user(access_token)
            try:
                _upsert_profile(
                    db=db,
                    user_id=supabase_user["id"],
                    name=name,
                    email=supabase_user.get("email") or email,
                    password=password,
                    type_of_disability=type_of_disability,
                )
            except SQLAlchemyError as exc:
                db.rollback()
                raise AuthError(
                    f"Failed to store user profile: {exc.__class__.__name__}"
                ) from exc
            return access_token
        raise AuthError(error_message)

    payload = response.json()
    access_token = payload.get("access_token")
    user_payload = payload.get("user") or {}
    user_id = user_payload.get("id")
    if not access_token or not user_id:
        raise AuthError(
            "Supabase did not return access_token. Disable email confirmation in Supabase Auth settings."
        )

    try:
        _upsert_profile(
            db=db,
            user_id=str(user_id),
            name=name,
            email=email,
            password=password,
            type_of_disability=type_of_disability,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise AuthError(f"Failed to store user profile: {exc.__class__.__name__}") from exc
    return access_token


async def login_user(email: str, password: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=password",
            headers=_supabase_headers(use_service_role=False),
            json={"email": email, "password": password},
        )
    if response.status_code >= 400:
        raise AuthError("Invalid email or password")
    payload = response.json()
    access_token = payload.get("access_token")
    if not access_token:
        raise AuthError("Access token is missing in Supabase response")
    return access_token


async def sync_profile_from_token(
    db: Session,
    access_token: str,
    fallback_email: str,
) -> None:
    supabase_user = await get_supabase_user(access_token)
    user_id = supabase_user.get("id")
    if not user_id:
        raise AuthError("Token does not contain user id")

    if get_profile(db, user_id):
        return

    metadata = supabase_user.get("user_metadata") or {}
    name = metadata.get("name") or fallback_email.split("@")[0]
    disability_raw = metadata.get("type_of_disability")
    try:
        disability = DisabilityType(disability_raw)
    except Exception:
        disability = DisabilityType.wheelchair

    try:
        _upsert_profile(
            db=db,
            user_id=str(user_id),
            name=str(name),
            email=supabase_user.get("email") or fallback_email,
            password="placeholder_not_used",
            type_of_disability=disability,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise AuthError(f"Failed to sync user profile: {exc.__class__.__name__}") from exc


async def get_supabase_user(token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
            },
        )
    if response.status_code >= 400:
        raise AuthError("Invalid or expired token")
    payload = response.json()
    if not payload.get("id"):
        raise AuthError("Token does not contain user id")
    return payload


def get_profile(db: Session, user_id: str | uuid.UUID) -> dict[str, Any] | None:
    row = db.execute(
        text(
            """
            SELECT id, name, email, type_of_disability, created_at
            FROM users
            WHERE id = :user_id
            """
        ),
        {"user_id": str(user_id)},
    ).mappings().first()
    return dict(row) if row else None
