# Page Load 3s Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page on the live site (Vercel frontend + Render backend) renders within **3 seconds of cold navigation**. Specific heavy components may exceed up to 5–7s, but the overall shell + first content must be inside 3s. Produces a per-component latency table to inform follow-up layout work.

**Architecture:** Three independent intervention surfaces, each measurable and revertible:
1. **Backend hot paths** — eliminate one cache-bypass bug (`get_macro_vitals`), add request-level price cache, batch-fix one N+1.
2. **Frontend RSC** — replace blanket `cache: 'no-store'` with deliberate cache strategy per call type, wrap RSC fetchers in `React.cache()` for per-render dedup, route `/portfolio` through the existing `getPortfolioPageData()` aggregator.
3. **Cold start infra** — replace unreliable GitHub Actions cron with external 5-min ping service (UptimeRobot or cron-job.org) pointing at a new no-DB `/api/healthz` endpoint.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Next.js 14 App Router + React Server Components (frontend), Render free tier (backend host), Vercel (frontend host), GitHub Actions (legacy ping — to be decommissioned).

**Acceptance criteria:**
- Live site page (`/`, `/friday`, `/portfolio`, `/intelligence`) shell + first content ≤ 3000ms from cold navigation (excluding cold backend boot — measured separately).
- Cold backend boot eliminated (no 503s within a 24h sample window).
- Heavy component exceptions explicitly listed in the latency table with budget annotation (e.g. "EquityCurveSection: 5s, exception").
- All existing pytest suite green; frontend type-check + lint green.

---

## File Structure

### New files
- `backend/app/main.py` — add `/api/healthz` endpoint (no-DB)
- `frontend/src/lib/api-rsc-cache.ts` — `React.cache()` wrappers for shared RSC fetchers (only those called from multiple components)
- `docs/superpowers/measurements/2026-05-13-page-load-baseline.md` — baseline latency table (Phase 0 output)
- `docs/superpowers/measurements/2026-05-13-page-load-after.md` — post-intervention latency table (Phase 4 output)
- `.github/workflows/keep-alive.yml.disabled` — renamed from active workflow (kept in tree for rollback)
- `docs/runbook/external-uptime-ping.md` — UptimeRobot / cron-job.org setup instructions

### Modified files
- `backend/app/services/macro_service.py` — `get_macro_vitals` routes through `get_macro_snapshot_cached` (1-line behavior fix; signature changes to accept `db`)
- `backend/app/services/price_service.py` — add module-level dict cache keyed by `(symbol, source, date)` for `get_current_price`
- `backend/app/main.py` — `/api/macro-vitals` now takes `db` dep; `/api/stress-test` batches asset lookups
- `frontend/src/lib/api.ts` — sweep `cache: 'no-store'`; classify each call as `'no-store'` (write-after reads), `'force-cache'` (immutable per session), or default (let Next.js decide)
- `frontend/src/app/portfolio/page.tsx` — route through `getPortfolioPageData()`

### Rules — these do NOT change
- Pre-existing UX-1 envelope shape (touching the unwrap path is out of scope)
- DB schema / Alembic migrations (no migration in this plan)
- `friday_service` / `report_service` / `briefing_service` consolidation (separate architectural plan, deferred)

---

## Phase 0 — Baseline Measurement

Goal: Establish the per-page, per-component latency baseline. Without this number, "is it under 3s now?" cannot be answered.

### Task 0.1: Measure cold-navigation latency per page

**Files:**
- Create: `docs/superpowers/measurements/2026-05-13-page-load-baseline.md`

- [ ] **Step 1: Wake the backend** so cold start does not contaminate the measurement

```bash
curl -sS -o /dev/null -w "wake_status=%{http_code} time=%{time_total}s\n" \
  https://portfolio-tracker-backend-tnsm.onrender.com/api/assets
```
Expected: `wake_status=200 time=<value>s` (first call may be 20–60s if cold; subsequent calls < 2s)

> If you don't know the live backend URL, read it from `frontend/.env.production` or `render.yaml`, or read `reference_prod_urls.md` in `/home/lg/.claude/projects/-home-lg-dev-Portfolio-Tracker/memory/`.

- [ ] **Step 2: Run a chrome-devtools performance trace on each page**

For each of `/`, `/friday`, `/portfolio?period=1y`, `/intelligence`, capture:
- TTFB (Time to First Byte)
- FCP (First Contentful Paint)
- LCP (Largest Contentful Paint)
- Total page-complete time

Use chrome-devtools MCP. For each URL:

```
mcp__chrome-devtools__new_page(url)
mcp__chrome-devtools__performance_start_trace()
mcp__chrome-devtools__navigate_page(url)  # cold navigate
mcp__chrome-devtools__performance_stop_trace()
mcp__chrome-devtools__list_network_requests()  # capture per-endpoint timing
mcp__chrome-devtools__close_page()
```

Expected: Five rows of trace data, plus per-endpoint backend timing.

- [ ] **Step 3: Write the baseline measurement table**

Create `docs/superpowers/measurements/2026-05-13-page-load-baseline.md` with this exact schema:

