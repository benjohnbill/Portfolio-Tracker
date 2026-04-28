"""Source of truth for macro indicator metadata. Consumed by MacroService for
state classification, by score_rules / score_service for predicate predicates,
and by MacroContextService + IndicatorCard for the explanation surface.

META_LOGIC_VERSION must bump on any threshold or core_indicator change. The
version is emitted in every /api/intelligence/macro-context envelope and
recorded on every frozen weekly_report's score record so historical surfaces
remain interpretable across versions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

META_LOGIC_VERSION = "1.0.0"

LeadLagTier = Literal[
    "strong_lead_12_18m",
    "mid_lead_6_12m",
    "coincident",
    "weak_lag_1_3m",
    "strong_lag_quarterly",
]
ThresholdSource = Literal["academic", "policy", "historical_percentile", "custom"]
SignalAsymmetry = Literal["fn_dominant", "fp_dominant", "symmetric"]


@dataclass(frozen=True)
class IndicatorMeta:
    key: str
    label: str
    bucket: str
    lead_lag_tier: LeadLagTier
    definition: str
    methodology: str
    why_it_matters: str
    baseline_thresholds: dict[str, float] = field(default_factory=dict)
    threshold_rationale: str = ""
    threshold_rationale_source: ThresholdSource = "custom"
    computation_window_weeks: int = 156
    signal_asymmetry: SignalAsymmetry = "symmetric"
    core_indicator: bool = False
    persistence_weeks: int = 1
    source: str = "FRED"
    refresh_frequency: Literal["daily", "weekly", "monthly", "quarterly"] = "weekly"


INDICATOR_META: dict[str, IndicatorMeta] = {
    # Liquidity/FCI ------------------------------------------------------
    "net_liquidity": IndicatorMeta(
        key="net_liquidity",
        label="Net Liquidity",
        bucket="Liquidity/FCI",
        lead_lag_tier="mid_lead_6_12m",
        definition="Fed balance sheet (WALCL) minus Treasury General Account (WDTGAL) minus reverse repo (RRPONTSYD). Approximates dollars circulating outside the Fed.",
        methodology="WALCL/1e6 − WDTGAL/1e6 − RRPONTSYD/1e3. Forward-fill missing dates. Percentile vs trailing 3-year window. Hard floor at 5T.",
        why_it_matters="Risk assets historically expand when net liquidity rises and contract when it shrinks. Mid-lead — moves 6-12 months ahead of risk price action.",
        baseline_thresholds={"hard_floor": 5.0},
        threshold_rationale="Hard 5T floor + 20/80 percentile bands; absolute level lacks robust meaning, percentile reserved per Boundary Design Philosophy.",
        threshold_rationale_source="historical_percentile",
        computation_window_weeks=156,
        signal_asymmetry="symmetric",
        core_indicator=False,
        persistence_weeks=1,
        source="FRED",
        refresh_frequency="weekly",
    ),
    "m2_yoy": IndicatorMeta(
        key="m2_yoy",
        label="M2 YoY",
        bucket="Liquidity/FCI",
        lead_lag_tier="mid_lead_6_12m",
        definition="Year-over-year change in M2 money supply.",
        methodology="(M2SL_t / M2SL_t-12) − 1, expressed as percent. Percentile vs trailing window.",
        why_it_matters="Broad money growth is a slow-moving liquidity input that conditions multi-quarter risk appetite.",
        baseline_thresholds={},
        threshold_rationale="Percentile bands; level is regime-dependent so absolute thresholds are not robust.",
        threshold_rationale_source="historical_percentile",
        computation_window_weeks=520,
        signal_asymmetry="symmetric",
        source="FRED",
        refresh_frequency="monthly",
    ),
    "nfci": IndicatorMeta(
        key="nfci",
        label="NFCI",
        bucket="Liquidity/FCI",
        lead_lag_tier="mid_lead_6_12m",
        definition="Chicago Fed National Financial Conditions Index. >0 = tighter than average, <0 = looser.",
        methodology="Direct FRED series NFCI. Threshold ±0.25 on the level.",
        why_it_matters="Synthetic measure of credit, liquidity, and leverage stress. Tightness leads risk-asset drawdowns.",
        baseline_thresholds={"adverse_above": 0.25, "supportive_below": -0.25},
        threshold_rationale="Chicago Fed publication conventions; ±0.25 is the standard tight/loose flag.",
        threshold_rationale_source="policy",
        computation_window_weeks=104,
        signal_asymmetry="fp_dominant",
        core_indicator=True,
        source="FRED",
        refresh_frequency="weekly",
    ),
    # Rates --------------------------------------------------------------
    "real_yield_10y": IndicatorMeta(
        key="real_yield_10y",
        label="10Y Real Yield",
        bucket="Rates",
        lead_lag_tier="coincident",
        definition="10-year TIPS yield (DFII10) — nominal yield minus inflation breakeven.",
        methodology="Direct FRED DFII10 level. Percentile bands with 1.5 hard floor on adverse side.",
        why_it_matters="Real yield is the discount rate for risk assets — high real yield → equity multiple compression.",
        baseline_thresholds={"hard_floor": 1.5},
        threshold_rationale="Percentile + hard 1.5% floor; rising real yields above 1.5 compress multiples historically.",
        threshold_rationale_source="historical_percentile",
        computation_window_weeks=156,
        signal_asymmetry="symmetric",
        source="FRED",
        refresh_frequency="daily",
    ),
    "yield_spread_10y2y": IndicatorMeta(
        key="yield_spread_10y2y",
        label="10Y-2Y Spread",
        bucket="Rates",
        lead_lag_tier="strong_lead_12_18m",
        definition="10-year minus 2-year Treasury yield (T10Y2Y).",
        methodology="Direct FRED T10Y2Y level. <-0.5 adverse, <0 neutral, else supportive.",
        why_it_matters="Inverted curve has historically led recessions by 12-18 months.",
        baseline_thresholds={"adverse_below": -0.5, "neutral_below": 0.0},
        threshold_rationale="Academic recession-prediction literature uses inversion (<0) as the canonical signal; -0.5 is the deeper-inversion adverse threshold.",
        threshold_rationale_source="academic",
        computation_window_weeks=520,
        signal_asymmetry="fn_dominant",
        source="FRED",
        refresh_frequency="daily",
    ),
    "yield_spread_10y3m": IndicatorMeta(
        key="yield_spread_10y3m",
        label="10Y-3M Spread",
        bucket="Rates",
        lead_lag_tier="strong_lead_12_18m",
        definition="10-year minus 3-month Treasury yield (T10Y3M). NY Fed recession-probability model uses this spread.",
        methodology="Direct FRED T10Y3M level. Adverse if inverted (<0) for 4+ consecutive weeks (persistence_weeks=4).",
        why_it_matters="NY Fed's primary recession-probability input. Strong-lead 12-18m.",
        baseline_thresholds={"adverse_below": 0.0},
        threshold_rationale="NY Fed recession-probability model standard; persistence required to filter noise.",
        threshold_rationale_source="policy",
        computation_window_weeks=520,
        signal_asymmetry="fn_dominant",
        core_indicator=True,
        persistence_weeks=4,
        source="FRED",
        refresh_frequency="daily",
    ),
    # Inflation ----------------------------------------------------------
    "cpi_yoy": IndicatorMeta(
        key="cpi_yoy",
        label="CPI YoY",
        bucket="Inflation",
        lead_lag_tier="weak_lag_1_3m",
        definition="Headline CPI year-over-year change (CPIAUCSL).",
        methodology="(CPIAUCSL_t / CPIAUCSL_t-12) − 1, percent. <=2.5 supportive, >=3.5 adverse.",
        why_it_matters="Headline CPI shapes near-term policy expectations and household sentiment.",
        baseline_thresholds={"supportive_below": 2.5, "adverse_above": 3.5},
        threshold_rationale="Fed 2% target + 1.5pp tolerance band → 2.5 supportive ceiling; 3.5 marks meaningful overshoot.",
        threshold_rationale_source="policy",
        computation_window_weeks=156,
        signal_asymmetry="symmetric",
        source="FRED",
        refresh_frequency="monthly",
    ),
    "core_pce_yoy": IndicatorMeta(
        key="core_pce_yoy",
        label="Core PCE YoY",
        bucket="Inflation",
        lead_lag_tier="weak_lag_1_3m",
        definition="Core PCE (excluding food & energy) year-over-year (PCEPILFE).",
        methodology="(PCEPILFE_t / PCEPILFE_t-12) − 1, percent. <=2.5 supportive, >=3.0 adverse.",
        why_it_matters="The Fed's preferred inflation gauge — sticky enough to drive policy.",
        baseline_thresholds={"supportive_below": 2.5, "adverse_above": 3.0},
        threshold_rationale="Fed dual-mandate target framing + sticky-inflation literature; 3.0 marks the policy-action zone.",
        threshold_rationale_source="policy",
        computation_window_weeks=156,
        signal_asymmetry="fn_dominant",
        core_indicator=True,
        source="FRED",
        refresh_frequency="monthly",
    ),
    # Growth/Labor -------------------------------------------------------
    "real_gdp_growth": IndicatorMeta(
        key="real_gdp_growth",
        label="Real GDP Growth",
        bucket="Growth/Labor",
        lead_lag_tier="strong_lag_quarterly",
        definition="Real GDP annualized quarterly growth (A191RL1Q225SBEA).",
        methodology="Direct FRED level. >=2.0 supportive, <=0.5 adverse.",
        why_it_matters="Coarsest read of cycle position; lags by a quarter so it confirms rather than leads.",
        baseline_thresholds={"supportive_above": 2.0, "adverse_below": 0.5},
        threshold_rationale="Trend US growth ~2%; sub-1% historically aligns with NBER recession periods.",
        threshold_rationale_source="academic",
        computation_window_weeks=520,
        signal_asymmetry="symmetric",
        source="FRED",
        refresh_frequency="quarterly",
    ),
    "nfp_change_3m_avg": IndicatorMeta(
        key="nfp_change_3m_avg",
        label="NFP 3M Avg",
        bucket="Growth/Labor",
        lead_lag_tier="weak_lag_1_3m",
        definition="3-month moving average of monthly nonfarm payroll changes.",
        methodology="diff(PAYEMS).rolling(3).mean(). >=150k supportive, <=50k adverse.",
        why_it_matters="Real-time labor market read; sub-50k typically marks late-cycle stalls.",
        baseline_thresholds={"supportive_above": 150.0, "adverse_below": 50.0},
        threshold_rationale="150k aligned with break-even labor force growth; 50k near recession-onset historical levels.",
        threshold_rationale_source="academic",
        computation_window_weeks=520,
        signal_asymmetry="symmetric",
        source="FRED",
        refresh_frequency="monthly",
    ),
    "sahm_rule": IndicatorMeta(
        key="sahm_rule",
        label="Sahm Rule",
        bucket="Growth/Labor",
        lead_lag_tier="weak_lag_1_3m",
        definition="3-month MA of unemployment rate minus the 12-month low. >=0.50pp signals recession onset (NBER-aligned).",
        methodology="Direct FRED SAHMREALTIME level. <0.30 supportive, 0.30-0.49 neutral, >=0.50 adverse.",
        why_it_matters="Backward-looking but high-confidence — has called every NBER recession with low false-positive rate.",
        baseline_thresholds={"supportive_below": 0.30, "adverse_above": 0.50},
        threshold_rationale="Sahm (2019) NBER paper; 0.50pp is the published rule.",
        threshold_rationale_source="academic",
        computation_window_weeks=520,
        signal_asymmetry="fn_dominant",
        core_indicator=True,
        source="FRED",
        refresh_frequency="monthly",
    ),
    # Stress/Sentiment ---------------------------------------------------
    "vxn": IndicatorMeta(
        key="vxn",
        label="VXN",
        bucket="Stress/Sentiment",
        lead_lag_tier="coincident",
        definition="Nasdaq-100 volatility index (^VXN).",
        methodology="Yahoo Finance daily close. Percentile vs trailing 3-year window; supportive when low.",
        why_it_matters="Direct read of equity-tail-risk pricing; spikes coincide with risk-off events.",
        baseline_thresholds={},
        threshold_rationale="Percentile bands; absolute VXN level is regime-dependent.",
        threshold_rationale_source="historical_percentile",
        computation_window_weeks=156,
        signal_asymmetry="fp_dominant",
        source="Yahoo Finance",
        refresh_frequency="daily",
    ),
    "credit_spread": IndicatorMeta(
        key="credit_spread",
        label="Credit Spread",
        bucket="Stress/Sentiment",
        lead_lag_tier="coincident",
        definition="ICE BofA US Corporate Master OAS (BAMLC0A0CM).",
        methodology="Direct FRED level. Percentile vs trailing window; supportive when narrow.",
        why_it_matters="Wider spreads → tighter financial conditions → lower risk appetite.",
        baseline_thresholds={},
        threshold_rationale="Percentile bands; absolute level is cycle-dependent.",
        threshold_rationale_source="historical_percentile",
        computation_window_weeks=520,
        signal_asymmetry="fp_dominant",
        source="FRED",
        refresh_frequency="daily",
    ),
}
