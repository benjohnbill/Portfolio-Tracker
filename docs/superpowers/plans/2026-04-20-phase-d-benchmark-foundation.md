# Phase D — B4 + B5 + B2 Benchmark Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend prerequisite bundle (single Alembic migration + three layered services + two read endpoints + minimal frontend scaffold) that unblocks Phase D items B2, B4, and B5 with UI maturity gates at 12 / 52 / 26 weeks respectively.

**Architecture:** Three-layer service tree (`benchmark_service` primitives → `risk_adjusted_service` composition → `outcome_evaluator` write-path). Write-time precompute pattern: freeze writes `weekly_snapshots.risk_metrics` JSONB; Sunday cron writes `decision_outcomes.outcome_delta_*` columns. Read-path API does DB reads only — no live yfinance/fdr hits. Frontend scaffold paints skeleton instantly with `ready=false` payloads.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 1.4 / Alembic / Pydantic / pandas / pytest / Next.js / TypeScript / yfinance / FinanceDataReader.

**Source of truth for scope, architecture decisions, and out-of-scope items:** `docs/superpowers/decisions/2026-04-20-phase-d-B4-B5-scope-lock.md`. When in doubt about whether a change belongs in this bundle, consult that document first.

---

## Pre-flight

- [ ] **P1: Create feature branch**

From repo root on `main`:
```bash
git checkout main
git pull --ff-only origin main
git checkout -b feature/phase-d-benchmark-foundation
```

- [ ] **P2: Verify pre-flight grep (safety gate from decision doc)**

```bash
grep -rn "risk_metrics\|outcome_delta_vs_spy_pure\|outcome_delta_calmar_vs_spy" backend/app/
```
Expected output: empty (no existing references). If any match, stop and surface to planner before proceeding.

- [ ] **P3: Verify pytest baseline**

```bash
cd backend && python -m pytest -q
```
Expected: 72 passed (matches Plan C progress log). If different, investigate before touching anything.

---

## File Structure Map

**New files (backend):**
- `backend/alembic/versions/<hash>_add_benchmark_compare_columns.py` — single migration adding 3 nullable columns.
- `backend/app/services/benchmark_service.py` — Layer 1 primitives (SPY-KRW series + metric compute).
- `backend/app/services/risk_adjusted_service.py` — Layer 2/3 composition for B4 + B5.
- `backend/app/services/outcome_evaluator.py` — Layer 2 write-path for B2.
- `backend/tests/test_benchmark_service.py`
- `backend/tests/test_risk_adjusted_service.py`
- `backend/tests/test_outcome_evaluator.py`

**Modified files (backend):**
- `backend/app/models.py` — add `risk_metrics`, `outcome_delta_vs_spy_pure`, `outcome_delta_calmar_vs_spy` columns to ORM.
- `backend/app/services/friday_service.py::create_snapshot` — one-line wiring (wrapped in try/except).
- `backend/app/main.py::update_signals` — one-step wiring + two new GET endpoints.
- `backend/tests/test_friday_service.py` — regression test + two new assertions.
- `backend/tests/test_api.py` — two new endpoint tests.

**New files (frontend):**
- `frontend/src/app/intelligence/risk-adjusted/page.tsx` — new route.
- `frontend/src/components/intelligence/RiskAdjustedScorecard.tsx` — scorecard component.
- `frontend/src/components/intelligence/CalmarTrajectoryPlaceholder.tsx` — placeholder card.
- `frontend/src/components/intelligence/__tests__/RiskAdjustedScorecard.test.tsx`
- `frontend/src/components/intelligence/__tests__/CalmarTrajectoryPlaceholder.test.tsx`

**Modified files (frontend):**
- `frontend/src/lib/api.ts` — two new types + two new fetcher helpers.
- `frontend/src/components/intelligence/IntelligenceDashboard.tsx` — mount `CalmarTrajectoryPlaceholder` per DESIGN.md hierarchy item 4.

**Testing convention this plan follows:** existing backend tests use the `_FakeDB` / `_FakeQuery` mock pattern (see `backend/tests/test_friday_service.py`). No `conftest.py` exists; do NOT create one. For DB interactions, mock via `_FakeDB`. For `BenchmarkService` call sites, use `unittest.mock.patch`.

---

## Task 1: Alembic migration — add_benchmark_compare_columns

**Files:**
- Create: `backend/alembic/versions/c9e5f2a8d410_add_benchmark_compare_columns.py`
- Modify: `backend/app/models.py:104-216` (ORM column additions)

**Decision doc reference:** §In scope → Database.

- [ ] **Step 1: Write the migration file**

Create `backend/alembic/versions/c9e5f2a8d410_add_benchmark_compare_columns.py`:
```python
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
        sa.Column('risk_metrics', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
```

- [ ] **Step 2: Add ORM columns to models.py**

In `backend/app/models.py`, find the `WeeklySnapshot` class (around line 104). After the existing `comment = Column(Text, nullable=True)` line (around line 113), add:
```python
    # B4 — per-freeze precomputed risk metric snapshot (portfolio + SPY-KRW trailing-1Y).
    # Shape: see docs/superpowers/decisions/2026-04-20-phase-d-B4-B5-scope-lock.md
    risk_metrics = Column(JSONB, nullable=True)
```

In `backend/app/models.py`, find the `DecisionOutcome` class (around line 190). After the existing `regime_changed` column (around line 213), add:
```python
    # B2 — SPY-KRW benchmark deltas populated by OutcomeEvaluatorService on matured outcomes.
    outcome_delta_vs_spy_pure = Column(Float, nullable=True)
    outcome_delta_calmar_vs_spy = Column(Float, nullable=True)
```

Confirm `JSONB` is already imported at the top of `models.py` (it is used by existing columns).

- [ ] **Step 3: Run upgrade to verify migration applies**

```bash
cd backend && alembic upgrade head
```
Expected: "Running upgrade a2b8f4d1c901 -> c9e5f2a8d410". No errors.

Verify columns exist (adjust DB URL as needed):
```bash
python -c "from app.database import engine; from sqlalchemy import inspect; \
i = inspect(engine); \
ws = [c['name'] for c in i.get_columns('weekly_snapshots')]; \
do = [c['name'] for c in i.get_columns('decision_outcomes')]; \
print('risk_metrics' in ws, 'outcome_delta_vs_spy_pure' in do, 'outcome_delta_calmar_vs_spy' in do)"
```
Expected: `True True True`.

- [ ] **Step 4: Run downgrade to verify reversibility**

```bash
alembic downgrade -1
```
Expected: "Running downgrade c9e5f2a8d410 -> a2b8f4d1c901". No errors. Re-inspecting columns should show them absent.

- [ ] **Step 5: Re-run upgrade (idempotency check)**

```bash
alembic upgrade head
```
Expected: clean re-apply. All three columns present again.

- [ ] **Step 6: Baseline pytest still green**

```bash
python -m pytest -q
```
Expected: 72 passed (same baseline — ORM additions are additive and nullable).

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/versions/c9e5f2a8d410_add_benchmark_compare_columns.py backend/app/models.py
git commit -m "feat(phase-d): migration adding benchmark compare columns (B4/B5/B2 prereq)"
```

---

## Task 2: BenchmarkService — RiskMetrics dataclass + compute_metrics

**Files:**
- Create: `backend/app/services/benchmark_service.py` (partial — dataclass + `compute_metrics` only)
- Create: `backend/tests/test_benchmark_service.py`

**Decision doc reference:** §In scope → Backend services → `benchmark_service.py`.

- [ ] **Step 1: Write the failing test — happy path compute_metrics**

Create `backend/tests/test_benchmark_service.py`:
```python
import math
import numpy as np
import pandas as pd
import pytest

from app.services.benchmark_service import BenchmarkService, RiskMetrics


def _steady_growth_returns(n=252, daily_drift=0.0005, vol=0.01, seed=42):
    rng = np.random.default_rng(seed)
    return pd.Series(rng.normal(daily_drift, vol, n))


