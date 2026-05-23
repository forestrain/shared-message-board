from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.deps_board import require_public_board
from app.models import Board, Post, User
from app.schemas.post import PostCreate, PostListResponse, PostOut
from app.services.post_present import post_to_out

board_posts_router = APIRouter(prefix="/boards/{board_id}/posts", tags=["posts"])
posts_router = APIRouter(prefix="/posts", tags=["posts"])

_POST_LOAD = (
    joinedload(Post.author),
    joinedload(Post.quoted_post).joinedload(Post.author),
)


@board_posts_router.get("", response_model=PostListResponse)
def list_posts(
    board_id: uuid.UUID,
    _board: Board = Depends(require_public_board),
    db: Session = Depends(get_db),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> PostListResponse:
    base = select(Post).options(*_POST_LOAD).where(Post.board_id == board_id, Post.deleted_at.is_(None))
    total = (
        db.scalar(
            select(func.count()).select_from(Post).where(Post.board_id == board_id, Post.deleted_at.is_(None))
        )
        or 0
    )
    rows = db.scalars(base.order_by(Post.created_at.desc()).offset(skip).limit(limit)).unique().all()
    items = [post_to_out(p) for p in rows]
    return PostListResponse(items=items, total=int(total), skip=skip, limit=limit)


@board_posts_router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    board_id: uuid.UUID,
    body: PostCreate,
    board: Board = Depends(require_public_board),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PostOut:
    quoted_id = body.quoted_post_id
    if quoted_id is not None:
        quoted = db.get(Post, quoted_id)
        if (
            quoted is None
            or quoted.board_id != board_id
            or quoted.deleted_at is not None
        ):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="引用的留言不存在或已删除",
            )
    post = Post(
        board_id=board_id,
        author_id=user.id,
        content=body.content.strip(),
        quoted_post_id=quoted_id,
    )
    db.add(post)
    db.commit()
    post = db.execute(select(Post).options(*_POST_LOAD).where(Post.id == post.id)).scalar_one()
    return post_to_out(post)


@posts_router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    post = db.execute(
        select(Post).options(joinedload(Post.board)).where(Post.id == post_id, Post.deleted_at.is_(None))
    ).scalar_one_or_none()
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.board.visibility != "public":
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.author_id != user.id and post.board.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed")
    post.deleted_at = datetime.now(timezone.utc)
    db.add(post)
    db.commit()
