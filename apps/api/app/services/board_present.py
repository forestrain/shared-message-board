from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models import Board, User
from app.schemas.board import BoardOut
from app.schemas.common import CreatorBrief
from app.services.board_access import PRIVATE, get_acl_users


def board_to_out(db: Session, board: Board, viewer: Optional[User]) -> BoardOut:
    out = BoardOut.model_validate(board)
    if (
        board.visibility == PRIVATE
        and viewer is not None
        and board.creator_id == viewer.id
    ):
        members = get_acl_users(db, board.id)
        out.allowed_members = [CreatorBrief.model_validate(m) for m in members]
    return out
