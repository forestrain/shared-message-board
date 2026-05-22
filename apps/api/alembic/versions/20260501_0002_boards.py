"""boards table

Revision ID: 20260501_0002
Revises: 20260501_0001
Create Date: 2026-05-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260501_0002"
down_revision: Union[str, Sequence[str], None] = "20260501_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "boards",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("visibility", sa.String(length=32), nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_boards_visibility"), "boards", ["visibility"], unique=False)
    op.create_index(op.f("ix_boards_creator_id"), "boards", ["creator_id"], unique=False)
    op.create_index(op.f("ix_boards_group_id"), "boards", ["group_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_boards_group_id"), table_name="boards")
    op.drop_index(op.f("ix_boards_creator_id"), table_name="boards")
    op.drop_index(op.f("ix_boards_visibility"), table_name="boards")
    op.drop_table("boards")
