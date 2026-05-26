from __future__ import annotations

from app.models import Post
from app.schemas.common import QuotedPostBrief
from app.schemas.post import PostOut

QUOTE_PREVIEW_MAX = 120


def truncate_preview(text: str, max_len: int = QUOTE_PREVIEW_MAX) -> str:
    single_line = " ".join(text.split())
    if len(single_line) <= max_len:
        return single_line
    return single_line[: max_len - 1] + "…"


def post_to_out(post: Post) -> PostOut:
    quoted = None
    if post.quoted_post_id and post.quoted_post is not None and post.quoted_post.deleted_at is None:
        quoted = QuotedPostBrief(
            id=post.quoted_post.id,
            content=truncate_preview(post.quoted_post.content),
            author=post.quoted_post.author,
        )
    return PostOut(
        id=post.id,
        board_id=post.board_id,
        content=post.content,
        image_url=post.image_url,
        created_at=post.created_at,
        author=post.author,
        quoted_post_id=post.quoted_post_id,
        quoted_post=quoted,
        pinned_at=post.pinned_at,
    )
