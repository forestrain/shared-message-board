"""board_acl for private board access

Revision ID: 20260501_0007
Revises: 20260501_0006
Create Date: 2026-05-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260501_0007"
down_revision: Union[str, Sequence[str], None] = "20260501_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "board_acl",
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("board_id", "user_id"),
    )
    op.create_index(op.f("ix_board_acl_user_id"), "board_acl", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_board_acl_user_id"), table_name="board_acl")
    op.drop_table("board_acl")
