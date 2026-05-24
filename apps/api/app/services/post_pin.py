from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Board, Post, User

MAX_PINNED_PER_BOARD = 2


def count_pinned_posts(db: Session, board_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Post)
            .where(
                Post.board_id == board_id,
                Post.deleted_at.is_(None),
                Post.pinned_at.is_not(None),
            )
        )
        or 0
    )


def get_mutable_post(db: Session, post_id: uuid.UUID) -> Post | None:
    return db.execute(
        select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
    ).scalar_one_or_none()


def require_board_owner(board: Board, user: User) -> None:
    if board.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="仅留言板版主可操作置顶")
    if board.visibility != "public":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed")


def pin_post(db: Session, post: Post, board: Board, user: User) -> Post:
    require_board_owner(board, user)
    if post.board_id != board.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.pinned_at is not None:
        return post
    if count_pinned_posts(db, board.id) >= MAX_PINNED_PER_BOARD:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"每块留言板最多置顶 {MAX_PINNED_PER_BOARD} 条留言",
        )
    post.pinned_at = datetime.now(timezone.utc)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def unpin_post(db: Session, post: Post, board: Board, user: User) -> Post:
    require_board_owner(board, user)
    if post.board_id != board.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Post not found")
    post.pinned_at = None
    db.add(post)
    db.commit()
    db.refresh(post)
    return post
