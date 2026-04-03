"""Add Friday Time Machine tables

Revision ID: f1a9c3d8e210
Revises: d5b8e3f0ab12
Create Date: 2026-04-04 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'f1a9c3d8e210'
down_revision: Union[str, Sequence[str], None] = 'd5b8e3f0ab12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'weekly_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('frozen_report', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('snapshot_date'),
    )
    op.create_index(op.f('ix_weekly_snapshots_id'), 'weekly_snapshots', ['id'], unique=False)
    op.create_index(op.f('ix_weekly_snapshots_snapshot_date'), 'weekly_snapshots', ['snapshot_date'], unique=True)

    op.create_table(
        'weekly_decisions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('snapshot_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('decision_type', sa.String(), nullable=False),
        sa.Column('asset_ticker', sa.String(), nullable=True),
        sa.Column('note', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Integer(), nullable=False),
        sa.Column('invalidation', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['snapshot_id'], ['weekly_snapshots.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_weekly_decisions_id'), 'weekly_decisions', ['id'], unique=False)
    op.create_index(op.f('ix_weekly_decisions_snapshot_id'), 'weekly_decisions', ['snapshot_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_weekly_decisions_snapshot_id'), table_name='weekly_decisions')
    op.drop_index(op.f('ix_weekly_decisions_id'), table_name='weekly_decisions')
    op.drop_table('weekly_decisions')

    op.drop_index(op.f('ix_weekly_snapshots_snapshot_date'), table_name='weekly_snapshots')
    op.drop_index(op.f('ix_weekly_snapshots_id'), table_name='weekly_snapshots')
    op.drop_table('weekly_snapshots')
