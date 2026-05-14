"""add ingested_at to raw_daily_price

Revision ID: dacdf886e7d3
Revises: 1c1a7e367634
Create Date: 2026-05-14 13:15:04.018580

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dacdf886e7d3'
down_revision: Union[str, Sequence[str], None] = '1c1a7e367634'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "raw_daily_prices",
        sa.Column("ingested_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("raw_daily_prices", "ingested_at")
