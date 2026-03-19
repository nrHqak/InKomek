from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from services.auth_service import AuthError, get_profile, get_supabase_user, sync_profile_from_token
from services.db import get_db_session

security = HTTPBearer(auto_error=True)


def get_db() -> Generator[Session, None, None]:
    with get_db_session() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    token = credentials.credentials
    try:
        supabase_user = await get_supabase_user(token)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    profile = get_profile(db, supabase_user["id"])
    if not profile:
        await sync_profile_from_token(
            db=db,
            access_token=token,
            fallback_email=supabase_user.get("email") or "user@example.com",
        )
        profile = get_profile(db, supabase_user["id"])
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile
