"""公开板依赖：与 PRD 一致，仅 `visibility=public` 的板可被匿名读取。"""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Board

PUBLIC = "public"


def require_public_board(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> Board:
    board = db.get(Board, board_id)
    if board is None or board.visibility != PUBLIC:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Board not found")
    return board
