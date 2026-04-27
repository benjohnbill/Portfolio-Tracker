# PRODUCT.md -- Portfolio Tracker

## 1. Product Vision

Portfolio Tracker is a solo-investor decision-support tool for a KRW-denominated, multi-sleeve portfolio spanning Korean ISA accounts, US-listed ETFs, and Brazilian bonds. It replaces ad-hoc spreadsheet reviews with a deterministic, explainable pipeline that **frames portfolio risk-taking against macro context** -- the composite score signals whether the portfolio's current risk profile is justified by the current macro environment, and whether the portfolio is robust enough to survive when those two diverge. The system surfaces a weekly review dashboard where one number (the composite score out of 100) plus a handful of triggered rules tell the investor whether to hold, rebalance, or act. Every threshold is published and every recommendation traces back to named rules, making the logic fully auditable.

## 2. User Persona

- Solo investor based in Korea
- KRW base currency; all USD-denominated positions are converted via live USD/KRW exchange rates
- Weekly review cadence -- not day-trading, not monthly; the system is designed around a Friday-to-Friday cycle
- Wants: **risk-aware signals where macro regime contextualizes the portfolio's risk-taking** rather than dictating it, drift alerts when category weights diverge from targets, explainable deterministic rules (no black-box ML), and stress test results showing how the portfolio would have fared in past crises

## 3. Core Loop

**Daily (automated):**
GitHub Actions cron (Mon--Fri at 21:00 UTC / 06:00 KST) triggers `POST /api/cron/update-signals`. The endpoint runs a six-step pipeline: ingest raw prices, generate portfolio snapshots, update VXN history, seed MSTR corporate actions, generate the weekly report (optionally with an LLM summary), and send Discord + Telegram notifications (see §9 for alert policy).

**Weekly (human) — Friday ritual:**
Open `/friday`. Review the Since Last Friday briefing card (events since the prior freeze: regime transitions, matured decision outcomes, alert history). Read the composite score (0--100). Review triggered rules sorted by severity, each annotated with a mini-indicator of your own past follow/override outcomes. Check the 6-sleeve Health panel (drift + signal + 4-week recency). Check the macro regime state across five buckets. Decide.

**Decision journal at freeze time:**
For each decision record type, ticker, free-text rationale (`note`), plus three confidence scalars:

1. `confidence_vs_spy_riskadj` (1--10) — probability that over the 3M horizon the portfolio beats SPY-KRW on a risk-adjusted basis (primary goal per portfolio design intent).
2. `confidence_vs_cash` (1--10) — probability that the portfolio posts a positive return over 3M (baseline).
3. `confidence_vs_spy_pure` (1--10) — probability that the portfolio beats SPY-KRW on pure 3M return (stretch).

Expected ordering per portfolio design intent: `#1 ≥ #2 ≥ #3`. Ordering deviation (e.g., `#3 > #1`) is itself a signal recorded for later calibration analysis.

Also record a structured invalidation hypothesis: `expected_failure_mode` enum + `trigger_threshold` numeric + free-text reason. Optionally attach a weekly snapshot comment (1--2 lines, per-freeze observation, distinct from per-decision `note`).

**Freeze (the weekly contract):**
Freeze is not a save. It is an atomic self-contract --- see §9 for the full list of items locked together at freeze time.

**Action (outside the app):**
Hold, rebalance, or execute a specific rotation based on the recommendation stance. The system does not execute trades (see §8).

**Record (optional post-facto):**
Log executed transactions through the AddAssetModal, which auto-fetches prices and classifies the asset into the correct account silo. Optionally log execution slippage (the gap between the frozen decision and actual execution in timing or price) to the per-decision slippage log --- records only, not routing.

## 4. Key Decisions Supported

- **NDX trend regime rotation:** When NDX (proxied by QQQ) crosses its 250-day moving average, the system recommends switching between the leveraged TIGER_2X and the unleveraged KODEX_1X.
- **MSTR overheating / opportunity:** Z-score and MNAV ratio thresholds detect when MSTR is statistically overextended (sell) or undervalued (buy from DBMF proceeds).
- **Portfolio alignment drift:** When any category weight drifts more than 30% from its target, a high-severity rebalance rule fires.
- **Macro regime fit:** The Fit Score evaluates whether the portfolio's exposure profile (risk beta, duration, inflation defense, diversifier, reserve) matches the current macro environment across five buckets.
- **Crisis resilience:** Stress tests replay the portfolio through the 2020 COVID crash and the 2022 inflation bear market, scoring resilience based on worst return and max drawdown.
- **Concentration risk:** HHI and top-1/top-2 weight checks detect when the portfolio is too concentrated in a single position.

