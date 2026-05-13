# Page Load Baseline — 2026-05-13

Measurement environment: live Vercel frontend, live Render backend, backend pre-warmed.
Tooling: chrome-devtools MCP performance trace + Performance API (`getEntriesByType`)
for FCP/TTFB/loadEvent; LCP from chrome-devtools trace summary; per-endpoint backend
timings via `curl` against the live Render backend (RSC architecture — browser never
calls `/api/*` directly, so per-endpoint timings cannot be sourced from the trace
network panel).

## Per-page totals (ms)

All four pages were measured warm (RSC + browser cache). Values: FCP/TTFB/`Complete`
from Performance API on a fresh navigation; LCP from chrome-devtools trace summary
(separate reload). Single run per page — these are baseline snapshots, not
distributions.

| Page | TTFB | FCP | LCP | Complete | Cold boot included? |
|---|---|---|---|---|---|
| / | 18 | 728 | 3881 | 2004 | no |
| /friday | 12 | 620 | 2657 | 1804 | no |
| /portfolio?period=1y | 38 | 1340 | 1463 | 2205 | no |
| /intelligence | 15 | 676 | 675 | 1140 | no |

Notes on the columns:
- **TTFB** = `PerformanceNavigationTiming.responseStart`.
- **FCP** = first-contentful-paint entry.
- **LCP** = largest-contentful-paint, observed in chrome-devtools trace
  (Performance API LCP buffered list was empty on warm reloads, so the trace
  number is authoritative).
- **Complete** = `loadEventEnd` from PerformanceNavigationTiming. This is
  "browser onload fired," not "every Suspense boundary resolved." For RSC pages
  with deferred sections (especially `/portfolio` and `/friday`), additional
  streaming may continue after `loadEvent`.
- **Cold boot included?** = "no" because the Render backend was pre-warmed
  before all four measurements. Cold path metrics are in the separate section
  below.

LCP > Complete on `/` is real, not a measurement bug: the `/` page renders a
hero illustration whose LCP element keeps changing as RSC streams complete,
pushing the LCP timestamp past `loadEvent` even though the page is
navigation-ready. See `/` in chrome-devtools trace bounds: max-min ≈ 6.8s.

## Per-endpoint backend timing (from /portfolio?period=1y page)

Measured via `curl` against `https://portfolio-tracker-f8a3.onrender.com`. Two runs
per endpoint; both reported below as `run1 / run2 (s)`. Backend was warm.

These endpoints are called server-side by Next.js RSC, not by the browser, so the
chrome-devtools network panel never sees them. The numbers below are upper-bound
contributions to RSC server render time.

| Endpoint | Duration (ms) | Notes |
|---|---|---|
| /api/portfolio/history?period=1y | 738 / 1493 | called by EquityCurveSection |
| /api/portfolio/allocation | 364 / 372 | AssetAllocationSection |
| /api/portfolio/summary | 382 / 373 | PortfolioSummaryCard |
| /api/signals/history?ticker=QQQ&period=1y | 690 / 557 | NDX signal card |
| /api/signals/history?ticker=GLDM&period=1y | 588 / 558 | Gold signal card |
| /api/signals/history?ticker=TLT&period=1y | 523 / 717 | Bonds signal card |
| /api/signals/mstr-history?period=1y | 939 / 867 | MSTR signal card |
| /api/macro-vitals | 8113 / 8534 | dashboard widget — **8x slower than next worst** |
| /api/stress-test | 2290 / 2170 | stress widget |

Sum of run1 values: ~14.6s of backend work if all called serially. RSC parallelism
hides most of this, but `/api/macro-vitals` alone (~8.4s, 205-byte response —
pure server compute) is the dominant tail-latency contributor on any page that
includes it.

## Observed cold-boot duration

- First `/api/assets` call after Render sleep: **53,938 ms** (status 200)
- Second `/api/assets` call (warm confirmation): **465 ms** (status 200)
- Pages that timed out / 503'd during cold boot: none — but the first
  `chrome-devtools navigate_page` to `/friday` hit the MCP's 10s navigation
  timeout (the page kept loading; the MCP wrapper gave up). This is consistent
  with RSC server-render still waiting on backend endpoints when the backend
  has just woken or is mid-request.

## Caveats / measurement gaps

- **LCP from trace vs. Performance API.** Two reload cycles per page (one for
  the chrome-devtools trace, one for the Performance API snapshot). Numbers are
  from separate reloads, not the same load. Variance between reloads is small
  on warm cache but not zero.
- **RSC backend timings invisible to the browser.** The plan template assumes
  per-endpoint browser-side network rows; with RSC there are none. Curl numbers
  are the closest proxy and are reported here in lieu.
- **No CPU/network throttling.** Measurements taken on developer machine
  (WSL → Linux Chromium headless). Mobile / slow-3G numbers would be worse.
- **Single-run page totals.** Each page total is one navigation. No variance
  bars. Good enough for baseline but not for micro-optimization claims.
- **`Complete` is `loadEventEnd`.** For RSC streaming pages this can be earlier
  than "all Suspense boundaries painted." If the 3s budget cares about
  "everything rendered," a stricter metric (e.g. last network XHR + last
  Suspense resolve) is needed in a follow-up measurement.
