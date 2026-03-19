from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from models.schemas import AuthResponse, LoginRequest, RegisterRequest, UserProfile
from services.auth_service import AuthError, login_user, register_user, sync_profile_from_token
from services.dependencies import get_current_user, get_db

router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    # Регистрация пользователя через Supabase Auth.
    # Вход: {name, email, password, type_of_disability}
    # Выход: {access_token, token_type}
    # Пример запроса:
    # {"name":"Ali","email":"ali@example.com","password":"Password123","type_of_disability":"wheelchair"}
    # Пример ответа:
    # {"access_token":"<jwt>","token_type":"bearer"}
    try:
        token = await register_user(
            db=db,
            name=payload.name,
            email=payload.email,
            password=payload.password,
            type_of_disability=payload.type_of_disability,
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AuthResponse(access_token=token)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    # Авторизация пользователя через Supabase Auth.
    # Вход: {email, password}
    # Выход: {access_token, token_type}
    # Пример запроса:
    # {"email":"ali@example.com","password":"Password123"}
    # Пример ответа:
    # {"access_token":"<jwt>","token_type":"bearer"}
    try:
        token = await login_user(payload.email, payload.password)
        await sync_profile_from_token(db, token, payload.email)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return AuthResponse(access_token=token)


@router.get("/me", response_model=UserProfile)
async def me(current_user: dict = Depends(get_current_user)) -> UserProfile:
    # Профиль текущего пользователя по JWT.
    # Вход: Bearer JWT в Authorization.
    # Выход: профиль пользователя из таблицы users.
    # Пример ответа:
    # {"id":"...","name":"Ali","email":"ali@example.com","type_of_disability":"wheelchair","created_at":"..."}
    return UserProfile(**current_user)
