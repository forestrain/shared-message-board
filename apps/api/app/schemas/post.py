from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import CreatorBrief, QuotedPostBrief

__all__ = ["PostCreate", "PostOut", "PostListResponse", "QuotedPostBrief", "CreatorBrief"]


class PostCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    quoted_post_id: Optional[uuid.UUID] = None


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    board_id: uuid.UUID
    content: str
    created_at: datetime
    author: CreatorBrief
    quoted_post_id: Optional[uuid.UUID] = None
    quoted_post: Optional[QuotedPostBrief] = None


class PostListResponse(BaseModel):
    items: list[PostOut]
    total: int
    skip: int
    limit: int
