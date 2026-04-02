# ARCHITECTURE.md -- Portfolio Tracker

## 1. System Overview

```
+---------------------+       +---------------------------+       +------------------+
|  External Data      |       |  Backend (FastAPI)         |       |  Frontend        |
|  Sources            |  -->  |                           |  -->  |  (Next.js)       |
|                     |       |  /api/cron/update-signals  |       |                  |
|  - yfinance         |       |  /api/portfolio/*          |       |  Dashboard       |
|  - FRED via FDR     |       |  /api/signals/*            |       |  Weekly Report   |
|  - KIS Open API     |       |  /api/reports/weekly/*     |       |  Portfolio View  |
|  - OpenAI / Gemini  |       |  /api/algo/action-report   |       |                  |
+---------------------+       +---------------------------+       +------------------+
        |                              |                                  |
        |                              v                                  |
        |                     +------------------+                        |
        +-------------------> |  PostgreSQL      | <----------------------+
                              |  (Render)        |
                              +------------------+
```

**External data sources:**
- **yfinance:** Historical and current prices for US-listed tickers (QQQ, MSTR, DBMF, GLDM, TLT, BIL, SPY, ^VXN, BTC-USD)
- **FRED via FinanceDataReader:** Macro indicators (WALCL, WDTGAL, RRPONTSYD, M2SL, DFII10, T10Y2Y, CPIAUCSL, PCEPILFE, A191RL1Q225SBEA, PAYEMS, BAMLC0A0CM) and USD/KRW exchange rates
- **KIS Open API:** Brazil Bond valuation (real-time KRW value via KISService)
- **OpenAI / Gemini:** Optional LLM-generated narrative summary for the weekly report

## 2. Data Pipeline

The end-to-end pipeline is triggered by `POST /api/cron/update-signals` (defined in `main.py`, function `update_signals`). It is protected by a `CRON_SECRET` header.

**Pipeline steps:**

```
Step 1: PriceIngestionService.update_raw_prices()
        Fetches missing daily close prices for all tracked assets.
        Upserts into raw_daily_prices table (date + ticker composite key).
        Skips BRAZIL_BOND assets (priced via KIS API).
            |
            v
Step 2: PriceIngestionService.generate_portfolio_snapshots()
        Recalculates the full equity curve via PortfolioService.get_equity_curve().
        Upserts daily total_value into portfolio_snapshots table.
            |
            v
Step 3: QuantService.update_vxn_history()
        Downloads 3 years of ^VXN daily closes from yfinance.
        Upserts into vxn_history table.
            |
            v
Step 4: QuantService.seed_mstr_corporate_actions()
        Seeds mstr_corporate_actions with historical BTC holdings
        and outstanding shares if the table is empty.
            |
            v
Step 5: ReportService.generate_weekly_report()
        Assembles the full weekly report (see Section 4).
        Persists to weekly_reports table.
        Optionally generates an LLM summary if provider keys are configured.
            |
            v
Step 6: NotificationService.send_cron_success()
        Sends a Telegram notification with duration, VXN status,
        and weekly score.
```

Each run is logged to the `cron_run_logs` table with status, duration, and error details.

## 3. Decision Engine

The decision engine comprises three subsystems that feed into the weekly report.

### 3.1 AlgoService -- Signal Rules

`AlgoService.get_action_report` evaluates 9 deterministic rules against current holdings and market signals. Rules are split into sell-priority and buy-priority groups; a buy rule for an asset group is suppressed if a sell rule already fired for that group.

**Thresholds** (from `THRESHOLDS` dict in `algo_service.py`):

| Threshold Key | Value | Used By |
|---|---|---|
| MSTR_HARD_EXIT_Z | 3.5 | MSTR Hard Exit rule |
| MSTR_HARD_EXIT_MNAV | 2.5 | MSTR Hard Exit rule |
| MSTR_PROFIT_LOCK_Z | 2.0 | MSTR Profit Lock rule |
| MSTR_AGGRESSIVE_BUY_Z | 0.0 | MSTR Aggressive Buy rule |
| RSI_DEFENSIVE_FLOOR | 35 | GLDM/TLT Defensive rules |
| RSI_REENTRY_CEILING | 65 | GLDM/TLT Re-entry rules |

**All 9 rules:**

