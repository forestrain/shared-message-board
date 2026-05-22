from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import AuthSession, User


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    name = settings.session_cookie_name
    raw = request.cookies.get(name)
    if raw is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        sid = uuid.UUID(raw)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    row = db.get(AuthSession, sid)
    now = datetime.now(timezone.utc)
    if row is None or row.expires_at <= now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user
