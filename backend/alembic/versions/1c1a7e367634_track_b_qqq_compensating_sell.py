"""track_b_qqq_compensating_sell

Adds a note column to transactions (nullable) and inserts a compensating
SELL transaction to correct a 2-share over-sell error on 2026-04-15.
The sell was recorded as 4 shares but should have been 2; this migration
inserts the offsetting BUY-side correction as a SELL of 2 shares.

The INSERT is idempotent via the note sentinel 'operator-error-correction-v1'.

Deploy gate: Apply after track_b_backfill_20260320_prices (66469081d5b6).

Revision ID: 1c1a7e367634
Revises: 66469081d5b6
Create Date: 2026-04-26 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = '1c1a7e367634'
down_revision = '66469081d5b6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add note column to transactions (nullable; existing rows get NULL).
    op.add_column('transactions', sa.Column('note', sa.String(), nullable=True))

    # Insert compensating SELL — idempotent via note sentinel.
    op.execute("""
        INSERT INTO transactions (date, asset_id, type, quantity, price, total_amount, account_type, note)
        SELECT '2026-04-15', 1, 'SELL', 2, 25310.0, 50620.0, 'ISA', 'operator-error-correction-v1'
        WHERE NOT EXISTS (
            SELECT 1 FROM transactions WHERE note = 'operator-error-correction-v1'
        )
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM transactions WHERE note = 'operator-error-correction-v1'
    """)

    op.drop_column('transactions', 'note')
