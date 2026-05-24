from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models import Board, Post, User
from app.schemas.board import (
    BoardCreate,
    BoardListItem,
    BoardListResponse,
    BoardOut,
    BoardUpdate,
    PostBrief,
)
from app.schemas.common import QuotedPostBrief
from app.services.post_present import truncate_preview

router = APIRouter(prefix="/boards", tags=["boards"])

PUBLIC = "public"
POST_BRIEF_MAX = 80


def _truncate_post_content(text: str, max_len: int = POST_BRIEF_MAX) -> str:
    single_line = " ".join(text.split())
    if len(single_line) <= max_len:
        return single_line
    return single_line[: max_len - 1] + "…"


def _post_brief(post: Post) -> PostBrief:
    quoted = None
    if post.quoted_post_id and post.quoted_post is not None and post.quoted_post.deleted_at is None:
        quoted = QuotedPostBrief(
            id=post.quoted_post.id,
            content=truncate_preview(post.quoted_post.content, max_len=POST_BRIEF_MAX),
            author=post.quoted_post.author,
        )
    return PostBrief(
        id=post.id,
        content=_truncate_post_content(post.content),
        author=post.author,
        quoted_post_id=post.quoted_post_id,
        quoted_post=quoted,
        pinned_at=post.pinned_at,
    )


_POST_PREVIEW_LOAD = (
    joinedload(Post.author),
    joinedload(Post.quoted_post).joinedload(Post.author),
)


def _preview_posts_for_board(db: Session, board_id: uuid.UUID, limit: int = 2) -> list[Post]:
    """首页摘要：先置顶（最多 limit 条），不足则用最新非置顶帖补齐。"""
    pinned = list(
        db.scalars(
            select(Post)
            .options(*_POST_PREVIEW_LOAD)
            .where(
                Post.board_id == board_id,
                Post.deleted_at.is_(None),
                Post.pinned_at.is_not(None),
            )
            .order_by(Post.pinned_at.desc())
            .limit(limit)
        ).unique().all()
    )
    if len(pinned) >= limit:
        return pinned
    pinned_ids = [p.id for p in pinned]
    remaining = limit - len(pinned)
    q = (
        select(Post)
        .options(*_POST_PREVIEW_LOAD)
        .where(
            Post.board_id == board_id,
            Post.deleted_at.is_(None),
            Post.pinned_at.is_(None),
        )
        .order_by(Post.created_at.desc())
        .limit(remaining)
    )
    if pinned_ids:
        q = q.where(Post.id.not_in(pinned_ids))
    recent = list(db.scalars(q).unique().all())
    return pinned + recent


def _recent_posts_by_board(
    db: Session, board_ids: list[uuid.UUID], per_board: int = 2
) -> dict[uuid.UUID, list[Post]]:
    if not board_ids:
        return {}
    return {bid: _preview_posts_for_board(db, bid, per_board) for bid in board_ids}


@router.get("", response_model=BoardListResponse)
def list_public_boards(
    db: Session = Depends(get_db),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BoardListResponse:
    base = select(Board).options(joinedload(Board.creator)).where(Board.visibility == PUBLIC)
    total = db.scalar(select(func.count()).select_from(Board).where(Board.visibility == PUBLIC)) or 0
    rows = db.scalars(base.order_by(Board.created_at.desc()).offset(skip).limit(limit)).unique().all()
    board_ids = [b.id for b in rows]
    posts_map = _recent_posts_by_board(db, board_ids, per_board=2)
    items: list[BoardListItem] = []
    for board in rows:
        briefs = [_post_brief(p) for p in posts_map.get(board.id, [])]
        item = BoardListItem.model_validate(board)
        item.recent_posts = briefs
        items.append(item)
    return BoardListResponse(items=items, total=int(total), skip=skip, limit=limit)


@router.post("", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
def create_board(
    body: BoardCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BoardOut:
    board = Board(
        title=body.title.strip(),
        description=body.description.strip() if body.description else None,
        visibility=PUBLIC,
        creator_id=user.id,
        group_id=None,
    )
    db.add(board)
    db.commit()
    db.refresh(board)
    board = db.execute(
        select(Board).options(joinedload(Board.creator)).where(Board.id == board.id)
    ).scalar_one()
    return BoardOut.model_validate(board)


@router.get("/{board_id}", response_model=BoardOut)
def get_board(board_id: uuid.UUID, db: Session = Depends(get_db)) -> BoardOut:
    board = db.execute(
        select(Board).options(joinedload(Board.creator)).where(Board.id == board_id)
    ).scalar_one_or_none()
    if board is None or board.visibility != PUBLIC:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Board not found")
    return BoardOut.model_validate(board)


@router.patch("/{board_id}", response_model=BoardOut)
def update_board(
    board_id: uuid.UUID,
    body: BoardUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BoardOut:
    if body.title is None and body.description is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one of title or description is required",
        )
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Board not found")
    if board.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if board.visibility != PUBLIC:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed")
    if body.title is not None:
        t = body.title.strip()
        if not t:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="title cannot be empty")
        board.title = t
    if body.description is not None:
        board.description = body.description.strip() or None
    db.add(board)
    db.commit()
    board = db.execute(
        select(Board).options(joinedload(Board.creator)).where(Board.id == board_id)
    ).scalar_one()
    return BoardOut.model_validate(board)


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Board not found")
    if board.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not allowed")
    db.delete(board)
    db.commit()
