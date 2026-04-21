"""Add execution_slippage table — C1 slippage log

Revision ID: f1966ce042d3
Revises: c9e5f2a8d410
Create Date: 2026-04-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1966ce042d3'
down_revision: Union[str, Sequence[str], None] = 'c9e5f2a8d410'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'execution_slippage',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            'decision_id',
            sa.Integer(),
            sa.ForeignKey('weekly_decisions.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('executed_at', sa.Date(), nullable=True),
        sa.Column('executed_price', sa.Float(), nullable=True),
        sa.Column('executed_qty', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('execution_slippage')