| # | Rule ID | Trigger Condition | Action |
|---|---|---|---|
| 1 | MSTR_HARD_EXIT | Z-score > 3.5 OR MNAV ratio > 2.5 | Sell 100% MSTR, buy DBMF |
| 2 | MSTR_PROFIT_LOCK | Z-score > 2.0 (and rule 1 not triggered) | Sell 50% MSTR, buy DBMF |
| 3 | NDX_SAFETY_MODE | NDX price < 250MA, holding TIGER_2X | Sell TIGER_2X, buy KODEX_1X |
| 4 | GLDM_DEFENSIVE | GLDM price < 250MA AND RSI > 35, holding GLDM | Sell GLDM, buy VBIL |
| 5 | TLT_DEFENSIVE | TLT price < 250MA AND RSI > 35, holding TLT | Sell TLT, buy BIL |
| 6 | MSTR_AGGRESSIVE_BUY | Z-score < 0.0, holding DBMF, no MSTR sell | Sell 10% DBMF, buy MSTR |
| 7 | NDX_GROWTH_MODE | NDX price > 250MA, holding KODEX_1X, no NDX sell | Sell KODEX_1X, buy TIGER_2X |
| 8 | TLT_REENTRY | TLT price > 250MA AND RSI < 65, holding BIL, no TLT sell | Sell BIL, buy TLT |
| 9 | GLDM_REENTRY | GLDM price > 250MA AND RSI < 65, holding VBIL, no GLDM sell | Sell VBIL, buy GLDM |

Note: Rules 4, 5, 8, and 9 (GLDM/TLT signal rules) are currently bypassed in production because live yfinance calls for those tickers are disabled to maintain fast UI load times. The prices default to 0.0 and RSI to 50.0, so the defensive rules never fire and the re-entry rules never fire.

### 3.2 ScoreService -- Composite Scoring

Defined across `compute_fit_score`, `compute_alignment_score`, and `compute_posture_diversification_score`.

**Composite = Fit (max 40) + Alignment (max 35) + Posture/Diversification (max 25) = 100**

**Fit Score (0--40):**
Five macro buckets each contribute 0, 4, or 8 points. The function `_score_fit_bucket` evaluates the portfolio's exposure profile (risk_beta, duration, inflation_defense, diversifier, reserve) against each bucket's state (supportive / neutral / adverse). Exposures are computed by `_build_exposures` which maps allocation weights through `asset_to_category`.

**Alignment Score (0--35):**
Compares actual category weights against `CATEGORY_TARGETS` (NDX 30%, DBMF 30%, BRAZIL 10%, MSTR 10%, GLDM 10%, BONDS/CASH 10%). Per-category max points = 35 * target_weight. Drift thresholds: <=10% drift = full points, 10--30% = half, >30% = zero + rebalance flag.

**Posture/Diversification Score (0--25):**
Three sub-scores:
- Stress Resilience (0--10): worst simulated return >= -15% AND worst MDD >= -20% = 10; >= -25% / -35% = 6; else 2.
- Concentration Control (0--10): top1 <= 25% AND top2 <= 45% AND HHI <= 0.18 = 10; top1 <= 35% AND top2 <= 60% = 6; else 2.
- Diversifier Reserve (0--5): reserve + diversifier >= 15% = 5; >= 5% = 3; else 0.

### 3.3 MacroService -- Macro Context

`MacroService.get_macro_snapshot` collects 10 indicators grouped into 5 buckets:

| Bucket | Indicators | Source |
|---|---|---|
| Liquidity | Net Liquidity (WALCL - WDTGAL - RRP), M2 YoY | FRED |
| Rates | 10Y Real Yield (DFII10), 10Y-2Y Spread (T10Y2Y) | FRED |
| Inflation | CPI YoY (CPIAUCSL), Core PCE YoY (PCEPILFE) | FRED |
| Growth/Labor | Real GDP Growth (A191RL1Q225SBEA), NFP 3M Avg Change (PAYEMS) | FRED |
| Stress/Sentiment | VXN (^VXN), Credit Spread (BAMLC0A0CM) | Yahoo Finance, FRED |

**Bucket aggregation:** Each bucket has two indicators. If both are supportive, bucket = supportive (high confidence). If both are adverse, bucket = adverse (high confidence). Otherwise, bucket = neutral. Overall state: 3+ adverse buckets = adverse; 3+ supportive = supportive; else neutral.

**Indicator state classification uses:**
- Percentile-based: Net Liquidity, M2 YoY, 10Y Real Yield, VXN, Credit Spread (via `_state_from_percentiles` with 20th/80th percentile boundaries)
- Threshold-based: CPI YoY (<=2.5% supportive, >=3.5% adverse), Core PCE YoY (<=2.5% supportive, >=3.0% adverse), GDP (>=2.0% supportive, <=0.5% adverse), NFP (>=150k supportive, <=50k adverse), 10Y-2Y Spread (<-0.5% adverse, <0% neutral, else supportive)

