# Macro Warmup Cron — Mini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `get_macro_snapshot_cached` to the daily cron's Step 6 cache pre-warm block so the first user-facing request after each day's date rollover never hits the cold path (~8s on cache miss). After this, `/api/macro-vitals` is always served from `SystemCache` for that day.

**Architecture:** One-line addition to `backend/app/main.py` cron handler. No new tables, no new services. Reuses existing `MacroService.get_macro_snapshot_cached(db)` (Task 1.1 of page-load plan).

**Tech Stack:** FastAPI cron endpoint; pytest (sqlite C-track).

**Acceptance criteria:**
- Daily cron handler explicitly calls `MacroService.get_macro_snapshot_cached(db)` after the portfolio pre-warm block.
- Test: assert the cron handler invokes the cached-wrapper at least once (mock + call_count).
- `pytest tests -q`: same count + 1 new test.

**Why this is a separate plan, not part of the ELT migration:**
This is a band-aid for `macro_service`, not the structural rework. `macro_service` already has cross-restart DB cache (Task 1.1 deploy verified: 352 ms). The only remaining latency is the *first* request after date rollover. A cron warm-up eliminates that without any architectural change. ELT migration for macro is out of scope per `docs/superpowers/specs/2026-05-14-elt-price-migration.md` §3.2.

---

## File Structure

### Modified files
- `backend/app/main.py` — daily cron handler (around the existing pre-warm block; per prior audit, around line 1018-1023)

### New files
- `backend/tests/test_macro_warmup_in_cron.py` — verification test

---

## Task 1.1: Add macro warm-up call to cron handler

**Files:**
- Modify: `backend/app/main.py` — `/api/cron/update-signals` handler, Step 6 area
- Create: `backend/tests/test_macro_warmup_in_cron.py`

**Background:** The cron handler already pre-warms `portfolio_summary`, `portfolio_allocation`, and `equity_curve` (5 periods) per the prior audit. Adding macro is one extra line in the same block. The wrapper handles DB cache write internally.

- [ ] **Step 1: Locate the existing pre-warm block**

```bash
cd /home/lg/dev/Portfolio_Tracker && \
  grep -n "PortfolioService.clear_cache\|get_portfolio_summary\|get_portfolio_allocation\|get_equity_curve" backend/app/main.py
```

Find the contiguous block (per audit, around lines 1018-1023). Verify its current shape before editing.

- [ ] **Step 2: Write the failing test**

Create `backend/tests/test_macro_warmup_in_cron.py`:

```python
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app


def test_cron_warms_macro_snapshot(db_session, client, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "test-secret")

    # Mock every upstream so we don't hit yfinance / FRED / actual DB writes.
    with patch(
        "app.services.macro_service.MacroService.get_macro_snapshot_cached"
    ) as mock_warm, patch(
        "app.services.ingestion_service.PriceIngestionService.update_raw_prices"
    ), patch(
        "app.services.ingestion_service.PriceIngestionService.generate_portfolio_snapshots"
    ), patch(
        "app.services.quant_service.QuantService.update_vxn_history"
    ), patch(
        "app.services.quant_service.QuantService.seed_mstr_corporate_actions"
    ), patch(
        "app.services.report_service.ReportService.generate_weekly_report"
    ), patch(
        "app.services.portfolio_service.PortfolioService.clear_cache"
    ), patch(
        "app.services.portfolio_service.PortfolioService.get_portfolio_summary"
    ), patch(
        "app.services.portfolio_service.PortfolioService.get_portfolio_allocation"
    ), patch(
        "app.services.portfolio_service.PortfolioService.get_equity_curve"
    ):
        response = client.post(
            "/api/cron/update-signals",
            headers={"x-cron-secret": "test-secret"},
        )

    assert response.status_code == 200
    # Macro warm-up must have been called at least once.
    assert mock_warm.call_count >= 1, "cron did not warm macro snapshot"
```

