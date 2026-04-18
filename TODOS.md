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

Full rationale: `CLAUDE.md#Review-Principles`, `DESIGN.md#Decisions-Log`, `PRODUCT.md#9-Accumulation-as-Hero`.

### Schema migrations required

- `weekly_decisions`:
  - Rename existing `confidence` → `confidence_vs_spy_riskadj` (migrate values as-is; historical confidence values reinterpret as the primary risk-adjusted scalar per portfolio design intent).
  - Add `confidence_vs_cash` INT NULL.
  - Add `confidence_vs_spy_pure` INT NULL.
  - Add `expected_failure_mode` VARCHAR NULL (enum coerced in app layer: price_drop / regime_shift / correlation_breakdown / liquidity_crunch / other).
  - Add `trigger_threshold` NUMERIC NULL.
- `weekly_snapshots`:
  - Add `comment` TEXT NULL.
  - Add `risk_metrics` JSONB NULL (trailing-1Y portfolio + SPY-KRW snapshot at freeze time).
  - Add `ritual_consistency_state` VARCHAR NULL (enum: on_time / late / missed, computed at freeze insert).
- `decision_outcomes`:
  - Add `outcome_delta_vs_spy_pure` NUMERIC NULL (per-horizon).
  - Add `outcome_delta_calmar_vs_spy` NUMERIC NULL (per-horizon).
- New table `execution_slippage` (C1 dependency):
  - `id` PK, `decision_id` FK → `weekly_decisions`, `executed_at` DATE NULL, `executed_price` NUMERIC NULL, `executed_qty` NUMERIC NULL, `notes` TEXT NULL.

### Tier 1 — ship next

- [ ] **A1: Since Last Friday briefing card** — `/friday` top. Events since last freeze (regime transitions, matured outcomes, Discord/Telegram alert history, optional last-snapshot-comment snippet). Existing data. Maturity: 2 weeks+.
- [ ] **A2: Sleeve Health panel** — 6 sleeves × (current vs target % / drift bar / signal status / 4-week recency strip). Existing data. Maturity: 4 weeks+.
- [ ] **A3: 3-scalar Confidence** — UI + schema. 3 stacked sliders in freeze form with anchor labels. Schema migration per above. Subtle ordering-deviation hint (flag if `#1 < #2` or `#2 < #3`, not a warning — observation).
- [ ] **A4: Structured Invalidation** — UI + schema. `failure_mode` dropdown + `trigger_threshold` numeric + existing free-text `invalidation`. Schema migration per above.
- [ ] **A5: Prior Invalidation Retrieval card** — shown AFTER confidence + invalidation input (bias-avoidant per Codex). Retrieval key = `regime + asset_class`, not strict ticker. Existing data. Maturity: 4 weeks+.
- [ ] **A7: Weekly Snapshot Comment** — optional 1–2 line textarea in freeze form, collapsed by default. Schema: `weekly_snapshots.comment` TEXT NULL. Discord briefing echoes the latest non-empty comment in next week's message. Maturity: immediate.
- [ ] **R1: Remove Bell icon** — edit `frontend/src/app/layout.tsx:27-29`. No in-app notification system; alerts flow via Discord (primary) and Telegram (fallback) per env config.
- [ ] **B2: Quadrant Calibration plots** — 3 faceted scatter (per confidence scalar × matching outcome delta) + 1 Ordering Deviation time series. Depends on A3 + new outcome_delta columns. Maturity: 12 weeks+.
- [ ] **B3: Trust Calibration Audit** — grid on `/intelligence/rules`. Minimum-support `n ≥ 5` gating. Drift secondary tab (24+ weeks gated). Existing data + new compute logic. Maturity: 12 weeks+ per rule.
- [ ] **B5: Risk-Adjusted Scorecard** — new page `/intelligence/risk-adjusted`. 6 metrics vs SPY-KRW; Calmar headline. Maturity: 26 weeks+.
- [ ] **B6: Invalidation Auto-Review cards** — in `/intelligence/outcomes`. 3M post-freeze generation with system threshold auto-detection + user rating form. Data reuses existing tables. Maturity: 3M after first freeze.
- [ ] **Discord briefing echo** — extend cron notification: when a snapshot has a non-empty comment, include it in the next week's "Since Last Friday" Discord message. Touches `notification_service.py` + `discord_notifier.py`.