## 4. Report Assembly

`ReportService.build_weekly_report` produces the canonical weekly report JSON. The report is persisted to the `weekly_reports` table and served via `GET /api/reports/weekly/latest`.

**JSON shape:**

```
{
  weekEnding           -- ISO date string (Friday)
  generatedAt          -- UTC ISO timestamp
  logicVersion         -- "weekly-report-v0"
  status               -- "final"
  dataFreshness        -- portfolioAsOf, signalsAsOf, macroKnownAsOf, staleFlags
  portfolioSnapshot    -- totalValueKRW, investedCapitalKRW, metrics, allocation, targetDeviation
  macroSnapshot        -- overallState, buckets[], indicators[]
  signalsSnapshot      -- vxn, ndxTrend, mstr, stressTest
  score                -- total, fit, alignment, postureDiversification, bucketBreakdown[], positives[], negatives[]
  triggeredRules       -- [{ruleId, severity, source, message, affectedSleeves, inputs, logicVersion}]
  recommendation       -- {stance, actions[], rationale[]}
  eventAnnotations     -- [{eventId, level, status, title, summary, affectedBuckets, affectedSleeves, duration, decisionImpact}]
  userAction           -- null (reserved for future use)
  outcomeWindow        -- null (reserved for future use)
  notes                -- null (reserved for future use)
  llmSummary           -- null or {provider, model, generatedAt, headline, keyChanges, whyScoreChanged, actionFocus, watchItems}
}
```

**Recommendation stance logic** (in `_build_recommendation`):
- If any signal actions fired: stance = "rebalance"
- Else if total score < 45: stance = "reduce_risk"
- Else if total score < 60: stance = "watch_closely"
- Else: stance = "hold"

**Rule severity mapping** (from `SEVERITY_MAP`): MSTR_HARD_EXIT = critical, MSTR_PROFIT_LOCK / NDX_SAFETY_MODE / PORTFOLIO_ALIGNMENT_DRIFT = high, GLDM_DEFENSIVE / TLT_DEFENSIVE = medium, all buy rules = low.

## 5. Domain Concepts Glossary

| Term | Definition | Where Used |
|---|---|---|
| Sleeve | A logical asset category in the target allocation (NDX, DBMF, MSTR, GLDM, BRAZIL, BONDS/CASH) | `CATEGORY_TARGETS`, `asset_to_category` |
| Fit Score | How well the portfolio's exposure profile matches the current macro regime (0--40) | `compute_fit_score` |
| Alignment Score | How closely actual category weights match target weights (0--35) | `compute_alignment_score` |
| MNAV | Modeled Net Asset Value of MSTR: (BTC price * BTC holdings) / outstanding shares | `QuantService.get_mstr_signal` |
| Z-Score | Rolling 252-day standardized deviation of MSTR's MNAV ratio from its mean | `QuantService.get_mstr_signal` |
| Macro Bucket | One of five macro domains (Liquidity, Rates, Inflation, Growth/Labor, Stress/Sentiment) | `MacroService.BUCKET_ORDER` |
| Exposure | Portfolio weight decomposed into risk factors: risk_beta, duration, inflation_defense, diversifier, reserve | `_build_exposures` |
| Event Annotation | A manual or automated note attached to a specific report week for context | `EventAnnotation` model, `AnnotationService` |
| Account Silo | Physical account classification: ISA_ETF, OVERSEAS_ETF, or BRAZIL_BOND | `AccountSilo` enum, `PortfolioService.infer_account_silo` |
| Posture/Diversification | Combined score for stress resilience, concentration control, and diversifier reserve (0--25) | `compute_posture_diversification_score` |
| HHI | Herfindahl-Hirschman Index measuring portfolio concentration (sum of squared weights) | `compute_posture_diversification_score` |
| Stance | The recommendation output: hold, rebalance, reduce_risk, or watch_closely | `ReportService._build_recommendation` |

## 6. Database Schema

All models are defined in `models.py` using SQLAlchemy declarative base.