## 5. Scoring Model

The composite score is calculated by `compute_fit_score`, `compute_alignment_score`, and `compute_posture_diversification_score` in ScoreService.

**Composite = Fit (max 30) + Alignment (max 30) + Posture/Diversification (max 40) = 100** (v2.4, 2026-04-27 — risk-first reallocation, see Score Allocation Rationale below)

- **Fit Score (0--30):** Evaluates how well the portfolio's exposure profile matches the current macro regime. Five macro buckets (Liquidity/FCI, Rates, Inflation, Growth/Labor, Stress/Sentiment) each contribute up to 6 points. The function `_score_fit_bucket` compares each bucket's state (supportive / neutral / adverse) against the portfolio's exposure weights. Predicate specs are externalized to `score_rules.py` with `RULES_LOGIC_VERSION` (v2.4).

- **Alignment Score (0--30):** Measures how closely actual category weights match the target allocation defined in `CATEGORY_TARGETS`. Each category receives points proportional to its target weight (30 * target). A drift of 10% or less earns full points, 10--30% earns half, and over 30% earns zero and triggers a rebalance flag.

- **Posture/Diversification Score (0--40):** Three sub-components: Stress Resilience (0--20) based on simulated worst return and MDD thresholds, Concentration Control (0--12) based on HHI and top-position weights, and Diversifier Reserve (0--8) based on the combined weight of reserve and diversifier exposures. Stress Resilience is the largest sub-component because crisis survivorship dominates other risk dimensions when a regime turns adverse.

### Sleeve-Level Fit Projection (v2 evolution, 2026-04-27)

The deterministic exposure-factor matching defined above produces *factor-level* fit reasoning. For user-facing presentation, this projects deterministically onto sleeve-level **compatibility bands** ("below" / "in" / "above") via a published `SLEEVE_FACTOR_MAP` that records which exposure factor each sleeve contributes to and in what proportion.

A sleeve's compatibility band is derived from the fit rule predicates that govern its contributing exposure factors. This is a *read-only derivation surface, not a normative optimizer*. Scoring itself remains exposure-factor based; the sleeve projection is the explanation layer for the `/intelligence/macro-context` page.

This evolution preserves §8 Non-Goals -- no ML, only deterministic published rules and their sleeve-level projection.

### Boundary Design Philosophy (v2.3, 2026-04-27)

Indicator state classification follows five principles:

1. **Economic eventfulness over historical percentile** -- hard thresholds require academic / policy precedent (Sahm Rule 0.5pp; NFCI ±0.25; T10Y3M inversion); percentiles are reserved for indicators where absolute level lacks robust meaning (Net Liquidity, M2 YoY, VXN).
2. **Threshold rationale documentation** -- every threshold records its `threshold_rationale_source` (academic / policy / historical_percentile / custom) in `INDICATOR_META`.
3. **Core / secondary indicator distinction** -- within each bucket, one indicator may be designated `core_indicator=True`; its strong reading floors or ceilings the bucket score deterministically (e.g., Sahm Rule strong adverse → Growth/Labor bucket score capped at 0).
4. **Per-indicator computation window** -- `computation_window_weeks` is decoupled from the 26-week display horizon (vol short, labor mid, inflation/growth long).
5. **Signal asymmetry awareness** -- `signal_asymmetry` field records whether false-negative or false-positive cost dominates; reserved as input for future hysteresis layer.

### Score Allocation Rationale (v2.4, 2026-04-27)

The 30/30/40 allocation reflects a **risk-first product philosophy**: Posture/Diversification (Crisis resilience + Concentration control + Diversifier reserve) carries the largest weight because portfolio survivorship dominates macro-environmental fit when the two diverge. Fit and Alignment are equal-weighted second-tier dimensions: macro context informs whether risk-taking is justified, while Alignment polices operational discipline against published targets.

