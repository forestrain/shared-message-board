from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user, get_optional_user
from app.models import Board, Post, User
from app.schemas.board import (
    BoardCreate,
    BoardListItem,
    BoardListResponse,
    BoardOrderMove,
    BoardOut,
    BoardUpdate,
    PostBrief,
)
from app.schemas.common import QuotedPostBrief
from app.services.board_access import PRIVATE, clear_board_acl, sync_board_acl
from app.services.board_order import list_home_boards, move_board_in_user_list
from app.services.board_present import board_to_out
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
    preview = _truncate_post_content(post.content) if post.content.strip() else ""
    if not preview and post.image_url:
        preview = "[图片]"
    return PostBrief(
        id=post.id,
        content=preview,
        image_url=post.image_url,
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
    user: Optional[User] = Depends(get_optional_user),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BoardListResponse:
    all_boards = list_home_boards(db, user)
    total = len(all_boards)
    rows = all_boards[skip : skip + limit]
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
    return board_to_out(db, board, user)


@router.post("/{board_id}/order/move", status_code=status.HTTP_204_NO_CONTENT)
def move_board_order(
    board_id: uuid.UUID,
    body: BoardOrderMove,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    move_board_in_user_list(db, user, board_id, body.direction)


@router.get("/{board_id}", response_model=BoardOut)
def get_board(
    board_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> BoardOut:
    from app.deps_board import require_board_read

    board = require_board_read(board_id, db, user)
    board = db.execute(
        select(Board).options(joinedload(Board.creator)).where(Board.id == board.id)
    ).scalar_one()
    return board_to_out(db, board, user)


@router.patch("/{board_id}", response_model=BoardOut)
def update_board(
    board_id: uuid.UUID,
    body: BoardUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BoardOut:
    if (
        body.title is None
        and body.description is None
        and body.visibility is None
        and body.member_emails is None
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="请至少提供一项要修改的内容",
        )
    board = db.get(Board, board_id)
    if board is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Board not found")
    if board.creator_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="仅版主可修改留言板")

    if body.title is not None:
        t = body.title.strip()
        if not t:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="title cannot be empty")
        board.title = t
    if body.description is not None:
        board.description = body.description.strip() or None

    if body.visibility == PRIVATE:
        board.visibility = PRIVATE
        if body.member_emails is not None:
            sync_board_acl(db, board, body.member_emails)
    elif body.visibility == PUBLIC:
        board.visibility = PUBLIC
        clear_board_acl(db, board.id)
    elif body.member_emails is not None:
        if board.visibility != PRIVATE:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="仅私密留言板可设置可见成员",
            )
        sync_board_acl(db, board, body.member_emails)

    db.add(board)
    db.commit()
    board = db.execute(
        select(Board).options(joinedload(Board.creator)).where(Board.id == board_id)
    ).scalar_one()
    return board_to_out(db, board, user)


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
