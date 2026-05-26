from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import CreatorBrief, QuotedPostBrief

__all__ = ["PostCreate", "PostOut", "PostListResponse", "QuotedPostBrief", "CreatorBrief"]


class PostCreate(BaseModel):
    content: str = Field(default="", max_length=2000)
    quoted_post_id: Optional[uuid.UUID] = None
    image_url: Optional[str] = Field(None, max_length=512)

    @model_validator(mode="after")
    def require_content_or_image(self) -> PostCreate:
        if not self.content.strip() and not self.image_url:
            raise ValueError("正文与图片至少填写一项")
        return self


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    board_id: uuid.UUID
    content: str
    image_url: Optional[str] = None
    created_at: datetime
    author: CreatorBrief
    quoted_post_id: Optional[uuid.UUID] = None
    quoted_post: Optional[QuotedPostBrief] = None
    pinned_at: Optional[datetime] = None


class PostListResponse(BaseModel):
    items: list[PostOut]
    total: int
    skip: int
    limit: int