This allocation is a reasoned prior, not an empirical optimum. Phase F (see Future Evolution Path) anticipates re-validation after 26+ weeks of accumulated frozen attribution history. Pre-2026-04-27 weekly reports use the legacy 40/35/25 logic; their `logicVersion` field preserves the historical scoring per record.

### Posture-Stance Veto (v2.4, 2026-04-27)

Beyond contributing to the composite total, Posture/Diversification also gates the recommendation stance via two veto rules added to `_build_recommendation`:

- **Posture < 8** (out of 40) → stance auto-overrides to `reduce_risk`, regardless of composite total.
- **Stress Resilience sub-component < 4** (out of 20) → stance auto-overrides to `reduce_risk`, regardless of composite total.

These vetoes ensure that when the portfolio's structural risk profile breaches survivorship floors, no level of macro fit or weight alignment can mask the warning. They sit *above* the existing 4-branch stance logic in `ARCHITECTURE.md §4` -- vetoes evaluate first; if no veto fires, the existing composite-score-based branches resolve.

### Veto Threshold Recalibration (informational, v2.4)

The veto thresholds (Posture < 8, Stress Resilience < 4) are reasoned priors, not empirically tuned values. If observed firing frequency proves disproportionate to actual portfolio risk events -- the veto fires weekly without drawdown materializing, or fails to catch realized stress -- thresholds should be recalibrated. Recalibration is reactive (not scheduled), triggered by user observation or empirical signal accumulation. A change bumps `RULES_LOGIC_VERSION`.

### Future Evolution Path (informational; reservation, not commitment)

The following items are deferred from v2.4 spec scope but reserved as evolution candidates. Each names the v2.4 placeholder field that anticipates it.

- **Phase A — Hysteresis layer.** Entry/exit asymmetric persistence rules (e.g., adverse entry: 2-week confirmation; adverse release: 4-week improvement average). v2.4: `IndicatorMeta.persistence_weeks` field exists, value = 1 (no hysteresis active).
- **Phase B — 5-state internal classification.** Strong SUP / weak SUP / NEU / weak ADV / strong ADV; display compresses to 3 states. v2.4: not yet present.
- **Phase C — Risk-aware Alignment.** Split Alignment 30 into Structural (target weight drift) + Risk (realized vol / beta-weighted risk contribution drift). v2.4: not yet present; Alignment definition above unchanged.
- **Phase D — Sleeve cluster correlation in Posture.** NDX + MSTR as shared risk cluster; concentration penalty across correlated sleeves. v2.4: not yet present.
- **Phase E — Full weighted bucket aggregation.** External AI prior 0.5/0.3/0.2 (core + secondary 1 + secondary 2). v2.4: reduced form via `core_indicator: bool` floor/ceiling rule; full ratio deferred.
- **Phase F — Empirical score allocation re-validation.** After 26+ weeks of frozen attribution, validate whether 30/30/40 allocation predicts portfolio outcomes better than alternatives. v2.4: rationale glossed above, no commitment to specific tuning.
- **Phase G — Sub-page narrative reflow.** Risk-first ordering on `/intelligence/macro-context` (Positioning → Performance → Causal Map → Indicators). v2.4: atom→cause→current→result order retained pending usage feedback.

## 6. Asset Categories (Sleeves)

Target weights are defined in `CATEGORY_TARGETS`:

| Sleeve | Target Weight | Constituent Assets |
|---|---|---|
| NDX | 30% | KODEX_1X (379810), TIGER_2X (418660) |
| DBMF | 30% | DBMF |
| BRAZIL | 10% | BRAZIL_BOND |
| MSTR | 10% | MSTR |
| GLDM | 10% | GLDM, GLD |
| BONDS/CASH | 10% | ACE_TLT (476760), BIL, VBIL, IEF |

Asset-to-category mapping is handled by `asset_to_category` in ScoreService.

## 7. Account Structure

| Account Silo | Description | Examples |
|---|---|---|
| ISA (ISA_ETF) | Korean-listed ETFs held in an Individual Savings Account | KODEX_1X (379810), TIGER_2X (418660), ACE_TLT (476760) |
| OVERSEAS (OVERSEAS_ETF) | US-listed ETFs held in an overseas brokerage account | QQQ, DBMF, MSTR, GLDM, BIL, VBIL |
| BRAZIL_BOND | Brazilian government bonds accessed via KIS Open API | BRAZIL_BOND |