```markdown
# Page Load Baseline — 2026-05-13

Measurement environment: live Vercel frontend, live Render backend, backend pre-warmed.
Tooling: chrome-devtools MCP performance trace.

## Per-page totals (ms)

| Page | TTFB | FCP | LCP | Complete | Cold boot included? |
|---|---|---|---|---|---|
| / | … | … | … | … | no |
| /friday | … | … | … | … | no |
| /portfolio?period=1y | … | … | … | … | no |
| /intelligence | … | … | … | … | no |

## Per-endpoint backend timing (from /portfolio?period=1y page)

| Endpoint | Duration (ms) | Notes |
|---|---|---|
| /api/portfolio/history?period=1y | … | called by EquityCurveSection |
| /api/portfolio/allocation | … | AssetAllocationSection |
| /api/portfolio/summary | … | PortfolioSummaryCard |
| /api/signals/history?ticker=QQQ&period=1y | … | NDX signal card |
| /api/signals/history?ticker=GLDM&period=1y | … | Gold signal card |
| /api/signals/history?ticker=TLT&period=1y | … | Bonds signal card |
| /api/signals/mstr-history?period=1y | … | MSTR signal card |
| /api/macro-vitals | … | dashboard widget |
| /api/stress-test | … | stress widget |

## Observed cold-boot duration

- First `/api/assets` call after Render sleep: … ms
- Pages that timed out / 503'd during cold boot: …
```

Fill the table from Step 2 measurements. Do not estimate. Leave a cell as `n/a` if a page never makes that call.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/measurements/2026-05-13-page-load-baseline.md
git commit -m "docs(perf): capture page load baseline before 3s-budget plan"
```

---

## Phase 1 — Backend Quick Wins

Three changes, all small, all reverting independently.

### Task 1.1: Route `/api/macro-vitals` through the cache wrapper

**Files:**
- Modify: `backend/app/services/macro_service.py:446-476`
- Modify: `backend/app/main.py:416-418`
- Test: `backend/tests/test_macro_service.py` (new test)

**Background:** `macro_service.py:446` calls `MacroService.get_macro_snapshot()` directly, bypassing `get_macro_snapshot_cached()` defined right above it at `macro_service.py:428-443`. Every `/api/macro-vitals` request re-fetches 13 FRED+Yahoo series.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_macro_service.py` (append if it exists) with this test. It verifies the wrapper is consulted on the second call.

```python
from unittest.mock import patch
from datetime import date
from backend.app.services.macro_service import MacroService


def test_get_macro_vitals_uses_cache_on_second_call(db_session):
    snapshot = {
        "overallState": "neutral",
        "buckets": [],
        "indicators": [
            {"key": "net_liquidity", "value": 1.0, "unit": "T", "trend": "flat", "state": "supportive"},
            {"key": "real_yield_10y", "value": 2.0, "unit": "%", "trend": "down", "state": "supportive"},
        ],
        "knownAsOf": date.today().isoformat(),
    }

    with patch.object(MacroService, "get_macro_snapshot", return_value=snapshot) as mock_snapshot:
        first = MacroService.get_macro_vitals(db_session)
        second = MacroService.get_macro_vitals(db_session)

    assert first["net_liquidity"]["value"] == 1.0
    assert second["net_liquidity"]["value"] == 1.0
    # Cache must short-circuit upstream fetch on the second call.
    assert mock_snapshot.call_count == 1
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_macro_service.py::test_get_macro_vitals_uses_cache_on_second_call -q
```

Expected: FAIL with `TypeError: get_macro_vitals() takes 0 positional arguments but 1 was given` (current signature takes no args) OR `assert mock_snapshot.call_count == 1` fails with `call_count == 2`.

- [ ] **Step 3: Fix `get_macro_vitals` to accept `db` and route through the cache wrapper**

Replace `backend/app/services/macro_service.py:445-476` with:

```python
    @staticmethod
    def get_macro_vitals(db) -> Dict[str, Any]:
        snapshot = MacroService.get_macro_snapshot_cached(db)
        net_liquidity = next((item for item in snapshot["indicators"] if item["key"] == "net_liquidity"), None)
        real_yield = next((item for item in snapshot["indicators"] if item["key"] == "real_yield_10y"), None)
        if not net_liquidity or not real_yield:
            return {"status": "loading"}

        def remap_state(value: Optional[str]) -> str:
            if value == "supportive":
                return "safe"
            if value == "adverse":
                return "danger"
            return "neutral"

        return {
            "last_updated": snapshot["knownAsOf"],
            "net_liquidity": {
                "value": net_liquidity["value"],
                "unit": net_liquidity["unit"],
                "trend": net_liquidity["trend"],
                "state": remap_state(net_liquidity["state"]),
                "thresholds": {},
            },
            "real_yield": {
                "value": real_yield["value"],
                "unit": real_yield["unit"],
                "trend": real_yield["trend"],
                "state": remap_state(real_yield["state"]),
                "thresholds": {},
            },
        }
```

- [ ] **Step 4: Update the endpoint to inject `db`**

Replace `backend/app/main.py:416-418` with:

```python
@app.get("/api/macro-vitals")
def get_macro_vitals(db: Session = Depends(get_db)):
    return MacroService.get_macro_vitals(db) or {"status": "loading"}
```

