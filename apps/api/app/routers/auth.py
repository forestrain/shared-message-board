import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AuthSession, User
from app.schemas.user import UserCreate, UserLogin, UserPublic
from app.services.password import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)) -> User:
    exists = db.scalar(select(User).where(User.email == body.email))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        nickname=body.nickname,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _set_session_cookie(response: Response, db: Session, user: User) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.session_ttl_days)
    row = AuthSession(user_id=user.id, expires_at=expires_at)
    db.add(row)
    db.commit()
    db.refresh(row)

    max_age = int(timedelta(days=settings.session_ttl_days).total_seconds())
    response.set_cookie(
        key=settings.session_cookie_name,
        value=str(row.id),
        httponly=True,
        secure=settings.session_secure,
        samesite="lax",
        max_age=max_age,
        path="/",
    )


@router.post("/login", response_model=UserPublic)
def login(body: UserLogin, response: Response, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    _set_session_cookie(response, db, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    raw = request.cookies.get(settings.session_cookie_name)
    if raw:
        try:
            sid = uuid.UUID(raw)
            row = db.get(AuthSession, sid)
            if row is not None:
                db.delete(row)
                db.commit()
        except ValueError:
            pass
    response.delete_cookie(key=settings.session_cookie_name, path="/")
