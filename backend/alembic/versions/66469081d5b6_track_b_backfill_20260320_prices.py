"""track_b_backfill_20260320_prices

Backfills price and total_amount for five 2026-03-20 transactions that were
recorded with price=0 and total_amount=0. Confirmed prices for ids 7-10 come
from M-STOCK (KRW) and Toss (KRW) broker statements. Id 11 (CSI300 SELL) is
skipped — no Toss data available (sold before the 3-month window).

Deploy gate: Apply after Track A production verification passes (post 2026-05-04).

Revision ID: 66469081d5b6
Revises: 08a8ebea1f16
Create Date: 2026-04-26 00:00:00.000000

"""
from alembic import op

revision = '66469081d5b6'
down_revision = '08a8ebea1f16'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # id=7: NDX_1X BUY, 34 shares @ 24315.0 KRW (source: M-STOCK)
    op.execute("""
        UPDATE transactions
        SET price = 24315.0,
            total_amount = 826710.0
        WHERE id = 7
          AND price = 0
    """)

    # id=8: ACE_TLT BUY, 24 shares @ 10225.0 KRW (source: M-STOCK)
    op.execute("""
        UPDATE transactions
        SET price = 10225.0,
            total_amount = 245400.0
        WHERE id = 8
          AND price = 0
    """)

    # id=9: DBMF BUY, 16.95 shares — price derived from total/qty (source: Toss)
    # price = 720630.0 / 16.95 = 42515.04 (rounded to 2dp; price*qty ≈ total)
    op.execute("""
        UPDATE transactions
        SET price = 42515.04,
            total_amount = 720630.0
        WHERE id = 9
          AND price = 0
    """)

    # id=10: MSTR BUY, 2.88 shares — price derived from total/qty (source: Toss)
    op.execute("""
        UPDATE transactions
        SET price = 149686.81,
            total_amount = 431098.0
        WHERE id = 10
          AND price = 0
    """)

    # id=11: CSI300 SELL — SKIPPED. No Toss data available (sold before the
    # 3-month retention window). Price remains 0 pending manual retrieval.


def downgrade() -> None:
    # Reverse confirmed backfills; id=11 was never touched so no revert needed.
    op.execute("""
        UPDATE transactions
        SET price = 0,
            total_amount = 0
        WHERE id = 10
    """)

    op.execute("""
        UPDATE transactions
        SET price = 0,
            total_amount = 0
        WHERE id = 9
    """)

    op.execute("""
        UPDATE transactions
        SET price = 0,
            total_amount = 0
        WHERE id = 8
    """)

    op.execute("""
        UPDATE transactions
        SET price = 0,
            total_amount = 0
        WHERE id = 7
    """)
