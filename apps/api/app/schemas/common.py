from __future__ import annotations

import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CreatorBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    nickname: Optional[str]


class QuotedPostBrief(BaseModel):
    """被 @ 引用的留言摘要（正文已截断）。"""

    id: uuid.UUID
    content: str
    author: CreatorBrief