- [ ] **Step 5: Re-run the test — confirm it passes**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_macro_service.py::test_get_macro_vitals_uses_cache_on_second_call -q
```

Expected: PASS.

- [ ] **Step 6: Run the full backend suite to confirm no regression**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: All previously-green tests still green. Note any pre-existing failures separately.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/macro_service.py backend/app/main.py backend/tests/test_macro_service.py
git commit -m "fix(macro): route /api/macro-vitals through cache wrapper

Previously get_macro_vitals() called get_macro_snapshot() directly,
bypassing the date-keyed DB cache and re-fetching 13 FRED+Yahoo series
on every request (3-5s)."
```

---

### Task 1.2: Add request-level price cache to `PriceService.get_current_price`

**Files:**
- Modify: `backend/app/services/price_service.py:1-30`
- Test: `backend/tests/test_price_service.py` (new file)

**Background:** Each `/api/stress-test` call (and several other paths) hits yfinance / FinanceDataReader live for every (symbol, source) pair. There's no in-memory cache between calls within the same backend process.

The cache strategy: a module-level dict keyed by `(symbol, source, date.today().isoformat())`. Same calendar day → reuse. Day rollover invalidates automatically. No TTL needed.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_price_service.py`:

```python
from unittest.mock import patch, MagicMock
import pandas as pd
from backend.app.services.price_service import PriceService, _PRICE_CACHE


def test_get_current_price_caches_within_day():
    _PRICE_CACHE.clear()
    fake_data = pd.DataFrame({"Close": [123.45]})
    fake_ticker = MagicMock()
    fake_ticker.history.return_value = fake_data

    with patch("backend.app.services.price_service.yf.Ticker", return_value=fake_ticker) as mock_ticker:
        first = PriceService.get_current_price("FAKE", "US")
        second = PriceService.get_current_price("FAKE", "US")

    assert first == 123.45
    assert second == 123.45
    assert mock_ticker.call_count == 1  # second call must hit cache
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_price_service.py -q
```

Expected: FAIL with `ImportError: cannot import name '_PRICE_CACHE'`.

- [ ] **Step 3: Add the module-level cache and rewrite `get_current_price`**

Replace `backend/app/services/price_service.py:1-30` with:

```python
import yfinance as yf
import FinanceDataReader as fdr
from datetime import datetime, timedelta, date
from typing import Tuple, Dict
import pandas as pd

# Module-level cache for the current backend process. Keyed by
# (symbol, source, ISO date). Day rollover invalidates automatically
# because the date component changes; no TTL mechanism needed.
_PRICE_CACHE: Dict[Tuple[str, str, str], float] = {}


class PriceService:
    @staticmethod
    def get_current_price(symbol: str, source: str = "US") -> float:
        """
        Fetches the latest closing price for a given symbol.
        source: "US" for Yahoo Finance, "KR" for FinanceDataReader.
        Same-day calls reuse a process-local cache.
        """
        cache_key = (symbol, source, date.today().isoformat())
        if cache_key in _PRICE_CACHE:
            return _PRICE_CACHE[cache_key]

        try:
            if source == "US":
                ticker = yf.Ticker(symbol)
                data = ticker.history(period="1d")
                if not data.empty:
                    price = float(data['Close'].iloc[-1])
                    _PRICE_CACHE[cache_key] = price
                    return price

            elif source == "KR":
                df = fdr.DataReader(symbol, (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))
                if not df.empty:
                    price = float(df['Close'].iloc[-1])
                    _PRICE_CACHE[cache_key] = price
                    return price

            return 0.0
        except Exception as e:
            print(f"Error fetching price for {symbol}: {e}")
            return 0.0
```

Leave `get_historical_prices` and `get_historical_prices_bulk` (lines 32-65) unchanged.

- [ ] **Step 4: Re-run the test — confirm it passes**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_price_service.py -q
```

Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/price_service.py backend/tests/test_price_service.py
git commit -m "perf(price): cache current price by (symbol, source, date)

Process-local dict; same-day calls reuse. No TTL — date rollover
invalidates automatically. Removes repeated yfinance round-trips
for endpoints like /api/stress-test that price each holding."
```

---

### Task 1.3: Batch asset lookups in `/api/stress-test`

**Files:**
- Modify: `backend/app/main.py:420-437`
- Test: `backend/tests/test_stress_test_endpoint.py` (new)

**Background:** `main.py:430` issues `db.query(Asset).filter(Asset.id == aid).first()` per holding inside a loop. With N holdings: N DB round-trips. Replace with one `IN` query.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_stress_test_endpoint.py`:

```python
from unittest.mock import patch
from sqlalchemy import event
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models import Asset, Transaction


def test_stress_test_uses_single_asset_query(db_session, client):
    # Seed two holdings.
    a1 = Asset(symbol="AAA", source="US", category="Equity", currency="USD", name="A")
    a2 = Asset(symbol="BBB", source="US", category="Equity", currency="USD", name="B")
    db_session.add_all([a1, a2])
    db_session.commit()
    db_session.add_all([
        Transaction(asset_id=a1.id, type="BUY", quantity=10, price=100, fees=0),
        Transaction(asset_id=a2.id, type="BUY", quantity=5, price=200, fees=0),
    ])
    db_session.commit()

    query_count = {"n": 0}

    @event.listens_for(db_session.bind, "before_cursor_execute")
    def count(conn, cursor, statement, parameters, context, executemany):
        if "FROM assets" in statement or "FROM asset" in statement.lower():
            query_count["n"] += 1

    with patch(
        "backend.app.services.price_service.PriceService.get_current_price",
        return_value=100.0,
    ), patch(
        "backend.app.services.stress_service.StressService.run_simulation",
        return_value=[],
    ):
        response = client.get("/api/stress-test")

    assert response.status_code == 200
    # Endpoint must batch: one Asset query regardless of holding count.
    assert query_count["n"] <= 1, f"expected ≤1 asset query, got {query_count['n']}"
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_stress_test_endpoint.py -q
```