- [ ] **Step 3: Run — confirm fail**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_macro_warmup_in_cron.py -q
```

Expected: FAIL — `assert mock_warm.call_count >= 1` (cron does not yet warm macro).

- [ ] **Step 4: Add the warm-up call to the cron handler**

In `backend/app/main.py`, locate the cache pre-warm block (around line 1018-1023 per audit). Add **one line** after the existing portfolio pre-warm calls but inside the same try-except block. Final shape should look like:

```python
# Step 6: Cache prewarm
PortfolioService.clear_cache(db)
for period in ["1m", "3m", "6m", "1y", "all"]:
    PortfolioService.get_portfolio_summary(db, period=period)
    PortfolioService.get_portfolio_allocation(db, period=period)
    PortfolioService.get_equity_curve(db, period=period)
# Macro warm-up: ensures /api/macro-vitals first-request after date rollover
# is always served from SystemCache (~350ms) instead of cold (~8s).
MacroService.get_macro_snapshot_cached(db)
```

Confirm `MacroService` is imported at top of `main.py` (it should be — already used by `/api/macro-vitals` route).

- [ ] **Step 5: Run — confirm pass**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_macro_warmup_in_cron.py -q
```

Expected: PASS.

- [ ] **Step 6: Run full suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 389 passed + 1 pre-existing failure (assuming Page-load plan's 388 baseline + 1 new test from this plan).

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/tests/test_macro_warmup_in_cron.py
git commit -m "perf(macro): warm macro snapshot in daily cron pre-warm block

After date rollover, the first /api/macro-vitals request was the only
cold path remaining in the macro service (~8s via 13 FRED+Yahoo
round-trips). Calling get_macro_snapshot_cached in the cron pre-warm
block puts the result in SystemCache before any user request, so the
warm-cache path (~350ms verified post-Task 1.1) is always taken."
```

---

## Task 1.2: Deploy + verify in production

- [ ] **Step 1: Push**

```bash
git push origin main
```

Render auto-deploys. Wait ~3 min, then verify warm via `/api/healthz`.

- [ ] **Step 2: Trigger the cron manually (one-time)**

The cron only runs at 21:00 UTC (06:00 KST). Trigger it manually once to populate today's cache:

```bash
curl -X POST "https://portfolio-tracker-f8a3.onrender.com/api/cron/update-signals" \
  -H "x-cron-secret: <CRON_SECRET-from-Render-env>" \
  -H "Content-Type: application/json"
```

Expected: 200 response (may take 30-60s — full cron pipeline). Or trigger via GitHub Actions `workflow_dispatch` on `.github/workflows/daily-quant-update.yml`.

- [ ] **Step 3: Verify**

```bash
for i in 1 2; do
  t=$(curl -sS -o /dev/null -w "%{time_total}" "https://portfolio-tracker-f8a3.onrender.com/api/macro-vitals")
  echo "macro-vitals run $i: ${t}s"
done
```

Expected: both <500ms (warm SystemCache).

- [ ] **Step 4: Note success in slow-vs-fast table**

Open `docs/superpowers/measurements/2026-05-13-slow-vs-fast-components.md`. Add a short note at the bottom:

```markdown
## Update 2026-05-XX

`/api/macro-vitals` warm-up added to daily cron pre-warm block. First
user request after date rollover now serves cached payload (~350ms)
instead of cold (~8s). MacroVitalsWidget tier confirmed FAST.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/measurements/2026-05-13-slow-vs-fast-components.md
git commit -m "docs(perf): note macro warm-up landed in slow-vs-fast table"
git push origin main
```

---

## Self-Review

1. **Spec coverage** — none (this plan derives from page-load plan §Phase 4 "Recommend: future cleanup task to ensure first user always sees cached payload"). No separate spec.

2. **Placeholders** — none.

3. **Type / signature consistency** — `MacroService.get_macro_snapshot_cached(db)` matches existing call in `/api/macro-vitals` handler (Task 1.1 of page-load plan).

4. **Out of scope (intentional, deferred)**
   - ELT migration for macro tables (separate plan: `2026-05-14-elt-price-migration.md` §3.2 deferred)
   - UI staleness surface for macro data
