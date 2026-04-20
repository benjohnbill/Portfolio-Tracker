# Phase D — B4 + B5 + B2 Benchmark Foundation Scope Lock

**Date:** 2026-04-20
**Scope:** Lock concrete boundaries for the backend prerequisite bundle that unblocks three data-maturity-gated Phase D items (B2, B4, B5) before writing-plans begins. Backend-only work with a minimal frontend scaffold; UI surfaces that depend on this foundation unlock 12 / 26 / 52 weeks after ship.
**Related:** TODOS.md §Phase D → Deferred — schema/backend prerequisite (B2, B4, B5), PRODUCT.md §9 (Accumulation-as-Hero / N8), CLAUDE.md §Review Principles, `docs/superpowers/decisions/2026-04-19-phase-d-partition.md`, `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md`.

## Already shipped on `origin/main` (reference)

- Phase D Ship Now (Plans A, B, C) complete per `2026-04-19-phase-d-ship-now-scope-lock.md` progress log. Final state: 72/72 backend tests green, frontend tsc clean, Playwright MCP QA 11/13 PASS.
- Three-scalar confidence model live (`confidence_vs_spy_riskadj` required, `confidence_vs_cash` + `confidence_vs_spy_pure` optional). Structured invalidation live (`expected_failure_mode`, `trigger_threshold`). Snapshot `comment` live. Discord cron echo live.

## Why this bundle (context)

Three Phase D items share the same backend prerequisite — a SPY-KRW benchmark composer and its consumers — and no item's UI ships in this cycle:

- **B2 (Quadrant Calibration)** — needs `decision_outcomes.outcome_delta_vs_spy_pure` + `outcome_delta_calmar_vs_spy` columns, populated weekly by a new `outcome_evaluator` service. UI matures at 12 weeks.
- **B4 (Calmar Trajectory + Decision Annotations)** — needs `weekly_snapshots.risk_metrics` JSONB populated at each freeze by a new `risk_adjusted_service`. UI matures at 52 weeks.
- **B5 (Risk-Adjusted Scorecard)** — needs the same `risk_metrics` JSONB plus a scorecard aggregation endpoint. UI matures at 26 weeks.

Shipping the three backends as one bundle avoids building `benchmark_service` twice, gives the shared primitives a real production consumer on day one (the Sunday cron via `outcome_evaluator`), and lets the single combined migration carry a coherent unit of schema change.

## In scope

### Database

- **Single Alembic revision** `add_benchmark_compare_columns` adding three nullable columns:
  - `weekly_snapshots.risk_metrics` (JSONB, NULL) — per-freeze precomputed risk metric snapshot.
  - `decision_outcomes.outcome_delta_vs_spy_pure` (Float, NULL) — portfolio-return minus SPY-KRW-return at horizon.
  - `decision_outcomes.outcome_delta_calmar_vs_spy` (Float, NULL) — Calmar delta at horizon.
- **`weekly_snapshots.risk_metrics` JSONB shape** (written at freeze time by `RiskAdjustedService.compute_snapshot_metrics`):
  ```json
  {
    "as_of": "2026-04-17",
    "trailing_1y": {
      "portfolio": {"cagr": 0.12, "mdd": -0.18, "sd": 0.22, "sharpe": 0.55, "calmar": 0.67, "sortino": 0.8},
      "spy_krw":   {"cagr": 0.08, "mdd": -0.15, "sd": 0.18, "sharpe": 0.44, "calmar": 0.53, "sortino": 0.6}
    },
    "data_quality": {"portfolio_days": 252, "spy_krw_days": 250, "source": "yfinance+fdr"}
  }
  ```
  On upstream failure, metric fields become `null` and `data_quality.source` becomes `"unavailable"`; freeze still succeeds.
- **Backfill policy is asymmetric by design**:
  - `weekly_snapshots.risk_metrics` — **no historical backfill**. Existing snapshots keep NULL forever. Values accumulate from the first freeze after deploy. This is the N8 accumulation-as-hero decision that makes the `/intelligence/risk-adjusted` counter start at `0/26` and tick weekly.
  - `decision_outcomes.outcome_delta_vs_spy_pure` / `outcome_delta_calmar_vs_spy` — **will be populated on already-evaluated historical rows** by the first Sunday cron after deploy via `OutcomeEvaluatorService.backfill_spy_deltas`. This is correct N8 semantics (the scatter point's x-coordinate is the original freeze's confidence scalar and the y-coordinate is the outcome delta at horizon — both anchored to the original freeze date, not today). Rows without `confidence_vs_cash` / `confidence_vs_spy_pure` populated will have partial scatter presence (riskadj axis only) until enough post-Plan-A freezes mature.

