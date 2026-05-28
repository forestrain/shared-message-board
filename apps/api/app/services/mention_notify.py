from __future__ import annotations

import logging
import uuid
from html import escape

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import SessionLocal
from app.models import Board, Post, User
from app.services.email_transport import send_email, smtp_enabled

logger = logging.getLogger(__name__)

PREVIEW_MAX = 200


def _display_name(user: User) -> str:
    return (user.nickname or "").strip() or user.email


def _preview(text: str, has_image: bool) -> str:
    t = " ".join(text.split())
    if not t and has_image:
        return "（图片）"
    if len(t) > PREVIEW_MAX:
        return t[: PREVIEW_MAX - 1] + "…"
    return t or "（无文字）"


def _board_url(board_id: uuid.UUID) -> str:
    base = settings.app_public_url.rstrip("/")
    return f"{base}/boards/{board_id}"


def notify_quoted_author(
    db: Session,
    *,
    new_post: Post,
    board: Board,
    author: User,
    quoted_post: Post,
) -> None:
    if not smtp_enabled():
        return

    quoted_author = quoted_post.author
    if quoted_author is None:
        quoted_author = db.get(User, quoted_post.author_id)
    if quoted_author is None:
        return
    if quoted_author.id == author.id:
        return

    author_label = escape(_display_name(author))
    board_title = escape(board.title)
    snippet = escape(_preview(new_post.content, bool(new_post.image_url)))
    link = escape(_board_url(board.id))

    subject = f"【交换心声】{ _display_name(author) } 在《{board.title}》中引用了你的留言"
    text_body = (
        f"你好，{_display_name(quoted_author)}：\n\n"
        f"{_display_name(author)} 在留言板「{board.title}」发布新留言时 @ 引用了你。\n\n"
        f"TA 的留言：{ _preview(new_post.content, bool(new_post.image_url)) }\n\n"
        f"查看留言板：{_board_url(board.id)}\n\n"
        f"— 交换心声（本邮件由系统自动发送，请勿直接回复）"
    )
    html_body = f"""\
<html><body style="font-family:sans-serif;line-height:1.6;color:#334155;">
<p>你好，{escape(_display_name(quoted_author))}：</p>
<p><strong>{author_label}</strong> 在留言板「<strong>{board_title}</strong>」发布新留言时 @ 引用了你。</p>
<blockquote style="margin:12px 0;padding:12px;background:#f1f5f9;border-left:4px solid #3d7a96;">
{snippet}
</blockquote>
<p><a href="{link}">打开留言板查看</a></p>
<p style="font-size:12px;color:#94a3b8;">交换心声 · 本邮件由系统自动发送</p>
</body></html>"""

    try:
        send_email(
            to_addr=quoted_author.email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )
        logger.info("Mention email sent to %s for post %s", quoted_author.email, new_post.id)
    except Exception:
        # 发帖已成功，邮件失败仅记日志
        logger.exception("Mention email failed for post %s", new_post.id)


def send_mention_email_background(
    post_id: uuid.UUID,
    quoted_post_id: uuid.UUID,
    board_id: uuid.UUID,
    author_id: uuid.UUID,
) -> None:
    """BackgroundTasks 入口：独立会话加载数据后发信。"""
    if not smtp_enabled():
        return

    db = SessionLocal()
    try:
        new_post = db.execute(
            select(Post)
            .options(joinedload(Post.author))
            .where(Post.id == post_id, Post.deleted_at.is_(None))
        ).scalar_one_or_none()
        quoted_post = db.execute(
            select(Post)
            .options(joinedload(Post.author))
            .where(Post.id == quoted_post_id, Post.deleted_at.is_(None))
        ).scalar_one_or_none()
        board = db.get(Board, board_id)
        author = db.get(User, author_id)
        if new_post is None or quoted_post is None or board is None or author is None:
            return
        notify_quoted_author(db, new_post=new_post, board=board, author=author, quoted_post=quoted_post)
    finally:
        db.close()