Expected: FAIL — current code issues 2 asset queries (one per holding).

- [ ] **Step 3: Rewrite the endpoint**

Replace `backend/app/main.py:420-437` with:

```python
@app.get("/api/stress-test")
def get_stress_test(db: Session = Depends(get_db)):
    txs = db.query(Transaction).filter(Transaction.type.in_(["BUY", "SELL"])).all()
    holdings = {}
    for t in txs:
        holdings[t.asset_id] = holdings.get(t.asset_id, 0) + (t.quantity if t.type == "BUY" else -t.quantity)
    active_holdings = {aid: qty for aid, qty in holdings.items() if qty > 0.0001}
    if not active_holdings:
        return []

    # Batch: one query for all referenced assets.
    asset_rows = db.query(Asset).filter(Asset.id.in_(active_holdings.keys())).all()
    asset_by_id = {a.id: a for a in asset_rows}

    total_value = 0
    asset_values = {}
    for aid, qty in active_holdings.items():
        asset = asset_by_id.get(aid)
        if asset is None:
            continue
        price = PriceService.get_current_price(asset.symbol, asset.source)
        val = qty * price
        asset_values[asset.symbol] = val
        total_value += val

    if total_value == 0:
        return []
    weights = {sym: val / total_value for sym, val in asset_values.items()}
    return StressService.run_simulation(weights)
```

- [ ] **Step 4: Re-run the test — confirm it passes**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_stress_test_endpoint.py -q
```

Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_stress_test_endpoint.py
git commit -m "perf(stress): batch asset lookups in /api/stress-test

Replaces N db.query(Asset).filter(id==aid).first() loops with one
IN query. Combined with the new price-cache in PriceService, the
endpoint now does 1 DB query + ≤N yfinance calls (cached same-day)
instead of 2N round-trips."
```

---

## Phase 2 — Frontend Caching and Parallelism

Three changes. Phase 2 depends on Phase 1 being deployed first (you need the backend changes live to measure honest cache wins).

### Task 2.1: Classify and sweep `cache: 'no-store'` in `api.ts`

**Files:**
- Modify: `frontend/src/lib/api.ts` — 27 call sites (see line numbers in Step 2)

**Background:** Every backend fetcher in `api.ts` has `cache: 'no-store'`. This disables Next.js's request-level deduplication (different from data cache) and forces every render to call the backend even when the same call already happened in the same render pass.

Classification rules:

| Call returns | Recommendation |
|---|---|
| Mutation (POST/PUT/DELETE) | Leave as-is — Next.js doesn't cache non-GET anyway |
| GETs read after a known write | `cache: 'no-store'` (keep) |
| GETs of date-keyed snapshots (`/api/macro-vitals`, friday reports) | drop `cache` option → Next.js default (React-level dedup within render) |
| GETs of historical/static data (`/api/assets`, `/api/signals/history`) | drop `cache` option |
| Identical call invoked twice in one page render (signal cards) | drop `cache` option — React dedup will collapse |

> Do NOT set `cache: 'force-cache'` anywhere in this task. That's a separate decision per route and risks staleness. The goal here is to remove the *defeat* of Next.js's automatic per-render dedup, not to add cross-request caching.

- [ ] **Step 1: List the 27 call sites**

```bash
grep -n "cache: 'no-store'" /home/lg/dev/Portfolio_Tracker/frontend/src/lib/api.ts
```

Expected output: 27 line numbers (688, 705, 722, 759, 779, 792, 812, 845, 870, 885, 900, 918, 942, 974, 1001, 1029, 1053, 1199, 1217, 1232, 1247, 1284, 1299, 1311, 1323, 1409, 1430).

- [ ] **Step 2: Read each call site and classify**

For each of the 27 lines, open `api.ts` and read the surrounding function (typically 5–10 lines). Record which functions are mutations or write-adjacent reads. Build the classification list in a scratchpad — do NOT modify yet. This step is structured note-taking.

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && grep -n "^export async function" src/lib/api.ts
```

Cross-reference with the line numbers from Step 1 to identify the owning function for each `cache: 'no-store'`.

- [ ] **Step 3: Apply the sweep**

For each function classified as "drop `cache` option", remove the `cache: 'no-store'` option entirely. Style:

```typescript
// BEFORE
const res = await fetch(`${API_BASE}/api/signals/history?...`, {
  cache: 'no-store',
});

// AFTER
const res = await fetch(`${API_BASE}/api/signals/history?...`);
```

For multi-option object fetch calls (e.g. POSTs with headers), only remove the `cache` field, not the whole object.

For functions where the rule says "keep" (write-adjacent reads), leave them unchanged.

- [ ] **Step 4: Type-check and lint**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run build && npm run lint
```

