"""留言板读权限：公开板所有人可读；私有板仅创建者与 ACL 用户可读。"""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_optional_user
from typing import Optional

from app.models import Board, User
from app.services.board_access import user_can_access_board, user_can_write_board

PUBLIC = "public"


def _load_board(db: Session, board_id: uuid.UUID) -> Board | None:
    return db.get(Board, board_id)


def require_board_read(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> Board:
    board = _load_board(db, board_id)
    if board is None or not user_can_access_board(db, board, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Board not found")
    return board


def require_board_write(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Board:
    board = _load_board(db, board_id)
    if board is None or not user_can_write_board(db, board, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Board not found")
    return board


# 兼容旧名
require_public_board = require_board_read
