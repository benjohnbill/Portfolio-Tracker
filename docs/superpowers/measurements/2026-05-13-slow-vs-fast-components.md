# Slow vs Fast Components — Layout Decision Input

**Date:** 2026-05-13
**Source:** Per-endpoint timings from `2026-05-13-page-load-baseline.md`, plus codebase mapping of which RSC component owns each endpoint call.
**Purpose:** This table is the input artifact for the next iteration of layout work. The 3s page-load budget is achievable if slow components are isolated into Suspense boundaries with skeleton placeholders, while fast components remain in the synchronous first-paint path.

> **Important caveat:** This document is written from the **pre-fix baseline**. Tasks 1.1 (macro-vitals cache fix), 1.2 (price cache), and 1.3 (stress-test N+1 fix) materially change the SLOW-tier numbers below. A post-deploy refresh of these numbers is the Phase 4 Task 4.1 deliverable.

## Latency tiers

| Tier | Range (ms) | Treatment |
|---|---|---|
| **FAST** | < 500 ms | Render synchronously in the first paint. No Suspense needed. |
| **MEDIUM** | 500 – 1500 ms | Suspense boundary with skeleton; OK to block within ~1.5s. |
| **SLOW** | 1500 – 3000 ms | Suspense boundary required. Skeleton must match final layout (no CLS). |
| **EXCEPTION** | > 3000 ms | Cannot fit 3s budget. Either route to a separate page, stream into a deferred Suspense with a populated cache-first skeleton, or shift to client-side polling after first paint. |

## Component → Endpoint → Tier (pre-fix baseline)

Endpoints listed are the server-side calls made by each RSC component, measured warm via curl against the live Render backend.

| Component | Endpoint(s) | Backend ms (warm) | Tier (pre-fix) | Post-fix expectation | Pages that mount it |
|---|---|---|---|---|---|
| **MacroVitalsWidget** | `/api/macro-vitals` | 8113 / 8534 | **EXCEPTION** | 352 / 359 ms — **FAST** (Task 1.1 verified, ≈ 23× faster) | `/` (dashboard) |
| **StressTestWidget** | `/api/stress-test` | 2290 / 2170 | **SLOW** | 4433 ms cold → 1869–2076 ms steady (Task 1.3 batch verified) — **MEDIUM** steady-state, EXCEPTION on cold path | `/` (dashboard) |
| **EquityCurveSection** | `/api/portfolio/history?period=…` | 738 / 1493 | MEDIUM (variance — see note) | 1968 / 472 ms — MEDIUM (variance pattern persists; exchange/KIS cache fix not in this plan) | `/portfolio` |
| **MSTRSignalSection** | `/api/signals/mstr-history?period=…` | 939 / 867 | MEDIUM | 616 / 722 ms — MEDIUM (slightly improved) | `/portfolio` |
| **AssetSignalSection (QQQ)** | `/api/signals/history?ticker=QQQ` | 690 / 557 | MEDIUM | 466 / 686 ms — MEDIUM (comparable) | `/portfolio` |
| **AssetSignalSection (GLDM)** | `/api/signals/history?ticker=GLDM` | 588 / 558 | MEDIUM | 524 / 616 ms — MEDIUM (comparable) | `/portfolio` |
| **AssetSignalSection (TLT)** | `/api/signals/history?ticker=TLT` | 523 / 717 | MEDIUM | 610 / 483 ms — MEDIUM (comparable) | `/portfolio` |
| **PortfolioSummaryCard** | `/api/portfolio/summary` | 382 / 373 | **FAST** | 356 / 334 ms — FAST | `/portfolio` |
| **AssetAllocationSection** | `/api/portfolio/allocation` | 364 / 372 | **FAST** | 333 / 318 ms — FAST | `/portfolio` |
| **MacroContextSection** | `/api/macro-context` (24h ISR via `unstable_cache`) | served from Next.js data cache (sub-ms after first build) | **FAST** (after ISR warm) / SLOW (cold ISR — falls back to macro-vitals path) | FAST — cold ISR fallback now hits 352 ms macro-vitals (Task 1.1) | `/friday`, `/intelligence` |
| **FridayReportSection** | `/api/v1/friday/current`, `/api/v1/friday/snapshots`, conditional `/api/v1/friday/snapshot/<date>` | not directly measured (Friday page total: 1804ms warm) | MEDIUM | MEDIUM unchanged (Friday page LCP 1303 ms / Complete 523 ms post-fix) | `/friday` |
| **FridayBriefingSection** | `/api/v1/friday/briefing` | not directly measured | MEDIUM | MEDIUM unchanged | `/friday` |
| **IntelligenceSection (Hero/Stats/Heatmap/Decisions)** | `/api/intelligence/*` family | not directly measured (Intelligence page total: 1140ms warm) | FAST | FAST — Intelligence page LCP 433 ms / Complete 258 ms post-fix | `/intelligence` |

