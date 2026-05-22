from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models import Board, User
from app.schemas.board import BoardCreate, BoardListResponse, BoardOut, BoardUpdate

router = APIRouter(prefix="/boards", tags=["boards"])

PUBLIC = "public"


@router.get("", response_model=BoardListResponse)
def list_public_boards(
    db: Session = Depends(get_db),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> BoardListResponse:
    base = select(Board).options(joinedload(Board.creator)).where(Board.visibility == PUBLIC)
    total = db.scalar(select(func.count()).select_from(Board).where(Board.visibility == PUBLIC)) or 0
    rows = db.scalars(base.order_by(Board.created_at.desc()).offset(skip).limit(limit)).unique().all()
    items = [BoardOut.model_validate(b) for b in rows]
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
