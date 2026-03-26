"""Add weekly reports and annotations

Revision ID: 6b2d4c8f9a11
Revises: a874b8e65364
Create Date: 2026-03-27 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b2d4c8f9a11'
down_revision: Union[str, Sequence[str], None] = 'a874b8e65364'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'weekly_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('week_ending', sa.Date(), nullable=False),
        sa.Column('generated_at', sa.DateTime(), nullable=False),
        sa.Column('logic_version', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('report_json', sa.JSON(), nullable=False),
        sa.Column('llm_summary_json', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('week_ending')
    )
    op.create_index(op.f('ix_weekly_reports_id'), 'weekly_reports', ['id'], unique=False)
    op.create_index(op.f('ix_weekly_reports_week_ending'), 'weekly_reports', ['week_ending'], unique=True)

    op.create_table(
        'event_annotations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('week_ending', sa.Date(), nullable=False),
        sa.Column('event_date', sa.Date(), nullable=True),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('summary', sa.String(), nullable=False),
        sa.Column('affected_buckets', sa.JSON(), nullable=True),
        sa.Column('affected_sleeves', sa.JSON(), nullable=True),
        sa.Column('duration', sa.String(), nullable=True),
        sa.Column('decision_impact', sa.String(), nullable=True),
        sa.Column('source', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_event_annotations_id'), 'event_annotations', ['id'], unique=False)
    op.create_index(op.f('ix_event_annotations_week_ending'), 'event_annotations', ['week_ending'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_event_annotations_week_ending'), table_name='event_annotations')
    op.drop_index(op.f('ix_event_annotations_id'), table_name='event_annotations')
    op.drop_table('event_annotations')

    op.drop_index(op.f('ix_weekly_reports_week_ending'), table_name='weekly_reports')
    op.drop_index(op.f('ix_weekly_reports_id'), table_name='weekly_reports')
    op.drop_table('weekly_reports')