Expected: build succeeds, no new lint errors.

- [ ] **Step 5: Smoke-test in browser via chrome-devtools**

Start the dev server:

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run dev
```

In another terminal, point chrome-devtools at `http://localhost:3000/portfolio?period=1y` and confirm the page renders identically to before — same data, same layout. Verify in the network panel that the four signal-card endpoints (`/api/signals/history?ticker=…`) are no longer each duplicated when refreshing during a single render (the React per-render dedup should collapse identical calls).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "perf(api): drop blanket cache: 'no-store' to allow Next.js per-render dedup

Classified the 27 call sites: kept 'no-store' for write-adjacent reads;
removed for reads of date-keyed snapshots and historical data so that
React can dedup identical fetches within a single render pass."
```

---

### Task 2.2: Wrap shared RSC fetchers with `React.cache()`

**Files:**
- Create: `frontend/src/lib/api-rsc-cache.ts`
- Modify: `frontend/src/components/features/portfolio/AssetSignalSection.tsx:1`, `frontend/src/components/features/portfolio/EquityCurveSection.tsx` (single import line)

**Background:** Four `AssetSignalSection` instances on `/portfolio` each call `getAssetHistory(ticker, period)`. Even after Task 2.1, distinct tickers each fire one backend call — that's expected. But `cache()` wrapping makes the function shape uniform so future shared-data scenarios (e.g. two components asking for the same ticker) automatically dedup.

- [ ] **Step 1: Create the wrapper module**

Create `frontend/src/lib/api-rsc-cache.ts`:

```typescript
import 'server-only';
import { cache } from 'react';

import {
  getAssetHistory as _getAssetHistory,
  getMSTRHistory as _getMSTRHistory,
  getPortfolioHistory as _getPortfolioHistory,
  getPortfolioAllocation as _getPortfolioAllocation,
  getPortfolioSummary as _getPortfolioSummary,
} from './api';

// React `cache()` dedupes within a single render pass. Wrap every
// fetcher invoked from more than one Server Component so that the
// page tree never issues two identical backend calls in one render.
export const getAssetHistoryCached = cache(_getAssetHistory);
export const getMSTRHistoryCached = cache(_getMSTRHistory);
export const getPortfolioHistoryCached = cache(_getPortfolioHistory);
export const getPortfolioAllocationCached = cache(_getPortfolioAllocation);
export const getPortfolioSummaryCached = cache(_getPortfolioSummary);
```

- [ ] **Step 2: Update `AssetSignalSection` to use the cached version**

In `frontend/src/components/features/portfolio/AssetSignalSection.tsx`, replace line 1:

```typescript
// BEFORE
import { getAssetHistory } from '@/lib/api';

// AFTER
import { getAssetHistoryCached as getAssetHistory } from '@/lib/api-rsc-cache';
```

No other change to this file.

- [ ] **Step 3: Update `EquityCurveSection`, `PortfolioSummaryCard`, `AssetAllocationSection`, `MSTRSignalSection` similarly**

For each of these four files, replace the top-level `import { … } from '@/lib/api'` with the corresponding `Cached` import from `@/lib/api-rsc-cache`. Local variable names inside the component body do not need to change — alias on import.

Locations (read the files to confirm exact import statements before editing):

- `frontend/src/components/features/portfolio/EquityCurveSection.tsx` — uses `getPortfolioHistory`
- `frontend/src/components/features/portfolio/PortfolioSummaryCard.tsx` — uses `getPortfolioSummary`
- `frontend/src/components/features/portfolio/AssetAllocationSection.tsx` — uses `getPortfolioAllocation`
- `frontend/src/components/features/portfolio/MSTRSignalSection.tsx` — uses `getMSTRHistory`

- [ ] **Step 4: Type-check and lint**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run build && npm run lint
```

Expected: build succeeds, no new lint errors.

- [ ] **Step 5: Smoke-test in dev**

