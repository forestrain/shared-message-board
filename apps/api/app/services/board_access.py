from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.models import Board, BoardAcl, User

PUBLIC = "public"
PRIVATE = "private"


def user_can_access_board(db: Session, board: Board, user: User | None) -> bool:
    if board.visibility == PUBLIC:
        return True
    if user is None:
        return False
    if board.creator_id == user.id:
        return True
    row = db.get(BoardAcl, {"board_id": board.id, "user_id": user.id})
    return row is not None


def user_can_write_board(db: Session, board: Board, user: User | None) -> bool:
    return user is not None and user_can_access_board(db, board, user)


def get_acl_users(db: Session, board_id: uuid.UUID) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .join(BoardAcl, BoardAcl.user_id == User.id)
            .where(BoardAcl.board_id == board_id)
            .order_by(User.email)
        ).all()
    )


def sync_board_acl(db: Session, board: Board, member_emails: list[str]) -> None:
    normalized = []
    seen: set[str] = set()
    for raw in member_emails:
        email = raw.strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        normalized.append(email)

    users: list[User] = []
    if normalized:
        rows = db.scalars(select(User).where(User.email.in_(normalized))).all()
        by_email = {u.email.lower(): u for u in rows}
        missing = [e for e in normalized if e not in by_email]
        if missing:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"以下邮箱未注册：{', '.join(missing)}",
            )
        users = [by_email[e] for e in normalized]

    db.execute(delete(BoardAcl).where(BoardAcl.board_id == board.id))
    for member in users:
        if member.id == board.creator_id:
            continue
        db.add(BoardAcl(board_id=board.id, user_id=member.id))
    db.commit()


def clear_board_acl(db: Session, board_id: uuid.UUID) -> None:
    db.execute(delete(BoardAcl).where(BoardAcl.board_id == board_id))
    db.commit()


def private_boards_for_user(db: Session, user: User) -> list[Board]:
    acl_board_ids = select(BoardAcl.board_id).where(BoardAcl.user_id == user.id)
    return list(
        db.scalars(
            select(Board)
            .options(joinedload(Board.creator))
            .where(
                Board.visibility == PRIVATE,
                (Board.creator_id == user.id) | (Board.id.in_(acl_board_ids)),
            )
            .order_by(Board.created_at.desc())
        ).unique().all()
    )