### Backend services (three new files, layered responsibilities)

- **`backend/app/services/benchmark_service.py` (~120 lines)** — Layer 1 primitives.
  - `get_spy_krw_series(db, start, end) -> pd.Series` — composes existing `PriceService.get_historical_prices("SPY", ...)` × `ExchangeService.get_usd_krw_history(...)`, inner-joined on trading dates, cached via `SystemCache` with 1-hour TTL, key `spy_krw_series_{start}_{end}`.
  - `compute_metrics(returns, risk_free=0.0) -> RiskMetrics` dataclass — pure function computing CAGR, MDD, SD, Sharpe, Calmar, Sortino + `n_obs` count. Returns all-None metrics when `n_obs < 20`. `sharpe=None` when `sd=0`; `calmar=None` when `mdd=0`.
  - On upstream failure (yfinance / fdr empty or error): returns empty Series from `get_spy_krw_series`; callers graceful-degrade.

- **`backend/app/services/risk_adjusted_service.py` (~180 lines)** — Layer 2/3 composition for B4 + B5.
  - `compute_snapshot_metrics(db, snapshot) -> dict` — called from freeze path, returns the `risk_metrics` JSONB payload. Window = trailing 365 calendar days ending on `snapshot.snapshot_date` (inner-joined to available trading days via `BenchmarkService.get_spy_krw_series`).
  - `scorecard(db) -> dict` — B5 endpoint payload. Multi-horizon (6M, 1Y, ITD) × (portfolio, spy_krw). Shape includes `based_on_freezes`, `based_on_weeks`, `first_freeze_date`, `maturity_gate: {required_weeks: 26, current_weeks, ready}`. Horizons map present even when `ready=false` (all metric fields null).
  - `calmar_trajectory(db) -> dict` — B4 endpoint payload. One point per frozen snapshot, reading `risk_metrics` JSONB. Shape includes `based_on_freezes`, `required_weeks: 52`, `ready`, `points: [{date, portfolio_calmar, spy_krw_calmar, delta}]`, `decision_markers: [{date, decisions}]`. Points list present even when `ready=false` (partial points allowed).

- **`backend/app/services/outcome_evaluator.py` (~120 lines)** — Layer 2 write-path for B2.
  - `backfill_spy_deltas(db) -> dict` — walks `decision_outcomes` where `evaluated_at IS NOT NULL AND outcome_delta_vs_spy_pure IS NULL`. Uses `BenchmarkService.get_spy_krw_series` and `asof` fallback for non-trading horizon dates. Idempotent. Returns `{processed, skipped_insufficient_data, errors}`.
  - Appended as step 7 of the existing `POST /api/cron/update-signals` 6-step pipeline.

### Backend wiring

- **Freeze path** — `FridayService.create_snapshot` gains a single new line after the existing commit, wrapped in `try/except`:
  ```python
  try:
      snapshot.risk_metrics = RiskAdjustedService.compute_snapshot_metrics(db, snapshot)
      db.commit()
  except Exception as e:
      logger.warning("risk_metrics compute failed, skipping: %s", e)
  ```
  Failure of metric compute does NOT fail the freeze.

- **Cron path** — `main.py` cron endpoint gains a single new call after the existing 6-step pipeline, wrapped in `try/except` with the project's established logging pattern. Cron returns 200 even if this step fails.

- **API endpoints** (added to `intelligence_service.py` router):
  - `GET /api/v1/intelligence/risk-adjusted/scorecard`
  - `GET /api/v1/intelligence/risk-adjusted/calmar-trajectory`
  - Both: no parameters, no auth (matches existing `/api/v1/intelligence/*` convention). Reads only — no live compute.

### Frontend scaffold (minimal, empty-state ready)

- New route `frontend/src/app/intelligence/risk-adjusted/page.tsx`.
- New component `frontend/src/components/intelligence/RiskAdjustedScorecard.tsx`. Renders empty-state ("N/26 freezes accumulated" counter + dash placeholders) when payload's `ready=false`; renders real scorecard when `ready=true`. Same component, branch on `ready` flag.
- New component `frontend/src/components/intelligence/CalmarTrajectoryPlaceholder.tsx` placed on existing `/intelligence` root page per DESIGN.md Intelligence Hierarchy (item 4 position). Empty-state card with "N/52 freezes accumulated" counter; swaps to real trajectory line when `ready=true` in a future UI plan.
- Counter wording is uniform across both scaffolds: "N/26 freezes accumulated" and "N/52 freezes accumulated" (one freeze = one week by design — the unit is a completed freeze, not elapsed calendar time).
- `frontend/src/lib/api.ts` gains two fetcher helpers + TypeScript types matching the payload contracts above. Types include `ready`, `maturity_gate`, `based_on_*` meta fields.
- No DESIGN.md changes in this bundle. The scaffold cards are placeholders; full visual design is deferred to the UI plan that ships after data matures.

