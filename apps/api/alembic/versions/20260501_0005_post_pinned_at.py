"""posts.pinned_at for board owner pins

Revision ID: 20260501_0005
Revises: 20260501_0004
Create Date: 2026-05-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260501_0005"
down_revision: Union[str, Sequence[str], None] = "20260501_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_posts_pinned_at"), "posts", ["pinned_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_posts_pinned_at"), table_name="posts")
    op.drop_column("posts", "pinned_at")
