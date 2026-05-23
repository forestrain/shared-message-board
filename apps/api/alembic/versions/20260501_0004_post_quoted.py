"""posts.quoted_post_id for @ references

Revision ID: 20260501_0004
Revises: 20260501_0003
Create Date: 2026-05-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260501_0004"
down_revision: Union[str, Sequence[str], None] = "20260501_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("quoted_post_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_posts_quoted_post_id",
        "posts",
        "posts",
        ["quoted_post_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_posts_quoted_post_id"), "posts", ["quoted_post_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_posts_quoted_post_id"), table_name="posts")
    op.drop_constraint("fk_posts_quoted_post_id", "posts", type_="foreignkey")
    op.drop_column("posts", "quoted_post_id")
