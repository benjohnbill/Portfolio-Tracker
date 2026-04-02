# Portfolio Charts Status

Updated: 2026-04-03

## Purpose

This document classifies the current portfolio chart work into three buckets so the next discussion can cleanly separate:

1. items already implemented,
2. items that remain under-verified or under-specified,
3. items that require product or technical discussion before implementation.

It is based on the current codebase, the Batch 1 plan, and the chart spec.

## Executive Summary

- Batch 1 chart implementation is largely present in code.
- Batch 1 should not yet be called fully closed because the verification chain is still incomplete.
- The MSTR chart exists, but its data basis is not yet strong enough to be treated as fully trusted for production decision support.
- Batch 2, including Ulcer Index, should still be treated as not yet implemented.

## 1) Implemented

These items are present in the active codebase.

### Batch 1 frontend chart surface

- `frontend/src/app/portfolio/page.tsx:33-35` loads `getPortfolioPageData(period)` with a default period of `1y`.
- `frontend/src/app/portfolio/page.tsx:171-188` renders the shared period selector with `1M / 3M / 6M / 1Y / All`.
- `frontend/src/app/portfolio/page.tsx:192-262` renders the Batch 1 chart layout with:
  - `HistoryChart`
  - `AlphaChart`
  - `NDXTrendChart`
  - `MSTRZScoreChart`

### SPY benchmark and alpha data contract

- `backend/app/main.py:213-226` exposes `benchmark_value` and `alpha` from `/api/portfolio/history`.
- `backend/app/services/portfolio_service.py:272-279` computes and returns `benchmark_value` and `alpha`.
- `frontend/src/lib/api.ts:1-22` extends `PortfolioHistoryData` with `benchmark_value?: number` and `alpha?: number`.

### Batch 1 chart components

- `frontend/src/components/features/HistoryChart.tsx` implements the equity curve with SPY benchmark overlay and tooltip support.
- `frontend/src/components/features/AlphaChart.tsx:13-116` implements the alpha chart with zero line and positive/negative fills.
- `frontend/src/components/features/NDXTrendChart.tsx` implements NDX price vs 250MA, regime shading, mode label, and current stats.
- `frontend/src/components/features/MSTRZScoreChart.tsx` implements the Z-score chart with threshold lines, zones, and current status.

### Batch 1 backend history endpoints

- `backend/app/main.py:280-288` implements:
  - `GET /api/signals/mstr-history`
  - `GET /api/signals/ndx-history`
- `frontend/src/lib/api.ts:380-440` wires `getNDXHistory()`, `getMSTRHistory()`, and `getPortfolioPageData()`.

### Verified during this session

- `frontend/src/components/features/AlphaChart.tsx` was updated so negative alpha values render with red fill below zero.
- `cd frontend && npm run build` passed after the AlphaChart fix.

## 2) Under-specified or Incomplete

These items are not cleanly closed yet. Some are implemented in code but still not fully validated; others exist with operational caveats that keep them from being treated as production-ready.

### Batch 1 verification chain is still incomplete

The Batch 1 plan still requires verification work that has not been fully closed in repo evidence.

- `.omc/plans/portfolio-charts-batch1.md:239-269` still calls for:
  - backend endpoint checks via curl,
  - frontend build verification,
  - visual verification on `/portfolio`,
  - short-period edge-case testing.
- `.omc/plans/portfolio-charts-batch1.md:256-269` keeps the acceptance checklist unchecked.

Current status of that chain:

- Frontend build: completed in this session.
- ESLint: still open as a verification step.
- Backend runtime/curl verification: still open.
- Browser QA for `1Y` / `1M` and sparse-data handling: still open.

### Frontend degradation behavior is implementation-complete but validation-incomplete

- `frontend/src/lib/api.ts:380-402` returns empty arrays on NDX/MSTR history fetch failure.
- `frontend/src/app/portfolio/page.tsx` renders the charts using `ndxHistory` and `mstrHistory`, which means the failure mode is “empty chart / insufficient data” rather than a hard page failure.

This behavior may be acceptable, but it still needs explicit visual/runtime validation before being called complete.

### MSTR chart implementation exists, but trustworthiness is not production-complete

- `backend/app/services/quant_service.py:119-142` seeds `mstr_corporate_actions` with hardcoded snapshot data ending at `2024-03-01`.
- `backend/app/services/quant_service.py:145-179` builds the MSTR dataframe from cached DB tables plus those seeded corporate actions.

As a result, the MSTR chart path is implemented, but the underlying corporate-action basis is stale enough that the chart should not yet be treated as fully trustworthy for production decision-making.

In short:

- implementation status: mostly complete,
- production-readiness status: incomplete.

## 3) Discussion-needed

These items should be resolved through explicit product/technical discussion before implementation proceeds.

### MSTR data reliability remediation path

The main unresolved question is not whether the chart exists, but how its data should become trustworthy.

Open decision:

- Which remediation path should be adopted for `mstr_corporate_actions`?

Candidate options:

1. add runtime ingestion / refresh for MSTR corporate actions,
2. manually backfill and maintain the table with a defined update process,
3. keep the current implementation but add an explicit UI freshness/risk warning,
4. combine a short-term warning with a proper ingestion follow-up.

Until this is decided, the MSTR chart should be treated as implemented-but-not-trusted.

### Batch 2 scope start condition

The spec clearly places Ulcer Index in Batch 2, but the repo currently contains no Ulcer implementation.

Evidence:

- `.omc/specs/deep-interview-portfolio-charts.md:23` defines Batch 2 as the later chart batch.
- `.omc/specs/deep-interview-portfolio-charts.md:121` names `UlcerIndex` as a Batch 2 entity.
- No Ulcer Index component or endpoint is present in active frontend/backend code.

Open decision:

- Should Batch 2 begin only after Batch 1 verification and MSTR trust remediation are closed, or can Ulcer Index begin in parallel as a separate stream?

### AGENTS.md update policy for this workstream

Before editing `AGENTS.md`, decide whether there is any durable instruction worth preserving.

Current recommendation:

- do not put transient task status into `AGENTS.md`,
- keep status tracking in docs,
- only update `AGENTS.md` if we want to preserve a lasting rule (for example, how to treat chart verification or data-trust warnings in future work).

## Recommended next order

1. Close Batch 1 verification evidence:
   - run ESLint,
   - verify backend endpoints live,
   - run browser QA for `/portfolio` on `1Y` and `1M`.
2. Decide the MSTR trust remediation path.
3. Only then decide whether Batch 2 should start immediately or wait for Batch 1 closure.
4. Revisit `AGENTS.md` only if that discussion produces a durable new instruction.

## Current working conclusion

- Batch 1 implementation: nearly complete
- Batch 1 verification: incomplete
- MSTR trust remediation: not implemented
- Batch 2 Ulcer Index: not implemented