Account classification is inferred automatically by `PortfolioService.infer_account_silo` based on asset source and symbol/code.

## 8. Non-Goals

- **Not a brokerage.** The system does not execute trades. It produces recommendations that the investor acts on manually.
- **Not real-time.** Prices are ingested in a daily batch after US market close. The review cadence is weekly.
- **Not multi-user.** Designed for a single investor. There is no authentication, authorization, or user management.
- **Not a backtesting engine.** Stress tests replay historical crises but do not support arbitrary strategy backtesting.
- **Not ML-powered.** All rules are deterministic with published thresholds. The only ML component is an optional LLM summary (OpenAI or Gemini) that narrates the report but does not influence scoring or recommendations.
- **Not a gamification app.** No outcome streaks, reward loops, or mood indicators based on decision performance. The ritual-consistency strip (process-completion signal: on-time freeze + fields-complete) is permitted because it measures discipline, not outcome.

## 9. Accumulation-as-Hero

The product is a compounding self-knowledge artifact. Every Friday freeze is not only a record of the week's state but an input that increases the quality of all downstream analysis. Week 52 is not "week 1 buried under 51 entries"; week 52's archive, intelligence views, and decision retrieval are meaningfully richer than they were at week 1.

### Six accumulation axes

1. **Archived history** --- 52+ frozen weeks searchable via the regime ribbon, archive, and quadrant calibration surfaces.
2. **Compression** --- recurring patterns (decision archetypes, regime-specific batting averages, error signatures) automatically surface from raw history into compact tiles.
3. **Trust calibration** --- across rules and regimes, the user learns (with statistical backing) when to trust the system's recommendation and when to override.
4. **Counterfactual accumulation** (Phase D Late) --- "what would have happened if I had followed the rules consistently" traced as a parallel portfolio path, with each override annotated.
5. **Error-memory accumulation** --- recurring mistake signatures named and surfaced (e.g., "`correlation_breakdown` hit 4 times in BR-GLDM context during Inflation-Adverse regime").
6. **Decision-latency accumulation** --- process discipline measured via on-time freeze + field-completion; stacked weeks reveal whether the ritual is growing sharper or eroding.

### Freeze as weekly contract

At freeze time the following are locked together atomically:

1. **World state** (immutable `frozen_report` JSONB copy of the generated weekly report).
2. **3-scalar confidence** (`vs_spy_riskadj` / `vs_cash` / `vs_spy_pure`, see §3).
3. **Structured invalidation** (`expected_failure_mode` enum + `trigger_threshold` numeric + free-text hypothesis).
4. **Optional weekly snapshot comment** (1--2 line per-freeze observation).
5. **Ritual-consistency stamp** (green / amber / red per on-time freeze + field-completion).
6. **3M auto-review schedule** --- at T+3 months the system tests the invalidation threshold and prompts the user to rate the hypothesis realization (Yes/No/Partial/NA).
7. **Trailing-1Y risk metrics snapshot** (portfolio + SPY-KRW: CAGR / MDD / SD / Sharpe / Calmar / Sortino).

### Benchmark framing

SPY-KRW is the goal benchmark --- the reference the portfolio is designed to exceed on a risk-adjusted basis (primarily Calmar, secondarily Sharpe / MDD). It is not a peer composition match; the portfolio's deliberate multi-sleeve allocation (NDX / DBMF / BRAZIL / MSTR / GLDM / BONDS-CASH) is the means to achieve risk-adjusted dominance over SPY-KRW, not to replicate its composition.

The single-number expression of this goal is the Calmar delta: `Calmar(Portfolio) − Calmar(SPY-KRW)` on a trailing-1Y basis. Sustained positive Calmar delta confirms portfolio design intent; persistent negative delta indicates the sophistication is not earning its keep.

### Alert policy

Daily cron alerts (success / failure / regime shifts) flow via **Discord** (primary, webhook-based) and **Telegram** (optional, retained for fallback). The weekly cron additionally echoes the latest non-empty `weekly_snapshots.comment` in the "Since Last Friday" Discord message, closing the user-to-self hand-off loop across weeks. In-app Bell-style notification icons are removed; the `/friday` Since Last Friday briefing card is the accumulated in-app ledger of between-freeze events.
