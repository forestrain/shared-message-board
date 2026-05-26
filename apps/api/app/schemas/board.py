from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import CreatorBrief, QuotedPostBrief


class BoardCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=8000)
    visibility: Literal["public"] = "public"


class BoardUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=8000)
    visibility: Optional[Literal["public", "private"]] = None
    member_emails: Optional[list[str]] = Field(
        None,
        description="私密板可见用户邮箱（须已注册）；版主无需列入",
    )


class BoardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: Optional[str]
    visibility: str
    created_at: datetime
    creator: CreatorBrief
    allowed_members: list[CreatorBrief] = Field(default_factory=list)


class PostBrief(BaseModel):
    """列表页展示的留言摘要（正文已在服务端截断）。"""

    id: uuid.UUID
    content: str
    image_url: Optional[str] = None
    author: CreatorBrief
    quoted_post_id: Optional[uuid.UUID] = None
    quoted_post: Optional[QuotedPostBrief] = None
    pinned_at: Optional[datetime] = None


class BoardListItem(BoardOut):
    recent_posts: list[PostBrief] = Field(default_factory=list)


class BoardListResponse(BaseModel):
    items: list[BoardListItem]
    total: int
    skip: int
    limit: int


class BoardOrderMove(BaseModel):
    direction: Literal["up", "down"]
