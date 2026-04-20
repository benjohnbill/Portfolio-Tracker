"""Benchmark compare columns — weekly_snapshots.risk_metrics + decision_outcomes SPY deltas

Revision ID: c9e5f2a8d410
Revises: a2b8f4d1c901
Create Date: 2026-04-20 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c9e5f2a8d410'
down_revision: Union[str, Sequence[str], None] = 'a2b8f4d1c901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # B4 — per-freeze precomputed risk metrics JSONB.
    op.add_column(
        'weekly_snapshots',
        sa.Column('risk_metrics', postgresql.JSONB(), nullable=True),
    )

    # B2 — SPY-KRW benchmark deltas on matured decision outcomes.
    op.add_column(
        'decision_outcomes',
        sa.Column('outcome_delta_vs_spy_pure', sa.Float(), nullable=True),
    )
    op.add_column(
        'decision_outcomes',
        sa.Column('outcome_delta_calmar_vs_spy', sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('decision_outcomes', 'outcome_delta_calmar_vs_spy')
    op.drop_column('decision_outcomes', 'outcome_delta_vs_spy_pure')
    op.drop_column('weekly_snapshots', 'risk_metrics')