Open `/portfolio?period=1y` in a browser via chrome-devtools, confirm visual parity.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api-rsc-cache.ts frontend/src/components/features/portfolio/*.tsx
git commit -m "perf(rsc): wrap shared portfolio fetchers in React.cache()

Per-render dedup. Matches the existing pattern in
macro-context-fetchers-rsc.ts. Components import the *Cached aliases
so the call sites read unchanged."
```

---

### Task 2.3: Route `/portfolio` page through `getPortfolioPageData()`

**Files:**
- Modify: `frontend/src/app/portfolio/page.tsx`

**Background:** `frontend/src/lib/api.ts:801-836` already defines `getPortfolioPageData()` that batches history + allocation + summary + ndx + mstr fetches inside one `Promise.all`. The `/portfolio` page does not use it — each Suspense child fires its own fetch.

This task is structural: hoist the aggregator call into the page, pass results into props instead of having children fetch independently. This makes the parallel fan-out visible in one place and ensures `Promise.all` semantics.

> Important: this restructure changes how Suspense streams. Today, every section streams independently. After this task, all five "above the fold" sections wait on the same `Promise.all`. If the slowest one (likely `getPortfolioHistory`) is 4s, all sections appear together at 4s. Measure in Phase 4 — if this is worse for perceived performance, the alternative is to keep Suspense streaming and only `React.cache()`-wrap (Task 2.2 already did that). Decide based on the Phase 0 baseline numbers.

- [ ] **Step 1: Decide whether to apply this task based on Phase 0 numbers**

Read `docs/superpowers/measurements/2026-05-13-page-load-baseline.md`. Look at the per-endpoint timing column for `/portfolio?period=1y`:

- If the slowest endpoint is **≤ 1.5s** AND the page-complete time is dominated by JS hydration: apply this task.
- If one endpoint dominates (≥ 3s) and the rest are fast: **skip this task** — Suspense streaming + Task 2.2 is the better shape. Document the skip in the commit phase of Task 4.1.

- [ ] **Step 2: If applying — write the page rewrite**

Read the current `frontend/src/app/portfolio/page.tsx` (130 lines) to keep the header / period-switch / layout JSX intact. Replace only the data-flow portion: pre-fetch via `getPortfolioPageData()` in the page body, pass results into child components as props.

Apply this rewrite (assumes child components accept a new optional `data` prop — see Step 3 for child changes):

```typescript
import Link from 'next/link';
import { Suspense } from 'react';

import { AddAssetModal } from '@/components/features/AddAssetModal';
import { Clock, Briefcase, ChevronLeft } from 'lucide-react';

import { EquityCurveSection } from '@/components/features/portfolio/EquityCurveSection';
import { PortfolioSummaryCard } from '@/components/features/portfolio/PortfolioSummaryCard';
import { AssetAllocationSection } from '@/components/features/portfolio/AssetAllocationSection';
import { AssetSignalSection } from '@/components/features/portfolio/AssetSignalSection';
import { MSTRSignalSection } from '@/components/features/portfolio/MSTRSignalSection';
import { Skeleton } from '@/components/ui/skeleton';
import { getPortfolioPageData } from '@/lib/api';

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const period = typeof params.period === 'string' ? params.period : '1y';

  const pageData = await getPortfolioPageData(period);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* ... header unchanged: copy lines 28-70 verbatim ... */}

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-8">
          <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
            <EquityCurveSection period={period} preloaded={pageData.history} />
          </Suspense>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Signal Pulse Grid</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <AssetSignalSection
                  ticker="QQQ"
                  title="NDX vs 250MA"
                  description="Trend regime — drives NDX_2X ↔ NDX_1X rotation"
                  period={period}
                  preloaded={pageData.ndxHistory}
                />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <MSTRSignalSection period={period} preloaded={pageData.mstrHistory} />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <AssetSignalSection
                  ticker="GLDM"
                  title="Gold vs 250MA"
                  description="Defensive regime — monitors GLDM relative to trend"
                  period={period}
                />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}>
                <AssetSignalSection
                  ticker="TLT"
                  title="Bonds vs 250MA"
                  description="Duration regime — monitors TLT relative to trend"
                  period={period}
                />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-xl" />}>
            <PortfolioSummaryCard preloaded={pageData.summary} />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
            <AssetAllocationSection preloaded={pageData.allocation} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
```

(Lines `28-70` mentioned above: header block with `<Clock>` / `<Briefcase>` / period-switch `<Link>` group / `<AddAssetModal/>` — copy verbatim from the current file.)

> Note: `pageData.ndxHistory` is the QQQ history (NDX is QQQ-proxied per project history). For GLDM and TLT, the aggregator does not currently fetch them — those two cards keep their own fetcher path. That is intentional; aggregating all four would change the aggregator's shape and is out of scope here.

- [ ] **Step 3: Add `preloaded?` optional prop to each child component**

For each receiving component, add a typed optional `preloaded` prop. When provided, skip the internal fetch and use it. Example for `EquityCurveSection`:

```typescript
// frontend/src/components/features/portfolio/EquityCurveSection.tsx
import { getPortfolioHistoryCached as getPortfolioHistory } from '@/lib/api-rsc-cache';
import type { ApiResult, PortfolioHistoryData } from '@/lib/api';
// ... existing imports

interface EquityCurveSectionProps {
  period: string;
  preloaded?: ApiResult<PortfolioHistoryData>;
}

export async function EquityCurveSection({ period, preloaded }: EquityCurveSectionProps) {
  const result = preloaded ?? { data: await getPortfolioHistory(period), error: null };
  // ... rest unchanged
}
```

Apply the analogous pattern to `PortfolioSummaryCard`, `AssetAllocationSection`, `AssetSignalSection` (with `preloaded?: NDXHistoryPoint[]`), `MSTRSignalSection` (with `preloaded?: MSTRHistoryPoint[]`).

- [ ] **Step 4: Type-check, lint, smoke-test**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run build && npm run lint
```

