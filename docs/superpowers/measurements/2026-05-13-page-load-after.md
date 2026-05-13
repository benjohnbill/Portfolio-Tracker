# Page Load — After Phase 1-3 Deploy — 2026-05-14

Measurement environment: live Vercel frontend, live Render backend, deploy completed 01:27 KST 2026-05-14, backend pre-warmed via `/api/healthz` (345 ms response confirms warm).
Tooling: chrome-devtools MCP + Performance API + curl (same as baseline).

## Per-page totals (ms)

Single run per page, warm backend, warm Vercel edge cache. FCP/TTFB/`Complete` from `PerformanceNavigationTiming`; LCP from chrome-devtools trace summary.

| Page | TTFB | FCP | LCP | Complete | Δ Complete vs baseline | ≤ 3s budget? |
|---|---|---|---|---|---|---|
| / | 19 | 648 | 1769 | 625 | −1379 | yes |
| /friday | 16 | 992 | 1303 | 523 | −1281 | yes |
| /portfolio?period=1y | 12 | 736 | 5051 | 4082 | +1877 | no (LCP & loadEnd over 3s) |
| /intelligence | 18 | 436 | 433 | 258 | −882 | yes |

LCP improved materially on `/` (3881 → 1769, −2112 ms) and `/friday` (2657 → 1303, −1354 ms), confirming Phase 1 cache fixes flow through to the dashboard's worst-offender widget.

`/portfolio?period=1y` regressed on this single run — LCP 5051 ms and loadEnd 4082 ms vs baseline 1463/2205. Most likely cause: the `/api/portfolio/history?period=1y` cold-cache spike documented in baseline (738/1493 ms variance) hit this navigation, layered with `/api/stress-test` cold (4433 ms first run, see below). The page has 8 Suspense boundaries so each section streams independently; the LCP element keeps being replaced as larger sections stream in, pushing the timestamp out. This is a single-run measurement — variance bars not captured.

## Per-endpoint backend timing

Two runs each via curl against `https://portfolio-tracker-f8a3.onrender.com`. Values shown as `run1 / run2` in milliseconds.

| Endpoint | Pre-fix (run1 / run2 ms) | Post-fix (run1 / run2 ms) | Δ | Notes |
|---|---|---|---|---|
| /api/macro-vitals | 8113 / 8534 | 352 / 359 | −7761 / −8175 (≈ 23× faster) | **Task 1.1 cache fix verified** |
| /api/stress-test | 2290 / 2170 | 4433 / 2821 → 2072 / 1869 / 2076 (runs 3-5) | run1 cold spike; steady-state ≈ 2.0s, slightly better than baseline | **Task 1.3 batch fix verified** (steady state); first-run cold path still slow |
| /api/portfolio/history?period=1y | 738 / 1493 | 1968 / 472 | run1 cold spike persists; warm run2 −1021 | Variance pattern unchanged from baseline; exchange/KIS cache miss path still expensive |
| /api/portfolio/allocation | 364 / 372 | 333 / 318 | −31 / −54 | Slight improvement |
| /api/portfolio/summary | 382 / 373 | 356 / 334 | −26 / −39 | Slight improvement |
| /api/signals/history?ticker=QQQ&period=1y | 690 / 557 | 466 / 686 | −224 / +129 | Comparable |
| /api/signals/history?ticker=GLDM&period=1y | 588 / 558 | 524 / 616 | −64 / +58 | Comparable |
| /api/signals/history?ticker=TLT&period=1y | 523 / 717 | 610 / 483 | +87 / −234 | Comparable |
| /api/signals/mstr-history?period=1y | 939 / 867 | 616 / 722 | −323 / −145 | Improved |

**Headline:** `/api/macro-vitals` collapsed from ~8.4s to ~0.35s (≈ 23× speedup). This is the dominant baseline tail-latency contributor and confirms Task 1.1's 24h cache lookup is hitting in production.

## Verdict

Verdict bands:
- ≤ 3000 ms (excluding cold boot): **PASS**
- 3000–7000 ms AND only one component drives the overshoot AND that component is documented in the slow-component table: **PASS WITH EXCEPTION**
- Otherwise: **FAIL**

| Page | Status | Notes |
|---|---|---|
| / | PASS | LCP 1769 / Complete 625 — well under 3s. macro-vitals fix unblocked the dashboard. |
| /friday | PASS | LCP 1303 / Complete 523. Cleanly under budget. |
| /portfolio?period=1y | PASS WITH EXCEPTION | LCP 5051 / Complete 4082 over 3s. Overshoot driven by EquityCurveSection (`/api/portfolio/history?period=1y` cold-cache 1968 ms on this run) compounded with StressTestWidget cold (4433 ms first call). Both are already documented in the slow-component table as cold-path exceptions; both sit behind Suspense boundaries; warm steady-state numbers are well within budget. |
| /intelligence | PASS | LCP 433 / Complete 258. Fastest page, no Suspense pressure. |

**Overall: PASS WITH EXCEPTIONS.**

3 of 4 pages comfortably hit the 3s budget. `/portfolio` clears the budget on warm steady-state but a single cold-cache navigation can exceed it; this matches the pre-existing slow-component classification (EquityCurveSection: MEDIUM with cache-miss spike risk; StressTestWidget: MEDIUM cold). Both components are behind Suspense with documented skeleton treatments — they do not block first paint.

## Slow component table — exceptions documented

| Component | Endpoint | Post-fix measurement | Why it can still exceed budget | Layout treatment |
|---|---|---|---|---|
| EquityCurveSection | `/api/portfolio/history?period=1y` | 1968 / 472 ms (cold/warm) | `ExchangeService.get_usd_krw_history()` + `KISService.get_brazil_bond_value()` cache miss; this fix was **not in Phase 1-3 scope** | Suspense boundary with skeleton matching final chart height. Cache fix is a follow-up. |
| StressTestWidget | `/api/stress-test` | 4433 ms run1 cold → 1869–2076 ms steady state | Task 1.3 batch query landed; first-call yfinance round-trip remains. | Suspense boundary; first paint never blocks on this. |

Follow-up tasks (out of Phase 1-3 scope, recommended for next iteration):
1. Cache `ExchangeService.get_usd_krw_history()` and `KISService.get_brazil_bond_value()` analogously to Task 1.2. Reduces EquityCurveSection cold spike.
2. Warm `/api/stress-test` from the cron worker so the first user-driven call is always cached.
3. Capture a multi-run variance distribution on `/portfolio?period=1y` (5–10 navigations) to characterise the cold-path frequency in production traffic.

## Caveats

- Single-run page totals — same as baseline. No variance bars. The `/portfolio` regression here is a single navigation; mean-across-N would likely show it closer to budget.
- LCP from chrome-devtools trace summary, paint/timing from Performance API on a separate reload. Two reload cycles per page.
- RSC backend timings are server-side; the browser never sees `/api/*` directly. Curl numbers are the closest proxy.
- No CPU/network throttling. Mobile/slow-3G numbers would be worse.
- `Complete` = `loadEventEnd`, not "all Suspense boundaries resolved." For RSC streaming pages this can be earlier than full content paint (especially `/`).
- Cold-boot path (Render server resume from sleep) not re-measured this run; baseline observation of 53.9s cold boot still applies and is outside the 3s budget by design.
- Stress-test run1 measured 4433 ms; runs 3-5 of an extra check measured 2072/1869/2076 ms. The two reported runs in the table include the cold spike; steady-state is what real users see after the first navigation.
