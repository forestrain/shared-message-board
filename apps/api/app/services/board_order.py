from __future__ import annotations

import uuid
from typing import Literal, Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.models import Board, User, UserBoardOrder

PUBLIC = "public"
MoveDirection = Literal["up", "down"]


def _load_public_boards(db: Session) -> list[Board]:
    return list(
        db.scalars(
            select(Board)
            .options(joinedload(Board.creator))
            .where(Board.visibility == PUBLIC)
            .order_by(Board.created_at.desc())
        ).unique().all()
    )


def _order_map(db: Session, user_id: uuid.UUID) -> dict[uuid.UUID, int]:
    rows = db.scalars(select(UserBoardOrder).where(UserBoardOrder.user_id == user_id)).all()
    return {r.board_id: r.position for r in rows}


def sort_boards_for_user(boards: list[Board], order_map: dict[uuid.UUID, int]) -> list[Board]:
    if not order_map:
        return boards

    def sort_key(b: Board) -> tuple[int, int, float]:
        if b.id in order_map:
            return (0, order_map[b.id], 0.0)
        return (1, 0, -b.created_at.timestamp())

    return sorted(boards, key=sort_key)


def sorted_public_boards(db: Session, user: Optional[User]) -> list[Board]:
    boards = _load_public_boards(db)
    if user is None:
        return boards
    return sort_boards_for_user(boards, _order_map(db, user.id))


def _save_order(db: Session, user_id: uuid.UUID, board_ids: list[uuid.UUID]) -> None:
    db.execute(delete(UserBoardOrder).where(UserBoardOrder.user_id == user_id))
    for index, board_id in enumerate(board_ids):
        db.add(UserBoardOrder(user_id=user_id, board_id=board_id, position=index))
    db.commit()


def move_board_in_user_list(
    db: Session,
    user: User,
    board_id: uuid.UUID,
    direction: MoveDirection,
) -> None:
    boards = sorted_public_boards(db, user)
    ids = [b.id for b in boards]
    if board_id not in ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Board not found")
    index = ids.index(board_id)
    if direction == "up":
        if index == 0:
            return
        ids[index], ids[index - 1] = ids[index - 1], ids[index]
    elif direction == "down":
        if index >= len(ids) - 1:
            return
        ids[index], ids[index + 1] = ids[index + 1], ids[index]
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="direction must be up or down")
    _save_order(db, user.id, ids)