Then smoke-test `/portfolio?period=1y` via chrome-devtools. Confirm:
- Visual parity (same layout, same data)
- Network tab shows the five aggregator endpoints firing in parallel, no duplicate calls
- Page completes faster than the Phase 0 baseline (record the number for Phase 4)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/portfolio/page.tsx frontend/src/components/features/portfolio/*.tsx
git commit -m "perf(portfolio): route page through getPortfolioPageData aggregator

Existing aggregator (api.ts:801) was unused. Page now triggers one
Promise.all for history+allocation+summary+ndx+mstr, then streams the
preloaded data into each Suspense child via optional 'preloaded' prop.
GLDM/TLT signal cards keep their own fetchers."
```

---

## Phase 3 — Cold Start Infrastructure

Replace the GitHub Actions cron (proven unreliable: 1-3h gaps + cold-boot 503s) with an external 5-minute ping service.

### Task 3.1: Add a lightweight `/api/healthz` endpoint

**Files:**
- Modify: `backend/app/main.py` — add new route near the top of the route list
- Test: `backend/tests/test_health_endpoint.py` (new)

**Background:** Current ping target is `/api/assets`, which touches the DB. A health endpoint should not touch the DB or any external API — it should respond as quickly as possible so the ping service times-out less often, and so it doesn't generate DB load every 5 minutes.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_health_endpoint.py`:

```python
from fastapi.testclient import TestClient
from backend.app.main import app


def test_healthz_returns_200_without_db():
    client = TestClient(app)
    response = client.get("/api/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_health_endpoint.py -q
```

Expected: FAIL with 404 (endpoint does not exist).

- [ ] **Step 3: Add the endpoint**

In `backend/app/main.py`, find the first existing `@app.get(...)` route. Above it, add:

```python
@app.get("/api/healthz")
def healthz():
    """Lightweight health-check for external uptime pings.
    Intentionally does not touch the DB or any external API so a 5-minute
    ping schedule generates no load and never blocks on cold-start IO."""
    return {"status": "ok"}
```

- [ ] **Step 4: Re-run the test — confirm it passes**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_health_endpoint.py -q
```

Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_health_endpoint.py
git commit -m "feat(health): add /api/healthz endpoint for external uptime ping

No-DB, no-external-API. Replaces /api/assets as ping target so the
5-min external ping (Phase 3.2) generates zero DB load."
```

---

### Task 3.2: Set up external ping and disable GitHub Actions cron

**Files:**
- Create: `docs/runbook/external-uptime-ping.md`
- Move: `.github/workflows/keep-alive.yml` → `.github/workflows/keep-alive.yml.disabled`

> This task involves an external SaaS configuration step the agent cannot complete autonomously. The runbook records the exact account-level steps; the user runs them.

- [ ] **Step 1: Write the runbook**

Create `docs/runbook/external-uptime-ping.md`:

```markdown
# External Uptime Ping — Setup Runbook

## Why

GitHub Actions free-tier cron is unreliable: scheduled `*/10 * * * *` runs
in practice drift by 1–3 hours, leaving the Render free-tier backend in
sleep (Render sleeps after 15min idle). When the next ping fires, Render
cold-boots and the ping times out → 503.

External ping services run from their own infrastructure with strict
schedules. UptimeRobot and cron-job.org both offer free 5-min ping plans.

## Target endpoint

```
GET https://<backend-host>/api/healthz
```

Returns `{"status": "ok"}` in <100ms (no DB, no external API).
The backend URL is the value of `BACKEND_BASE_URL` in GitHub secrets,
also visible in `frontend/.env.production` as `NEXT_PUBLIC_API_URL`.

## UptimeRobot setup (recommended)

1. Sign up at https://uptimerobot.com (free tier: 50 monitors, 5-min checks).
2. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: `Portfolio Tracker — Render Keep-Alive`
   - URL: `https://<backend-host>/api/healthz`
   - Monitoring Interval: 5 minutes
   - Monitor Timeout: 30 seconds (Render cold-boot can take 20–30s)
3. Optional: configure an alert contact for downtime notifications.
4. Save.

## cron-job.org alternative

1. Sign up at https://cron-job.org.
2. Create cronjob:
   - URL: `https://<backend-host>/api/healthz`
   - Schedule: every 5 minutes
   - Timeout: 30s
3. Save.

## Verification

24 hours after enabling:

1. Check ping-service dashboard — uptime should be ≥ 99% (some 503s during
   first cold boots are expected as the system stabilizes).
2. Run from any terminal:
   ```bash
   for i in 1 2 3; do
     curl -sS -o /dev/null -w "ping %{http_code} %{time_total}s\n" https://<backend-host>/api/healthz
     sleep 60
   done
   ```
   Three pings, ≥ 200 status, each < 2s = backend is staying warm.

## Rollback

Re-enable `.github/workflows/keep-alive.yml.disabled` by renaming back to
`keep-alive.yml`. The workflow file is preserved in the repo for this purpose.
```

- [ ] **Step 2: Disable the GitHub Actions cron**

```bash
cd /home/lg/dev/Portfolio_Tracker
git mv .github/workflows/keep-alive.yml .github/workflows/keep-alive.yml.disabled
```

> GitHub Actions ignores files that don't end in `.yml` or `.yaml`, so the renamed file will be inert until renamed back.

- [ ] **Step 3: Commit both changes together**

```bash
git add docs/runbook/external-uptime-ping.md .github/workflows/keep-alive.yml.disabled
git commit -m "ops(keepalive): disable GitHub cron, document external ping setup