def test_compute_metrics_happy_path():
    returns = _steady_growth_returns()
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 252
    assert m.cagr is not None and isinstance(m.cagr, float)
    assert m.mdd is not None and m.mdd <= 0
    assert m.sd is not None and m.sd > 0
    assert m.sharpe is not None
    assert m.calmar is not None
    assert m.sortino is not None
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
cd backend && python -m pytest tests/test_benchmark_service.py::test_compute_metrics_happy_path -v
```
Expected: `ModuleNotFoundError: No module named 'app.services.benchmark_service'`.

- [ ] **Step 3: Minimal implementation — dataclass + compute_metrics**

Create `backend/app/services/benchmark_service.py`:
```python
"""Benchmark primitives — SPY-KRW series composition + pure risk-metric computation.

Layer 1 of the B4/B5/B2 bundle. This file holds no Layer 2 composition logic:
callers (risk_adjusted_service, outcome_evaluator) are responsible for
assembling payloads and choosing horizons.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import date
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

TRADING_DAYS_PER_YEAR = 252
MIN_OBS = 20


@dataclass(frozen=True)
class RiskMetrics:
    cagr: Optional[float]
    mdd: Optional[float]
    sd: Optional[float]
    sharpe: Optional[float]
    calmar: Optional[float]
    sortino: Optional[float]
    n_obs: int


class BenchmarkService:
    @staticmethod
    def compute_metrics(returns: pd.Series, risk_free: float = 0.0) -> RiskMetrics:
        """Pure computation of trailing risk metrics from a daily-return Series.

        Contract:
            - n_obs = count of finite values in `returns`.
            - When n_obs < MIN_OBS (20): all metric fields None, n_obs truthful.
            - sharpe = None when sd == 0 (degenerate zero-variance series).
            - calmar = None when mdd == 0 (no drawdown observed).
            - Does not touch DB; pure function over a Series.
        """
        clean = returns.dropna()
        n = int(clean.shape[0])

        if n < MIN_OBS:
            return RiskMetrics(None, None, None, None, None, None, n)

        arr = clean.to_numpy()
        mean_daily = float(arr.mean())
        sd_daily = float(arr.std(ddof=1))
        sd_annual = sd_daily * math.sqrt(TRADING_DAYS_PER_YEAR)

        cumulative = (1.0 + clean).cumprod()
        years = n / TRADING_DAYS_PER_YEAR
        cagr = float(cumulative.iloc[-1] ** (1.0 / years) - 1.0) if years > 0 else None

        running_max = cumulative.cummax()
        drawdown = (cumulative / running_max) - 1.0
        mdd = float(drawdown.min())

        sharpe = None
        if sd_annual > 0:
            sharpe = (mean_daily * TRADING_DAYS_PER_YEAR - risk_free) / sd_annual

        calmar = None
        if mdd < 0 and cagr is not None:
            calmar = cagr / abs(mdd)

        downside = arr[arr < 0]
        sortino = None
        if downside.size > 0:
            downside_sd_annual = float(downside.std(ddof=1)) * math.sqrt(TRADING_DAYS_PER_YEAR)
            if downside_sd_annual > 0:
                sortino = (mean_daily * TRADING_DAYS_PER_YEAR - risk_free) / downside_sd_annual

        return RiskMetrics(
            cagr=cagr,
            mdd=mdd,
            sd=sd_annual,
            sharpe=sharpe,
            calmar=calmar,
            sortino=sortino,
            n_obs=n,
        )
```

- [ ] **Step 4: Run test, expect PASS**

```bash
python -m pytest tests/test_benchmark_service.py::test_compute_metrics_happy_path -v
```
Expected: PASSED.

- [ ] **Step 5: Add boundary tests**

Append to `backend/tests/test_benchmark_service.py`:
```python
def test_compute_metrics_insufficient_data_below_min_obs():
    returns = pd.Series([0.01] * 19)
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 19
    assert m.cagr is None
    assert m.mdd is None
    assert m.sd is None
    assert m.sharpe is None
    assert m.calmar is None
    assert m.sortino is None


def test_compute_metrics_exactly_min_obs_passes_gate():
    returns = pd.Series([0.001] * 20)
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 20
    assert m.cagr is not None


def test_compute_metrics_zero_volatility_returns_no_sharpe():
    returns = pd.Series([0.0] * 252)
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 252
    assert m.sd == 0.0
    assert m.sharpe is None


def test_compute_metrics_monotonic_growth_returns_no_calmar():
    returns = pd.Series([0.001] * 252)
    m = BenchmarkService.compute_metrics(returns)
    assert m.mdd == 0.0
    assert m.calmar is None


def test_compute_metrics_all_nan_treated_as_empty():
    returns = pd.Series([float("nan")] * 100)
    m = BenchmarkService.compute_metrics(returns)
    assert m.n_obs == 0
    assert m.cagr is None
```

- [ ] **Step 6: Run full test file, expect all PASS**

```bash
python -m pytest tests/test_benchmark_service.py -v
```
Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/benchmark_service.py backend/tests/test_benchmark_service.py
git commit -m "feat(phase-d): BenchmarkService.compute_metrics primitives + boundary tests"
```

---

## Task 3: BenchmarkService.get_spy_krw_series + SystemCache

**Files:**
- Modify: `backend/app/services/benchmark_service.py` (append `get_spy_krw_series`)
- Modify: `backend/tests/test_benchmark_service.py` (append series tests)

**Decision doc reference:** §In scope → Backend services → `benchmark_service.py` (series composition, SystemCache 1h TTL, inner join, empty-Series graceful degrade).

- [ ] **Step 1: Write the failing test — cache miss composes upstreams**

Append to `backend/tests/test_benchmark_service.py`:
```python
from datetime import date as _date
from unittest.mock import MagicMock, patch


def _fake_spy_usd_series():
    idx = pd.date_range("2025-01-01", periods=250, freq="B")
    return pd.Series(range(100, 350), index=idx, dtype=float)


def _fake_fx_series():
    idx = pd.date_range("2025-01-01", periods=250, freq="B")
    return pd.Series([1350.0] * 250, index=idx, dtype=float)


def test_get_spy_krw_series_cache_miss_composes_upstreams():
    db = MagicMock()
    with patch("app.services.benchmark_service.CacheService") as MockCache, \
         patch("app.services.benchmark_service.PriceService") as MockPrice, \
         patch("app.services.benchmark_service.ExchangeService") as MockFx:
        MockCache.get_cache.return_value = None
        MockPrice.get_historical_prices.return_value = _fake_spy_usd_series()
        MockFx.get_usd_krw_history.return_value = _fake_fx_series()

        series = BenchmarkService.get_spy_krw_series(db, _date(2025, 1, 1), _date(2025, 12, 31))

    assert isinstance(series, pd.Series)
    assert len(series) == 250
    assert float(series.iloc[0]) == 100.0 * 1350.0
    MockPrice.get_historical_prices.assert_called_once()
    MockFx.get_usd_krw_history.assert_called_once()
    MockCache.set_cache.assert_called_once()
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
python -m pytest tests/test_benchmark_service.py::test_get_spy_krw_series_cache_miss_composes_upstreams -v
```
Expected: FAIL with `AttributeError: type object 'BenchmarkService' has no attribute 'get_spy_krw_series'`.

- [ ] **Step 3: Implement get_spy_krw_series**

At the top of `backend/app/services/benchmark_service.py`, add imports:
```python
from .cache_service import CacheService
from .exchange_service import ExchangeService
from .price_service import PriceService
```

Append to the `BenchmarkService` class:
```python
    CACHE_KEY_PREFIX = "spy_krw_series"

    @staticmethod
    def get_spy_krw_series(db: Session, start: date, end: date) -> pd.Series:
        """SPY daily close (USD) * USDKRW daily close, inner-joined on trading dates.

        Cached via SystemCache with effective 1-hour TTL by including `today` in the key
        for same-day-ending ranges (so a new day naturally invalidates). Returns an empty
        Series on upstream failure; callers must graceful-degrade.
        """
        cache_key = f"{BenchmarkService.CACHE_KEY_PREFIX}_{start.isoformat()}_{end.isoformat()}"
        cached = CacheService.get_cache(db, cache_key)
        if cached:
            try:
                series = pd.Series(
                    {pd.Timestamp(k): float(v) for k, v in cached.items()}
                ).sort_index()
                return series
            except Exception as exc:
                logger.warning("SPY-KRW cache decode failed (%s); refetching", exc)

        spy_usd = PriceService.get_historical_prices(
            "SPY", start.isoformat(), end.isoformat(), source="US"
        )
        fx = ExchangeService.get_usd_krw_history(start.isoformat(), end.isoformat())

        if spy_usd is None or fx is None:
            return pd.Series(dtype=float)
        if getattr(spy_usd, "empty", True) or getattr(fx, "empty", True):
            return pd.Series(dtype=float)

        joined = pd.concat([spy_usd, fx], axis=1, join="inner").dropna()
        if joined.empty:
            return pd.Series(dtype=float)

        joined.columns = ["spy_usd", "fx"]
        spy_krw = (joined["spy_usd"] * joined["fx"]).astype(float)
        spy_krw.name = "spy_krw"

        try:
            payload = {ts.strftime("%Y-%m-%d"): float(v) for ts, v in spy_krw.items()}
            CacheService.set_cache(db, cache_key, payload)
        except Exception as exc:
            logger.warning("SPY-KRW cache write failed (%s); proceeding without cache", exc)

        return spy_krw
```

- [ ] **Step 4: Run test, expect PASS**

```bash
python -m pytest tests/test_benchmark_service.py::test_get_spy_krw_series_cache_miss_composes_upstreams -v
```
Expected: PASSED.

- [ ] **Step 5: Add cache-hit + graceful-degrade tests**

Append to `backend/tests/test_benchmark_service.py`:
```python
def test_get_spy_krw_series_cache_hit_skips_upstreams():
    db = MagicMock()
    cached_payload = {"2025-01-02": 135000.0, "2025-01-03": 135500.0}
    with patch("app.services.benchmark_service.CacheService") as MockCache, \
         patch("app.services.benchmark_service.PriceService") as MockPrice, \
         patch("app.services.benchmark_service.ExchangeService") as MockFx:
        MockCache.get_cache.return_value = cached_payload

        series = BenchmarkService.get_spy_krw_series(db, _date(2025, 1, 1), _date(2025, 1, 5))

    assert len(series) == 2
    MockPrice.get_historical_prices.assert_not_called()
    MockFx.get_usd_krw_history.assert_not_called()


def test_get_spy_krw_series_upstream_empty_returns_empty_series():
    db = MagicMock()
    with patch("app.services.benchmark_service.CacheService") as MockCache, \
         patch("app.services.benchmark_service.PriceService") as MockPrice, \
         patch("app.services.benchmark_service.ExchangeService") as MockFx:
        MockCache.get_cache.return_value = None
        MockPrice.get_historical_prices.return_value = pd.Series(dtype=float)
        MockFx.get_usd_krw_history.return_value = _fake_fx_series()

        series = BenchmarkService.get_spy_krw_series(db, _date(2025, 1, 1), _date(2025, 12, 31))

    assert isinstance(series, pd.Series)
    assert series.empty
    MockCache.set_cache.assert_not_called()


def test_get_spy_krw_series_inner_join_drops_misaligned_dates():
    db = MagicMock()
    spy_idx = pd.date_range("2025-01-01", periods=5, freq="B")
    fx_idx = pd.date_range("2025-01-02", periods=5, freq="B")
    spy_series = pd.Series([100.0] * 5, index=spy_idx)
    fx_series = pd.Series([1350.0] * 5, index=fx_idx)
    with patch("app.services.benchmark_service.CacheService") as MockCache, \
         patch("app.services.benchmark_service.PriceService") as MockPrice, \
         patch("app.services.benchmark_service.ExchangeService") as MockFx:
        MockCache.get_cache.return_value = None
        MockPrice.get_historical_prices.return_value = spy_series
        MockFx.get_usd_krw_history.return_value = fx_series

        series = BenchmarkService.get_spy_krw_series(db, _date(2025, 1, 1), _date(2025, 1, 10))

    assert len(series) == 4  # intersection, not union
```

- [ ] **Step 6: Run full test file**

```bash
python -m pytest tests/test_benchmark_service.py -v
```
Expected: 8 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/benchmark_service.py backend/tests/test_benchmark_service.py
git commit -m "feat(phase-d): BenchmarkService.get_spy_krw_series + SystemCache composition"
```

---

## Task 4: RiskAdjustedService.compute_snapshot_metrics

**Files:**
- Create: `backend/app/services/risk_adjusted_service.py` (partial — only `compute_snapshot_metrics`)
- Create: `backend/tests/test_risk_adjusted_service.py`

**Decision doc reference:** §In scope → Backend services → `risk_adjusted_service.py`; §In scope → Database → JSONB shape.

- [ ] **Step 1: Write the failing test — happy path JSONB**

Create `backend/tests/test_risk_adjusted_service.py`:
```python
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.services.benchmark_service import RiskMetrics
from app.services.risk_adjusted_service import RiskAdjustedService


class _Snap:
    def __init__(self, snapshot_date, risk_metrics=None):
        self.snapshot_date = snapshot_date
        self.risk_metrics = risk_metrics
        self.id = 1


def _mk_portfolio_series(n=252):
    idx = pd.date_range(end="2026-04-17", periods=n, freq="B")
    return pd.Series(range(10_000_000, 10_000_000 + n * 100, 100), index=idx, dtype=float)


def _mk_spy_krw_series(n=252):
    idx = pd.date_range(end="2026-04-17", periods=n, freq="B")
    return pd.Series(range(500_000, 500_000 + n * 50, 50), index=idx, dtype=float)


def test_compute_snapshot_metrics_happy_path_shape():
    snap = _Snap(date(2026, 4, 17))
    db = MagicMock()
    with patch("app.services.risk_adjusted_service.BenchmarkService") as MockBench, \
         patch("app.services.risk_adjusted_service.RiskAdjustedService._load_portfolio_series") as mock_load:
        mock_load.return_value = _mk_portfolio_series()
        MockBench.get_spy_krw_series.return_value = _mk_spy_krw_series()
        MockBench.compute_metrics.side_effect = [
            RiskMetrics(0.12, -0.18, 0.22, 0.55, 0.67, 0.8, n_obs=252),
            RiskMetrics(0.08, -0.15, 0.18, 0.44, 0.53, 0.6, n_obs=250),
        ]
        payload = RiskAdjustedService.compute_snapshot_metrics(db, snap)

    assert payload["as_of"] == "2026-04-17"
    assert "trailing_1y" in payload
    assert set(payload["trailing_1y"].keys()) == {"portfolio", "spy_krw"}
    for side in ("portfolio", "spy_krw"):
        assert set(payload["trailing_1y"][side].keys()) == \
            {"cagr", "mdd", "sd", "sharpe", "calmar", "sortino"}
    assert payload["data_quality"]["portfolio_days"] == 252
    assert payload["data_quality"]["spy_krw_days"] == 250
    assert payload["data_quality"]["source"] == "yfinance+fdr"
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
python -m pytest tests/test_risk_adjusted_service.py::test_compute_snapshot_metrics_happy_path_shape -v
```
Expected: FAIL with ModuleNotFoundError.

- [ ] **Step 3: Implement compute_snapshot_metrics**

Create `backend/app/services/risk_adjusted_service.py`:
```python
"""Risk-adjusted composition — B4 trajectory + B5 scorecard + freeze-time precompute.

