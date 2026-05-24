"""user_board_orders for personal home list sort

Revision ID: 20260501_0006
Revises: 20260501_0005
Create Date: 2026-05-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260501_0006"
down_revision: Union[str, Sequence[str], None] = "20260501_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_board_orders",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("board_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["board_id"], ["boards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "board_id"),
    )
    op.create_index(
        op.f("ix_user_board_orders_user_id_position"),
        "user_board_orders",
        ["user_id", "position"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_board_orders_user_id_position"), table_name="user_board_orders")
    op.drop_table("user_board_orders")
