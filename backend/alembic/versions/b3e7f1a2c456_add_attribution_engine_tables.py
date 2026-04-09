"""Add attribution engine tables

Revision ID: b3e7f1a2c456
Revises: f1a9c3d8e210
Create Date: 2026-04-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b3e7f1a2c456'
down_revision: Union[str, None] = '8d1789f7c374'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'scoring_attributions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('snapshot_id', sa.Integer(), sa.ForeignKey('weekly_snapshots.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),

        # Fit score decomposition (40 pts, 5 buckets x 8 max)
        sa.Column('fit_score', sa.Float(), nullable=False),
        sa.Column('fit_bucket_liquidity', sa.Float(), nullable=True),
        sa.Column('fit_bucket_rates', sa.Float(), nullable=True),
        sa.Column('fit_bucket_inflation', sa.Float(), nullable=True),
        sa.Column('fit_bucket_growth', sa.Float(), nullable=True),
        sa.Column('fit_bucket_stress', sa.Float(), nullable=True),

        # Alignment score decomposition (35 pts, 6 categories)
        sa.Column('alignment_score', sa.Float(), nullable=False),
        sa.Column('alignment_ndx', sa.Float(), nullable=True),
        sa.Column('alignment_dbmf', sa.Float(), nullable=True),
        sa.Column('alignment_brazil', sa.Float(), nullable=True),
        sa.Column('alignment_mstr', sa.Float(), nullable=True),
        sa.Column('alignment_gldm', sa.Float(), nullable=True),
        sa.Column('alignment_bonds_cash', sa.Float(), nullable=True),

        # Posture/Diversification (25 pts)
        sa.Column('posture_score', sa.Float(), nullable=False),
        sa.Column('posture_stress_resilience', sa.Float(), nullable=True),
        sa.Column('posture_concentration', sa.Float(), nullable=True),
        sa.Column('posture_diversifier_reserve', sa.Float(), nullable=True),

        # Composite
        sa.Column('total_score', sa.Integer(), nullable=False),

        # JSONB fields
        sa.Column('regime_snapshot', postgresql.JSONB(), nullable=True),
        sa.Column('indicator_values', postgresql.JSONB(), nullable=True),
        sa.Column('rules_fired', postgresql.JSONB(), nullable=True),
    )
    # snapshot_id already has a unique index from unique=True in create_table

    op.create_table(
        'decision_outcomes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('decision_id', sa.Integer(), sa.ForeignKey('weekly_decisions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('snapshot_id', sa.Integer(), sa.ForeignKey('weekly_snapshots.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('evaluated_at', sa.DateTime(), nullable=True),

        sa.Column('horizon', sa.String(), nullable=False),

        sa.Column('portfolio_value_at_decision', sa.Float(), nullable=True),
        sa.Column('portfolio_value_at_horizon', sa.Float(), nullable=True),
        sa.Column('score_at_decision', sa.Integer(), nullable=True),
        sa.Column('score_at_horizon', sa.Integer(), nullable=True),
        sa.Column('regime_at_decision', sa.String(), nullable=True),
        sa.Column('regime_at_horizon', sa.String(), nullable=True),

        sa.Column('outcome_delta_pct', sa.Float(), nullable=True),
        sa.Column('score_delta', sa.Integer(), nullable=True),
        sa.Column('regime_changed', sa.String(), nullable=True),

        sa.UniqueConstraint('decision_id', 'horizon', name='uq_decision_horizon'),
    )
    op.create_index('ix_decision_outcomes_decision_id', 'decision_outcomes', ['decision_id'])
    op.create_index('ix_decision_outcomes_snapshot_id', 'decision_outcomes', ['snapshot_id'])


def downgrade() -> None:
    op.drop_table('decision_outcomes')
    op.drop_table('scoring_attributions')