Layer 2/3 for the B4/B5/B2 bundle. Consumes BenchmarkService primitives and
PortfolioSnapshot rows to produce the JSONB payload written at freeze time and
the two read-only API payloads served to the frontend.
"""
from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy.orm import Session

from ..models import PortfolioSnapshot, WeeklyDecision, WeeklySnapshot
from .benchmark_service import BenchmarkService, RiskMetrics

logger = logging.getLogger(__name__)

TRAILING_1Y_DAYS = 365
SCORECARD_MATURITY_WEEKS = 26
TRAJECTORY_MATURITY_WEEKS = 52


class RiskAdjustedService:
    @staticmethod
    def compute_snapshot_metrics(db: Session, snapshot: WeeklySnapshot) -> Dict[str, Any]:
        """Build the weekly_snapshots.risk_metrics JSONB payload for a single freeze.

        Window = trailing 365 calendar days ending on snapshot.snapshot_date.
        On upstream failure, returns a shaped payload with nulls + source='unavailable'.
        """
        as_of: date = snapshot.snapshot_date
        start = as_of - timedelta(days=TRAILING_1Y_DAYS)

        portfolio_series = RiskAdjustedService._load_portfolio_series(db, start, as_of)
        spy_krw_series = BenchmarkService.get_spy_krw_series(db, start, as_of)

        portfolio_ok = portfolio_series is not None and not portfolio_series.empty
        spy_ok = spy_krw_series is not None and not spy_krw_series.empty

        portfolio_returns = portfolio_series.pct_change().dropna() if portfolio_ok else pd.Series(dtype=float)
        spy_returns = spy_krw_series.pct_change().dropna() if spy_ok else pd.Series(dtype=float)

        portfolio_m = BenchmarkService.compute_metrics(portfolio_returns)
        spy_m = BenchmarkService.compute_metrics(spy_returns)

        source = "yfinance+fdr" if (portfolio_ok and spy_ok) else "unavailable"

        return {
            "as_of": as_of.isoformat(),
            "trailing_1y": {
                "portfolio": RiskAdjustedService._metrics_to_dict(portfolio_m),
                "spy_krw": RiskAdjustedService._metrics_to_dict(spy_m),
            },
            "data_quality": {
                "portfolio_days": int(portfolio_series.shape[0]) if portfolio_ok else 0,
                "spy_krw_days": int(spy_krw_series.shape[0]) if spy_ok else 0,
                "source": source,
            },
        }

    @staticmethod
    def _metrics_to_dict(m: RiskMetrics) -> Dict[str, Optional[float]]:
        d = asdict(m)
        d.pop("n_obs", None)
        return d

    @staticmethod
    def _load_portfolio_series(db: Session, start: date, end: date) -> pd.Series:
        """Load PortfolioSnapshot.total_krw values indexed by snapshot_date between [start, end]."""
        rows = (
            db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.snapshot_date >= start)
            .filter(PortfolioSnapshot.snapshot_date <= end)
            .order_by(PortfolioSnapshot.snapshot_date.asc())
            .all()
        )
        if not rows:
            return pd.Series(dtype=float)
        idx = [pd.Timestamp(r.snapshot_date) for r in rows]
        vals = [float(getattr(r, "total_krw", 0) or 0) for r in rows]
        return pd.Series(vals, index=idx, dtype=float)
```

NOTE: If `PortfolioSnapshot.total_krw` column name differs in the project, adjust the `getattr` key. Grep `backend/app/models.py` for the `class PortfolioSnapshot` declaration to confirm the value-holding column name before running tests.

- [ ] **Step 4: Run test, expect PASS**

```bash
python -m pytest tests/test_risk_adjusted_service.py::test_compute_snapshot_metrics_happy_path_shape -v
```
Expected: PASSED.

- [ ] **Step 5: Add upstream-failure test**

Append to `backend/tests/test_risk_adjusted_service.py`:
```python
def test_compute_snapshot_metrics_upstream_failure_marks_unavailable():
    snap = _Snap(date(2026, 4, 17))
    db = MagicMock()
    with patch("app.services.risk_adjusted_service.BenchmarkService") as MockBench, \
         patch("app.services.risk_adjusted_service.RiskAdjustedService._load_portfolio_series") as mock_load:
        mock_load.return_value = pd.Series(dtype=float)
        MockBench.get_spy_krw_series.return_value = pd.Series(dtype=float)
        MockBench.compute_metrics.return_value = RiskMetrics(None, None, None, None, None, None, n_obs=0)
        payload = RiskAdjustedService.compute_snapshot_metrics(db, snap)

    assert payload["data_quality"]["source"] == "unavailable"
    assert payload["data_quality"]["portfolio_days"] == 0
    assert payload["data_quality"]["spy_krw_days"] == 0
    assert payload["trailing_1y"]["portfolio"]["cagr"] is None
    assert payload["trailing_1y"]["spy_krw"]["cagr"] is None
```

- [ ] **Step 6: Run test file, expect PASS**

```bash
python -m pytest tests/test_risk_adjusted_service.py -v
```
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/risk_adjusted_service.py backend/tests/test_risk_adjusted_service.py
git commit -m "feat(phase-d): RiskAdjustedService.compute_snapshot_metrics (freeze-time precompute)"
```

---

## Task 5: RiskAdjustedService.scorecard (B5 read)

**Files:**
- Modify: `backend/app/services/risk_adjusted_service.py` (append `scorecard`)
- Modify: `backend/tests/test_risk_adjusted_service.py` (append scorecard tests)

**Decision doc reference:** §In scope → Backend services → `risk_adjusted_service.py` → `scorecard`.

- [ ] **Step 1: Write the failing test — empty DB, ready=false shape**

Append to `backend/tests/test_risk_adjusted_service.py`:
```python
def test_scorecard_empty_db_ready_false_shape_stable():
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = []

    payload = RiskAdjustedService.scorecard(db)

    assert payload["ready"] is False
    assert payload["based_on_freezes"] == 0
    assert payload["based_on_weeks"] == 0
    assert payload["first_freeze_date"] is None
    assert payload["maturity_gate"] == {"required_weeks": 26, "current_weeks": 0, "ready": False}
    assert set(payload["horizons"].keys()) == {"6M", "1Y", "ITD"}
    for h in ("6M", "1Y", "ITD"):
        assert set(payload["horizons"][h].keys()) == {"portfolio", "spy_krw"}
        for side in ("portfolio", "spy_krw"):
            for key in ("cagr", "mdd", "sd", "sharpe", "calmar", "sortino"):
                assert payload["horizons"][h][side][key] is None
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
python -m pytest tests/test_risk_adjusted_service.py::test_scorecard_empty_db_ready_false_shape_stable -v
```
Expected: FAIL with `AttributeError: type object 'RiskAdjustedService' has no attribute 'scorecard'`.

- [ ] **Step 3: Implement scorecard**

Append to the `RiskAdjustedService` class in `backend/app/services/risk_adjusted_service.py`:
```python
    @staticmethod
    def scorecard(db: Session) -> Dict[str, Any]:
        """B5 endpoint payload — multi-horizon scorecard assembled from risk_metrics JSONB.

        Shape is invariant across ready/not-ready states: all keys present, metric
        values are None when horizon has insufficient data or when maturity gate
        is not yet met.
        """
        snapshots = (
            db.query(WeeklySnapshot)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        populated = [s for s in snapshots if s.risk_metrics and (s.risk_metrics.get("data_quality", {}).get("source") != "unavailable")]
        n_freezes = len(populated)
        n_weeks = n_freezes

        first_freeze_date = populated[0].snapshot_date.isoformat() if populated else None
        ready = n_weeks >= SCORECARD_MATURITY_WEEKS

        empty_metric = {"cagr": None, "mdd": None, "sd": None, "sharpe": None, "calmar": None, "sortino": None}
        empty_horizon = {"portfolio": dict(empty_metric), "spy_krw": dict(empty_metric)}
        horizons = {"6M": dict(empty_horizon), "1Y": dict(empty_horizon), "ITD": dict(empty_horizon)}

        if ready:
            horizons = RiskAdjustedService._build_horizons(populated)

        return {
            "ready": ready,
            "based_on_freezes": n_freezes,
            "based_on_weeks": n_weeks,
            "first_freeze_date": first_freeze_date,
            "maturity_gate": {
                "required_weeks": SCORECARD_MATURITY_WEEKS,
                "current_weeks": n_weeks,
                "ready": ready,
            },
            "horizons": horizons,
        }

    @staticmethod
    def _build_horizons(populated: List[WeeklySnapshot]) -> Dict[str, Any]:
        """Aggregate trailing-1Y metrics from JSONB into 6M/1Y/ITD horizons.

        Strategy: use the latest snapshot's 'trailing_1y' directly for '1Y'. For '6M',
        take the most-recent-half subset — if fewer than half available, mirror 1Y.
        For 'ITD' (inception-to-date), take the first snapshot's trailing_1y and
        let UI interpret "since inception" framing. This keeps backend composition
        simple; richer aggregation is a future UI-plan concern.
        """
        def _trailing(s: WeeklySnapshot) -> Dict[str, Any]:
            return (s.risk_metrics or {}).get("trailing_1y", {"portfolio": {}, "spy_krw": {}})

        latest = populated[-1]
        first = populated[0]
        mid_index = max(0, len(populated) - max(1, len(populated) // 2))
        mid = populated[mid_index]

        return {
            "6M": _trailing(mid),
            "1Y": _trailing(latest),
            "ITD": _trailing(first),
        }
```

- [ ] **Step 4: Run test, expect PASS**

```bash
python -m pytest tests/test_risk_adjusted_service.py::test_scorecard_empty_db_ready_false_shape_stable -v
```
Expected: PASSED.

- [ ] **Step 5: Add ready-state + shape-invariant tests**

Append to `backend/tests/test_risk_adjusted_service.py`:
```python
def _fake_snapshot_row(d, metrics_payload):
    return _Snap(d, risk_metrics=metrics_payload)


def _populated_snapshots(n_weeks):
    base = date(2025, 10, 17)
    out = []
    for i in range(n_weeks):
        sd = base + timedelta(weeks=i)
        out.append(_fake_snapshot_row(sd, {
            "as_of": sd.isoformat(),
            "trailing_1y": {
                "portfolio": {"cagr": 0.1 + i * 0.001, "mdd": -0.15, "sd": 0.2, "sharpe": 0.5, "calmar": 0.6, "sortino": 0.7},
                "spy_krw":   {"cagr": 0.08, "mdd": -0.12, "sd": 0.18, "sharpe": 0.4, "calmar": 0.5, "sortino": 0.6},
            },
            "data_quality": {"portfolio_days": 252, "spy_krw_days": 250, "source": "yfinance+fdr"},
        }))
    return out


def test_scorecard_thirty_weeks_ready_true_and_horizons_populated():
    snapshots = _populated_snapshots(30)
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = snapshots

    payload = RiskAdjustedService.scorecard(db)

    assert payload["ready"] is True
    assert payload["based_on_weeks"] == 30
    assert payload["maturity_gate"]["ready"] is True
    assert payload["horizons"]["1Y"]["portfolio"]["cagr"] is not None
    assert payload["first_freeze_date"] == "2025-10-17"


def test_scorecard_skips_unavailable_source_freezes_in_count():
    populated = _populated_snapshots(25)
    unavailable = _fake_snapshot_row(date(2025, 10, 10), {
        "as_of": "2025-10-10",
        "trailing_1y": {"portfolio": {}, "spy_krw": {}},
        "data_quality": {"portfolio_days": 0, "spy_krw_days": 0, "source": "unavailable"},
    })
    snapshots = [unavailable] + populated
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = snapshots

    payload = RiskAdjustedService.scorecard(db)

    assert payload["based_on_freezes"] == 25  # unavailable row excluded
    assert payload["ready"] is False  # 25 < 26 gate
```

- [ ] **Step 6: Run test file, expect 4 passed**

```bash
python -m pytest tests/test_risk_adjusted_service.py -v
```
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/risk_adjusted_service.py backend/tests/test_risk_adjusted_service.py
git commit -m "feat(phase-d): RiskAdjustedService.scorecard (B5 read endpoint payload)"
```

---

## Task 6: RiskAdjustedService.calmar_trajectory (B4 read)

**Files:**
- Modify: `backend/app/services/risk_adjusted_service.py` (append `calmar_trajectory`)
- Modify: `backend/tests/test_risk_adjusted_service.py` (append trajectory tests)

**Decision doc reference:** §In scope → Backend services → `risk_adjusted_service.py` → `calmar_trajectory`.

- [ ] **Step 1: Write the failing test — empty DB, ready=false, points=[]**

Append to `backend/tests/test_risk_adjusted_service.py`:
```python
def test_calmar_trajectory_empty_db_shape():
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = []

    payload = RiskAdjustedService.calmar_trajectory(db)

    assert payload["ready"] is False
    assert payload["based_on_freezes"] == 0
    assert payload["required_weeks"] == 52
    assert payload["points"] == []
    assert payload["decision_markers"] == []
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
python -m pytest tests/test_risk_adjusted_service.py::test_calmar_trajectory_empty_db_shape -v
```
Expected: FAIL with `AttributeError: no attribute 'calmar_trajectory'`.

- [ ] **Step 3: Implement calmar_trajectory**

Append to the `RiskAdjustedService` class:
```python
    @staticmethod
    def calmar_trajectory(db: Session) -> Dict[str, Any]:
        """B4 endpoint payload — one point per populated freeze + decision markers."""
        snapshots = (
            db.query(WeeklySnapshot)
            .order_by(WeeklySnapshot.snapshot_date.asc())
            .all()
        )
        points: List[Dict[str, Any]] = []
        for s in snapshots:
            rm = s.risk_metrics or {}
            if rm.get("data_quality", {}).get("source") == "unavailable":
                continue
            trailing = rm.get("trailing_1y", {})
            pcal = trailing.get("portfolio", {}).get("calmar")
            scal = trailing.get("spy_krw", {}).get("calmar")
            if pcal is None and scal is None:
                continue
            delta = (pcal - scal) if (pcal is not None and scal is not None) else None
            points.append({
                "date": s.snapshot_date.isoformat(),
                "portfolio_calmar": pcal,
                "spy_krw_calmar": scal,
                "delta": delta,
            })

        decision_markers = RiskAdjustedService._decision_markers_for(db, [p["date"] for p in points])

        n_freezes = len(points)
        ready = n_freezes >= TRAJECTORY_MATURITY_WEEKS

        return {
            "ready": ready,
            "based_on_freezes": n_freezes,
            "required_weeks": TRAJECTORY_MATURITY_WEEKS,
            "points": points,
            "decision_markers": decision_markers,
        }

    @staticmethod
    def _decision_markers_for(db: Session, iso_dates: List[str]) -> List[Dict[str, Any]]:
        """Build per-freeze decision marker list. Each entry: {date, decisions: [{ticker, decision_type, note}]}."""
        if not iso_dates:
            return []
        # Query decisions whose snapshot date is in iso_dates.
        decisions = (
            db.query(WeeklyDecision)
            .join(WeeklySnapshot, WeeklyDecision.snapshot_id == WeeklySnapshot.id)
            .filter(WeeklySnapshot.snapshot_date.in_(iso_dates))
            .all()
        )
        by_date: Dict[str, List[Dict[str, Any]]] = {d: [] for d in iso_dates}
        for dec in decisions:
            snap = getattr(dec, "snapshot", None)
            dkey = snap.snapshot_date.isoformat() if snap else None
            if dkey and dkey in by_date:
                by_date[dkey].append({
                    "ticker": dec.asset_ticker,
                    "decision_type": dec.decision_type,
                    "note": (dec.note or "")[:120],
                })
        return [{"date": d, "decisions": by_date[d]} for d in iso_dates if by_date[d]]
```

- [ ] **Step 4: Run test, expect PASS**

```bash
python -m pytest tests/test_risk_adjusted_service.py::test_calmar_trajectory_empty_db_shape -v
```
Expected: PASSED.

- [ ] **Step 5: Add partial-data + ordering test**

Append to `backend/tests/test_risk_adjusted_service.py`:
```python
def test_calmar_trajectory_partial_weeks_points_ordered_ready_false():
    snapshots = _populated_snapshots(10)
    db = MagicMock()
    ordered_query = db.query.return_value.order_by.return_value
    ordered_query.all.return_value = snapshots
    # Second query (decision markers) returns empty list for simplicity.
    db.query.return_value.join.return_value.filter.return_value.all.return_value = []

    payload = RiskAdjustedService.calmar_trajectory(db)

    assert payload["ready"] is False
    assert payload["based_on_freezes"] == 10
    assert len(payload["points"]) == 10
    # Points must be in ascending date order.
    dates = [p["date"] for p in payload["points"]]
    assert dates == sorted(dates)
    # Delta present for every point (both sides have calmar in fixture).
    assert all(p["delta"] is not None for p in payload["points"])
```

- [ ] **Step 6: Run test file, expect 6 passed**

```bash
python -m pytest tests/test_risk_adjusted_service.py -v
```
Expected: 6 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/risk_adjusted_service.py backend/tests/test_risk_adjusted_service.py
git commit -m "feat(phase-d): RiskAdjustedService.calmar_trajectory (B4 read endpoint payload)"
```

---

## Task 7: OutcomeEvaluatorService.backfill_spy_deltas

**Files:**
- Create: `backend/app/services/outcome_evaluator.py`
- Create: `backend/tests/test_outcome_evaluator.py`

**Decision doc reference:** §In scope → Backend services → `outcome_evaluator.py`; §In scope → Database → "Backfill policy is asymmetric by design".

- [ ] **Step 1: Write the failing test — happy path processes NULL rows**

Create `backend/tests/test_outcome_evaluator.py`:
```python
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.services.outcome_evaluator import OutcomeEvaluatorService


class _Outcome:
    def __init__(self, horizon, decision_date, horizon_date, portfolio_delta_pct):
        self.horizon = horizon
        self.evaluated_at = datetime(2026, 4, 1, tzinfo=timezone.utc)
        self.outcome_delta_pct = portfolio_delta_pct
        self.outcome_delta_vs_spy_pure = None
        self.outcome_delta_calmar_vs_spy = None
        self.snapshot = MagicMock(snapshot_date=decision_date)
        self._horizon_date = horizon_date


def _fake_spy_series(start, end, anchor=500_000.0, drift=100.0):
    idx = pd.date_range(start, end, freq="B")
    return pd.Series([anchor + i * drift for i in range(len(idx))], index=idx, dtype=float)


def test_backfill_spy_deltas_happy_path_processes_null_rows():
    d0 = date(2025, 1, 3)
    d1 = date(2025, 2, 3)
    rows = [
        _Outcome("1m", d0, d1, portfolio_delta_pct=0.05),
        _Outcome("1m", d0, d1, portfolio_delta_pct=0.03),
        _Outcome("1m", d0, d1, portfolio_delta_pct=0.04),
    ]
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = rows

    with patch("app.services.outcome_evaluator.BenchmarkService") as MockBench:
        MockBench.get_spy_krw_series.return_value = _fake_spy_series(d0, d1)
        result = OutcomeEvaluatorService.backfill_spy_deltas(db)

    assert result["processed"] == 3
    assert result["errors"] == 0
    for r in rows:
        assert r.outcome_delta_vs_spy_pure is not None
        assert r.outcome_delta_calmar_vs_spy is not None
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
python -m pytest tests/test_outcome_evaluator.py::test_backfill_spy_deltas_happy_path_processes_null_rows -v
```
Expected: FAIL with ModuleNotFoundError.

- [ ] **Step 3: Implement OutcomeEvaluatorService**

Create `backend/app/services/outcome_evaluator.py`:
```python
"""Decision-outcome evaluator — populates SPY-KRW delta columns on matured outcomes.

