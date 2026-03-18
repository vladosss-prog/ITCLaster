from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import User


router = APIRouter()


def _get_jwt_settings() -> tuple[str, str]:
    secret_key = os.getenv("SECRET_KEY")
    algorithm = os.getenv("ALGORITHM")
    if not secret_key or not algorithm:
        raise HTTPException(
            status_code=500,
            detail="Ошибка конфигурации сервера: не задан SECRET_KEY или ALGORITHM",
        )
    return secret_key, algorithm


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Отсутствует заголовок Authorization")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Некорректный формат Authorization (нужен Bearer токен)")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Пустой токен в Authorization")
    return token


def _get_current_user(db: Session, authorization: Optional[str]) -> User:
    token = _extract_bearer_token(authorization)
    secret_key, algorithm = _get_jwt_settings()
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Недействительный токен")

    user_id = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail='Недействительный токен: отсутствует поле "sub"')

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


def get_current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> User:
    return _get_current_user(db=db, authorization=authorization)


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    organization: Optional[str] = None
    global_role: str
    created_at: datetime

    class Config:
        from_attributes = True


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str
    organization: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/register", response_model=UserOut)
def register(body: RegisterIn, db: Session = Depends(get_db)) -> UserOut:
    stmt = select(User).where(User.email == body.email)
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

    user = User(
        email=body.email,
        password_hash=password_hash,
        full_name=body.full_name,
        organization=body.organization,
        global_role="PARTICIPANT",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user, from_attributes=True)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    stmt = select(User).where(User.email == body.email)
    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not bcrypt.checkpw(body.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    secret_key, algorithm = _get_jwt_settings()
    expire_minutes_str = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480")
    try:
        expire_minutes = int(expire_minutes_str)
    except ValueError:
        expire_minutes = 480

    payload = {
        "sub": user.id,
        "exp": datetime.utcnow() + timedelta(minutes=expire_minutes),
    }
    token = jwt.encode(payload, secret_key, algorithm=algorithm)

    return TokenOut(access_token=token, user=UserOut.model_validate(user, from_attributes=True))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user, from_attributes=True)