GitHub Actions free-tier cron drifts 1-3h between runs (observed in
gh run list timestamps), leaving Render free-tier backend in sleep.
External 5-min ping (UptimeRobot or cron-job.org) is more reliable.
Workflow file preserved as .disabled for rollback."
```

- [ ] **Step 4: User-action handoff**

After committing, surface this message to the user:

> "Phase 3.2 done in the repo. Next manual step (outside this session):
> 1. Sign up for UptimeRobot (or cron-job.org).
> 2. Add HTTP monitor pointing at `<backend-host>/api/healthz`, 5-min interval, 30s timeout.
> 3. After 24h, check ping-service dashboard for uptime ≥ 99%.
> Runbook at `docs/runbook/external-uptime-ping.md`."

---

## Phase 4 — Verification and Layout Input Table

### Task 4.1: Re-measure and confirm 3s budget

**Files:**
- Create: `docs/superpowers/measurements/2026-05-13-page-load-after.md`

- [ ] **Step 1: Confirm Phase 1-3 changes are deployed to live**

```bash
git log --oneline main..HEAD  # if on a branch
git log --oneline -n 10        # recent commits on main
```

Verify the Phase 1, 2, 3 commits land on `main` and that Render+Vercel auto-deploys complete. The Render deploy log is visible in the Render dashboard; Vercel deploys typically take 2-3 min after push.

- [ ] **Step 2: Wait for external ping to keep backend warm**

After enabling UptimeRobot (Task 3.2 manual step), wait at least 20 minutes so two consecutive 5-min pings have run. This confirms the backend will not cold-boot during measurement.

```bash
curl -sS -o /dev/null -w "%{http_code} %{time_total}s\n" https://<backend-host>/api/healthz
```

Expected: `200 0.0xx-s` (< 100ms warm).

- [ ] **Step 3: Re-run the chrome-devtools traces from Task 0.1**

Same procedure as Phase 0 Task 0.1, Step 2. Same four pages.

- [ ] **Step 4: Write the after-measurement table**

Create `docs/superpowers/measurements/2026-05-13-page-load-after.md` using the same schema as Phase 0. Add two extra columns to the per-page totals table:

```markdown
| Page | TTFB | FCP | LCP | Complete | Δ vs baseline (Complete) | ≤ 3s budget? |
```

Fill the Δ column as `(after - before)` in ms. Fill the budget column as `yes` / `no` / `exception: <component>`.

- [ ] **Step 5: Identify slow components for the layout-input table**

For any page that exceeds 3s OR that hosts a clearly-slow component, add a "slow component" subsection:

```markdown
## Slow components — candidates for layout exception

| Component | Page | Backend endpoint | Backend ms | Frontend render ms | Notes |
|---|---|---|---|---|---|
| EquityCurveSection | /portfolio | /api/portfolio/history?period=1y | … | … | computes 500+day curve |
| FridayReportSection | /friday | /api/v1/friday/current | … | … | … |
```

This table is the deliverable for the follow-up layout work mentioned in the goal — "오래 걸리는 컴포넌트와 ms 단위의 빠른 컴포넌트의 구분."

- [ ] **Step 6: Decide pass / fail**

For each page:
- Page-complete ≤ 3000ms (excluding cold boot): **PASS**
- 3000ms < complete ≤ 7000ms AND only one component drives the overshoot AND that component is documented in the slow-component table: **PASS WITH EXCEPTION**
- Otherwise: **FAIL** — open a follow-up task in the slow-component table identifying the next intervention point.

Add a verdict block at the bottom of the markdown:

```markdown
## Verdict

| Page | Status |
|---|---|
| / | PASS |
| /friday | PASS WITH EXCEPTION (FridayReportSection 4.8s) |
| /portfolio?period=1y | PASS |
| /intelligence | PASS |

Overall: PASS / FAIL.
```

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/measurements/2026-05-13-page-load-after.md
git commit -m "docs(perf): post-intervention page load measurements

Verifies 3s budget. Includes slow-component table for follow-up
layout work."
```

---

## Self-Review Checklist

Run before handing off:

1. **Spec coverage**
   - Cold start hypothesis → Phase 3 ✓
   - Backend hot paths → Phase 1 ✓ (3 tasks)
   - Frontend waterfalls / no-store sweep → Phase 2 ✓ (3 tasks)
   - 3s budget acceptance → Phase 4 ✓
   - Slow-vs-fast component table for follow-up layout work → Phase 4 Step 5 ✓
   - Baseline measurement (so "is it 3s now?" is answerable) → Phase 0 ✓

2. **Placeholders** — scanned: none.

3. **Type / signature consistency**
   - `get_macro_vitals(db)` — added `db` param in macro_service.py AND main.py route. ✓
   - `_PRICE_CACHE` exported from `price_service.py` and imported in test. ✓
   - `getPortfolioPageData` shape matches what `/portfolio` page consumes (history/allocation/summary/ndxHistory/mstrHistory). ✓
   - `preloaded?` prop type matches each fetcher's return type: `ApiResult<PortfolioHistoryData>` (history), `PortfolioAllocationData[]` (allocation envelope), `PortfolioSummaryEnvelope` (summary), `NDXHistoryPoint[]` (ndx), `MSTRHistoryPoint[]` (mstr). ✓

4. **Out of scope (intentional)**
   - Architecture deepening candidates #7–#10 from the diagnosis (api.ts split, friday/report/briefing consolidation, intelligence service split, external API seam) — deferred to a separate plan because they are not on the critical path for the 3s budget.
   - `getPortfolioSummary` UX-1 envelope migration (project history flags it as legacy pattern, but it's not on the 3s critical path).