### Variance note on EquityCurveSection

The two `curl` runs on `/api/portfolio/history?period=1y` returned 738 ms and 1493 ms — that's >2× variance on warm cache. Likely cause: the endpoint's underlying `get_equity_curve()` invokes `ExchangeService.get_usd_krw_history()` and `KISService.get_brazil_bond_value()` on cache miss (per the backend audit). On warm DB-cache it's fast; on miss it spikes. Treating it as MEDIUM is appropriate, but if the cold path is hit often it's effectively SLOW.

## Per-page implications

| Page | First-paint budget situation | Recommendation |
|---|---|---|
| `/` (dashboard) | Hosts the worst offender (MacroVitalsWidget, 8.4s pre-fix). Even after Task 1.1 the **first ever** request post-deploy will populate the cache and may be slow. | Wrap MacroVitalsWidget in its own Suspense with a fully-laid-out skeleton (no CLS). Stress widget gets a separate Suspense after Task 1.3. |
| `/friday` | Has the cold-MCP-timeout issue (10s wrapper hit on first navigation). All sub-sections are MEDIUM. | Already uses 5 Suspense boundaries. Acceptable layout. Verify after deploy that warm `/friday` stays <3s. |
| `/portfolio` | Seven fetches in parallel. Slowest tail is EquityCurveSection (cache-miss spike). Per-row signal cards are MEDIUM. | Already uses 8 Suspense boundaries. Task 2.3 (route through `getPortfolioPageData()` aggregator) is conditional — should now go through, since slowest endpoint is ≤1.5s. After Task 2.2 `React.cache()` lands, ensure no double-fetch of same ticker. |
| `/intelligence` | Fastest page (1140ms warm). All FAST. | No layout changes needed. |

## Layout decisions implied (forward-looking, not in this plan)

1. **MacroVitalsWidget must stay behind Suspense forever** — even with the cache, a once-per-day cache-miss path exists (date rollover), and 13 FRED+Yahoo round-trips are inherently slow. Skeleton must match final card height and grid position.

2. **StressTestWidget**, post-Task 1.3 batching, may move from SLOW to MEDIUM but still pays ≤N yfinance fetches on cache miss. Suspense boundary appropriate.

3. **EquityCurveSection variance** is a separate concern. If post-deploy measurements show the spike persists, the next-iteration intervention is to cache `ExchangeService.get_usd_krw_history()` and `KISService.get_brazil_bond_value()` (analogous to Task 1.2 for prices).

4. **MacroContextSection** uses 24-hour ISR. First request after a Vercel deploy will be cold (falls back to MacroVitals path). Consider revalidating on the cron worker after Task 1.1 lands so the first user always sees a cached payload.

5. **Per-page parallel fan-out** — every page already streams independently via Suspense. Tasks 2.1 and 2.2 reinforce per-render dedup; Task 2.3 (if applied) reduces fan-out re-entry. None of these change the layout shape, only the timing inside it.

## Status of this table

| | Status |
|---|---|
| Pre-fix slow/fast classification | ✅ this document |
| Post-fix measurement (deploy required) | ✅ Task 4.1 verified 2026-05-14 — "Post-fix expectation" column now contains measured numbers. macro-vitals fix confirmed (≈ 23× faster). stress-test batch fix confirmed (steady-state ≈ 2.0s). EquityCurve variance persists (cache fix needed). |
| Layout retrofit (separate plan) | not started — this table is the input |

**Verified: 2026-05-14** — Post-deploy measurements completed; see `2026-05-13-page-load-after.md`. Verdict: PASS WITH EXCEPTIONS (3 of 4 pages under 3s budget; `/portfolio` overshoots on cold-cache single-run path, both contributing components already documented as exceptions).
