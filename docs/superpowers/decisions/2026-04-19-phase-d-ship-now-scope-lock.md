# Phase D — Ship Now Scope Lock (Plans B, C, QA)

**Date:** 2026-04-19
**Scope:** Lock concrete boundaries for the remaining 4 Ship Now items before cross-session handoff. Written before Plan B writing-plans begins so the next session can pick up with no ambiguity.
**Related:** TODOS.md §Phase D → Ship Now, PRODUCT.md §9, DESIGN.md Friday Hierarchy.

## Already shipped on `origin/main` (reference)

- Plan A (schema + backend + API): commit series `bd8be17..bdb9eb0`, Alembic revision `a2b8f4d1c901`.
- Plan A UI (A3 / A4 / A7 / R1): commit series `bf4a321..09b2c2a`.
- Notification import hotfix: `0f1af6d`.
- Render prod DB is at head; Start Command embeds `alembic upgrade head` for future deploys.

## Plan B — `/friday` top-of-page (A1 + A2)

**Plan doc (prospective):** `docs/superpowers/plans/2026-04-19-phase-d-friday-top.md`

### In scope

- **A1: Since Last Friday briefing card** — `/friday` top, above hero strip. Severity-grouped events since last freeze: regime transitions, matured outcomes, alert-history summary, optional last-snapshot-comment snippet.
  - **New backend endpoint:** `GET /api/v1/friday/briefing?since=<last_snapshot_date>` returning `{regimeTransitions, maturedOutcomes, alertHistory, lastSnapshotComment}`.
  - Aggregates across existing tables: `weekly_snapshots`, `decision_outcomes`, `cron_run_log`, `weekly_snapshots.frozen_report`.

- **A2: Sleeve Health panel** — `/friday`, between hero strip and Portfolio delta card. 6 sleeves × (label | current% / target% | drift bar | signal status | 4-week recency strip).
  - Current / target / drift / signal come from existing `WeeklyReport` props (`portfolioSnapshot.allocation`, `portfolioSnapshot.targetDeviation`, `triggeredRules`) — no extra backend call required.
  - **New backend endpoint for recency strip:** `GET /api/v1/friday/sleeve-history?weeks=4` returning `{ "NDX": [0,1,1,0], "DBMF": [...], ... }` — per-sleeve signal firing count per week over the last N weeks. (Chosen over client-side aggregation to avoid 4× HTTP roundtrip on Render free tier.)

- **Frontend:** new `SinceLastFridayBriefing.tsx`, new `SleeveHealthPanel.tsx`, wired into `FridayDashboard.tsx` at correct positions per DESIGN.md Friday Hierarchy (item 1 and item 3). `api.ts` gets two new fetch helpers + types.

### Out of scope

- Keep existing Portfolio delta card. A2 is higher-level summary, not replacement (DESIGN.md Friday Hierarchy item 3 vs item 4).
- Don't touch `notification_service.py` or `discord_notifier.py` (Plan C).
- Don't touch legacy `confidence` alias (Plan C).
- No new schema migration.

### Sequencing

Plan B ships before Plan C. After Plan B lands, run:

```bash
grep -rn "decision\.confidence\b" frontend/src --include="*.tsx" --include="*.ts"
```

If the result is non-empty, migrate the remaining read sites to `decision.confidenceVsSpyRiskadj` as part of Plan C's cleanup scope.

## Plan C — Backend hygiene (Discord echo + legacy alias cleanup)

**Plan doc (prospective):** `docs/superpowers/plans/2026-04-19-phase-d-backend-hygiene.md`

### In scope

- **Discord briefing echo** — extend the weekly cron success message in `notification_service.py` to append `> 💬 Last week's comment: "{comment}"` when the latest snapshot's `comment` is non-empty. `discord_notifier.py` mostly unchanged (HTML→Markdown already handles italics). Update the 14 existing Discord tests + relevant cron-notification tests.

- **Legacy `confidence` alias — symmetric 4-layer removal**:
  1. Backend `friday_service.py::_serialize_decision` — drop `"confidence": primary` mirror key.
  2. Backend `intelligence_service.py` outcome payload — drop `"confidence": ...` mirror key.
  3. Frontend `api.ts::FridayDecision.confidence` — drop the field + delete the "Legacy mirror" comment block.
  4. Frontend `api.ts::DecisionOutcomeData.decision.confidence` — drop the field.
  5. Backend `main.py::FridayDecisionCreateRequest.confidence` — drop the Optional legacy field.
  6. Backend `friday_service.py::add_decision` — drop the `confidence=None` kwarg, the mutual-exclusion branch, and the dual-resolution logic (primary is now required via the new Pydantic field).
  7. Frontend grep: `decision.confidence\b` sites → migrate to `decision.confidenceVsSpyRiskadj` (Plan B follow-up grep may surface additional sites to handle here).

### Out of scope

- `confidence_vs_cash` / `confidence_vs_spy_pure` nullability unchanged.
- `decision_type?` legacy TS alias on `FridayDecision` — not touched (pre-Phase-D technical debt).
- No new schema migration.
- No new features — pure tightening.

### Safety gate

Plan C only runs AFTER Plan B is merged + the grep above confirms no remaining frontend reads of `decision.confidence`.

