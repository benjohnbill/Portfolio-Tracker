# ELT Price Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `PriceService.get_current_price()` from yfinance/FDR live calls to `RawDailyPrice` DB reads. Add sync backfill on new-symbol registration. No schema migration — existing ELT table reused. Outcome: request-path latency for `/api/portfolio/stress-test` and `POST /api/transactions` drops from 1-5s (per call) to <50ms (DB read).

**Architecture:** Three independent, individually-deployable steps:
1. `PriceService.get_current_price()` → DB read (signature gains `db: Session` argument)
2. `create_transaction` endpoint → sync backfill helper for newly-registered Assets
3. `/api/stress-test` + other callers → pass `db` through; audit no remaining live yfinance call in any read path

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend); pytest (sqlite C-track per `.claude/rules/testing.md`); no frontend changes.

**Acceptance criteria:**
- Mock `yfinance.Ticker` and `fdr.DataReader` to raise on any call. Run `/api/portfolio/stress-test` and `POST /api/transactions` (existing-asset case): MUST NOT raise — DB-only path. New-asset transaction can call yfinance (it's the backfill path).
- `pytest tests -q` shows ≥393 passed (current 388 + 5 new tests) + 1 pre-existing failure (`test_get_friday_sleeve_history_returns_zeros_when_no_reports`).
- All existing endpoints return same shape (no API contract breakage).
- Spec at `docs/superpowers/specs/2026-05-14-elt-price-migration.md` open-questions 1-5 each resolved.

---

## Decisions on the 5 open questions (from spec §7)

These were left open in the spec and are decided here in the plan. Plan reviewer can override any of them by editing this section and the corresponding step.

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | `PriceService` session pattern | Add `db: Session` as a positional argument to `get_current_price`; keep `@staticmethod`. | Smallest viable change. DI instance refactor is a larger architectural pivot, deferred. `SessionLocal` direct usage breaks dependency injection pattern used elsewhere. |
| 2 | DB miss policy | Caller-specific: `create_transaction` triggers sync backfill; `stress-test` returns 0.0 (existing behavior preserved); other callers raise `HTTPException(404)` to surface "symbol not yet ingested". | Policy lives in the caller, not the service. Service is pure DB read. |
| 3 | Sync/async backfill | Sync, 5s timeout. If timeout exceeded, transaction record is created anyway with `price_at_purchase` taken from yfinance live one-time fetch (not DB); historical backfill continues in background. | Sync gives users immediate historical chart. Timeout protects UX if yfinance is slow. |
| 4 | Staleness UI | Out of scope — no UI changes in this plan. Add `ingested_at` column to `RawDailyPrice` in a single Alembic migration in Step 1 so future UI can surface staleness. | Backend prepared; UI deferred. |
| 5 | Migration rollback | Each step is one commit. Rollback = `git revert <sha>`. No feature flag. Steps are backward-compatible at API level (response shapes unchanged). | Simple, solo-dev appropriate. |

---

## File Structure

### New files
- `backend/alembic/versions/<hash>_add_ingested_at_to_raw_daily_price.py` — Alembic migration for `ingested_at` column
- `backend/tests/test_price_service_db_read.py` — DB-read behavior tests for `get_current_price`
- `backend/tests/test_transaction_backfill.py` — new-symbol sync backfill flow tests

### Modified files
- `backend/app/models.py` — add `ingested_at: datetime` column to `RawDailyPrice`
- `backend/app/services/price_service.py` — rewrite `get_current_price` body; preserve signature additions
- `backend/app/services/ingestion_service.py` — add `backfill_single_symbol(db, asset)` helper
- `backend/app/main.py` — `create_transaction` handler integrates backfill; `stress-test` passes `db` through; any other `PriceService.get_current_price` callers updated
- `backend/tests/test_price_service.py` — update Task 1.2-era tests to match new signature (mock DB instead of yfinance)

### Files explicitly NOT changing
- `frontend/**` — zero changes
- `backend/app/services/portfolio_service.py` — calls `get_current_price` indirectly via other services; signature ripple from Step 1 propagates here only if it directly invokes `get_current_price` (audit during Step 1)
- `backend/app/services/macro_service.py`, `kis_service.py`, `exchange_service.py` — out of scope

---

## Phase 1 — Schema-prep + read-path migration

### Task 1.1: Add `ingested_at` column to `RawDailyPrice`

**Files:**
- Modify: `backend/app/models.py:50-54`
- Create: `backend/alembic/versions/<hash>_add_ingested_at_to_raw_daily_price.py`

**Background:** Spec §3.3 said "no schema changes," but decision #4 above adds one nullable column so future UI can surface staleness without another migration. Backward-compat: nullable, defaults to `now()` on row insert. Existing rows get NULL — that's fine, query path tolerates.

- [ ] **Step 1: Generate the alembic migration scaffold**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m alembic revision -m "add ingested_at to raw_daily_price"
```

Expected: new file at `backend/alembic/versions/<hash>_add_ingested_at_to_raw_daily_price.py`. Open it.

- [ ] **Step 2: Write the migration body**

In the new revision file, fill `upgrade()` / `downgrade()`:

```python
"""add ingested_at to raw_daily_price

Revision ID: <hash from alembic>
Revises: <down_revision filled by alembic — leave as generated>
Create Date: 2026-05-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "<hash>"
down_revision: Union[str, Sequence[str], None] = "<as generated>"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "raw_daily_prices",
        sa.Column("ingested_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("raw_daily_prices", "ingested_at")
```

- [ ] **Step 3: Add the column to the SQLAlchemy model**

Modify `backend/app/models.py:50-54`. Current state (from prior audit):

```python
class RawDailyPrice(Base):
    __tablename__ = "raw_daily_prices"
    date = Column(Date, primary_key=True)
    ticker = Column(String, primary_key=True)
    close_price = Column(Float)
```

Replace with:

```python
class RawDailyPrice(Base):
    __tablename__ = "raw_daily_prices"
    date = Column(Date, primary_key=True)
    ticker = Column(String, primary_key=True)
    close_price = Column(Float)
    ingested_at = Column(DateTime, nullable=True)
```

Ensure `from sqlalchemy import DateTime` is in the import block at top of file (it likely already is; verify).

- [ ] **Step 4: Test the migration round-trip on postgres D-track**

Per `.claude/rules/testing.md`, schema migrations must round-trip on real postgres (sqlite C-track uses `alembic stamp` and won't catch migration bugs).

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && \
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/portfolio_test \
  .venv/bin/python -m alembic upgrade head && \
  .venv/bin/python -m alembic downgrade -1 && \
  .venv/bin/python -m alembic upgrade head
```

> Setup for D-track: see `backend/tests/AGENTS.md`. If D-track docker is not running, start it first.

Expected: each step succeeds; no errors.

- [ ] **Step 5: Run full sqlite suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: same 388 passed + 1 pre-existing failure. New column is nullable so no test breaks.

- [ ] **Step 6: Update `ingestion_service.update_raw_prices` to populate `ingested_at`**

In `backend/app/services/ingestion_service.py`, find the insert statement (currently around lines 71-76 per prior audit; verify before editing). It uses postgres `on_conflict_do_update` upsert. Add `ingested_at=datetime.utcnow()` (or `sa.func.now()`) to both the insert values and the update set:

```python
stmt = insert(RawDailyPrice).values(
    date=row_date,
    ticker=symbol,
    close_price=close,
    ingested_at=datetime.utcnow(),
)
stmt = stmt.on_conflict_do_update(
    index_elements=["date", "ticker"],
    set_={"close_price": close, "ingested_at": datetime.utcnow()},
)
db.execute(stmt)
```

> Use the same `datetime.utcnow()` import the file already has (top of file).

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/versions/*_add_ingested_at_to_raw_daily_price.py backend/app/models.py backend/app/services/ingestion_service.py
git commit -m "feat(elt): add ingested_at to raw_daily_prices

Prep for ELT price migration. Nullable column; existing rows stay NULL.
Cron ingestion writes utcnow() on upsert. Used by future UI staleness
indicator."
```

---

### Task 1.2: Rewrite `PriceService.get_current_price` to DB read

**Files:**
- Modify: `backend/app/services/price_service.py:1-30`
- Create: `backend/tests/test_price_service_db_read.py`

**Background:** Current `get_current_price` calls yfinance/FDR live. Replace with DB query of `RawDailyPrice` most-recent row. Signature gains `db: Session`. Cache (`_PRICE_CACHE` from Task 1.2 of page-load plan) kept — but now caches DB read results, not yfinance results. Cache key unchanged.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_price_service_db_read.py`:

```python
from datetime import date, timedelta
from unittest.mock import patch
import pandas as pd
from app.models import RawDailyPrice
from app.services.price_service import PriceService, _PRICE_CACHE


def test_get_current_price_reads_from_raw_daily_price(db_session):
    _PRICE_CACHE.clear()
    today = date.today()
    db_session.add_all([
        RawDailyPrice(date=today - timedelta(days=2), ticker="AAA", close_price=100.0),
        RawDailyPrice(date=today - timedelta(days=1), ticker="AAA", close_price=110.0),
        RawDailyPrice(date=today, ticker="AAA", close_price=120.0),
    ])
    db_session.commit()

    # Patch yfinance to raise — if get_current_price calls it, test fails.
    with patch(
        "app.services.price_service.yf.Ticker",
        side_effect=AssertionError("get_current_price must not call yfinance"),
    ):
        price = PriceService.get_current_price(db_session, "AAA", "US")

    assert price == 120.0  # latest row


def test_get_current_price_returns_zero_for_unknown_symbol(db_session):
    _PRICE_CACHE.clear()
    price = PriceService.get_current_price(db_session, "UNKNOWN_TICKER", "US")
    assert price == 0.0


def test_get_current_price_uses_cache_on_second_call(db_session):
    _PRICE_CACHE.clear()
    db_session.add(RawDailyPrice(date=date.today(), ticker="BBB", close_price=50.0))
    db_session.commit()

    first = PriceService.get_current_price(db_session, "BBB", "US")
    # Mutate DB after the first call. Cache should still return the old value.
    db_session.query(RawDailyPrice).filter(RawDailyPrice.ticker == "BBB").update({"close_price": 999.0})
    db_session.commit()
    second = PriceService.get_current_price(db_session, "BBB", "US")

    assert first == 50.0
    assert second == 50.0  # cached
```

- [ ] **Step 2: Run tests — confirm fail**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_price_service_db_read.py -q
```

Expected: FAIL — `TypeError: get_current_price() missing 1 required positional argument: 'db'` OR FAIL on yfinance-not-called assertion (current code calls yfinance).

- [ ] **Step 3: Rewrite `get_current_price`**

Replace `backend/app/services/price_service.py:1-30` with:

```python
import yfinance as yf
import FinanceDataReader as fdr
from datetime import datetime, timedelta, date
from typing import Tuple, Dict
import pandas as pd
from sqlalchemy.orm import Session

from ..models import RawDailyPrice

# Module-level cache. Keyed by (symbol, source, ISO date).
# Day rollover invalidates automatically.
_PRICE_CACHE: Dict[Tuple[str, str, str], float] = {}


class PriceService:
    @staticmethod
    def get_current_price(db: Session, symbol: str, source: str = "US") -> float:
        """
        Returns the latest close price for `symbol` from RawDailyPrice.
        DB is source of truth — populated by the daily cron pipeline.
        Returns 0.0 when no row exists for the symbol.
        Caller decides how to handle 0.0 (e.g. trigger backfill).
        """
        cache_key = (symbol, source, date.today().isoformat())
        if cache_key in _PRICE_CACHE:
            return _PRICE_CACHE[cache_key]

        row = (
            db.query(RawDailyPrice)
            .filter(RawDailyPrice.ticker == symbol)
            .order_by(RawDailyPrice.date.desc())
            .first()
        )
        if row is None:
            return 0.0

        price = float(row.close_price)
        _PRICE_CACHE[cache_key] = price
        return price
```

Leave `get_historical_prices` (lines 32-65) unchanged — write-path service uses it and still needs yfinance.

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_price_service_db_read.py -q
```

Expected: PASS (3 tests).

- [ ] **Step 5: Update existing `test_price_service.py` for new signature**

The Task 1.2-era test in `backend/tests/test_price_service.py` mocks `yf.Ticker` and calls `get_current_price("FAKE", "US")` — both no longer valid (yfinance not called, signature gained `db`). Rewrite or delete that test. Since it's superseded by `test_price_service_db_read.py`, **delete the old test function** and keep the file empty or remove it entirely. Decide based on what else is in the file:

```bash
cat backend/tests/test_price_service.py
```

If the only test in the file is `test_get_current_price_caches_within_day`, delete the whole file:

```bash
rm backend/tests/test_price_service.py
```

If there are other tests, edit-out only that one function.

- [ ] **Step 6: Run full backend suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: **At least one regression** — at all callers of `get_current_price` (currently `main.py:276` and `main.py:448` per prior audit), the function is called without `db` argument. Note the failing tests; they'll be fixed in Task 1.3.

If more than the predicted callers fail, **stop** and report DONE_WITH_CONCERNS — there may be undiscovered call sites.

- [ ] **Step 7: Commit (with known callers broken — to be fixed in Task 1.3)**

```bash
git add backend/app/services/price_service.py backend/tests/test_price_service_db_read.py
git rm backend/tests/test_price_service.py  # if you deleted it
git commit -m "feat(elt): PriceService.get_current_price reads from RawDailyPrice

Signature gains db: Session argument. Callers updated in next commit.
Cache (Task 1.2 pattern) preserved — now caches DB reads."
```

> **This commit intentionally breaks `create_transaction` and `/api/stress-test` endpoints.** Task 1.3 is the immediate follow-up; do not deploy until Task 1.3 lands.

---

### Task 1.3: Update callers to pass `db`

**Files:**
- Modify: `backend/app/main.py` — `create_transaction` (~line 276), `get_stress_test` (~line 448)
- Modify: any other call sites discovered in Task 1.2 Step 6

- [ ] **Step 1: List all callers**

```bash
cd /home/lg/dev/Portfolio_Tracker && \
  grep -rn "PriceService.get_current_price" backend/app/ backend/tests/
```

Document the exact call sites in your scratchpad. The audit predicted 2 call sites (main.py:276, main.py:448). If you find more, note them — they all need the same signature update.

- [ ] **Step 2: Fix `create_transaction` (main.py around line 276)**

Read the current handler:

```bash
sed -n '230,300p' backend/app/main.py
```

The handler already has `db: Session = Depends(get_db)` in its signature. Change the `PriceService.get_current_price(asset.symbol, asset.source)` call to `PriceService.get_current_price(db, asset.symbol, asset.source)`. **Position the `db` argument first** to match the new signature.

> **Note**: This handler is also the new-symbol backfill site (Task 2.1). For now, just pass `db`. Backfill integration happens in Task 2.

- [ ] **Step 3: Fix `get_stress_test` (main.py around line 448)**

The handler already has `db: Session = Depends(get_db)`. The loop currently calls `PriceService.get_current_price(asset.symbol, asset.source)`. Change to `PriceService.get_current_price(db, asset.symbol, asset.source)`.

- [ ] **Step 4: Fix any other callers found in Step 1**

For each additional caller, ensure `db` is available (most are inside endpoint handlers with `Depends(get_db)` already; if not, add the dependency).

- [ ] **Step 5: Run the suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: back to 388 passed + 1 pre-existing failure, PLUS the 3 new tests in `test_price_service_db_read.py` = **391 passed + 1 pre-existing failure**.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(elt): pass db through to PriceService.get_current_price callers

create_transaction and stress-test handlers now route through the new
signature. yfinance live call eliminated from the read path."
```

---

## Phase 2 — New-symbol sync backfill

### Task 2.1: Add `backfill_single_symbol` helper

**Files:**
- Modify: `backend/app/services/ingestion_service.py`
- Create: `backend/tests/test_transaction_backfill.py`

**Background:** Spec §3.1 C and §4.4. When a user adds a new asset via `POST /api/transactions`, no historical price data exists in `RawDailyPrice` until the next daily cron. The new-symbol UX gap: chart is empty for ≤24h. Fix: trigger a one-shot ingestion for that symbol, sync, 5s timeout.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_transaction_backfill.py`:

```python
from unittest.mock import patch
import pandas as pd
from app.models import Asset, RawDailyPrice
from app.services.ingestion_service import PriceIngestionService


def test_backfill_single_symbol_writes_history(db_session):
    asset = Asset(symbol="NEWSYM", source="US", name="New Symbol")
    db_session.add(asset)
    db_session.commit()

    # Mock yfinance to return 5 days of fake history.
    fake_hist = pd.Series(
        [100.0, 101.0, 99.0, 102.0, 103.0],
        index=pd.date_range(end="2026-05-14", periods=5),
        name="Close",
    )
    with patch(
        "app.services.price_service.PriceService.get_historical_prices",
        return_value=fake_hist,
    ):
        PriceIngestionService.backfill_single_symbol(db_session, asset)

    rows = db_session.query(RawDailyPrice).filter(RawDailyPrice.ticker == "NEWSYM").all()
    assert len(rows) == 5
    assert max(r.close_price for r in rows) == 103.0
```

- [ ] **Step 2: Run — confirm fail (`AttributeError`)**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_transaction_backfill.py::test_backfill_single_symbol_writes_history -q
```

Expected: FAIL — `AttributeError: type object 'PriceIngestionService' has no attribute 'backfill_single_symbol'`.

- [ ] **Step 3: Implement the helper**

In `backend/app/services/ingestion_service.py`, add a new staticmethod (after the existing `update_raw_prices`):

```python
@staticmethod
def backfill_single_symbol(db: Session, asset: Asset, years_back: int = 3) -> int:
    """
    One-shot ingestion of historical prices for a single asset.
    Used when a new asset is registered via POST /api/transactions to
    avoid waiting for the next daily cron.
    Returns the number of rows upserted. 5-second soft budget — caller
    enforces timeout.
    """
    from datetime import date, timedelta
    end_date = date.today()
    start_date = end_date - timedelta(days=years_back * 365)

    hist = PriceService.get_historical_prices(
        asset.symbol,
        start_date.isoformat(),
        end_date.isoformat(),
        source=asset.source,
    )

    if hist is None or hist.empty:
        return 0

    inserted = 0
    for ts, close in hist.items():
        row_date = ts.date() if hasattr(ts, "date") else ts
        stmt = insert(RawDailyPrice).values(
            date=row_date,
            ticker=asset.symbol,
            close_price=float(close),
            ingested_at=datetime.utcnow(),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["date", "ticker"],
            set_={"close_price": float(close), "ingested_at": datetime.utcnow()},
        )
        db.execute(stmt)
        inserted += 1
    db.commit()
    return inserted
```

> Ensure `PriceService`, `RawDailyPrice`, `insert`, `Session`, `datetime` are imported at top of the file (they likely are from existing `update_raw_prices` body — verify).

- [ ] **Step 4: Run — confirm pass**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_transaction_backfill.py -q
```

Expected: PASS.

- [ ] **Step 5: Run full suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 392 passed + 1 pre-existing failure.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/ingestion_service.py backend/tests/test_transaction_backfill.py
git commit -m "feat(elt): backfill_single_symbol helper for new-asset ingestion

Pulls 3y of historical prices for one symbol on demand; upserts to
RawDailyPrice. Wired into create_transaction in the next commit."
```

---

### Task 2.2: Wire backfill into `create_transaction`

**Files:**
- Modify: `backend/app/main.py` — `create_transaction` handler (~line 234-300)
- Modify: `backend/tests/test_transaction_backfill.py` — add end-to-end test

**Background:** When `create_transaction` creates a new `Asset`, call `backfill_single_symbol` sync with 5s timeout. If timeout, fall back to one-time yfinance fetch for the `price_at_purchase` only, leaving historical backfill incomplete (next cron picks up).

- [ ] **Step 1: Write end-to-end test**

Append to `backend/tests/test_transaction_backfill.py`:

```python
from fastapi.testclient import TestClient
from app.main import app


def test_create_transaction_backfills_new_asset(db_session, client):
    fake_hist = pd.Series(
        [200.0, 210.0, 220.0],
        index=pd.date_range(end="2026-05-14", periods=3),
        name="Close",
    )
    with patch(
        "app.services.price_service.PriceService.get_historical_prices",
        return_value=fake_hist,
    ):
        response = client.post("/api/transactions", json={
            "symbol": "FRESHASSET",
            "type": "BUY",
            "quantity": 1,
            "date": "2026-05-14",
        })

    assert response.status_code in (200, 201)
    rows = db_session.query(RawDailyPrice).filter(RawDailyPrice.ticker == "FRESHASSET").all()
    assert len(rows) == 3  # backfill ran
```

If the project's `conftest.py` doesn't expose a `client` fixture, instantiate `TestClient(app)` directly inside the test and override `get_db` dependency.

- [ ] **Step 2: Run — confirm fail**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_transaction_backfill.py::test_create_transaction_backfills_new_asset -q
```

Expected: FAIL — assertion `len(rows) == 3` fails (no backfill wired yet).

- [ ] **Step 3: Wire backfill into the handler**

In `backend/app/main.py`, find the `create_transaction` handler. Around the place where a new `Asset` is committed (per prior audit, around line 234-254), add:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor, TimeoutError

# ... inside the handler, after a new Asset is committed and before the
# price-fetch-or-record path ...

if newly_created_asset:
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(
                PriceIngestionService.backfill_single_symbol, db, asset
            )
            future.result(timeout=5.0)
    except TimeoutError:
        # Backfill exceeded 5s. Continue with transaction creation;
        # next daily cron will fill the gap.
        pass
    except Exception as e:
        # Non-fatal — log and continue.
        logger.warning("backfill_single_symbol failed", exc_info=e)
```

> `newly_created_asset` is the boolean flag the handler already maintains (it currently determines whether to call `sync_asset_classification`). If it doesn't exist as a single flag, derive it: `newly_created_asset = (asset.id is None at start) or check via separate query before commit`.

> Read the current `create_transaction` code carefully before this step. The exact integration point depends on the current structure.

- [ ] **Step 4: Run — confirm pass**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_transaction_backfill.py -q
```

Expected: PASS.

- [ ] **Step 5: Run full suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 393 passed + 1 pre-existing failure.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_transaction_backfill.py
git commit -m "feat(elt): create_transaction triggers sync backfill on new symbol

5s timeout; on timeout or failure, transaction is still created and
the daily cron picks up the gap. Removes the 'empty chart until tomorrow'
new-asset UX gap."
```

---

## Phase 3 — Audit + verify

### Task 3.1: Audit all read-path live API calls

**Files:**
- Create: `backend/tests/test_no_live_api_in_read_path.py` — guard test

**Background:** Ensures no future PR reintroduces yfinance/FDR in a read path. Test patches yfinance to raise; if any read-path endpoint calls it, test fails.

- [ ] **Step 1: Write the guard test**

Create `backend/tests/test_no_live_api_in_read_path.py`:

```python
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.models import Asset, Transaction, RawDailyPrice
from datetime import date


def test_stress_test_no_yfinance_call(db_session, client):
    """The /api/stress-test endpoint must not call yfinance.
    DB is source of truth."""
    a = Asset(symbol="GUARD1", source="US", name="Guard 1")
    db_session.add(a)
    db_session.commit()
    db_session.add(Transaction(asset_id=a.id, type="BUY", quantity=10, price=100.0))
    db_session.add(RawDailyPrice(date=date.today(), ticker="GUARD1", close_price=100.0))
    db_session.commit()

    with patch(
        "app.services.price_service.yf.Ticker",
        side_effect=AssertionError("read path called yfinance"),
    ), patch(
        "app.services.price_service.fdr.DataReader",
        side_effect=AssertionError("read path called fdr"),
    ), patch(
        "app.services.stress_service.yf.download",
        side_effect=AssertionError("stress service called yfinance"),
    ):
        response = client.get("/api/stress-test")

    # Endpoint may return data or empty list, but MUST NOT raise.
    assert response.status_code == 200


def test_create_transaction_existing_asset_no_yfinance_call(db_session, client):
    """POST /api/transactions for an existing asset must not call yfinance
    (only new-asset case triggers backfill)."""
    a = Asset(symbol="GUARD2", source="US", name="Guard 2")
    db_session.add(a)
    db_session.add(RawDailyPrice(date=date.today(), ticker="GUARD2", close_price=50.0))
    db_session.commit()

    with patch(
        "app.services.price_service.yf.Ticker",
        side_effect=AssertionError("existing-asset transaction called yfinance"),
    ):
        response = client.post("/api/transactions", json={
            "symbol": "GUARD2",
            "type": "BUY",
            "quantity": 5,
            "date": "2026-05-14",
        })
    assert response.status_code in (200, 201)
```

- [ ] **Step 2: Run — confirm pass (if Phase 1 + Phase 2 are correctly land)**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_no_live_api_in_read_path.py -q
```

Expected: PASS.

If FAIL: trace the assertion message. It tells you exactly which yfinance/fdr/yf.download path the read path still hits. Fix that path (usually a missed caller).

- [ ] **Step 3: Run full suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 395 passed + 1 pre-existing failure.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_no_live_api_in_read_path.py
git commit -m "test(elt): guard against future regressions

Asserts neither stress-test nor existing-asset transactions trigger
yfinance/fdr in the read path."
```

---

### Task 3.2: Deploy + post-deploy measurement

**Files:**
- Create: `docs/superpowers/measurements/2026-05-XX-elt-after.md` (XX = deploy date)

- [ ] **Step 1: Push main**

```bash
git push origin main
```

Render auto-deploys. Wait ~3 min, then verify warm via `/api/healthz`.

- [ ] **Step 2: Re-measure same 4 pages**

Replicate the Phase 4 measurement procedure from the page-load plan (`2026-05-13-page-load-3s-budget.md` Phase 4 Task 4.1). chrome-devtools MCP + curl. Same 4 pages, same 9 endpoints.

Expected changes vs `2026-05-13-page-load-after.md`:

- `/api/stress-test` ms: previously 4433/2821 cold + 2072/1869/2076 follow-up. **After ELT: <100ms steady-state** (DB read only).
- `/portfolio?period=1y` Complete: previously 4082ms cold. **After ELT: <2s** (StressTestWidget cold contribution eliminated).
- All other endpoints: unchanged or marginal improvement.

- [ ] **Step 3: Write `2026-05-XX-elt-after.md`**

Schema same as `2026-05-13-page-load-after.md`. Add Δ vs both baseline and page-load-after.

- [ ] **Step 4: Commit + push**

```bash
git add docs/superpowers/measurements/*.md
git commit -m "docs(elt): post-deploy measurement after ELT migration"
git push origin main
```

---

## Self-Review

1. **Spec coverage**
   - PriceService → DB read: Task 1.2 ✓
   - Caller updates: Task 1.3 ✓
   - New-symbol backfill: Task 2.1 + 2.2 ✓
   - Guard against regression: Task 3.1 ✓
   - Verification: Task 3.2 ✓
   - All 5 open-questions decided in plan §Decisions ✓
   - Schema change for staleness UI prep: Task 1.1 (the one departure from spec's "no schema changes" — documented and justified) ✓

2. **Placeholders** — none.

3. **Type / signature consistency**
   - `PriceService.get_current_price(db, symbol, source)` — `db` first param, matches all caller updates ✓
   - `backfill_single_symbol(db, asset, years_back)` — signature consistent across helper + caller + tests ✓
   - `RawDailyPrice.ingested_at` — added in migration AND model AND ingestion service write path ✓

4. **Out of scope (intentional, deferred)**
   - macro_service ELT (separate plan: macro daily warm-up)
   - kis_service ELT (covered by option C memory cache)
   - Staleness UI surface (`ingested_at` available; UI integration follow-up)
   - IA Phase 1 atom_card data_contract resolution (separate plan)
   - `PriceService` to DI instance (deferred per decision #1)
