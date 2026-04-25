# Decision: Defer portfolio_service.py Split (Track A — 2026-04-25)

**Status:** Deferred (raise as its own task)
**Related Track A spec:** `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`
**Related Track A plan:** `docs/superpowers/plans/2026-04-25-portfolio-anchor-track-a.md`

## Context

Track A modified `backend/app/services/portfolio_service.py` in two places:

1. `infer_account_type` / `infer_account_silo` (lines 36–49) — simplified to drop the legacy symbol fallback set and use only `asset.code in ISA_KR_CODES`.
2. `get_equity_curve` (around lines 235–400) — added anchor-aware behavior for performance series initialisation, plus a `manual_anchor` lookup before the day loop and updated emit-gate / alpha-guard conditions.

After Track A the file is ~570 lines and `get_equity_curve` itself is ~270 lines, mixing transaction loading, price interpolation, FX conversion, archive value computation, performance value computation, benchmark normalisation, and series caching in a single method.

## Standing project feedback

Project memory entry **"Service-layer role partitioning"** notes a goal to split `backend/app/services/` by single responsibilities. The standing rule is to raise this as its own task whenever touching the service tree.

## Recommended follow-up: portfolio_service.py decomposition

Split `portfolio_service.py` into focused modules:

- `portfolio_query.py` — read-side helpers (cache, account silo inference)
- `equity_curve.py` — `get_equity_curve` and its price/FX helpers
- `performance.py` — TWR forward computation, anchor-aware base resolution
- `metrics.py` — `calculate_metrics`, `get_portfolio_summary`
- `allocation.py` — `get_portfolio_allocation`, `calculate_invested_capital`

`get_equity_curve` should be split into:

- `_load_transactions_and_prices(db, period)` — preparation
- `_compute_daily_state(date, transactions, prices, fx)` — per-day aggregation
- `_compute_performance_value(date, anchor, prev_state, day_state)` — anchor-aware TWR
- `compose_equity_curve(...)` — orchestration

This is **not** scope for Track A. It is raised here so the next person touching this file has the context.

## Other deferred items raised by Track A code review

### 1. Cron skip generalisation (raised in Task 6 code review)

`ingestion_service.generate_portfolio_snapshots` currently protects only rows with `source_version == "manual-anchor-v1"`:

```python
if existing is not None and existing.source_version == "manual-anchor-v1":
    continue
```

**Forward-compat concern:** Track C will introduce manual-correction rows with a different source_version (e.g., `"manual-correction-v1"`). Without expansion, those rows will be overwritten by the next cron run.

**Two acceptable resolutions** when Track C lands:

1. **Prefix match** (simpler):
   ```python
   if existing is not None and existing.source_version and existing.source_version.startswith("manual-"):
       continue
   ```

2. **Explicit allowlist** (safer, more deliberate):
   ```python
   PROTECTED_SOURCE_VERSIONS = {"manual-anchor-v1", "manual-correction-v1"}
   if existing is not None and existing.source_version in PROTECTED_SOURCE_VERSIONS:
       continue
   ```

The allowlist approach is preferred because it forces deliberate inclusion of new manual-override sources rather than accidentally protecting any string starting with "manual-" (e.g., a typo or unrelated label).

This is not scope for Track A because Track A's only manual source is `manual-anchor-v1`. Track C should handle the generalisation as part of its design.

### 2. Defensive guard comment expansion (raised in Task 6 code review)

In `portfolio_service.get_equity_curve`, the anchor-aware branch contains a defensive fallback:

```python
elif previous_absolute_value is None or performance_value is None:
    # Defensive: shouldn't happen if anchor day was processed,
    # but if so, re-base from current absolute value.
    performance_daily_return = 0.0
    performance_value = anchor_performance_base
```

The current comment undersells the importance of this branch. It can fire in two legitimate scenarios that future maintainers might miss:

1. The anchor day is before the period start (e.g., `period="1m"` filters anchor out of the iteration).
2. Gap days with no price data leave `previous_absolute_value` unset.

**Recommended comment expansion** (apply opportunistically, not a blocker):

```python
# Defensive: If anchor day was before period start (e.g., period="1m" but
# anchor is 2026-04-25), re-base from anchor. This ensures performance_value
# is never None on days after an anchor, even if the anchor day itself wasn't
# processed in this iteration.
```

This is a documentation-only refinement. Apply when the file is next touched (e.g., during the service-split refactor recommended above).

### 3. Track A markers

The Track A changes use inline `# === Track A: ... === / # === end Track A ===` markers to scope the new behavior. These markers are useful now for auditing and locating the change. They will become noise once the service split happens — at that point the markers should be removed and the anchor-aware logic should live in its own focused module (`performance.py` per the recommendation above).

## Risk of further accumulation

Track D (leverage-aware sleeve metrics) will need to modify performance computation again. If the split is not done before Track D, Track D's changes will land in an even larger method. Recommended priority: do the split between Track A ship and Track D start.
