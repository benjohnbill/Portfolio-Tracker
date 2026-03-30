"""Add cron run log table

Revision ID: d5b8e3f0ab12
Revises: c4a7c2c9bb21
Create Date: 2026-03-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5b8e3f0ab12'
down_revision: Union[str, Sequence[str], None] = 'c4a7c2c9bb21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cron_run_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('job_name', sa.String(100), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
    )
    op.create_index('ix_cron_run_logs_job_name', 'cron_run_logs', ['job_name'])
    op.create_index('ix_cron_run_logs_started_at', 'cron_run_logs', ['started_at'])


def downgrade() -> None:
    op.drop_index('ix_cron_run_logs_started_at', table_name='cron_run_logs')
    op.drop_index('ix_cron_run_logs_job_name', table_name='cron_run_logs')
    op.drop_table('cron_run_logs')
