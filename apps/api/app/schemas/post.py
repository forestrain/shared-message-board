from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.board import CreatorBrief


class PostCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    board_id: uuid.UUID
    content: str
    created_at: datetime
    author: CreatorBrief


class PostListResponse(BaseModel):
    items: list[PostOut]
    total: int
    skip: int
    limit: int