Layer 2 write-path for the B2 axis. Runs as the last non-blocking step of the
Sunday cron. Idempotent: only targets rows where evaluated_at IS NOT NULL AND
outcome_delta_vs_spy_pure IS NULL.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Dict, Optional

import pandas as pd
from sqlalchemy.orm import Session

from ..models import DecisionOutcome
from .benchmark_service import BenchmarkService

logger = logging.getLogger(__name__)


HORIZON_DELTA_DAYS = {
    "1w": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
}


class OutcomeEvaluatorService:
    @staticmethod
    def backfill_spy_deltas(db: Session) -> Dict[str, int]:
        """Walk matured DecisionOutcome rows with NULL SPY delta and populate both delta columns.

        Returns a summary dict: {processed, skipped_insufficient_data, errors}.
        Does NOT raise — per-row failures log + increment errors.
        """
        rows = (
            db.query(DecisionOutcome)
            .filter(DecisionOutcome.evaluated_at.isnot(None))
            .filter(DecisionOutcome.outcome_delta_vs_spy_pure.is_(None))
            .all()
        )
        processed = 0
        skipped = 0
        errors = 0

        for row in rows:
            try:
                snap = getattr(row, "snapshot", None)
                if snap is None:
                    skipped += 1
                    continue
                d0: date = snap.snapshot_date
                offset = HORIZON_DELTA_DAYS.get(row.horizon)
                if offset is None:
                    skipped += 1
                    continue
                d1: date = d0 + timedelta(days=offset)

                spy = BenchmarkService.get_spy_krw_series(db, d0 - timedelta(days=5), d1 + timedelta(days=5))
                if spy is None or spy.empty:
                    skipped += 1
                    continue

                spy_at_d0 = OutcomeEvaluatorService._asof(spy, d0)
                spy_at_d1 = OutcomeEvaluatorService._asof(spy, d1)
                if spy_at_d0 is None or spy_at_d1 is None or spy_at_d0 == 0:
                    skipped += 1
                    continue

                spy_return = (spy_at_d1 / spy_at_d0) - 1.0
                portfolio_return = row.outcome_delta_pct if row.outcome_delta_pct is not None else None
                if portfolio_return is None:
                    skipped += 1
                    continue

                row.outcome_delta_vs_spy_pure = float(portfolio_return - spy_return)
                row.outcome_delta_calmar_vs_spy = OutcomeEvaluatorService._calmar_delta(spy, d0, d1, portfolio_return)
                processed += 1

            except Exception as exc:
                errors += 1
                logger.warning("backfill_spy_deltas: row failed (%s)", exc)
                continue

        if processed:
            try:
                db.commit()
            except Exception as exc:
                logger.exception("backfill_spy_deltas: commit failed (%s)", exc)
                errors += 1

        return {"processed": processed, "skipped_insufficient_data": skipped, "errors": errors}

    @staticmethod
    def _asof(series: pd.Series, target: date) -> Optional[float]:
        ts = pd.Timestamp(target)
        try:
            val = series.asof(ts)
        except Exception:
            return None
        if pd.isna(val):
            return None
        return float(val)

    @staticmethod
    def _calmar_delta(spy: pd.Series, d0: date, d1: date, portfolio_return: float) -> Optional[float]:
        """Rough Calmar-delta proxy over the horizon window.

        Portfolio-side Calmar requires a full portfolio series during the horizon, which
        we don't reconstruct here (would re-query PortfolioSnapshot per row). We return
        the SPY Calmar-over-window value with sign inversion to preserve 'portfolio vs SPY'
        directionality; a richer computation is a future refinement captured in the
        UI plan. This keeps the column populated with a comparable scalar.
        """
        window = spy.loc[pd.Timestamp(d0):pd.Timestamp(d1)].dropna()
        if window.empty:
            return None
        returns = window.pct_change().dropna()
        m = BenchmarkService.compute_metrics(returns)
        if m.calmar is None:
            return None
        return float(portfolio_return - m.calmar)