### Tier 2 — ship after Tier 1 stabilizes

- [ ] **A6: Ritual-Consistency Strip** — header 8-dot. Past week's on-time freeze + field-completion. Process signal, not outcome. Existing data + `ritual_consistency_state` computation. Maturity: 8 weeks+.
- [ ] **B1: Regime Ribbon + embedded decisions** — `/intelligence` top. Primary historical index. Hover → weekly comment tooltip. Existing data. Maturity: 8 weeks+.
- [ ] **B4: Calmar Trajectory + Decision Annotations** — trailing-1Y `Calmar(Portfolio) − Calmar(SPY-KRW)` line with decision markers. Depends on `risk_metrics` JSONB + `benchmark_service.py`. Maturity: 52 weeks+.
- [ ] **B7: Error Signature Detector** — clusters past invalidations by `failure_mode`. Surfaces pattern card when N ≥ 3 same-mode. Data: A4 accumulation. Maturity: 12 weeks+.
- [ ] **C1: Slippage Log** — optional post-freeze recording. New `execution_slippage` table. N3 preservation: records only, not routing. Maturity: 4 weeks+.

### Tier 3

- [ ] **B8: Archetype Compression Layer** — compact widget on top of B1 ribbon. Initial grouping = `decision_type × regime` (no outcome-based clustering to avoid hindsight). Maturity: 12 weeks+.

### Deferred (prerequisite required)

- [ ] **D1: Counterfactual Portfolio Path** — rule-follow-always parallel path with override-point divergence markers. Requires counterfactual simulation engine. Subsumes the originally-proposed "Rule Ghost line." Maturity: Phase D Late.

### Backlog

- **E1: Annual Synthesis Contract** — semi-automated yearly review (raw stats auto, interpretation manual, immutable storage). Revisit after 12 months of Tier 1 + 2 data to verify underlying insights stick before committing to a synthesis format.

### New backend services / modules

- `services/benchmark_service.py` — SPY daily KRW-converted price series (SPY × USD/KRW time series).
- `services/risk_adjusted_service.py` — compute trailing-1Y CAGR / MDD / SD / Sharpe / Calmar / Sortino for portfolio + SPY-KRW.
- `services/outcome_evaluator.py` — extend with SPY-KRW comparison horizons and Calmar delta at each horizon maturation.
- `services/intelligence_service.py` — add endpoints: Trust Calibration (n-gated), Quadrant Calibration (incl. ordering deviation), Regime Ribbon, Calmar Trajectory, Error Signature, Risk-Adjusted Scorecard, Invalidation Auto-Review.

### New frontend routes / components

- `/intelligence/risk-adjusted` — Scorecard (B5).
- `/intelligence/outcomes` — extended with Invalidation Auto-Review cards (B6).
- `/intelligence/rules` — extended with Trust Calibration Audit + drift tab (B3).
- `/intelligence` (root) — Regime Ribbon (B1) + Quadrant Calibration (B2) + Calmar Trajectory (B4) + Error Signature Detector (B7) + Ritual-Consistency Strip (A6).
- `/friday` — Since Last Friday card (A1), Sleeve Health panel (A2), 3-scalar sliders (A3), structured invalidation (A4), Prior Invalidation retrieval (A5), Weekly snapshot comment (A7).
- `/archive` — card layout updated with prominent snapshot comment.
- Header — remove Bell (R1), add Ritual-Consistency Strip (A6).

**Design doc references:** `DESIGN.md#Friday-Page-Hierarchy`, `DESIGN.md#Intelligence-Page-Hierarchy`, `DESIGN.md#Decisions-Log`.