### Testing

Follows project testing rules (`.claude/rules/testing.md`): 80%+ coverage, TDD mandatory, unit + integration + E2E.

- `backend/tests/test_benchmark_service.py` (new) — pure unit tests for `compute_metrics` (boundary, zero-vol, zero-MDD, insufficient data) + mock-based tests for `get_spy_krw_series` (cache hit/miss, empty upstream, inner join).
- `backend/tests/test_risk_adjusted_service.py` (new) — fixtures `fake_spy_krw_series` + `seeded_snapshots` added to `conftest.py`. Tests `compute_snapshot_metrics`, `scorecard` (empty / partial / full), `calmar_trajectory` (ordering, decision marker mapping, partial points), payload-shape invariants (all keys present even when `ready=false`).
- `backend/tests/test_outcome_evaluator.py` (new) — `backfill_spy_deltas` happy path, idempotency, upstream failure (NULL preserved, errors counter), `asof` fallback for non-trading horizon dates, batch commit isolation.
- `backend/tests/test_api_intelligence.py` — two new endpoint tests (FastAPI TestClient) covering empty-DB `ready=false` shape + seeded 30-week `ready=true` shape.
- `backend/tests/test_friday_service.py` — regression test that existing `create_snapshot` passes remain green + new test that `risk_metrics` populates on success + new test that metric-compute exception leaves snapshot successful with `risk_metrics=NULL`.
- Existing cron test(s) — regression: new step 7 invoked; step 7 exception does not fail the cron.
- `frontend/src/components/intelligence/__tests__/RiskAdjustedScorecard.test.tsx` (new) — empty-state and loaded-state render tests. TSC + ESLint green across the new files.

**Coverage target**: 85%+ for the three new service files. Existing 72 tests remain green; total test count grows to 72 + Δ.

### Post-deploy smoke

Two curl smoke checks added to the decision doc's QA section, runnable against Render prod after deploy:
- `GET /api/v1/intelligence/risk-adjusted/scorecard` → 200, `ready=false`, all required keys present.
- `GET /api/v1/intelligence/risk-adjusted/calmar-trajectory` → 200, `ready=false`, `points=[]`.

No Playwright MCP QA for this bundle (scaffold has no meaningful interactive surface; endpoints are trivially smoke-testable).

## Out of scope

- **No soft/hard deletion of the legacy `DecisionOutcome.outcome_delta_pct` column.** Kept as-is; the two new columns sit alongside it.
- **No UI beyond scaffold.** The `RiskAdjustedScorecard` and `CalmarTrajectoryPlaceholder` components render empty-state only. Real visuals, chart rendering, decision marker drawing, horizon tables, DESIGN.md entries — all deferred to future UI plans that ship after data matures (12 / 26 / 52 weeks).
- **No historical backfill of `weekly_snapshots.risk_metrics`.** Existing `weekly_snapshots` rows keep `risk_metrics=NULL` forever. Explicit N8 accumulation decision — the scorecard / trajectory counters start at `0/26` and `0/52` on deploy day and tick weekly. (`decision_outcomes` delta columns are a different story — see §In scope → Database → "Backfill policy is asymmetric by design".)
- **No `/archive` UI changes.** Archive cards continue rendering without `risk_metrics`. Whether archive ever surfaces per-snapshot risk metrics is a future UI call.
- **No new DESIGN.md sections.** Scaffold cards reuse existing card primitives; formal visual specs wait for the post-maturity UI plan.
- **Service-layer role partitioning across existing services** (`intelligence_service.py` 587-line cleanup, `friday_service.py` mixed responsibility split, etc.) is a standing standalone task tracked in user memory. Not in this bundle — only the three new files follow the layered pattern here.
- **First-paint UX audit across existing routes** is a standing standalone task tracked in user memory. Not in this bundle — only the new scorecard / trajectory endpoints are designed skeleton-first here.
- **No feature-flag gating.** Route `/intelligence/risk-adjusted` is visible to anyone who navigates to it; empty-state renders honest progress.
- **No new benchmark beyond SPY-KRW.** EURKRW, asset-class benchmarks, peer composition benchmarks — explicitly out (PRODUCT.md §9 SPY-KRW is the goal benchmark).
- **No annual synthesis (E1), no counterfactual (D1), no ritual-consistency accumulation (A6).** Separate deferred items.

## Safety gate