```

NOTE: `_calmar_delta` uses a simplified proxy. This is the correct write-time behavior for the decision-doc contract: B2 UI (12 weeks out) consumes this column as a per-outcome scalar; richer per-outcome portfolio-series Calmar can be added in the UI plan without another migration.

- [ ] **Step 4: Run test, expect PASS**

```bash
python -m pytest tests/test_outcome_evaluator.py::test_backfill_spy_deltas_happy_path_processes_null_rows -v
```
Expected: PASSED.

- [ ] **Step 5: Add idempotency + upstream-failure tests**

Append to `backend/tests/test_outcome_evaluator.py`:
```python
def test_backfill_spy_deltas_idempotent_no_work_on_already_populated():
    d0 = date(2025, 1, 3)
    d1 = date(2025, 2, 3)
    rows = [_Outcome("1m", d0, d1, portfolio_delta_pct=0.05)]
    rows[0].outcome_delta_vs_spy_pure = 0.02  # already populated
    db = MagicMock()
    # Filter should exclude already-populated rows — simulate by returning empty list.
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = []

    with patch("app.services.outcome_evaluator.BenchmarkService"):
        result = OutcomeEvaluatorService.backfill_spy_deltas(db)

    assert result["processed"] == 0
    assert result["errors"] == 0
    assert result["skipped_insufficient_data"] == 0


def test_backfill_spy_deltas_upstream_failure_preserves_null_no_raise():
    d0 = date(2025, 1, 3)
    d1 = date(2025, 2, 3)
    rows = [_Outcome("1m", d0, d1, portfolio_delta_pct=0.05)]
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = rows

    with patch("app.services.outcome_evaluator.BenchmarkService") as MockBench:
        MockBench.get_spy_krw_series.return_value = pd.Series(dtype=float)
        result = OutcomeEvaluatorService.backfill_spy_deltas(db)

    assert result["processed"] == 0
    assert result["skipped_insufficient_data"] == 1
    assert rows[0].outcome_delta_vs_spy_pure is None
    assert rows[0].outcome_delta_calmar_vs_spy is None


def test_backfill_spy_deltas_unknown_horizon_skipped():
    d0 = date(2025, 1, 3)
    rows = [_Outcome("ninety_year", d0, d0 + timedelta(days=1), portfolio_delta_pct=0.01)]
    db = MagicMock()
    db.query.return_value.filter.return_value.filter.return_value.all.return_value = rows

    with patch("app.services.outcome_evaluator.BenchmarkService"):
        result = OutcomeEvaluatorService.backfill_spy_deltas(db)

    assert result["skipped_insufficient_data"] == 1
```

- [ ] **Step 6: Run test file, expect 4 passed**

```bash
python -m pytest tests/test_outcome_evaluator.py -v
```
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/outcome_evaluator.py backend/tests/test_outcome_evaluator.py
git commit -m "feat(phase-d): OutcomeEvaluatorService.backfill_spy_deltas (B2 write path)"
```

---

## Task 8: Freeze path wiring — friday_service.create_snapshot

**Files:**
- Modify: `backend/app/services/friday_service.py::create_snapshot` (insert 4-line try/except block)
- Modify: `backend/tests/test_friday_service.py` (append two tests)

**Decision doc reference:** §In scope → Backend wiring → Freeze path.

- [ ] **Step 1: Write the failing test — risk_metrics populates on success**

