"""Add relative_path to documents

Revision ID: 30b1c2d3e4f5
Revises: 2047460692d0
Create Date: 2026-05-14 14:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "30b1c2d3e4f5"
down_revision: Union[str, Sequence[str], None] = "2047460692d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "documents", sa.Column("relative_path", sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("documents", "relative_path")
