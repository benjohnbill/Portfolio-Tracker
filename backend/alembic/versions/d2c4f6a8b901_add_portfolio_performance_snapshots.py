"""Add portfolio performance snapshots

Revision ID: d2c4f6a8b901
Revises: f1966ce042d3
Create Date: 2026-04-23 13:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2c4f6a8b901"
down_revision: Union[str, Sequence[str], None] = "f1966ce042d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "portfolio_performance_snapshots",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("performance_value", sa.Float(), nullable=False),
        sa.Column("benchmark_value", sa.Float(), nullable=True),
        sa.Column("daily_return", sa.Float(), nullable=True),
        sa.Column("alpha", sa.Float(), nullable=True),
        sa.Column("coverage_start_date", sa.Date(), nullable=False),
        sa.Column("coverage_status", sa.String(), nullable=False, server_default="ready"),
        sa.Column("source_version", sa.String(), nullable=False, server_default="portfolio-performance-v1"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("date"),
    )
    op.create_index(
        op.f("ix_portfolio_performance_snapshots_coverage_status"),
        "portfolio_performance_snapshots",
        ["coverage_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_portfolio_performance_snapshots_coverage_status"),
        table_name="portfolio_performance_snapshots",
    )
    op.drop_table("portfolio_performance_snapshots")