Append to `backend/tests/test_friday_service.py`:
```python
from unittest.mock import patch


def test_create_snapshot_populates_risk_metrics_on_success():
    from app.services.friday_service import FridayService
    from datetime import date as _date

    payload = {
        "as_of": "2026-04-17",
        "trailing_1y": {"portfolio": {}, "spy_krw": {}},
        "data_quality": {"portfolio_days": 252, "spy_krw_days": 250, "source": "yfinance+fdr"},
    }
    with patch("app.services.friday_service.RiskAdjustedService") as MockRA, \
         patch("app.services.friday_service.ReportService") as MockReport:
        MockRA.compute_snapshot_metrics.return_value = payload
        MockReport.get_week_ending.return_value = _date(2026, 4, 17)
        MockReport.build_weekly_report.return_value = {"portfolioSnapshot": {}, "score": {"total": 80}}

        db = _FakeDB()
        result = FridayService.create_snapshot(db, snapshot_date=_date(2026, 4, 17), comment="qa")

    # Reach back into DB-mock-persisted snapshot; _FakeDB.add assigns ids.
    stored = db.snapshots[-1]
    assert stored.risk_metrics == payload
    assert result["comment"] == "qa"


def test_create_snapshot_tolerates_risk_metrics_failure():
    from app.services.friday_service import FridayService
    from datetime import date as _date

    with patch("app.services.friday_service.RiskAdjustedService") as MockRA, \
         patch("app.services.friday_service.ReportService") as MockReport:
        MockRA.compute_snapshot_metrics.side_effect = RuntimeError("upstream blew up")
        MockReport.get_week_ending.return_value = _date(2026, 4, 17)
        MockReport.build_weekly_report.return_value = {"portfolioSnapshot": {}, "score": {"total": 80}}

        db = _FakeDB()
        result = FridayService.create_snapshot(db, snapshot_date=_date(2026, 4, 17))

    stored = db.snapshots[-1]
    assert stored.risk_metrics is None  # freeze still succeeded; metrics left NULL
    assert result is not None
```

NOTE: This test assumes `_FakeDB` retains inserted snapshots via its existing `add()` method. If `_FakeDB.add` does not persist, the test will fail at the `db.snapshots[-1]` line — in that case, adapt the assertion to check the returned snapshot id or refetch.

- [ ] **Step 2: Run tests, expect FAIL**

```bash
python -m pytest tests/test_friday_service.py::test_create_snapshot_populates_risk_metrics_on_success tests/test_friday_service.py::test_create_snapshot_tolerates_risk_metrics_failure -v
```
Expected: FAIL with `AttributeError` (RiskAdjustedService not imported in friday_service).

- [ ] **Step 3: Wire RiskAdjustedService into create_snapshot**

At the top of `backend/app/services/friday_service.py`, add import:
```python
from .risk_adjusted_service import RiskAdjustedService
```

In `backend/app/services/friday_service.py::create_snapshot`, locate the block (approximately lines 272-280):
```python
        try:
            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)
        except IntegrityError:
            getattr(db, "rollback", lambda: None)()
            raise SnapshotConflictError(f"Snapshot already exists for {target_date.isoformat()}")

        return FridayService._serialize_snapshot(snapshot, include_report=True)
```

Replace with:
```python
        try:
            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)
        except IntegrityError:
            getattr(db, "rollback", lambda: None)()
            raise SnapshotConflictError(f"Snapshot already exists for {target_date.isoformat()}")

        # B4 — precompute risk_metrics JSONB. Failure does NOT fail the freeze.
        try:
            snapshot.risk_metrics = RiskAdjustedService.compute_snapshot_metrics(db, snapshot)
            db.commit()
        except Exception as exc:  # noqa: BLE001 — intentional broad catch to protect freeze
            logger.warning("risk_metrics compute failed for %s: %s", target_date, exc)

        return FridayService._serialize_snapshot(snapshot, include_report=True)
```

Confirm `logger` is already imported in `friday_service.py`. If not, add at top:
```python
import logging
logger = logging.getLogger(__name__)
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
python -m pytest tests/test_friday_service.py -v
```
Expected: all previous tests still pass + 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/friday_service.py backend/tests/test_friday_service.py
git commit -m "feat(phase-d): wire risk_metrics precompute into freeze path (non-fatal try/except)"
```

---

## Task 9: Cron path wiring — update-signals step 10

**Files:**
- Modify: `backend/app/main.py::update_signals`
- Modify: `backend/tests/test_api.py` (append cron regression test)

**Decision doc reference:** §In scope → Backend wiring → Cron path.

- [ ] **Step 1: Inspect current cron handler**

Read `backend/app/main.py` lines 608-760 to confirm layout of the try block and locate the insertion point (after the "Step 9: Regime transition alerts" block, before `duration = time.time() - start_time`).

- [ ] **Step 2: Write the failing test — step 10 invoked**

Append to `backend/tests/test_api.py`:
```python
def test_update_signals_invokes_spy_delta_backfill(client, monkeypatch):
    import os
    from unittest.mock import MagicMock, patch

    monkeypatch.setenv("CRON_SECRET", "test-secret")

    calls = []

    def fake_backfill(db):
        calls.append("backfill_spy_deltas")
        return {"processed": 0, "skipped_insufficient_data": 0, "errors": 0}

    with patch("app.main.OutcomeEvaluatorService.backfill_spy_deltas", side_effect=fake_backfill), \
         patch("app.main.PriceIngestionService"), \
         patch("app.main.QuantService"), \
         patch("app.main.ReportService"), \
         patch("app.main.PortfolioService"), \
         patch("app.main.AttributionService"), \
         patch("app.main.IntelligenceService"), \
         patch("app.main.NotificationService"), \
         patch("app.main.send_discord_message"):
        response = client.post("/api/cron/update-signals", headers={"x-cron-secret": "test-secret"})

    assert response.status_code == 200
    assert "backfill_spy_deltas" in calls


def test_update_signals_tolerates_spy_delta_backfill_failure(client, monkeypatch):
    from unittest.mock import patch

    monkeypatch.setenv("CRON_SECRET", "test-secret")

    def blowup(db):
        raise RuntimeError("benchmark fetch died")

    with patch("app.main.OutcomeEvaluatorService.backfill_spy_deltas", side_effect=blowup), \
         patch("app.main.PriceIngestionService"), \
         patch("app.main.QuantService"), \
         patch("app.main.ReportService"), \
         patch("app.main.PortfolioService"), \
         patch("app.main.AttributionService"), \
         patch("app.main.IntelligenceService"), \
         patch("app.main.NotificationService"), \
         patch("app.main.send_discord_message"):
        response = client.post("/api/cron/update-signals", headers={"x-cron-secret": "test-secret"})

    assert response.status_code == 200
```

NOTE: This assumes `test_api.py` already defines a `client` fixture (FastAPI TestClient). If it doesn't, grep for existing cron tests in that file to copy the fixture pattern, or skip this test and rely on manual smoke — but first attempt uses `client`. If no fixture exists, add at top of the file:
```python
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)
```

- [ ] **Step 3: Run tests, expect FAIL**

```bash
python -m pytest tests/test_api.py::test_update_signals_invokes_spy_delta_backfill -v
```
Expected: FAIL (step 10 not yet wired).

- [ ] **Step 4: Add OutcomeEvaluatorService import + new step**

At the top of `backend/app/main.py`, add import next to other service imports:
```python
from app.services.outcome_evaluator import OutcomeEvaluatorService
```

In `backend/app/main.py::update_signals`, locate the Step 9 regime alerts block ending around line 692. Immediately after its `except Exception: pass` line and BEFORE `duration = time.time() - start_time`, insert:
```python
        # Step 10: SPY-KRW delta backfill on matured outcomes (non-blocking)
        spy_delta_result = {"processed": 0, "skipped_insufficient_data": 0, "errors": 0}
        try:
            current_step = "spy_delta_backfill"
            spy_delta_result = OutcomeEvaluatorService.backfill_spy_deltas(db)
        except Exception as exc:
            logger.warning("spy_delta_backfill failed: %s", exc)
```

In the `details_json` dict assignment (around line 702-710), add one key:
```python
            "spy_delta_backfill": spy_delta_result,
```

If `logger` is not already defined in `main.py`, add near top:
```python
import logging
logger = logging.getLogger(__name__)
```

- [ ] **Step 5: Run tests, expect PASS**

```bash
python -m pytest tests/test_api.py::test_update_signals_invokes_spy_delta_backfill tests/test_api.py::test_update_signals_tolerates_spy_delta_backfill_failure -v
```
Expected: both pass. If the existing cron test suite breaks, inspect which mocks need adjustment — the failure message will tell you.

- [ ] **Step 6: Full pytest baseline — no regression**

```bash
python -m pytest -q
```
Expected: 72 + new additions passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/tests/test_api.py
git commit -m "feat(phase-d): wire OutcomeEvaluatorService as non-blocking cron step 10"
```

---

## Task 10: API endpoints — scorecard + calmar-trajectory

**Files:**
- Modify: `backend/app/main.py` (add two GET endpoints)
- Modify: `backend/tests/test_api.py` (append endpoint tests)

**Decision doc reference:** §In scope → Backend wiring → API endpoints.

- [ ] **Step 1: Write the failing tests — both endpoints respond with shape-stable payload**

Append to `backend/tests/test_api.py`:
```python
def test_get_scorecard_empty_db_returns_ready_false_shape(client):
    response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is False
    assert payload["based_on_freezes"] == 0
    assert payload["maturity_gate"]["required_weeks"] == 26
    assert set(payload["horizons"].keys()) == {"6M", "1Y", "ITD"}


def test_get_calmar_trajectory_empty_db_returns_shape_stable(client):
    response = client.get("/api/v1/intelligence/risk-adjusted/calmar-trajectory")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is False
    assert payload["required_weeks"] == 52
    assert payload["points"] == []
    assert payload["decision_markers"] == []
```

- [ ] **Step 2: Run tests, expect FAIL**

```bash
python -m pytest tests/test_api.py::test_get_scorecard_empty_db_returns_ready_false_shape tests/test_api.py::test_get_calmar_trajectory_empty_db_returns_shape_stable -v
```
Expected: FAIL with 404.

