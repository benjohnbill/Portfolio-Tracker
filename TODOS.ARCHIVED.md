# TODOS

## Timezone: Fix get_week_ending() to use KST

**Status:** Done
**Priority:** Medium
**Added:** 2026-04-03 (eng review)
**Completed:** 2026-04-04

ReportService.get_week_ending() uses naive `date.today()` which returns UTC on Render.
A cron running at Friday 11pm UTC is Saturday 8am KST, causing the week-ending date
to be wrong by one week. The new friday_service uses KST-aware dates for snapshot_date,
but the existing get_week_ending() in ReportService still uses naive dates.

**Fix:** Replace `date.today()` with KST-aware `datetime.now(ZoneInfo("Asia/Seoul")).date()`
in `ReportService.get_week_ending()`. Check historical data for any shifted dates.

**Files:** `backend/app/services/report_service.py:42`
**Blocked by:** Nothing, but needs care with existing data.

**Result:** `ReportService.get_week_ending()` now uses `datetime.now(ZoneInfo("Asia/Seoul")).date()`.

---

## Friday Time Machine — Implementation Checklist

**Priority:** High
**Added:** 2026-04-03 (office-hours + eng review + design review)

### Architecture Spec (eng review + Codex review, 2026-04-03)

```
SCHEMA (final):
  weekly_snapshots:
    id: Integer PK (autoincrement)
    snapshot_date: Date (unique) — computed via get_week_ending() in KST
    created_at: DateTime
    frozen_report: JSONB — IMMUTABLE copy of report_json at freeze time (source of truth)
    metadata: JSONB — coverage map {"portfolio": true, "macro": false, ...}

  weekly_decisions:
    id: Integer PK (autoincrement)
    snapshot_id: Integer FK -> weekly_snapshots.id
    created_at: DateTime
    decision_type: VARCHAR (free-form: hold, rebalance, buy, sell, reduce_risk, watch, etc.)
    asset_ticker: VARCHAR (nullable)
    note: TEXT
    confidence: Integer (1-10)
    invalidation: TEXT ("what would change my mind?")

KEY DECISIONS:
  - NO report_id FK. frozen_report is the sole source of truth (avoids cron upsert race).
  - friday_service delegates to ReportService.build_weekly_report() for data gathering,
    then copies the full report_json into frozen_report JSONB.
  - snapshot_date uses get_week_ending() with KST timezone, not naive date.today().
  - POST /api/v1/friday/snapshot returns 409 if snapshot already exists for that week.
  - Partial snapshot policy: save with available data, record coverage in metadata.
  - Minimum viable snapshot: portfolio_state must succeed. If portfolio fails, snapshot is NOT saved.

COMPARISON CONTRACT (GET /api/v1/friday/compare?a=DATE&b=DATE):
  Response includes snapshot_a, snapshot_b, and deltas:
    score_total: b.score.total - a.score.total
    total_value: b.portfolioSnapshot.totalValueKRW - a
    regime_change: { from: a.macroSnapshot.overallState, to: b }
    rules_added: [ rules in b not in a, matched by ruleId ]
    rules_removed: [ rules in a not in b ]
    holdings_changed: [ { symbol, weight_a, weight_b, delta } ]

DATA FLOW:
  [Freeze Button] → friday_service.create_snapshot()
    → ReportService.generate_weekly_report() → WeeklyReport row
    → Copy report_json into frozen_report JSONB
    → INSERT weekly_snapshots
    → Return snapshot data to frontend

  [Decision Form] → friday_service.add_decision(snapshot_id, ...)
    → INSERT weekly_decisions

FRONTEND HIERARCHY (/friday page):
  1. Hero strip: score + delta badge + regime badge + signal count + Freeze button
  2. Two-column: portfolio delta (left) + macro regime (right)
  3. Signals: expandable list with severity badges (not cards)
  4. Decision journal: form at bottom (type, ticker, note, confidence slider, invalidation)
  5. Freeze button: terminal action after everything
```

### Backend
- [x] Alembic migration: `weekly_snapshots` + `weekly_decisions` tables
- [x] `friday_service.py`: delegates to `ReportService.build_weekly_report()`, copies `report_json` into `frozen_report` JSONB
- [x] Snapshot date via `get_week_ending()` with KST timezone (not naive `date.today()`)
- [x] 6 API endpoints: POST snapshot, GET snapshots, GET snapshot/{date}, POST decisions, GET compare, GET current
- [x] Idempotency: 409 Conflict on duplicate `snapshot_date`
- [x] Partial snapshot policy: save with coverage metadata when upstream services fail
- [x] Comparison contract: score delta, value delta, regime change, rules diff, holdings diff

