# Phase D — Data-Maturity Partition

**Date:** 2026-04-19
**Scope:** TODOS.md Phase D section restructure
**Related:** PRODUCT.md §9, DESIGN.md#Decisions-Log

## Why restructure

Phase D was originally organized by priority tiers (Tier 1 / 2 / 3 / Deferred / Backlog). After the A3 / A4 / A7 schema + backend + API landed (commit series `bd8be17..bdb9eb0` on `main`), the remaining 17 items partitioned more usefully by **data maturity** than by priority. The mixed-tier layout produced planning friction: it wasn't obvious which items were blocked on code vs. on time.

## Partition

1. **Ship Now (8 items)** — data-maturity independent, buildable today.
2. **Deferred — data-maturity gated (9 items)** — need N weeks / months of frozen decision history to surface meaningful value.
3. **Deferred — schema / backend prerequisite (4 items)** — need a new migration or new service module before UI work is meaningful.
4. **Deploy / Cleanup (2 items)** — Alembic prod apply + plan-doc staleness fix.

## Ship Now locked scope

A3 UI, A4 UI, A7 UI, R1 Bell removal, A1 briefing card, A2 sleeve panel, Discord briefing echo, legacy `confidence` alias cleanup.

## Boundary rationale

- **A1 / A2 included** — the original "2 weeks+" / "4 weeks+" tags describe when their recency sub-components become interesting, not when the components first function. Both rely on existing cron-ingested data (regime transitions, signal history, sleeve drift), not frozen-decision history. Render with graceful degradation on day 1.
- **A5 deferred** — distinct from A1 / A2 because it requires *frozen* decisions (not cron data) with matching `regime + asset_class`. Hard 4-week gate on real user input.
- **C1 borderline** — small deferred schema (`execution_slippage` table) + simple UI. Left in schema-prereq bucket pending explicit Ship-Now escalation by user.
- **D1, E1** — explicitly long-horizon items (counterfactual engine / 12-month revisit). Kept in Deferred — data-maturity gated for scope clarity.

## Invariants preserved

- PRODUCT.md §9 remains the authority on feature intent (Accumulation-as-Hero).
- DESIGN.md Friday / Intelligence / Archive hierarchies unchanged.
- Pre-restructure tier form available in git at commit `b89fc48` for reference.

## Next step

Enter concrete planning on the Ship Now subset. Natural first-plan scope candidates:

- **A3 + A4 + A7 UI + legacy alias cleanup** — one surface (`/friday` decision journal form) + one backend cleanup commit. R1 (Bell removal) cheap enough to bundle.
- **A1 + A2** — separate `/friday` top-of-page surface plan.
- **Discord briefing echo** — independent small backend plan; can ship in parallel with any of the above.
