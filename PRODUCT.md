# PRODUCT.md -- Portfolio Tracker

## 1. Product Vision

Portfolio Tracker is a solo-investor decision-support tool for a KRW-denominated, multi-sleeve portfolio spanning Korean ISA accounts, US-listed ETFs, and Brazilian bonds. It replaces ad-hoc spreadsheet reviews with a deterministic, explainable pipeline that combines macro context, quantitative signals, and portfolio state into a composite score with actionable recommendations. The system surfaces a weekly review dashboard where one number (the composite score out of 100) plus a handful of triggered rules tell the investor whether to hold, rebalance, or act. Every threshold is published and every recommendation traces back to named rules, making the logic fully auditable.

## 2. User Persona

- Solo investor based in Korea
- KRW base currency; all USD-denominated positions are converted via live USD/KRW exchange rates
- Weekly review cadence -- not day-trading, not monthly; the system is designed around a Friday-to-Friday cycle
- Wants: macro-aware signals that respect regime changes, drift alerts when category weights diverge from targets, explainable deterministic rules (no black-box ML), and stress test results showing how the portfolio would have fared in past crises

## 3. Core Loop

**Daily (automated):**
GitHub Actions cron (Mon--Fri at 21:00 UTC / 06:00 KST) triggers `POST /api/cron/update-signals`. The endpoint runs a six-step pipeline: ingest raw prices, generate portfolio snapshots, update VXN history, seed MSTR corporate actions, generate the weekly report (optionally with an LLM summary), and send a Telegram notification.

**Weekly (human):**
Open the dashboard, read the composite score (0--100), review any triggered rules sorted by severity, check the macro regime state across five buckets, and decide.

**Action:**
Hold, rebalance, or execute a specific rotation (e.g., TIGER_2X to KODEX_1X) based on the recommendation stance.

**Record:**
Log executed transactions through the AddAssetModal, which auto-fetches prices and classifies the asset into the correct account silo.

## 4. Key Decisions Supported

- **NDX trend regime rotation:** When NDX (proxied by QQQ) crosses its 250-day moving average, the system recommends switching between the leveraged TIGER_2X and the unleveraged KODEX_1X.
- **MSTR overheating / opportunity:** Z-score and MNAV ratio thresholds detect when MSTR is statistically overextended (sell) or undervalued (buy from DBMF proceeds).
- **Portfolio alignment drift:** When any category weight drifts more than 30% from its target, a high-severity rebalance rule fires.
- **Macro regime fit:** The Fit Score evaluates whether the portfolio's exposure profile (risk beta, duration, inflation defense, diversifier, reserve) matches the current macro environment across five buckets.
- **Crisis resilience:** Stress tests replay the portfolio through the 2020 COVID crash and the 2022 inflation bear market, scoring resilience based on worst return and max drawdown.
- **Concentration risk:** HHI and top-1/top-2 weight checks detect when the portfolio is too concentrated in a single position.

## 5. Scoring Model

The composite score is calculated by `compute_fit_score`, `compute_alignment_score`, and `compute_posture_diversification_score` in ScoreService.

**Composite = Fit (max 40) + Alignment (max 35) + Posture/Diversification (max 25) = 100**

- **Fit Score (0--40):** Evaluates how well the portfolio's exposure profile matches the current macro regime. Five macro buckets (Liquidity, Rates, Inflation, Growth/Labor, Stress/Sentiment) each contribute up to 8 points. The function `_score_fit_bucket` compares each bucket's state (supportive / neutral / adverse) against the portfolio's exposure weights.

- **Alignment Score (0--35):** Measures how closely actual category weights match the target allocation defined in `CATEGORY_TARGETS`. Each category receives points proportional to its target weight (35 * target). A drift of 10% or less earns full points, 10--30% earns half, and over 30% earns zero and triggers a rebalance flag.

- **Posture/Diversification Score (0--25):** Three sub-components: Stress Resilience (0--10) based on simulated worst return and MDD thresholds, Concentration Control (0--10) based on HHI and top-position weights, and Diversifier Reserve (0--5) based on the combined weight of reserve and diversifier exposures.

## 6. Asset Categories (Sleeves)

Target weights are defined in `CATEGORY_TARGETS`:

| Sleeve | Target Weight | Constituent Assets |
|---|---|---|
| NDX | 30% | QQQ, TIGER_2X (379810), KODEX_1X |
| DBMF | 30% | DBMF |
| BRAZIL | 10% | BRAZIL_BOND |
| MSTR | 10% | MSTR |
| GLDM | 10% | GLDM, GLD |
| BONDS/CASH | 10% | TLT, BIL, VBIL, IEF |

Asset-to-category mapping is handled by `asset_to_category` in ScoreService.

## 7. Account Structure

| Account Silo | Description | Examples |
|---|---|---|
| ISA (ISA_ETF) | Korean-listed ETFs held in an Individual Savings Account | TIGER_2X (379810), KODEX_1X (463300), TLT proxy (476760) |
| OVERSEAS (OVERSEAS_ETF) | US-listed ETFs held in an overseas brokerage account | QQQ, DBMF, MSTR, GLDM, BIL, VBIL |
| BRAZIL_BOND | Brazilian government bonds accessed via KIS Open API | BRAZIL_BOND |

Account classification is inferred automatically by `PortfolioService.infer_account_silo` based on asset source and symbol/code.

## 8. Non-Goals

- **Not a brokerage.** The system does not execute trades. It produces recommendations that the investor acts on manually.
- **Not real-time.** Prices are ingested in a daily batch after US market close. The review cadence is weekly.
- **Not multi-user.** Designed for a single investor. There is no authentication, authorization, or user management.
- **Not a backtesting engine.** Stress tests replay historical crises but do not support arbitrary strategy backtesting.
- **Not ML-powered.** All rules are deterministic with published thresholds. The only ML component is an optional LLM summary (OpenAI or Gemini) that narrates the report but does not influence scoring or recommendations.