## Playwright MCP QA — Ship Now validation

**Location: no plan doc needed.** Run directly from a fresh chat session using the Playwright MCP tools.

### Approach

- **Primary: local dev server.** Faster, no prod data pollution, easy reset. All interactive tests (including freeze) happen here.
- **Secondary: prod smoke.** After local QA passes, open the frontend prod URL (TBD — the backend at `https://portfolio-tracker-f8a3.onrender.com` is API-only and returns 404 on `/friday`; the Next.js frontend is hosted elsewhere — ask user for the URL before running). Visually verify render + check that pre-existing archive cards show no regression. DO NOT freeze on prod (would leave a QA snapshot in the archive). Backend prod smoke can still be done directly against `https://portfolio-tracker-f8a3.onrender.com/api/v1/friday/briefing` and `/sleeve-history?weeks=4` (both verified 200 on 2026-04-19 post-Plan-B).

### Checklist (against local dev)

1. `/friday` loads; Bell icon absent in header.
2. A1 briefing card renders at the top (empty-state OK if no prior freeze).
3. A2 sleeve health panel renders with 6 sleeves.
4. No regression in hero strip / portfolio delta / signals / macro / decision journal / archive access sections.
5. Decision journal form shows 3 stacked confidence sliders with value readouts.
6. Ordering-deviation test: set riskadj=3, cash=8 → muted italic note appears. Screenshot.
7. Failure-mode dropdown renders 5 options (price_drop / regime_shift / correlation_breakdown / liquidity_crunch / other). Trigger-threshold numeric input renders alongside.
8. Open `💬 이번 주 코멘트` details, type "QA test comment".
9. Freeze button. Watch step indicator. Navigate to `/friday/<date>`.
10. Archive panel shows italic left-accent quote at top with the comment text.
11. Decision card shows primary `Conf N`, secondary `vs Cash / vs SPY Pure` line, invalidation line, `Mode:` + `Threshold:` metadata line.
12. Network tab check on the freeze: POST `/api/v1/friday/snapshot` body includes `comment`. POST `/api/v1/friday/decisions` body includes all three `confidence_vs_*` fields + `expected_failure_mode` + `trigger_threshold`. **Body must NOT include legacy `confidence` key** (Plan C verification).
13. Response body of both POSTs echoes the new fields; **legacy `confidence` key absent from response** (Plan C verification).

### Prod smoke (after local passes)

- Open prod `/friday`. Header has no Bell. A1 / A2 render without errors (may be empty-state if never frozen under new schema).
- Open an existing archive card at `/friday/<old_date>`. Decision cards show `Conf N` (primary scalar filled from the rename migration of the old `confidence` column).
- DevTools Console: no errors.
- Do NOT freeze.

### Deliverables

- Screenshots saved to `.playwright-mcp/phase-d-ship-now-qa/` (or wherever the MCP default is).
- Plain-text PASS/FAIL per checklist item.
- If bugs: separate follow-up hotfix commits, not in-place fixes during the QA run.

## Progress log

- **2026-04-19 — Plan B shipped.** Commits `1b34f81..5af47de` + hotfix `8757e18` landed on `main` and deployed to Render prod. Backend endpoints verified live via Playwright MCP: `/api/v1/friday/briefing` returns structured payload (user's 2026-04-17 snapshot comment surfaces correctly); `/api/v1/friday/sleeve-history?weeks=4` returns the 6-sleeve zero strip (no recent triggered rules).
- **2026-04-19 — Sleeve normalize hotfix.** Playwright smoke revealed `targetDeviation.category = "BONDS/CASH"` in prod while `SLEEVES` canonical form is `"BONDS-CASH"`. Original `_normalize` stripped `-_space` but not `/`. Commit `8757e18` fixed both backend `briefing_service._normalize` and frontend `SleeveHealthPanel.normalize` with cross-reference comments + regression test. 69/69 backend tests passing.
- **2026-04-19 — Plan C safety gate verified.** `grep -rn "decision\.confidence\b" frontend/src` returns exactly **1 site**: `frontend/src/components/intelligence/OutcomesView.tsx:115` (`conf: {o.decision.confidence}/5`). Plan C must migrate this to `o.decision.confidenceVsSpyRiskadj` as part of the symmetric 4-layer cleanup. Consider whether the `/5` display denominator should become `/10` to match the actual 1..10 scalar range (design call for planning time).

## Cross-session handoff summary

When resuming Plan C in a new chat session, the entry points are:

1. This decision log — authoritative scope for C / QA + Progress log above.
2. TODOS.md §Phase D → Ship Now — checklist state + pointers here.
3. PRODUCT.md §9 — feature intent (Accumulation-as-Hero).
4. DESIGN.md Friday Hierarchy — UI placement spec.
5. `docs/superpowers/plans/2026-04-19-phase-d-friday-form-ui.md` (shipped Plan A UI) + `docs/superpowers/plans/2026-04-19-phase-d-friday-top.md` (shipped Plan B) — style / pattern references for Plan C commits and test-writing.

**First action in the new session: invoke `/superpowers:writing-plans` with Plan C scope from this document + the resolved safety-gate result (OutcomesView.tsx:115).**