No gate on prior plans — Ship Now Plans A/B/C already shipped. Prerequisites already satisfied:
- `PriceService.get_historical_prices("SPY", ..., source="US")` exists and works (used elsewhere).
- `ExchangeService.get_usd_krw_history(start, end)` exists and works (used elsewhere).
- `SystemCache` table + `CacheService.get_cache` / `set_cache` / `invalidate_cache` exist (used elsewhere).
- `DecisionOutcome.evaluated_at` population is active via the Sunday cron (verified by Plan C progress log referencing `cron_run_log`).

Pre-flight verification before writing-plans: run `grep -rn "risk_metrics\|outcome_delta_vs_spy_pure\|outcome_delta_calmar_vs_spy" backend/app/` and confirm zero existing references. If non-zero, surface in planning before implementation.

## Sequencing

1. **Migration first.** Alembic revision lands alone with its Python module in place but no service code referencing the columns yet. `alembic upgrade head` + `downgrade -1` + `upgrade head` cycle tested.
2. **Layer 1 service.** `benchmark_service.py` + tests. No Layer 2 / 3 code yet — fully standalone.
3. **Layer 2 services.** `risk_adjusted_service.py` + `outcome_evaluator.py` + tests. Still no wiring into freeze / cron.
4. **Wiring.** Freeze path one-line addition, cron path one-line addition, API endpoints. Regression tests updated.
5. **Frontend scaffold.** New route + two components + api.ts types + component tests.
6. **Post-deploy smoke.** Two curl checks against Render prod.

Each step lands as an atomic `feat:` / `test:` / `refactor:` commit on a new feature branch per existing convention (`feature/phase-d-benchmark-foundation` or similar — naming finalized during writing-plans). Fast-forward merge to main at bundle completion.

## Architecture locked decisions

Summary of the six open questions from the brainstorming session and their committed answers.

1. **Bundle scope**: B4 + B5 + B2 combined (option B in brainstorming). Rationale: `benchmark_service` gets a real production consumer on day one (`outcome_evaluator` via cron), avoiding 26 weeks of dead-code risk; `outcome_evaluator` columns enable the first meaningful UI at 12 weeks instead of 52; single coherent migration instead of two sequential ones.

2. **Service API shape**: Layered three-file pattern (option C in brainstorming). `benchmark_service` = primitives only; `risk_adjusted_service` = B4 / B5 composition; `outcome_evaluator` = B2 write path. Each file has a one-sentence responsibility; no cross-layer coupling except Layer 2 → Layer 1.

3. **Migration strategy**: Single combined Alembic revision (option B in brainstorming) named `add_benchmark_compare_columns`. Three nullable columns across two tables represent one coherent unit (SPY-KRW benchmark comparison) and rollback is either fully-atomic or not needed.

4. **Ship surface**: Minimal UI scaffold (option B in brainstorming). New `/intelligence/risk-adjusted` route + scaffold card on `/intelligence` root. Rationale: N8 accumulation-as-hero principle requires each freeze to visibly advance this feature's value. A counter ("N/26 accumulated") renders on every Friday entry, so progress is felt rather than invisible.

5. **Data source**: Existing `PriceService` + `ExchangeService` composition. No new FX or price infrastructure. `SystemCache` (DB-backed, survives Render cold start) with 1-hour TTL. Inner-join on trading dates. Empty-Series graceful degrade on upstream failure.

6. **N8 consistency check**: B2 and B4 are textbook accumulating surfaces (scatter points / trajectory line both grow per freeze). B5 is weaker by default (single-snapshot metrics table) — mitigated in API contract by (a) always including `based_on_freezes` / `based_on_weeks` meta fields the UI can surface, and (b) returning multiple horizons (6M + 1Y + ITD) side by side so the ITD column visibly extends weekly. The API contract fixed here enables the UI to honor N8 when it ships.

## Progress log

_Empty until implementation begins. Progress entries added as each sequencing step completes, following the Plan A/B/C log pattern._

## Cross-session handoff summary

When resuming this bundle in a new chat session, the entry points are:

1. This decision log — authoritative scope + architecture + sequencing.
2. TODOS.md §Phase D → Deferred — schema/backend prerequisite — checklist state.
3. PRODUCT.md §9 — N8 Accumulation-as-Hero feature intent.
4. DESIGN.md Intelligence Hierarchy — where B4 / B5 scaffolds live on the page.
5. `docs/superpowers/plans/2026-04-19-phase-d-friday-form-ui.md` (Plan A UI) + `docs/superpowers/plans/2026-04-19-phase-d-friday-top.md` (Plan B) — commit / test-writing style references.
6. Memory files: `feedback_service_layer_role_partitioning.md` + `feedback_first_paint_ux_priority.md` — standing preferences that informed this scope.

**First action in the new session: invoke `/superpowers:writing-plans` with this decision log as input to produce the implementation plan.**