### Frontend
- [x] Sidebar: add "Friday" at 2nd position (after This Week)
- [x] `/friday` page: hero strip → 2-column explore → signals list → decision form → freeze button
- [x] Inline drill: accordion expansion on holding rows (30-day sparkline + weight delta + related signal)
- [x] Decision journal form: type dropdown, ticker, note textarea, confidence slider, invalidation field
- [x] Freeze button: step indicator progress ("Fetching portfolio..." → "Saving snapshot...")
- [x] `/friday/archive`: vertical timeline (not card grid), click to view, compare mode (side-by-side columns)
- [x] `/archive` links into `/friday/[date]` for detail view (hybrid routing)

### Design System (DESIGN.md)
- [x] DESIGN.md created with full token definitions
- [x] Apply Geist + Geist Mono + Instrument Serif font stack
- [x] Apply amber/gold accent (#D4A574) replacing neon green
- [x] Apply borderless cards with spacing-based containment
- [x] Apply color-as-signal-only rule (green/red for P&L, amber warning, blue info)

### States to implement
- [ ] Loading: skeleton pulse for hero, skeleton rows for tables
- [x] Empty (first Friday): "Your first Friday ritual!" with absolute portfolio state
- [x] Empty (archive): "No Fridays frozen yet. Start your first ritual"
- [x] Error: per-section error badges ("Macro data unavailable")
- [x] Freeze progress: step indicator with elapsed time
- [x] Frozen success: toast + "✓ Frozen" badge
- [x] Partial compare safety: archive compare renders explicit unavailable placeholders when a frozen snapshot is partial

### Tooling / Cleanup
- [x] Finish frontend ESLint setup so `npm run lint` passes non-interactively

### Tests
- [x] 20 backend unit tests (test_friday_service.py): snapshot CRUD, decision CRUD, idempotency, partial failures, comparison, persisted latest-report fallback
- [x] Backend suite currently passes in repo venv: `cd backend && .venv/bin/python -m pytest tests -q` → 29 passed

### Stability Notes (2026-04-04)
- `GET /api/reports/weekly/latest` is now read-only against persisted `weekly_reports`.
- If the current week row is missing, the backend returns the latest persisted report instead of regenerating on read.
- Friday request paths no longer run request-time DDL; migration/setup drift should fail fast instead of being hidden.
- Friday snapshot lookup helpers now use filtered SQLAlchemy queries instead of `.all()` plus Python filtering.

### Phase C (deferred, schema designed to support)
- Outcome grading (after 4-6 weeks of data)
- Signal trust stats (after 8-12 weeks)
- Right-side detail panel for deeper drilling
- LLM synthesis (Phase 2)

**Design doc:** `~/.gstack/projects/benjohnbill-Portfolio-Tracker/lg-main-design-20260403-195434.md`
**Eng review test plan:** `~/.gstack/projects/benjohnbill-Portfolio-Tracker/lg-main-eng-review-test-plan-20260403-200500.md`

---

## Attribution Engine — Deferred Items

### Indicator-Level Importance Analysis
**Status:** Deferred (P3)
**Priority:** Low
**Added:** 2026-04-08 (CEO review)

Per-indicator importance requires outcome-linked correlation analysis, not structural
tie-break detection. The leave-one-out method is degenerate on 2-indicator buckets.
Defer until 3-6 months of outcome data exist for proper statistical analysis.

**Endpoint:** `GET /api/intelligence/indicators/importance?period=6m|1y|all`
**Minimum data:** 12 snapshots required; returns 400 if insufficient.
**Design doc:** `~/.gstack/projects/benjohnbill-Portfolio-Tracker/lg-main-design-20260408-112147.md`

---

### Algorithm Revision UI with What-If Simulation
**Status:** Deferred (P3)
**Priority:** Low
**Added:** 2026-04-08 (CEO review)

Threshold tuning interface based on accumulated outcome data.
"What-if" simulation: if I change this threshold, how would past decisions change?
Needs 3-6 months of attribution data to be meaningful.

**Files:** New frontend pages under `/intelligence/tuning`
**Depends on:** Indicator importance analysis, 3-6 months of decision_outcomes data

---

### Real-World Lifecycle System Connection
**Status:** Long-term vision
**Priority:** Future
**Added:** 2026-04-08 (office-hours)

Connect the portfolio intelligence system with the user's real-world lifecycle system.
The portfolio tracker becomes infrastructure for life decisions, not just an investment tool.

**Note:** User explicitly stated this is a someday-maybe item, not a near-term priority.

---

## Phase D — Accumulation-as-Hero

**Priority:** High
**Added:** 2026-04-19 (multi-phase design-evolution conversation: Phase 1 codebase verification → Phase 2 external reviewer 5-axis evaluation → Phase 2.5 N8 gap generation → Phase 3 integrated roadmap. Codex challenge consulted twice.)
**Restructured:** 2026-04-19 — repartitioned by data-maturity axis after A3/A4/A7 schema landed. See `docs/superpowers/decisions/2026-04-19-phase-d-partition.md` for rationale. Pre-restructure tier form preserved in git at commit `b89fc48`.

Full rationale: `CLAUDE.md#Review-Principles`, `DESIGN.md#Decisions-Log`, `PRODUCT.md#9-Accumulation-as-Hero`.

### Schema status

**✅ Landed** (commit series `bd8be17..bdb9eb0` on `main`, Alembic revision `a2b8f4d1c901`):

- `weekly_decisions`:
  - Renamed `confidence` → `confidence_vs_spy_riskadj`.
  - Added `confidence_vs_cash` INT NULL.
  - Added `confidence_vs_spy_pure` INT NULL.
  - Added `expected_failure_mode` VARCHAR NULL (enum coerced in app layer: price_drop / regime_shift / correlation_breakdown / liquidity_crunch / other).
  - Added `trigger_threshold` NUMERIC NULL.
- `weekly_snapshots`:
  - Added `comment` TEXT NULL.

**⏳ Deferred** (not required for Ship Now set):

- ~~`weekly_snapshots.risk_metrics` JSONB NULL~~ ✅ shipped 2026-04-21 (B4/B5/B2 bundle)
- `weekly_snapshots.ritual_consistency_state` VARCHAR NULL — A6 dep (enum: on_time / late / missed).
- ~~`decision_outcomes.outcome_delta_vs_spy_pure` NUMERIC NULL~~ ✅ shipped 2026-04-21 (B4/B5/B2 bundle)
- ~~`decision_outcomes.outcome_delta_calmar_vs_spy` NUMERIC NULL~~ ✅ shipped 2026-04-21 (B4/B5/B2 bundle)
- ~~New table `execution_slippage` — C1 dep: `id` PK, `decision_id` FK → `weekly_decisions`, `executed_at` DATE NULL, `executed_price` NUMERIC NULL, `executed_qty` NUMERIC NULL, `notes` TEXT NULL.~~ ✅ shipped 2026-04-21 (C1 bundle, commits `d551970..918c49b`)

### Ship Now — data-maturity independent (8 items, locked scope)

All items below are buildable today. Either no data gate, or existing (non-freeze) cron-ingested data already functional from day 1.

**Scope lock doc:** `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` — authoritative per-plan boundaries for Plan B / Plan C / QA (locked before cross-session handoff).

**Sequencing:** Plan A ✅ shipped (commits `bd8be17..bdb9eb0` + `bf4a321..09b2c2a` + hotfix `0f1af6d`). Plan B ✅ shipped (commits `1b34f81..5af47de` + hotfix `8757e18`, prod endpoints verified live). Plan C next (writing-plans in fresh session), then Playwright QA.

#### ✅ Shipped — Plan A (commits on `main`, Render prod live)

- [x] **A3: 3-scalar Confidence UI** — schema + backend + API + UI landed. 3 stacked sliders with anchor labels + ordering-deviation observation.
- [x] **A4: Structured Invalidation UI** — `failure_mode` dropdown + `trigger_threshold` numeric input + free-text invalidation.
- [x] **A7: Weekly Snapshot Comment UI** — collapsed "💬 이번 주 코멘트 (선택)" textarea in freeze form + surfaced as italic quote on archive panel. Real user comment already saved on 2026-04-17 snapshot ("이란 전쟁 종전 분위기 / 주식 시장은 아직 위축") and surfaces correctly through Plan B briefing endpoint.
- [x] **R1: Remove Bell icon** — `frontend/src/app/layout.tsx` cleaned.

#### ✅ Shipped — Plan B — `/friday` top-of-page (A1 + A2)

Plan doc: `docs/superpowers/plans/2026-04-19-phase-d-friday-top.md`

- [x] **A1: Since Last Friday briefing card** — `/friday` top, above hero strip. Severity-grouped: regime transitions, matured outcomes, alert-history summary, optional last-snapshot-comment snippet. Endpoint `GET /api/v1/friday/briefing?since=<last_snapshot_date>` aggregates over `weekly_snapshots` + `decision_outcomes` + `cron_run_log`. Verified live on prod.
- [x] **A2: Sleeve Health panel** — `/friday`, between hero strip and Portfolio delta. 6 sleeves × (label | current / target | drift | signal | 4-week recency strip). Endpoint `GET /api/v1/friday/sleeve-history?weeks=4` returns per-sleeve signal-firing counts. Verified live.
- [x] **Hotfix (`8757e18`)**: sleeve `_normalize` now strips `/` so prod `BONDS/CASH` category collapses into `BONDS-CASH` canonical form. Regression test + cross-reference comments added.

#### ✅ Shipped — Plan C — Backend hygiene (Discord echo + legacy alias cleanup)

Commits: `2c3f00a..ce600e2` on `feature/phase-d-plan-c-backend-hygiene`, fast-forward merged to `main`. Docs: `38256dc`.

- [x] **Discord briefing echo** — weekly cron success message now appends `> 💬 Last week's comment: "{comment}"` via new `latest_comment` parameter on `send_cron_success` (None/empty/whitespace-safe).
- [x] **Legacy `confidence` alias cleanup — symmetric 4-layer removal** — removed across frontend types (`api.ts::FridayDecision.confidence`, `DecisionOutcomeData.decision.confidence`), frontend read site (`OutcomesView.tsx:115` migrated to `o.decision.confidenceVsSpyRiskadj` with denominator 5→10), backend response serializers (`_serialize_decision` + intelligence outcomes mirrors), and backend write path (`FridayDecisionCreateRequest.confidence_vs_spy_riskadj` now required; `add_decision` legacy kwarg + mutual-exclusion branch removed). 72/72 backend tests passing, frontend tsc clean.

#### ✅ Playwright MCP QA — Ship Now validation (executed 2026-04-20)

Screenshots: `docs/qa-evidence/phase-d-ship-now-qa/` (7 files, archived from Playwright MCP scratch). Result: **11/13 PASS, 2 SKIPPED** (interactive freeze + POST write-path — local backend bound to prod Supabase via `backend/.env`; sqlite isolation blocked by postgres-only `JSONB` columns on `weekly_snapshots`; current week already frozen). Zero regressions; no hotfix commits required. Plan C legacy-`confidence`-key absence confirmed via read-path (`GET /api/v1/friday/snapshot/2026-04-17` returns the decision with all three `confidenceVs*` scalars + `expectedFailureMode` + `triggerThreshold` + `invalidation` keys and no legacy `confidence`). Full PASS/FAIL list in `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` §Progress log.

### Deferred — data-maturity gated (9 items)

All items below need N weeks / months of *frozen decision history* to surface anything meaningful. Shipping earlier would produce empty-state-only UI.

- [ ] **A5: Prior Invalidation Retrieval card** — 4 weeks of frozen decisions with matching `regime + asset_class`. Shown AFTER confidence + invalidation input (bias-avoidant per Codex).
- [ ] **A6: Ritual-Consistency Strip** — 8-dot header. 8 weeks freeze history + deferred schema `ritual_consistency_state`.
- [ ] **B1: Regime Ribbon + embedded decisions** — `/intelligence` top. 8 weeks freeze history.
- [ ] **B3: Trust Calibration Audit** — per-rule × per-regime grid on `/intelligence/rules`. `n ≥ 5` minimum-support gate; 12+ weeks per rule. Drift secondary tab 24+ weeks gated.
- [ ] **B6: Invalidation Auto-Review cards** — in `/intelligence/outcomes`. 3M post-freeze generation, starts 3M after first A4-formatted freeze.
- [ ] **B7: Error Signature Detector** — N ≥ 3 same-`failure_mode` invalidations required (~12 weeks A4 accumulation).
- [ ] **B8: Archetype Compression Layer** — compact widget on top of B1 ribbon; depends on B1; 12 weeks.
- [ ] **D1: Counterfactual Portfolio Path** — rule-follow-always parallel path with override-point divergence markers. Needs counterfactual simulation engine (large scope). Subsumes the originally-proposed "Rule Ghost line." Phase D Late.
- [ ] **E1: Annual Synthesis Contract** — semi-automated yearly review (raw stats auto, interpretation manual, immutable storage). Revisit after 12 months of accumulated Ship Now + maturity-gated data.

### Deferred — schema / backend prerequisite (4 items)

All items below need a deferred schema migration and/or new backend service before UI work is meaningful.

- [ ] **B2: Quadrant Calibration plots** — 3 faceted scatter (per confidence scalar × matching outcome delta) + 1 Ordering Deviation time series. ✅ schema+backend prereqs shipped (2026-04-21). Still needs 12+ weeks data before UI is meaningful.
- [ ] **B4: Calmar Trajectory + Decision Annotations** — trailing-1Y `Calmar(Portfolio) − Calmar(SPY-KRW)` line with decision markers. ✅ schema+backend+frontend scaffold shipped (2026-04-21); `CalmarTrajectoryPlaceholder` on `/intelligence` root. Still needs 52 weeks data.
- [ ] **B5: Risk-Adjusted Scorecard** — `/intelligence/risk-adjusted`. ✅ schema+backend+frontend scaffold shipped (2026-04-21); page live. Still needs 26 weeks data for scorecard to unlock.
- [ ] **C1: Slippage Log** — optional post-freeze recording. ✅ schema+backend+frontend shipped (2026-04-21, commits `d551970..918c49b`); per-decision collapsible form live on `/friday`, `POST /api/v1/friday/slippage` live. N3 preservation: records only, not routing. Still needs 4 weeks of usage data before the slippage surface has meaning.

### Deploy / Cleanup

#### ✅ Test infrastructure shipped (2026-04-20)

- [x] **Phase D test infrastructure — C + D hybrid**. Plan: `docs/superpowers/plans/2026-04-20-phase-d-test-infrastructure.md`. `JsonVariant` TypeDecorator + sqlite-backed C track (default, `python -m pytest -q`) + ephemeral postgres D track (`python -m pytest -m integration`, Docker Desktop required) + function-based seed helpers. Legacy `_FakeDB` tests unchanged. Routing rules in `backend/tests/AGENTS.md`. Revisit triggers in the 2026-04-19 scope-lock decision doc apply.

### New backend services / modules (planned, tied to Deferred work)

- ~~`services/benchmark_service.py`~~ ✅ shipped 2026-04-21 (SPY×KRW series + compute_metrics primitives)
- ~~`services/risk_adjusted_service.py`~~ ✅ shipped 2026-04-21 (scorecard + calmar_trajectory + freeze-time precompute)
- ~~`services/outcome_evaluator.py`~~ ✅ shipped 2026-04-21 (backfill_spy_deltas cron step)
- `services/intelligence_service.py` — add endpoints: Trust Calibration (n-gated), Quadrant Calibration (incl. ordering deviation), Regime Ribbon, Calmar Trajectory, Error Signature, Risk-Adjusted Scorecard, Invalidation Auto-Review.

### New frontend routes / components (planned)

- ~~`/intelligence/risk-adjusted`~~ ✅ shipped 2026-04-21 (scaffold, data-gated).
- `/intelligence/outcomes` — extended with Invalidation Auto-Review cards (B6).
- `/intelligence/rules` — extended with Trust Calibration Audit + drift tab (B3).
- `/intelligence` (root) — Regime Ribbon (B1) + Quadrant Calibration (B2) + ~~Calmar Trajectory placeholder (B4)~~ ✅ 2026-04-21 + Error Signature Detector (B7) + Ritual-Consistency Strip (A6).
- `/friday` — Since Last Friday card (A1), Sleeve Health panel (A2), 3-scalar sliders (A3), structured invalidation (A4), Prior Invalidation retrieval (A5), Weekly snapshot comment (A7).
- `/archive` — card layout updated with prominent snapshot comment.
- Header — remove Bell (R1), add Ritual-Consistency Strip (A6).

**Design doc references:** `DESIGN.md#Friday-Page-Hierarchy`, `DESIGN.md#Intelligence-Page-Hierarchy`, `DESIGN.md#Decisions-Log`.