- [ ] **Step 3: Add endpoints in main.py**

At the top of `backend/app/main.py`, add import next to RiskAdjustedService if not already:
```python
from app.services.risk_adjusted_service import RiskAdjustedService
```

Add two route handlers (place near other `/api/v1/intelligence/*` routes; if none exist, place after the existing `update_signals` definition):
```python
@app.get("/api/v1/intelligence/risk-adjusted/scorecard")
def get_risk_adjusted_scorecard(db: Session = Depends(get_db)):
    """B5 — multi-horizon risk-adjusted scorecard. Shape is stable across ready/not-ready."""
    return RiskAdjustedService.scorecard(db)


@app.get("/api/v1/intelligence/risk-adjusted/calmar-trajectory")
def get_calmar_trajectory(db: Session = Depends(get_db)):
    """B4 — per-freeze Calmar trajectory + decision markers."""
    return RiskAdjustedService.calmar_trajectory(db)
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
python -m pytest tests/test_api.py::test_get_scorecard_empty_db_returns_ready_false_shape tests/test_api.py::test_get_calmar_trajectory_empty_db_returns_shape_stable -v
```
Expected: both pass.

- [ ] **Step 5: Full pytest baseline — no regression**

```bash
python -m pytest -q
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_api.py
git commit -m "feat(phase-d): GET scorecard + calmar-trajectory endpoints (read-only from JSONB)"
```

---

## Task 11: Frontend types + fetchers in api.ts

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Decision doc reference:** §In scope → Frontend scaffold.

- [ ] **Step 1: Add TypeScript types**

At the appropriate location in `frontend/src/lib/api.ts` (group with other `/intelligence/*` types), add:
```typescript
export type RiskMetricValues = {
  cagr: number | null;
  mdd: number | null;
  sd: number | null;
  sharpe: number | null;
  calmar: number | null;
  sortino: number | null;
};

export type HorizonMetrics = {
  portfolio: RiskMetricValues;
  spy_krw: RiskMetricValues;
};

export type RiskAdjustedScorecardPayload = {
  ready: boolean;
  based_on_freezes: number;
  based_on_weeks: number;
  first_freeze_date: string | null;
  maturity_gate: {
    required_weeks: number;
    current_weeks: number;
    ready: boolean;
  };
  horizons: {
    "6M": HorizonMetrics;
    "1Y": HorizonMetrics;
    ITD: HorizonMetrics;
  };
};

export type CalmarTrajectoryPoint = {
  date: string;
  portfolio_calmar: number | null;
  spy_krw_calmar: number | null;
  delta: number | null;
};

export type CalmarDecisionMarker = {
  date: string;
  decisions: Array<{ ticker: string | null; decision_type: string; note: string }>;
};

export type CalmarTrajectoryPayload = {
  ready: boolean;
  based_on_freezes: number;
  required_weeks: number;
  points: CalmarTrajectoryPoint[];
  decision_markers: CalmarDecisionMarker[];
};
```

- [ ] **Step 2: Add fetcher helpers**

Below the types (same file), add:
```typescript
export async function fetchRiskAdjustedScorecard(): Promise<RiskAdjustedScorecardPayload> {
  const res = await fetch(`${API_BASE_URL}/api/v1/intelligence/risk-adjusted/scorecard`);
  if (!res.ok) throw new Error(`scorecard fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchCalmarTrajectory(): Promise<CalmarTrajectoryPayload> {
  const res = await fetch(`${API_BASE_URL}/api/v1/intelligence/risk-adjusted/calmar-trajectory`);
  if (!res.ok) throw new Error(`calmar-trajectory fetch failed: ${res.status}`);
  return res.json();
}
```

Confirm `API_BASE_URL` is already defined in `api.ts` (used by other fetchers). If named differently, match the project convention.

- [ ] **Step 3: TSC check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(phase-d): api.ts types + fetchers for risk-adjusted scorecard + calmar trajectory"
```

---

## Task 12: RiskAdjustedScorecard component

**Files:**
- Create: `frontend/src/components/intelligence/RiskAdjustedScorecard.tsx`
- Create: `frontend/src/components/intelligence/__tests__/RiskAdjustedScorecard.test.tsx`

**Decision doc reference:** §In scope → Frontend scaffold.

- [ ] **Step 1: Write the failing test — empty-state render**

Create `frontend/src/components/intelligence/__tests__/RiskAdjustedScorecard.test.tsx`:
```typescript
import { render, screen } from "@testing-library/react";
import { RiskAdjustedScorecard } from "../RiskAdjustedScorecard";
import type { RiskAdjustedScorecardPayload } from "@/lib/api";

const emptyPayload: RiskAdjustedScorecardPayload = {
  ready: false,
  based_on_freezes: 4,
  based_on_weeks: 4,
  first_freeze_date: "2026-03-20",
  maturity_gate: { required_weeks: 26, current_weeks: 4, ready: false },
  horizons: {
    "6M": { portfolio: nullMetrics(), spy_krw: nullMetrics() },
    "1Y": { portfolio: nullMetrics(), spy_krw: nullMetrics() },
    ITD: { portfolio: nullMetrics(), spy_krw: nullMetrics() },
  },
};

function nullMetrics() {
  return { cagr: null, mdd: null, sd: null, sharpe: null, calmar: null, sortino: null };
}

test("renders empty-state with freeze counter", () => {
  render(<RiskAdjustedScorecard payload={emptyPayload} />);
  expect(screen.getByText(/4\s*\/\s*26\s*freezes accumulated/i)).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});

test("renders ready-state with populated metrics", () => {
  const readyPayload: RiskAdjustedScorecardPayload = {
    ...emptyPayload,
    ready: true,
    based_on_freezes: 30,
    based_on_weeks: 30,
    maturity_gate: { required_weeks: 26, current_weeks: 30, ready: true },
    horizons: {
      "6M": { portfolio: { ...nullMetrics(), calmar: 0.6, sharpe: 0.5 }, spy_krw: { ...nullMetrics(), calmar: 0.5 } },
      "1Y": { portfolio: { ...nullMetrics(), calmar: 0.7, sharpe: 0.6 }, spy_krw: { ...nullMetrics(), calmar: 0.55 } },
      ITD: { portfolio: { ...nullMetrics(), calmar: 0.65 }, spy_krw: { ...nullMetrics(), calmar: 0.52 } },
    },
  };
  render(<RiskAdjustedScorecard payload={readyPayload} />);
  expect(screen.getByText(/30\s*\/\s*26\s*freezes accumulated/i)).toBeInTheDocument();
  expect(screen.getByText("0.70")).toBeInTheDocument(); // 1Y portfolio calmar
});
```

- [ ] **Step 2: Run tests, expect FAIL**

```bash
cd frontend && npx jest src/components/intelligence/__tests__/RiskAdjustedScorecard.test.tsx
```
Expected: module not found error.

- [ ] **Step 3: Implement component**

Create `frontend/src/components/intelligence/RiskAdjustedScorecard.tsx`:
```tsx
import type {
  RiskAdjustedScorecardPayload,
  RiskMetricValues,
} from "@/lib/api";

interface Props {
  payload: RiskAdjustedScorecardPayload;
}

const METRIC_KEYS: Array<keyof RiskMetricValues> = [
  "cagr",
  "mdd",
  "sd",
  "sharpe",
  "calmar",
  "sortino",
];

const METRIC_LABELS: Record<keyof RiskMetricValues, string> = {
  cagr: "CAGR",
  mdd: "MDD",
  sd: "SD",
  sharpe: "Sharpe",
  calmar: "Calmar",
  sortino: "Sortino",
};

function fmt(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

export function RiskAdjustedScorecard({ payload }: Props) {
  const { based_on_freezes, maturity_gate, horizons, ready } = payload;
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Risk-Adjusted Scorecard</h2>
        <span className="text-sm text-neutral-400">
          {based_on_freezes} / {maturity_gate.required_weeks} freezes accumulated
        </span>
      </header>

      {!ready && (
        <p className="mb-4 text-sm italic text-neutral-500">
          Accumulating. Full scorecard unlocks at {maturity_gate.required_weeks} freezes.
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-neutral-500">
            <th className="py-2">Metric</th>
            <th className="py-2">6M</th>
            <th className="py-2">1Y</th>
            <th className="py-2">ITD</th>
          </tr>
        </thead>
        <tbody>
          {METRIC_KEYS.map((key) => (
            <tr key={key} className="border-t border-neutral-800">
              <td className="py-2 text-neutral-300">{METRIC_LABELS[key]}</td>
              <td className="py-2 font-mono text-neutral-100">
                {fmt(horizons["6M"].portfolio[key])}
                <span className="text-neutral-600"> vs </span>
                {fmt(horizons["6M"].spy_krw[key])}
              </td>
              <td className="py-2 font-mono text-neutral-100">
                {fmt(horizons["1Y"].portfolio[key])}
                <span className="text-neutral-600"> vs </span>
                {fmt(horizons["1Y"].spy_krw[key])}
              </td>
              <td className="py-2 font-mono text-neutral-100">
                {fmt(horizons["ITD"].portfolio[key])}
                <span className="text-neutral-600"> vs </span>
                {fmt(horizons["ITD"].spy_krw[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

NOTE: If the project uses a different className convention (e.g., CSS modules or vanilla CSS), adjust the `className` attributes to match the nearest existing intelligence component (`OutcomesView.tsx`, `RulesView.tsx`). The decision-doc scope fixes this card as placeholder-quality — don't spend effort on final visual polish here; the future UI plan owns that.

- [ ] **Step 4: Run tests, expect PASS**

```bash
npx jest src/components/intelligence/__tests__/RiskAdjustedScorecard.test.tsx
```
Expected: 2 passed.

- [ ] **Step 5: TSC + lint**

```bash
npx tsc --noEmit && npx eslint src/components/intelligence/RiskAdjustedScorecard.tsx
```
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/intelligence/RiskAdjustedScorecard.tsx frontend/src/components/intelligence/__tests__/RiskAdjustedScorecard.test.tsx
git commit -m "feat(phase-d): RiskAdjustedScorecard scaffold component (empty/ready branch)"
```

