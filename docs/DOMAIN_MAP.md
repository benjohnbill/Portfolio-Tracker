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

### Intelligence (Phase 1b will extend this section)

- `attributions` — score decomposition over time.
- `rules` — rule accuracy table entries.
- `outcomes` — decision outcome evaluation.
- `scorecard` — portfolio vs SPY-KRW risk-adjusted metrics.

---

## Naming conventions (established)

- Plural field name = collection (`series`, `events`, `sleeves`, `snapshots`).
- `status` at root is reserved for the envelope contract.
- `coverage_*` / `as_of` / `since` / `horizon` are coverage metadata keywords.

---

## Change log

- 2026-04-23 — v1. UX-1 Phase 1a shared-infra commit introduced envelope rule + registry. Portfolio/performance entries already shipped in closeout `49f4c2b`.