| Table | Purpose |
|---|---|
| `assets` | Asset registry with symbol, code, name, source (KR/US), account type, and account silo |
| `daily_prices` | Legacy price table (asset_id foreign key, date, close) |
| `raw_daily_prices` | Primary price cache with composite key (date, ticker, close_price) |
| `portfolio_snapshots` | Daily portfolio total value snapshots for historical tracking |
| `transactions` | Trade log: BUY/SELL with quantity, price, total_amount, date, account_type |
| `vxn_history` | Daily ^VXN close prices for volatility signal computation |
| `mstr_corporate_actions` | MSTR BTC holdings and outstanding shares for MNAV calculation |
| `weekly_reports` | Persisted weekly report JSON with week_ending as unique key |
| `event_annotations` | Manual or automated event notes attached to report weeks |
| `cron_run_logs` | Operational log for each cron job execution (status, duration, errors) |

## 7. Deployment Topology

```
+---------------------+         +-------------------------+         +------------------+
|  GitHub Actions      |  POST   |  Render                 |         |  Render          |
|                      | ------> |  portfolio-backend      |         |  Frontend        |
|  daily-quant-update  |         |  (FastAPI + uvicorn)    | <-----> |  (Next.js)       |
|  cron: 0 21 * * 1-5  |         |                         |         |                  |
|                      |         |  Python 3.11            |         |                  |
|  keep-alive          |         |  PostgreSQL             |         |                  |
|  cron: */30 * * * *  |         +-------------------------+         +------------------+
+---------------------+
```

**GitHub Actions workflows:**
- `daily-quant-update.yml`: Runs Mon--Fri at 21:00 UTC (06:00 KST). Calls `POST /api/cron/update-signals` with `x-cron-secret` header. Retries up to 3 times with 30-second intervals.
- `keep-alive.yml`: Runs every 30 minutes. Pings `GET /api/assets` to prevent Render free-tier spin-down.

**Render configuration** (from `render.yaml`):
- Service type: web, Python environment
- Build: `pip install -r backend/requirements.txt`
- Start: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`

**Environment variables** (names only):
- `DATABASE_URL` -- PostgreSQL connection string
- `CRON_SECRET` -- Shared secret for cron endpoint authentication
- `KIS_APP_KEY`, `KIS_APP_SECRET` -- KIS Open API credentials for Brazil Bond
- `OPENAI_API_KEY` -- Optional, for LLM summary generation
- `GEMINI_API_KEY_MAIN` -- Optional, fallback LLM provider
- `WEEKLY_REPORT_LLM_PROVIDER` -- "openai" or "gemini"
- `WEEKLY_REPORT_OPENAI_MODEL` -- Default: "gpt-4o-mini"
- `WEEKLY_REPORT_GEMINI_MODEL` -- Default: "gemini-2.5-flash"
- `BACKEND_BASE_URL` -- GitHub Actions secret for cron and keep-alive targets
- `NEXT_PUBLIC_API_URL` -- Frontend environment variable pointing to backend

## 8. Key Technical Decisions

| Decision | Rationale | Trade-off |
|---|---|---|
| Price caching in `raw_daily_prices` | Avoid repeated yfinance/FDR calls; enable fast portfolio valuation without live API hits | Prices are stale until the next cron run; intraday moves are invisible |
| Deterministic rules with published thresholds | Full explainability; every recommendation traces to a named rule and numeric threshold | Cannot adapt to novel market regimes without manual threshold updates |
| Composite score (Fit + Alignment + Posture) | Single number for weekly decision; each component is independently interpretable | Weighting (40/35/25) is subjective; no empirical optimization of the split |
| PostgreSQL on Render (with SQLite fallback) | Production uses PostgreSQL for upsert support (`ON CONFLICT`); local dev can use SQLite | Requires `DATABASE_URL` configuration; SQLite lacks `ON CONFLICT` dialect |
| LLM summary with provider fallback | OpenAI primary, Gemini fallback; graceful degradation if neither key is set | Adds latency to report generation; LLM output is narration only, not scoring |
| Brazil Bond via KIS API | Only source for real-time KRW-denominated bond valuation; no yfinance equivalent | Requires KIS credentials; falls back to last transaction price if API fails |
| GLDM/TLT signal bypass | Live yfinance calls for GLDM/TLT technical indicators were disabled to achieve sub-100ms UI load | Rules 4, 5, 8, 9 never fire in production; those assets are effectively in hold-only mode |
| Single-file routes in `main.py` | All FastAPI endpoints in one file; simple for a solo-developer project | Will need splitting if endpoint count grows significantly |
| Stress test with proxy mapping | Assets that did not exist during historical crises use proxy tickers (e.g., GLDM proxied by GLD, VBIL by BND) | Proxy returns are approximations, not exact historical performance |
| Weekly report persistence | Reports are upserted by `week_ending`; regeneration overwrites the previous version for the same week | No versioning of within-week regenerations; only the latest version is kept |