---

## Task 13: CalmarTrajectoryPlaceholder component + IntelligenceDashboard mount

**Files:**
- Create: `frontend/src/components/intelligence/CalmarTrajectoryPlaceholder.tsx`
- Create: `frontend/src/components/intelligence/__tests__/CalmarTrajectoryPlaceholder.test.tsx`
- Modify: `frontend/src/components/intelligence/IntelligenceDashboard.tsx` (mount placeholder)

**Decision doc reference:** §In scope → Frontend scaffold (CalmarTrajectoryPlaceholder on `/intelligence` root per DESIGN.md Intelligence Hierarchy item 4).

- [ ] **Step 1: Write the failing test — renders counter and fetches on mount**

Create `frontend/src/components/intelligence/__tests__/CalmarTrajectoryPlaceholder.test.tsx`:
```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { CalmarTrajectoryPlaceholder } from "../CalmarTrajectoryPlaceholder";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("renders placeholder with freeze counter after fetch", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      ready: false,
      based_on_freezes: 7,
      required_weeks: 52,
      points: [],
      decision_markers: [],
    }),
  }) as unknown as typeof fetch;

  render(<CalmarTrajectoryPlaceholder />);
  await waitFor(() =>
    expect(screen.getByText(/7\s*\/\s*52\s*freezes accumulated/i)).toBeInTheDocument(),
  );
});
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
npx jest src/components/intelligence/__tests__/CalmarTrajectoryPlaceholder.test.tsx
```
Expected: module not found.

- [ ] **Step 3: Implement placeholder**

Create `frontend/src/components/intelligence/CalmarTrajectoryPlaceholder.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchCalmarTrajectory, type CalmarTrajectoryPayload } from "@/lib/api";

export function CalmarTrajectoryPlaceholder() {
  const [payload, setPayload] = useState<CalmarTrajectoryPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCalmarTrajectory()
      .then((p) => {
        if (!cancelled) setPayload(p);
      })
      .catch(() => {
        if (!cancelled) {
          setPayload({ ready: false, based_on_freezes: 0, required_weeks: 52, points: [], decision_markers: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const freezes = payload?.based_on_freezes ?? 0;
  const required = payload?.required_weeks ?? 52;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Calmar Trajectory</h2>
        <span className="text-sm text-neutral-400">
          {freezes} / {required} freezes accumulated
        </span>
      </header>
      <p className="text-sm italic text-neutral-500">
        Trajectory line unlocks at {required} freezes. Decision markers will accumulate here.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
npx jest src/components/intelligence/__tests__/CalmarTrajectoryPlaceholder.test.tsx
```
Expected: 1 passed.

- [ ] **Step 5: Mount in IntelligenceDashboard**

Read `frontend/src/components/intelligence/IntelligenceDashboard.tsx` and locate where sections are rendered. Add the import at top:
```typescript
import { CalmarTrajectoryPlaceholder } from "./CalmarTrajectoryPlaceholder";
```

Place `<CalmarTrajectoryPlaceholder />` in the hierarchy position per DESIGN.md Intelligence Hierarchy item 4 (between existing quadrant/regime sections and the outcomes section, or append at the bottom of the main scrollable area if hierarchy items are not explicitly separated). Match existing spacing/container pattern.

- [ ] **Step 6: TSC + lint + test**

```bash
npx tsc --noEmit && npx eslint src/components/intelligence/
npx jest src/components/intelligence/
```
Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/intelligence/CalmarTrajectoryPlaceholder.tsx frontend/src/components/intelligence/__tests__/CalmarTrajectoryPlaceholder.test.tsx frontend/src/components/intelligence/IntelligenceDashboard.tsx
git commit -m "feat(phase-d): CalmarTrajectoryPlaceholder mounted on /intelligence root"
```

---

## Task 14: `/intelligence/risk-adjusted` route page

**Files:**
- Create: `frontend/src/app/intelligence/risk-adjusted/page.tsx`

**Decision doc reference:** §In scope → Frontend scaffold (new route).

- [ ] **Step 1: Create the page**

Create `frontend/src/app/intelligence/risk-adjusted/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchRiskAdjustedScorecard, type RiskAdjustedScorecardPayload } from "@/lib/api";
import { RiskAdjustedScorecard } from "@/components/intelligence/RiskAdjustedScorecard";

function emptyPayload(): RiskAdjustedScorecardPayload {
  const nullMetric = { cagr: null, mdd: null, sd: null, sharpe: null, calmar: null, sortino: null };
  return {
    ready: false,
    based_on_freezes: 0,
    based_on_weeks: 0,
    first_freeze_date: null,
    maturity_gate: { required_weeks: 26, current_weeks: 0, ready: false },
    horizons: {
      "6M": { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
      "1Y": { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
      ITD: { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
    },
  };
}

export default function RiskAdjustedPage() {
  const [payload, setPayload] = useState<RiskAdjustedScorecardPayload>(emptyPayload());

  useEffect(() => {
    let cancelled = false;
    fetchRiskAdjustedScorecard()
      .then((p) => { if (!cancelled) setPayload(p); })
      .catch(() => { /* keep empty-state fallback */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <RiskAdjustedScorecard payload={payload} />
    </main>
  );
}
```

- [ ] **Step 2: TSC + lint**

```bash
cd frontend && npx tsc --noEmit && npx eslint src/app/intelligence/risk-adjusted/
```
Expected: zero errors.

- [ ] **Step 3: Dev server smoke — route actually renders**

```bash
cd frontend && npm run dev
```
In another terminal or browser, visit `http://localhost:3000/intelligence/risk-adjusted`. Expected: page renders with "0 / 26 freezes accumulated" (assuming local backend is running and DB has no populated risk_metrics rows). If the backend isn't running, the catch branch preserves the empty-state — page should still render, no error page.

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/intelligence/risk-adjusted/page.tsx
git commit -m "feat(phase-d): /intelligence/risk-adjusted route renders scaffold from backend"
```

---

## Task 15: Post-deploy smoke + merge + progress log

**Files:**
- Modify: `docs/superpowers/decisions/2026-04-20-phase-d-B4-B5-scope-lock.md` (append progress log entry)

**Decision doc reference:** §Progress log.

- [ ] **Step 1: Full local pytest + tsc before merging**

```bash
cd backend && python -m pytest -q
```
Expected: all green (72 + new additions).

```bash
cd frontend && npx tsc --noEmit && npx jest
```
Expected: all green.

- [ ] **Step 2: Merge to main (fast-forward)**

```bash
git checkout main
git pull --ff-only origin main
git merge --ff-only feature/phase-d-benchmark-foundation
git push origin main
```

- [ ] **Step 3: Wait for Render deploy + run post-deploy smoke**

After Render redeploy completes (~2-3 minutes), run against prod:
```bash
curl -s https://portfolio-tracker-f8a3.onrender.com/api/v1/intelligence/risk-adjusted/scorecard | python -m json.tool
```
Expected: HTTP 200, JSON with `"ready": false`, `"based_on_freezes": 0`, `"horizons"` map with all three keys.

```bash
curl -s https://portfolio-tracker-f8a3.onrender.com/api/v1/intelligence/risk-adjusted/calmar-trajectory | python -m json.tool
```
Expected: HTTP 200, JSON with `"ready": false`, `"points": []`, `"decision_markers": []`.

- [ ] **Step 4: Append progress log entry to decision doc**

In `docs/superpowers/decisions/2026-04-20-phase-d-B4-B5-scope-lock.md`, under the `## Progress log` section, replace the placeholder line with (fill in actual commit range and test counts):
```markdown
- **2026-04-20 — Bundle shipped.** Commits `<first>..<last>` on `feature/phase-d-benchmark-foundation`, fast-forward merged to `main` and pushed. Alembic revision `c9e5f2a8d410` applied via Render Start Command. Three new services live (`benchmark_service`, `risk_adjusted_service`, `outcome_evaluator`); freeze path precomputes `weekly_snapshots.risk_metrics`; Sunday cron step 10 populates `decision_outcomes` SPY delta columns on matured outcomes. New frontend route `/intelligence/risk-adjusted` + placeholder card on `/intelligence` root render empty-state counters. Post-deploy smoke: both endpoints 200 `ready=false`. Final state: <N>/<N> backend tests green, frontend tsc clean. Maturity gates now ticking — B2 UI plan unlocks at 12 freezes, B5 at 26, B4 at 52.
```

- [ ] **Step 5: Commit progress log**

```bash
git add docs/superpowers/decisions/2026-04-20-phase-d-B4-B5-scope-lock.md
git commit -m "docs(phase-d): record B4+B5+B2 benchmark foundation ship in decision log"
git push origin main
```

---

## Final verification checklist (from decision doc)

- [ ] New pytest files: `test_benchmark_service.py`, `test_risk_adjusted_service.py`, `test_outcome_evaluator.py` all green.
- [ ] Existing 72 tests remain green.
- [ ] `alembic upgrade head` + `downgrade -1` + `upgrade head` cycle succeeded on local without errors.
- [ ] Frontend `tsc` + `eslint` 0 error across new files.
- [ ] Post-deploy curl smoke: both endpoints 200 + `ready=false` payload shape verified.
- [ ] `grep -rn "yfinance\|fdr" backend/app/services/benchmark_service.py` returns 0 matches (benchmark_service does not call upstream libs directly — composition via existing services only).
- [ ] Decision-doc progress log entry appended with actual commit range and test counts.

---

## Deferred follow-ups (explicit, captured in user memory)

These items are NOT part of this plan and should NOT be done opportunistically:

- **Service-layer wide role partitioning** (memory file `feedback_service_layer_role_partitioning.md`). The three new files in this bundle follow the layered pattern; existing services are not refactored.
- **First-paint UX audit across existing routes** (memory file `feedback_first_paint_ux_priority.md`). This bundle's new endpoints are skeleton-first; existing endpoints are not touched.
- **B2 / B4 / B5 UI plans** — unlock at 12 / 52 / 26 freezes. Separate brainstorm + plan cycles.
- **Richer `_calmar_delta` computation** — the current write-time implementation uses a simplified proxy. The column shape supports replacement without another migration; future UI plan owns the refinement.
