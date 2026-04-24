# API Domain Map

**Scope:** UX-1 read-path endpoints (13 surfaces). See `docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md` for architectural contracts.

**Status:** v1 — minimal registry. Add terms and naming conventions incrementally as new surfaces land.

**Read trigger:** Consult this file when introducing a new API field, renaming an existing field, or resolving a perceived naming conflict. Update this file when a new domain term is introduced.

---

## Envelope rule (root invariant)

Every read-path endpoint response root contains:

- `status: 'ready' | 'partial' | 'unavailable'` — required.
- Optional coverage metadata (surface-specific name: `coverage_start`, `as_of`, `since`, `horizon`, `coverage`, etc.).
- Surface-specific domain data fields. Use `[]` or `{}` for empty, never drop the field.

Empty-state shape equals loaded-state shape — only `status` changes value.

Backend: use `app.api._envelope.wrap_response` to produce these responses.
Frontend: use `lib/envelope.ts` predicates to branch presentation.

---

## Term registry

### Portfolio / performance (cashflow split, shipped in closeout)

- `archive.series` — absolute wealth history, includes external cashflows. `AbsoluteHistoryPoint[]`.
- `performance.series` — cashflow-neutral performance history. `PerformanceHistoryPoint[]`.
- `coverage_start` — ISO date or null. Earliest date for which persisted performance snapshots exist.

### Friday ritual

- `since` — ISO date. Previous freeze date for briefing delta computation.
- `severity_groups` — grouped event list for Since Last Friday card.
- `sleeves` — 6 canonical sleeve identifiers (NDX, DBMF, BRAZIL, MSTR, GLDM, BONDS-CASH).
- `sleeve_history` — per-sleeve signal-firing counts over last N weeks.
- `snapshot` — a single frozen weekly snapshot.
- `snapshots` — list of frozen snapshots.
- `report` — the full weekly report object (portfolio + macro + signals + rules + score).
- `coverage` — per-section availability flags on a snapshot `{portfolio, macro, rules, decisions, slippage, comment}`.
- `deltas` — computed diff between two snapshots on `/friday/compare`.

### Intelligence

- `attributions` — score decomposition time series; each item is an `AttributionData` with `snapshotDate`, `totalScore`, and bucket breakdown. Envelope: `IntelligenceAttributionsEnvelope` (fields: `status`, `date_from`, `date_to`, `attributions`).
- `rules` — rule accuracy table entries (per-rule `fired`/`followed`/`accuracy`). Envelope: `IntelligenceRulesAccuracyEnvelope` (fields: `status`, `rules`).
- `outcomes` — decision outcome evaluations at a given horizon. Envelope: `IntelligenceOutcomesEnvelope` (fields: `status`, `horizon`, `outcomes`).
- `transitions` — regime transition timeline entries (Task 3 will add the envelope).
- `scorecard` — portfolio vs SPY-KRW risk-adjusted metrics (envelope landing in Task 6).

### Reports / archive

- `reports` — collection of `WeeklyReportSummary` rows (keys: `weekEnding`, `generatedAt`, `logicVersion`, `status`, `score`). Envelope: `WeeklyReportSummariesEnvelope` (fields: `status`, `count`, `reports`).
- `count` — length of `reports` array, duplicated in metadata for cheap UI summaries (avoid recomputing on the client).
- `report` — full `WeeklyReport` object (distinct from the summary rows in `reports`). Envelope: `WeeklyReportEnvelope` (fields: `status`, `report`).

---

## Exceptions / migration debt

- `/api/portfolio/history` predates the UX-1 envelope rule. Its `PortfolioHistoryData` (see `frontend/src/lib/api.ts`) carries `status` nested at `performance.status`, not at root, because the response deliberately splits archive and performance into two sub-envelopes. This exception is scheduled for alignment in Phase 1c (`/portfolio` alignment in the scope-lock plan). Do not introduce new endpoints with this nesting pattern; new surfaces follow the root-status rule in §"Envelope rule (root invariant)".

---

## Naming conventions (established)

- Plural field name = collection (`series`, `events`, `sleeves`, `snapshots`).
- `status` at root is reserved for the envelope contract.
- `coverage_*` / `as_of` / `since` / `horizon` are coverage metadata keywords.

---

## Change log

- 2026-04-23 — v1. UX-1 Phase 1a shared-infra commit introduced envelope rule + registry. Portfolio/performance entries already shipped in closeout `49f4c2b`.
- 2026-04-23 — Added Exceptions / migration debt section documenting `/api/portfolio/history` nested-status pattern. Phase 1c will flatten when `/portfolio` alignment ships.
- 2026-04-24 — Phase 1b Task 1: Intelligence attributions / rules / outcomes envelopes added. Subroute pages (rules, attributions, outcomes) on legacy-compat unwrap until their full restructure (Tasks 2, 3, 4).
- 2026-04-24 — Phase 1c Task 1: Weekly-reports list endpoint envelope added (`reports` registry entry + `count` metadata).
