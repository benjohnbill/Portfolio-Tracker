"""Phase D Tier 1 schema — 3-scalar confidence, structured invalidation, weekly snapshot comment

Revision ID: a2b8f4d1c901
Revises: f1a9c3d8e210
Create Date: 2026-04-19 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2b8f4d1c901'
down_revision: Union[str, Sequence[str], None] = 'f1a9c3d8e210'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A3 — rename legacy confidence column; values are preserved in place.
    op.alter_column(
        'weekly_decisions',
        'confidence',
        new_column_name='confidence_vs_spy_riskadj',
        existing_type=sa.Integer(),
        existing_nullable=False,
    )

    # A3 — two additional confidence scalars, nullable since historical rows have none.
    op.add_column('weekly_decisions', sa.Column('confidence_vs_cash', sa.Integer(), nullable=True))
    op.add_column('weekly_decisions', sa.Column('confidence_vs_spy_pure', sa.Integer(), nullable=True))

    # A4 — structured invalidation alongside the existing free-text `invalidation` column.
    op.add_column('weekly_decisions', sa.Column('expected_failure_mode', sa.String(), nullable=True))
    op.add_column('weekly_decisions', sa.Column('trigger_threshold', sa.Float(), nullable=True))

    # A7 — optional per-freeze observation field.
    op.add_column('weekly_snapshots', sa.Column('comment', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('weekly_snapshots', 'comment')

    op.drop_column('weekly_decisions', 'trigger_threshold')
    op.drop_column('weekly_decisions', 'expected_failure_mode')
    op.drop_column('weekly_decisions', 'confidence_vs_spy_pure')
    op.drop_column('weekly_decisions', 'confidence_vs_cash')

    op.alter_column(
        'weekly_decisions',
        'confidence_vs_spy_riskadj',
        new_column_name='confidence',
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
