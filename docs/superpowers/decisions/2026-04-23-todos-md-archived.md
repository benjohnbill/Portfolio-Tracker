# TODOS.md Archival

**Date:** 2026-04-23
**Status:** Active
**Scope:** Project-root roadmap/task index

## Summary

`TODOS.md` at the repository root has been renamed to `TODOS.ARCHIVED.md`. It is no longer consulted as current project state. All legacy content is preserved verbatim inside the renamed file for historical reference.

## Context

`TODOS.md` had accumulated three overlapping roles:

1. **Phase roadmap** — Phase D — Accumulation-as-Hero, Ship Now vs Deferred partition, data-maturity gates.
2. **Individual task tracker** — Timezone fix, Friday Time Machine implementation checklist, and similar granular items.
3. **ADR / schema-status log** — landed schema columns, deferred migration inventory, decision-log excerpts.

With these three roles entangled, the update criteria became unclear. Two recent workstreams confirmed the drift:

- The `.omx/` cashflow / benchmark closeout session (2026-04-23) executed a multi-commit refactor landing `PortfolioPerformanceSnapshot`, consumer rebinding, and normalizer hardening without any `TODOS.md` update.
- The Phase UX-1 first-paint brainstorming (2026-04-23) opened a new multi-phase scope without corresponding entry.

The authoritative records for the project now live in:

- `docs/superpowers/decisions/` — scope locks, ADRs, partition decisions.
- `docs/superpowers/plans/` — implementation plans (shipped and in-flight).
- `.omx/plans/`, `.omx/specs/`, `.omx/reports/` — omx / ralph-owned workstreams.

Continuing to treat `TODOS.md` as current state risks producing a third parallel source of truth that is systematically out of date.

## Decision

1. Rename `TODOS.md` → `TODOS.ARCHIVED.md` via `git mv` (history preserved).
2. Do not consult `TODOS.ARCHIVED.md` as current project state going forward.
3. Do not migrate legacy content into decision docs as part of this change. Content stays inside the archived file for historical lookup.

## Explicitly out of scope

- Long-term replacement design. Three possibilities remain open, to be decided in a later session:
  - **Option A** — Reintroduce a minimal project-root `TODOS.md` as a pure index pointing at `docs/superpowers/decisions/` and `docs/superpowers/plans/` entries. One or two lines per active item.
  - **Option B** — Retire the project-root TODO file permanently. Rely on `docs/superpowers/decisions/` + memory + claude-mem observations for project-state visibility.
  - **Option C** — Something else, driven by actual friction signals that emerge.
- Backfill of legacy TODOS content into individual ADR docs. Only pursued if a later session needs to promote a specific item to a standalone decision.

## Re-opening trigger

Revisit this decision when the absence of a project-root roadmap index starts producing friction. Concrete signals:

- Cross-session continuity breaks — future sessions cannot answer "what is the project working on right now" without reading multiple decision docs.
- A new collaborator or a future agent cannot orient themselves inside the repository within a reasonable scan.
- Two or more in-flight workstreams collide because there is no single index of active scopes.

At that point, revisit options A / B / C with evidence of the specific friction observed.

## Cross-references

- Phase UX-1 scope lock (forward reference, to be written this session): `docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md`
- Cashflow / benchmark closeout plan: `.omx/plans/verification-first-cashflow-benchmark-closeout-20260423.md`
- Existing decision-doc pattern examples: `2026-04-19-phase-d-partition.md`, `2026-04-19-phase-d-ship-now-scope-lock.md`
