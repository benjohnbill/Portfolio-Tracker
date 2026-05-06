# Macro Context Phase 1 (Sub-Page Narrative Surface) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v2.4 risk-first scoring re-allocation (30/30/40) and a new `/intelligence/macro-context` sub-page that explains every indicator, the indicator→bucket→sleeve→composite causal chain, the portfolio's current macro positioning, and the 26-week performance trend.

**Architecture:** Backend grows two new pure-data modules (`macro_indicator_meta.py`, `score_rules.py`) plus one new composer service (`MacroContextService`). Existing scoring functions are reweighted in place; `_score_fit_bucket` is refactored to consume `FIT_RULES` while preserving exact behavior under regression tests. A single new endpoint (`GET /api/intelligence/macro-context`) feeds an RSC sub-page with five `<Suspense>` boundaries. A `/friday` teaser card resolves the surface absence noted in the spec and links into the sub-page.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), Next.js App Router + React `cache()` + `unstable_cache` (frontend), `recharts` for the 26-week sparkline, `shadcn/ui` Tooltip + Card + Badge + Skeleton primitives.

**Reference documents (already committed in 157f500):**
- Spec: `docs/superpowers/specs/2026-04-27-self-development-loop-design.md`
- Decision: `docs/superpowers/decisions/2026-04-27-risk-first-score-allocation.md`
- Mockup: `docs/superpowers/specs/2026-04-27-macro-context-mockup.html`
- Patched: `PRODUCT.md` §1 + §5, `ARCHITECTURE.md` §3.2 + §3.3 + §4 + §5 + §8, `DESIGN.md` Macro Indicator Badge Convention + Friday/Intelligence Page Hierarchy

**Phase boundaries (each phase ends with a green test suite + commit):**
- **P1 — Backend foundation.** New modules `macro_indicator_meta.py`, `score_rules.py`. Score function reweights to v2.4. Veto branches in `_build_recommendation`.
- **P2 — Macro indicators expansion.** Sahm Rule, NFCI, T10Y3M wired into `MacroService`. Hardcoded thresholds migrated to META consumer pattern. `Liquidity` → `Liquidity/FCI` rename. Core-indicator override in bucket aggregation.
- **P3 — Read-model service + endpoint + caching.** `ScoreService.explain_fit`, `MacroContextService`, `GET /api/intelligence/macro-context`, T1/T2 SystemCache wrap, cron warm-up.
- **P4 — Frontend sub-page.** `/intelligence/macro-context/page.tsx` with five `<Suspense>` sections, `IndicatorCard` + `CausalMapSection` + `PerformanceTrendChart`, NavGrid 5th card.
- **P5 — Friday integration + cache invalidation.** New `MacroContextSection.tsx` teaser at hierarchy position 3, `revalidateTag('macro-context')` wired into Friday-freeze and transaction server actions.

**Out of scope (per spec §3):** Polymarket / forward expectation lines (Phase 2 separate office-hours), hysteresis (PRODUCT.md §5 Phase A), 5-state internal classification (Phase B), risk-aware Alignment split (Phase C), sleeve cluster correlation in Posture (Phase D), full weighted bucket aggregation 0.5/0.3/0.2 (Phase E), empirical re-validation (Phase F), risk-first sub-page narrative reflow (Phase G).

**One-time finding (recorded for the implementing agent):** the spec §5.4 says `MacroContextSection.tsx` is currently imported by `FridayDashboard.tsx:2,29` and `FridayReportSection.tsx:39` from a codex consult. A pre-plan `grep -rn "MacroContext" frontend/src/` returns zero hits — the broken import either was already cleaned up or never existed. P5 therefore creates the file and wires it in cleanly without removing dead imports first. Verify with `grep` before P5-T1 to confirm.

---

## Phase 1 — Backend Foundation

This phase produces a self-consistent backend where the v2.4 scoring formula is live, all rules / thresholds have a structural home, and the veto branches are wired in. Every existing test must still pass at the end of the phase, with new regression tests pinning the v1.x.x → v2.4 behavior.

### Task P1-T0: Pre-flight — confirm clean baseline

**Files:** none.

- [ ] **Step 1: Run the full backend suite, confirm baseline green**

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

Expected: all green (or pre-existing failures noted in the commit message and not introduced by this plan). If any test fails for an unrelated reason, stop and report — do not proceed until baseline is clean.

- [ ] **Step 2: Confirm `MacroContextSection` is currently absent**

```bash
grep -rn "MacroContextSection\|macro-context" /home/lg/dev/Portfolio_Tracker/frontend/src/ || echo "absent (expected)"
```

Expected: `absent (expected)` (no hits). Note the result — it informs P5's directness.

### Task P1-T1: Create `INDICATOR_META` skeleton

**Files:**
- Create: `backend/app/data/__init__.py`
- Create: `backend/app/data/macro_indicator_meta.py`
- Create: `backend/tests/test_macro_indicator_meta.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_macro_indicator_meta.py
from app.data.macro_indicator_meta import INDICATOR_META, META_LOGIC_VERSION


EXPECTED_KEYS = {
    "net_liquidity", "m2_yoy", "nfci",
    "real_yield_10y", "yield_spread_10y2y", "yield_spread_10y3m",
    "cpi_yoy", "core_pce_yoy",
    "real_gdp_growth", "nfp_change_3m_avg", "sahm_rule",
    "vxn", "credit_spread",
}

EXPECTED_BUCKETS = {
    "Liquidity/FCI": {"net_liquidity", "m2_yoy", "nfci"},
    "Rates": {"real_yield_10y", "yield_spread_10y2y", "yield_spread_10y3m"},
    "Inflation": {"cpi_yoy", "core_pce_yoy"},
    "Growth/Labor": {"real_gdp_growth", "nfp_change_3m_avg", "sahm_rule"},
    "Stress/Sentiment": {"vxn", "credit_spread"},
}

EXPECTED_CORES = {"sahm_rule", "core_pce_yoy", "nfci", "yield_spread_10y3m"}


def test_meta_logic_version_present_and_semver():
    assert META_LOGIC_VERSION == "1.0.0"


def test_meta_covers_all_13_indicators():
    assert set(INDICATOR_META.keys()) == EXPECTED_KEYS


def test_meta_bucket_assignment_matches_spec():
    by_bucket: dict[str, set[str]] = {}
    for key, meta in INDICATOR_META.items():
        by_bucket.setdefault(meta.bucket, set()).add(key)
    assert by_bucket == EXPECTED_BUCKETS


def test_each_bucket_has_at_most_one_core_indicator():
    cores_by_bucket: dict[str, list[str]] = {}
    for key, meta in INDICATOR_META.items():
        if meta.core_indicator:
            cores_by_bucket.setdefault(meta.bucket, []).append(key)
    for bucket, cores in cores_by_bucket.items():
        assert len(cores) <= 1, f"{bucket} has multiple cores: {cores}"


def test_expected_core_indicators_marked():
    actual_cores = {key for key, meta in INDICATOR_META.items() if meta.core_indicator}
    assert actual_cores == EXPECTED_CORES


def test_threshold_rationale_source_recorded_for_every_meta():
    valid = {"academic", "policy", "historical_percentile", "custom"}
    for key, meta in INDICATOR_META.items():
        assert meta.threshold_rationale_source in valid, key


def test_signal_asymmetry_recorded_for_every_meta():
    valid = {"fn_dominant", "fp_dominant", "symmetric"}
    for key, meta in INDICATOR_META.items():
        assert meta.signal_asymmetry in valid, key


def test_persistence_weeks_default_is_one_for_v24():
    """Phase A hysteresis is deferred — every persistence_weeks must be 1 in v2.4
    except T10Y3M which uses 4 (NY Fed model standard)."""
    for key, meta in INDICATOR_META.items():
        if key == "yield_spread_10y3m":
            assert meta.persistence_weeks == 4, key
        else:
            assert meta.persistence_weeks == 1, key
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_indicator_meta.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.data'`.

- [ ] **Step 3: Create the package init**

```python
# backend/app/data/__init__.py
"""Pure-data modules: dataclasses + tables, no service logic."""
```

- [ ] **Step 4: Write the meta module**

```python
# backend/app/data/macro_indicator_meta.py
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_indicator_meta.py -v`
Expected: 7 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/data/__init__.py backend/app/data/macro_indicator_meta.py backend/tests/test_macro_indicator_meta.py
git commit -m "feat(macro): add INDICATOR_META source-of-truth (13 indicators, v1.0.0)"
```

### Task P1-T2: Pin existing fit-score behavior with a regression test

This locks in the v1.x.x `_score_fit_bucket` outputs *before* refactoring so we can prove behavior is preserved when we extract to FIT_RULES.

**Files:**
- Create: `backend/tests/test_score_fit_regression.py`

- [ ] **Step 1: Author the regression suite**

```python
# backend/tests/test_score_fit_regression.py
"""Pins _score_fit_bucket behavior across the 5 buckets × 3 states × representative
exposure profiles. Used to prove the FIT_RULES extraction (P1-T4) preserves
behavior.

NOTE on max points: in v1.x.x each bucket awards 0/4/8 (max 8). In v2.4 each bucket
awards 0/3/6 (max 6). This test pins v1.x.x behavior to be re-asserted after the
extraction; the v2.4 reweight is applied in P1-T5 by simply rescaling the
points_full_match / points_partial_match / points_miss fields on each rule.
"""

from __future__ import annotations

import pytest

from app.services.score_service import _score_fit_bucket


# Exposure profiles cover the boundary cases each bucket's predicates discriminate.
PROFILES: dict[str, dict[str, float]] = {
    "balanced":            {"risk_beta": 0.40, "duration": 0.15, "inflation_defense": 0.06, "diversifier": 0.20, "reserve": 0.05},
    "aggressive":          {"risk_beta": 0.80, "duration": 0.05, "inflation_defense": 0.00, "diversifier": 0.10, "reserve": 0.05},
    "defensive":           {"risk_beta": 0.10, "duration": 0.40, "inflation_defense": 0.10, "diversifier": 0.15, "reserve": 0.20},
    "no_inflation_hedge":  {"risk_beta": 0.50, "duration": 0.20, "inflation_defense": 0.02, "diversifier": 0.15, "reserve": 0.05},
    "rich_diversifier":    {"risk_beta": 0.30, "duration": 0.10, "inflation_defense": 0.05, "diversifier": 0.25, "reserve": 0.15},
}

BUCKETS = ["Liquidity", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment"]
STATES = ["supportive", "neutral", "adverse"]


# Capture v1.x.x output by running once during test authoring and pasting back.
# DO NOT EDIT these expected values without running the regression separately
# and updating with intent — the whole point of this fixture is to detect drift.
EXPECTED: dict[tuple[str, str, str], int] = {
    # IMPORTANT TO IMPLEMENTING AGENT: populate this dict by running:
    #   python -c "from app.services.score_service import _score_fit_bucket; \
    #     [print((b, s, p, _score_fit_bucket(b, s, prof)[0])) for b in [...] for s in [...] for p, prof in PROFILES.items()]"
    # in the venv, then paste the (bucket, state, profile) -> score mapping here.
    # The first failing run will print every actual value — use that output verbatim.
}


@pytest.mark.parametrize("bucket", BUCKETS)
@pytest.mark.parametrize("state", STATES)
@pytest.mark.parametrize("profile_name", list(PROFILES.keys()))
def test_score_fit_bucket_v1_behavior_pinned(bucket: str, state: str, profile_name: str):
    expected = EXPECTED.get((bucket, state, profile_name))
    if expected is None:
        pytest.skip(f"Expected value not yet recorded for ({bucket}, {state}, {profile_name})")
    actual, _ = _score_fit_bucket(bucket, state, PROFILES[profile_name])
    assert actual == expected, f"Behavior drift: ({bucket}, {state}, {profile_name}) → {actual}, expected {expected}"
```

- [ ] **Step 2: Generate the EXPECTED table from current code**

```bash
cd backend && .venv/bin/python -c "
from app.services.score_service import _score_fit_bucket
PROFILES = {
    'balanced':            {'risk_beta': 0.40, 'duration': 0.15, 'inflation_defense': 0.06, 'diversifier': 0.20, 'reserve': 0.05},
    'aggressive':          {'risk_beta': 0.80, 'duration': 0.05, 'inflation_defense': 0.00, 'diversifier': 0.10, 'reserve': 0.05},
    'defensive':           {'risk_beta': 0.10, 'duration': 0.40, 'inflation_defense': 0.10, 'diversifier': 0.15, 'reserve': 0.20},
    'no_inflation_hedge':  {'risk_beta': 0.50, 'duration': 0.20, 'inflation_defense': 0.02, 'diversifier': 0.15, 'reserve': 0.05},
    'rich_diversifier':    {'risk_beta': 0.30, 'duration': 0.10, 'inflation_defense': 0.05, 'diversifier': 0.25, 'reserve': 0.15},
}
for b in ['Liquidity', 'Rates', 'Inflation', 'Growth/Labor', 'Stress/Sentiment']:
    for s in ['supportive', 'neutral', 'adverse']:
        for p, prof in PROFILES.items():
            score, _ = _score_fit_bucket(b, s, prof)
            print(f'    ({b!r}, {s!r}, {p!r}): {score},')
"
```

- [ ] **Step 3: Paste the printed `(...): N,` lines into the EXPECTED dict**

Replace the empty `EXPECTED` with all 75 entries (5 × 3 × 5).

- [ ] **Step 4: Run regression to verify it passes against current code**

Run: `cd backend && .venv/bin/python -m pytest tests/test_score_fit_regression.py -v`
Expected: 75 passed (every parametrized combination matches the captured value).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_score_fit_regression.py
git commit -m "test(score): pin _score_fit_bucket v1.x.x behavior across 5×3×5 grid"
```

### Task P1-T3: Create `score_rules.py` skeleton with empty rule list

**Files:**
- Create: `backend/app/services/score_rules.py`
- Create: `backend/tests/test_score_rules.py`

- [ ] **Step 1: Write the failing structural test**

```python
# backend/tests/test_score_rules.py
import pytest
from app.services.score_rules import (
    RULES_LOGIC_VERSION,
    FIT_RULES,
    SLEEVE_FACTOR_MAP,
    ThresholdPredicate,
    FitRuleSpec,
    BUCKETS,
    STATES,
)


def test_rules_logic_version():
    assert RULES_LOGIC_VERSION == "1.0.0"


def test_fit_rules_cover_all_15_combinations():
    assert len(FIT_RULES) == 15
    seen = {(r.bucket, r.state) for r in FIT_RULES}
    expected = {(b, s) for b in BUCKETS for s in STATES}
    assert seen == expected


def test_sleeve_factor_map_covers_six_sleeves():
    assert set(SLEEVE_FACTOR_MAP.keys()) == {"NDX", "MSTR", "DBMF", "GLDM", "BRAZIL", "BONDS/CASH"}


def test_each_rule_has_three_distinct_point_levels():
    """Full > Partial > Miss invariant for v2.4 6/3/0 grid (or any future grid)."""
    for r in FIT_RULES:
        assert r.points_full_match > r.points_partial_match >= r.points_miss


def test_threshold_predicate_op_set():
    valid = {">=", "<=", ">", "<", "between"}
    for r in FIT_RULES:
        for p in r.predicates:
            assert p.op in valid, (r.bucket, r.state, p)


def test_predicate_field_set():
    valid = {"risk_beta", "duration", "inflation_defense", "diversifier", "reserve", "diversifier_reserve"}
    for r in FIT_RULES:
        for p in r.predicates:
            assert p.field in valid, (r.bucket, r.state, p)
```

- [ ] **Step 2: Run test, verify it fails on import**

Run: `cd backend && .venv/bin/python -m pytest tests/test_score_rules.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.score_rules'`.

- [ ] **Step 3: Implement the dataclasses + skeleton constants (rules added in P1-T4)**

```python
# backend/app/services/score_rules.py
"""Externalized scoring predicate specs. Consumed by score_service._score_fit_bucket
(refactored to look up FIT_RULES) and by ScoreService.explain_fit (read-model
that returns the matched rule + projection). RULES_LOGIC_VERSION must bump on
any predicate threshold change."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Tuple, Union

RULES_LOGIC_VERSION = "1.0.0"

BUCKETS: tuple[str, ...] = ("Liquidity/FCI", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment")
STATES: tuple[str, ...] = ("supportive", "neutral", "adverse")

PredicateOp = Literal[">=", "<=", ">", "<", "between"]
PredicateValue = Union[float, Tuple[float, float]]


@dataclass(frozen=True)
class ThresholdPredicate:
    field: str
    op: PredicateOp
    value: PredicateValue


@dataclass(frozen=True)
class FitRuleSpec:
    bucket: str
    state: str
    predicates_full: list[ThresholdPredicate]      # AND — all must hold for full points
    predicates_partial: list[ThresholdPredicate]   # AND — all must hold for partial points
    points_full_match: int
    points_partial_match: int
    points_miss: int
    narrative_full: str
    narrative_partial: str
    narrative_miss: str


# Populated in P1-T4 — empty here so the structural test sees the variable.
FIT_RULES: list[FitRuleSpec] = []

# SLEEVE_FACTOR_MAP — sensitivity prior used by ScoreService._project_to_sleeves
# (Phase 3) to derive each sleeve's compatibility band ("below" / "in" / "above").
# Numbers are signed sensitivities, NOT weights. Sum across factors per sleeve is
# advisory, not normalized.
SLEEVE_FACTOR_MAP: dict[str, dict[str, int]] = {
    "NDX":        {"growth": +1, "liquidity": +1, "inflation": -1, "tight_fci": -1},
    "MSTR":       {"liquidity": +2, "growth": +1, "risk_off": -2},
    "DBMF":       {"dispersion": +1, "trend_persistence": +1, "equity_beta": 0},
    "GLDM":       {"real_rate": -1, "stress": +1},
    "BRAZIL":     {"dollar_liquidity": +1, "global_risk_on": +1, "rates": -1},
    "BONDS/CASH": {"growth_slowdown": +1, "inflation_reaccel": -1},
}
```

The file currently has `FIT_RULES = []` so the "covers 15" test fails — that's expected; P1-T4 fills it.

- [ ] **Step 4: Run again and observe the expected partial pass / partial fail**

Run: `cd backend && .venv/bin/python -m pytest tests/test_score_rules.py -v`
Expected: tests `test_rules_logic_version`, `test_sleeve_factor_map_covers_six_sleeves`, and the predicate-field/predicate-op tests pass; `test_fit_rules_cover_all_15_combinations` and `test_each_rule_has_three_distinct_point_levels` fail because `FIT_RULES` is empty. This is the expected RED state for P1-T4.

- [ ] **Step 5: Commit (skeleton only)**

```bash
git add backend/app/services/score_rules.py backend/tests/test_score_rules.py
git commit -m "feat(score): add score_rules skeleton (FIT_RULES populated next)"
```

### Task P1-T4: Author all 15 FIT_RULES entries (mirror v1.x.x predicate structure at v2.4 6/3/0 point grid)

**Files:**
- Modify: `backend/app/services/score_rules.py`

The 15 entries derive directly from `score_service._score_fit_bucket` lines 134-186. The current code uses points 8/4/0; v2.4 uses 6/3/0. Field names map: `diversifier_reserve` is computed as `diversifier + reserve` and is its own field for clarity.

- [ ] **Step 1: Replace `FIT_RULES: list[FitRuleSpec] = []` with the populated list**

```python
FIT_RULES: list[FitRuleSpec] = [
    # ----- Liquidity/FCI -------------------------------------------------
    FitRuleSpec(
        bucket="Liquidity/FCI", state="supportive",
        predicates_full=[ThresholdPredicate("risk_beta", "between", (0.20, 0.70))],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Liquidity supports maintaining core risk exposure.",
        narrative_partial="Liquidity is supportive, but current risk stance is either too defensive or too aggressive.",
        narrative_miss="Liquidity is supportive, but current risk stance is either too defensive or too aggressive.",
    ),
    FitRuleSpec(
        bucket="Liquidity/FCI", state="neutral",
        predicates_full=[ThresholdPredicate("risk_beta", "between", (0.15, 0.60))],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Liquidity is neutral and portfolio stance is balanced.",
        narrative_partial="Liquidity is neutral, but stance leans away from balance.",
        narrative_miss="Liquidity is neutral, but stance leans away from balance.",
    ),
    FitRuleSpec(
        bucket="Liquidity/FCI", state="adverse",
        predicates_full=[ThresholdPredicate("diversifier_reserve", ">=", 0.20)],
        predicates_partial=[ThresholdPredicate("diversifier_reserve", ">=", 0.10)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Liquidity is tight, but reserve/diversifier sleeves are meaningful.",
        narrative_partial="Liquidity is tight and reserve coverage is only partial.",
        narrative_miss="Liquidity is adverse while reserve/diversifier sleeves are thin.",
    ),
    # ----- Rates ---------------------------------------------------------
    FitRuleSpec(
        bucket="Rates", state="supportive",
        # OR-condition in v1: (duration >= 0.10 OR risk_beta >= 0.25). Encoded as
        # "predicates_full empty matches; predicates_partial OR-mode" via overrides
        # below. To keep the dataclass simple, supportive case uses predicates_full
        # = duration>=0.10 only and partial = risk_beta>=0.25 — evaluator falls
        # back to partial when full fails (see _evaluate_rule in score_service).
        predicates_full=[ThresholdPredicate("duration", ">=", 0.10)],
        predicates_partial=[ThresholdPredicate("risk_beta", ">=", 0.25)],
        points_full_match=6, points_partial_match=6, points_miss=3,
        narrative_full="Supportive rates backdrop allows duration and growth exposure.",
        narrative_partial="Supportive rates backdrop allows duration and growth exposure.",
        narrative_miss="Supportive rates backdrop is not fully utilized.",
    ),
    FitRuleSpec(
        bucket="Rates", state="neutral",
        predicates_full=[ThresholdPredicate("duration", "<=", 0.35)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Rates backdrop is neutral and posture is balanced.",
        narrative_partial="Rates backdrop is neutral, but duration is elevated.",
        narrative_miss="Rates backdrop is neutral, but duration is elevated.",
    ),
    FitRuleSpec(
        bucket="Rates", state="adverse",
        predicates_full=[
            ThresholdPredicate("duration", "<=", 0.20),
            ThresholdPredicate("risk_beta", "<=", 0.60),
        ],
        predicates_partial=[ThresholdPredicate("duration", "<=", 0.30)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Adverse rates backdrop is matched by contained duration and beta exposure.",
        narrative_partial="Adverse rates backdrop is only partially matched by current duration posture.",
        narrative_miss="Rates backdrop is adverse while duration exposure remains elevated.",
    ),
    # ----- Inflation -----------------------------------------------------
    FitRuleSpec(
        bucket="Inflation", state="supportive",
        predicates_full=[ThresholdPredicate("duration", "<=", 0.35)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Cooling inflation supports the current mix.",
        narrative_partial="Cooling inflation helps, but duration remains meaningful.",
        narrative_miss="Cooling inflation helps, but duration remains meaningful.",
    ),
    FitRuleSpec(
        bucket="Inflation", state="neutral",
        # OR: inflation_defense >= 0.05 OR duration <= 0.30
        predicates_full=[ThresholdPredicate("inflation_defense", ">=", 0.05)],
        predicates_partial=[ThresholdPredicate("duration", "<=", 0.30)],
        points_full_match=6, points_partial_match=6, points_miss=3,
        narrative_full="Inflation is neutral and portfolio carries acceptable hedging.",
        narrative_partial="Inflation is neutral and portfolio carries acceptable hedging.",
        narrative_miss="Inflation is neutral, but hedging is limited.",
    ),
    FitRuleSpec(
        bucket="Inflation", state="adverse",
        predicates_full=[ThresholdPredicate("inflation_defense", ">=", 0.08)],
        predicates_partial=[ThresholdPredicate("inflation_defense", ">=", 0.04)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Inflation pressure is buffered by explicit inflation-defense exposure.",
        narrative_partial="Inflation pressure is only partially buffered.",
        narrative_miss="Inflation pressure is adverse and inflation-defense exposure is minimal.",
    ),
    # ----- Growth/Labor --------------------------------------------------
    FitRuleSpec(
        bucket="Growth/Labor", state="supportive",
        predicates_full=[ThresholdPredicate("risk_beta", ">=", 0.25)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Growth backdrop supports current beta exposure.",
        narrative_partial="Growth backdrop is supportive, but portfolio remains cautious.",
        narrative_miss="Growth backdrop is supportive, but portfolio remains cautious.",
    ),
    FitRuleSpec(
        bucket="Growth/Labor", state="neutral",
        predicates_full=[ThresholdPredicate("risk_beta", "between", (0.20, 0.55))],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Growth backdrop is neutral and risk posture is balanced.",
        narrative_partial="Growth backdrop is neutral, but risk posture is lopsided.",
        narrative_miss="Growth backdrop is neutral, but risk posture is lopsided.",
    ),
    FitRuleSpec(
        bucket="Growth/Labor", state="adverse",
        predicates_full=[
            ThresholdPredicate("risk_beta", "<=", 0.45),
            ThresholdPredicate("diversifier_reserve", ">=", 0.15),
        ],
        predicates_partial=[ThresholdPredicate("risk_beta", "<=", 0.60)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Weak growth backdrop is matched by contained beta and some ballast.",
        narrative_partial="Weak growth backdrop is only partially reflected in the portfolio mix.",
        narrative_miss="Weak growth backdrop conflicts with elevated beta exposure.",
    ),
    # ----- Stress/Sentiment ---------------------------------------------
    FitRuleSpec(
        bucket="Stress/Sentiment", state="supportive",
        predicates_full=[ThresholdPredicate("risk_beta", ">=", 0.20)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Calmer stress backdrop allows risk assets to remain engaged.",
        narrative_partial="Stress backdrop is supportive, but the portfolio remains unusually defensive.",
        narrative_miss="Stress backdrop is supportive, but the portfolio remains unusually defensive.",
    ),
    FitRuleSpec(
        bucket="Stress/Sentiment", state="neutral",
        predicates_full=[ThresholdPredicate("diversifier_reserve", ">=", 0.10)],
        predicates_partial=[],
        points_full_match=6, points_partial_match=3, points_miss=3,
        narrative_full="Stress backdrop is neutral and posture is balanced.",
        narrative_partial="Stress backdrop is neutral, but ballast is limited.",
        narrative_miss="Stress backdrop is neutral, but ballast is limited.",
    ),
    FitRuleSpec(
        bucket="Stress/Sentiment", state="adverse",
        predicates_full=[
            ThresholdPredicate("diversifier_reserve", ">=", 0.20),
            ThresholdPredicate("risk_beta", "<=", 0.55),
        ],
        predicates_partial=[ThresholdPredicate("diversifier_reserve", ">=", 0.10)],
        points_full_match=6, points_partial_match=3, points_miss=0,
        narrative_full="Stress backdrop is adverse, but the portfolio still carries ballast.",
        narrative_partial="Stress backdrop is adverse and ballast is only partial.",
        narrative_miss="Stress backdrop is adverse while portfolio ballast remains limited.",
    ),
]
```

- [ ] **Step 2: Run all 6 score_rules tests; expect green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_score_rules.py -v`
Expected: 6 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/score_rules.py
git commit -m "feat(score): populate FIT_RULES (5×3=15 specs at v2.4 6/3/0 point grid)"
```

### Task P1-T5: Refactor `_score_fit_bucket` to consume FIT_RULES + reweight to 6/3/0

**Files:**
- Modify: `backend/app/services/score_service.py`

- [ ] **Step 1: Add a rule evaluator and rewrite `_score_fit_bucket`**

Replace the body of `_score_fit_bucket` (lines 128-186) with a FIT_RULES lookup. Add `_evaluate_predicates` helper at module level above `_score_fit_bucket`.

```python
# Add near top of score_service.py imports
from .score_rules import FIT_RULES, FitRuleSpec, ThresholdPredicate

# Replace _score_fit_bucket entirely; ALSO accept the new bucket name
# "Liquidity/FCI" alongside legacy "Liquidity" so pre-P2 callers don't break.
_LEGACY_BUCKET_RENAME = {"Liquidity": "Liquidity/FCI"}


def _exposure_value(field: str, exposures: Dict[str, float]) -> float:
    if field == "diversifier_reserve":
        return exposures["diversifier"] + exposures["reserve"]
    return exposures[field]


def _check_predicate(p: ThresholdPredicate, exposures: Dict[str, float]) -> bool:
    value = _exposure_value(p.field, exposures)
    if p.op == ">=":
        return value >= p.value
    if p.op == "<=":
        return value <= p.value
    if p.op == ">":
        return value > p.value
    if p.op == "<":
        return value < p.value
    if p.op == "between":
        low, high = p.value  # type: ignore[misc]
        return low <= value <= high
    raise ValueError(f"Unknown predicate op: {p.op}")


def _check_all(predicates: List[ThresholdPredicate], exposures: Dict[str, float]) -> bool:
    return all(_check_predicate(p, exposures) for p in predicates)


def _lookup_fit_rule(bucket: str, state: str) -> FitRuleSpec:
    canonical_bucket = _LEGACY_BUCKET_RENAME.get(bucket, bucket)
    for rule in FIT_RULES:
        if rule.bucket == canonical_bucket and rule.state == state:
            return rule
    raise KeyError(f"No FIT_RULES entry for bucket={bucket!r} state={state!r}")


def _score_fit_bucket(bucket: str, state: str, exposures: Dict[str, float]) -> Tuple[int, str]:
    rule = _lookup_fit_rule(bucket, state)
    if rule.predicates_full and _check_all(rule.predicates_full, exposures):
        return rule.points_full_match, rule.narrative_full
    if rule.predicates_partial and _check_all(rule.predicates_partial, exposures):
        return rule.points_partial_match, rule.narrative_partial
    return rule.points_miss, rule.narrative_miss
```

- [ ] **Step 2: Re-capture the regression EXPECTED values at the v2.4 grid**

The v1.x.x EXPECTED values from P1-T2 were captured at 8/4/0. After this refactor, every value scales to 6/3/0:
- 8 → 6
- 4 → 3
- 0 → 0

Update `EXPECTED` in `backend/tests/test_score_fit_regression.py` accordingly. Open the file, replace each `: 8,` with `: 6,` and `: 4,` with `: 3,`. Use sed:

```bash
cd backend
sed -i 's/: 8,$/: 6,/g; s/: 4,$/: 3,/g' tests/test_score_fit_regression.py
```

Or do it manually if uncertain — verify by reading the file after.

- [ ] **Step 3: Run regression suite — must pass**

Run: `cd backend && .venv/bin/python -m pytest tests/test_score_fit_regression.py -v`
Expected: 75 passed. If any single test fails, the predicate translation in P1-T4 missed a case — diff the failing `(bucket, state, profile)` against `_score_fit_bucket` v1.x.x source to find the discrepancy.

- [ ] **Step 4: Update `compute_fit_score` to return max=30 (was max=40)**

In `score_service.py`, change `compute_fit_score`:
- Bucket-row `"max": 8` → `"max": 6`
- Total-row `"max": 40` → `"max": 30`

Diff:
```python
# OLD
"max": 8,
# NEW
"max": 6,

# OLD
"max": 40,
# NEW
"max": 30,
```

- [ ] **Step 5: Run full backend suite**

Run: `cd backend && .venv/bin/python -m pytest tests -q`
Expected: all green. Some report-shape tests may break if any assert on `score.fit.max == 40` — fix those by updating the asserted value to 30 (the v2.4 reweight is the intended new contract).

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/score_service.py backend/tests/test_score_fit_regression.py
git commit -m "refactor(score): _score_fit_bucket consumes FIT_RULES; reweight Fit 0-30"
```

### Task P1-T6: Reweight `compute_alignment_score` (35→30) and `compute_posture_diversification_score` (25→40 with 20/12/8 sub-scores)

**Files:**
- Modify: `backend/app/services/score_service.py`
- Create: `backend/tests/test_score_v24_reweight.py`

- [ ] **Step 1: Write failing tests for the new sub-scores and ranges**

```python
# backend/tests/test_score_v24_reweight.py
"""v2.4 reweight invariants for compute_alignment_score and
compute_posture_diversification_score. Targets the new ranges and the
20/12/8 posture sub-decomposition."""

import pytest
from app.services.score_service import (
    compute_alignment_score,
    compute_posture_diversification_score,
)


def _alloc(weights: dict[str, float]) -> list[dict]:
    return [{"asset": symbol, "weight": w} for symbol, w in weights.items()]


# Alignment ---------------------------------------------------------------

def test_alignment_max_is_30_after_v24():
    result = compute_alignment_score(_alloc({"NDX_1X": 0.30, "DBMF": 0.30, "BRAZIL": 0.10, "MSTR": 0.10, "GLDM": 0.10, "BIL": 0.10}))
    assert result["max"] == 30
    assert result["score"] == 30  # all on target → full points


def test_alignment_per_category_max_uses_30_not_35():
    result = compute_alignment_score(_alloc({"NDX_1X": 0.30, "DBMF": 0.30, "BRAZIL": 0.10, "MSTR": 0.10, "GLDM": 0.10, "BIL": 0.10}))
    ndx = next(c for c in result["categories"] if c["category"] == "NDX")
    assert ndx["max"] == pytest.approx(30 * 0.30)


# Posture -----------------------------------------------------------------

def test_posture_max_is_40_after_v24(db_session):
    result = compute_posture_diversification_score(db_session, _alloc({"NDX_1X": 0.30, "DBMF": 0.30, "MSTR": 0.10, "GLDM": 0.10, "BRAZIL": 0.10, "BIL": 0.10}))
    assert result["max"] == 40


def test_posture_subscore_ranges_v24(db_session):
    result = compute_posture_diversification_score(db_session, _alloc({"NDX_1X": 0.30, "DBMF": 0.30, "MSTR": 0.10, "GLDM": 0.10, "BRAZIL": 0.10, "BIL": 0.10}))
    assert result["stressResilience"]["max"] == 20
    assert result["concentrationControl"]["max"] == 12
    assert result["diversifierReserve"]["max"] == 8


def test_posture_subscore_full_marks_v24(db_session):
    """Diversified portfolio should achieve all three sub-scores at full marks."""
    result = compute_posture_diversification_score(db_session, _alloc({"NDX_1X": 0.20, "DBMF": 0.30, "MSTR": 0.10, "GLDM": 0.15, "BRAZIL": 0.10, "BIL": 0.10, "VBIL": 0.05}))
    # In v2.4 grid: stress 20 / concentration 12 / reserve 8
    assert result["concentrationControl"]["score"] == 12
    assert result["diversifierReserve"]["score"] == 8
    # stressResilience depends on StressService scenarios — assert only that it
    # falls within the sub-score grid {20, 12, 4}
    assert result["stressResilience"]["score"] in {20, 12, 4}
```

The test uses a `db_session` fixture from `conftest.py` (already exists for the C-track suite). If the existing fixture is named differently, adjust to match.

- [ ] **Step 2: Confirm fixture name in conftest**

```bash
grep -n "def db_session\|@pytest.fixture" /home/lg/dev/Portfolio_Tracker/backend/tests/conftest.py
```

If the fixture has a different name (e.g., `db`), rename references in the new test accordingly.

- [ ] **Step 3: Run new tests — they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/test_score_v24_reweight.py -v`
Expected: every test fails — alignment max is still 35 and posture max is still 25.

- [ ] **Step 4: Apply the reweight in `score_service.py`**

In `compute_alignment_score`:
```python
# OLD: max_points = 35 * target
max_points = 30 * target
# OLD: "max": 35,
"max": 30,
```

In `compute_posture_diversification_score` rewrite the sub-score blocks (lines ~239-259):
```python
# Stress Resilience (0-20)
if worst_return >= -15 and worst_mdd >= -20:
    stress_score = 20
elif worst_return >= -25 and worst_mdd >= -35:
    stress_score = 12
else:
    stress_score = 4

# Concentration Control (0-12)
if top1 <= 0.25 and top2 <= 0.45 and hhi <= 0.18:
    concentration_score = 12
elif top1 <= 0.35 and top2 <= 0.60:
    concentration_score = 7
else:
    concentration_score = 2

# Diversifier Reserve (0-8)
reserve_diversifier = exposures["reserve"] + exposures["diversifier"]
if reserve_diversifier >= 0.15:
    diversifier_score = 8
elif reserve_diversifier >= 0.05:
    diversifier_score = 5
else:
    diversifier_score = 0
```

And update the return dict:
```python
return {
    "score": stress_score + concentration_score + diversifier_score,
    "max": 40,
    "stressResilience": {
        "score": stress_score,
        "max": 20,
        # ...
    },
    "concentrationControl": {
        "score": concentration_score,
        "max": 12,
        # ...
    },
    "diversifierReserve": {
        "score": diversifier_score,
        "max": 8,
        # ...
    },
}
```

- [ ] **Step 5: Re-run new tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_score_v24_reweight.py -v`
Expected: 5 passed.

- [ ] **Step 6: Run full backend suite**

Run: `cd backend && .venv/bin/python -m pytest tests -q`
Expected: green. Update any cascading tests that assert old maxes (35, 25, 10, 5).

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/score_service.py backend/tests/test_score_v24_reweight.py
git commit -m "refactor(score): reweight Alignment 0-30 and Posture 0-40 (20/12/8 sub-scores)"
```

### Task P1-T7: Add veto branches to `_build_recommendation`

**Files:**
- Modify: `backend/app/services/report_service.py`
- Create: `backend/tests/test_recommendation_veto.py`

- [ ] **Step 1: Write failing veto tests**

```python
# backend/tests/test_recommendation_veto.py
"""Two veto branches must override stance to 'reduce_risk' regardless of total score."""

from app.services.report_service import ReportService


def _action_report(actions=None):
    return {"actions": actions or [], "signals": {}}


def test_posture_below_8_vetoes_to_reduce_risk():
    posture = {"score": 6, "stressResilience": {"score": 10}}
    rec = ReportService._build_recommendation(_action_report(), total_score=85, triggered_rules=[], posture=posture)
    assert rec["stance"] == "reduce_risk"


def test_stress_resilience_below_4_vetoes_to_reduce_risk():
    posture = {"score": 30, "stressResilience": {"score": 2}}
    rec = ReportService._build_recommendation(_action_report(), total_score=85, triggered_rules=[], posture=posture)
    assert rec["stance"] == "reduce_risk"


def test_no_veto_when_thresholds_clear():
    posture = {"score": 30, "stressResilience": {"score": 12}}
    rec = ReportService._build_recommendation(_action_report(), total_score=85, triggered_rules=[], posture=posture)
    assert rec["stance"] == "hold"


def test_veto_takes_precedence_over_action_signals():
    """Veto must fire above the existing 'rebalance if actions' branch."""
    posture = {"score": 6, "stressResilience": {"score": 10}}
    rec = ReportService._build_recommendation(
        _action_report(actions=[{"asset": "NDX", "action": "BUY", "reason": "signal"}]),
        total_score=70, triggered_rules=[], posture=posture,
    )
    assert rec["stance"] == "reduce_risk"


def test_low_total_still_reduce_risk_when_no_veto():
    """Existing total<45 reduce_risk path still works when veto does not fire."""
    posture = {"score": 30, "stressResilience": {"score": 12}}
    rec = ReportService._build_recommendation(_action_report(), total_score=40, triggered_rules=[], posture=posture)
    assert rec["stance"] == "reduce_risk"
```

- [ ] **Step 2: Run — failing on signature (no `posture` kwarg yet)**

Run: `cd backend && .venv/bin/python -m pytest tests/test_recommendation_veto.py -v`
Expected: TypeError on the unknown `posture` keyword argument.

- [ ] **Step 3: Update `_build_recommendation` signature + add veto branches**

In `report_service.py`:

```python
@staticmethod
def _build_recommendation(
    action_report: Dict[str, Any],
    total_score: int,
    triggered_rules: List[Dict[str, Any]],
    posture: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    actions = action_report.get("actions", [])
    posture_total = (posture or {}).get("score")
    stress_score = (posture or {}).get("stressResilience", {}).get("score")

    # Veto branches (v2.4) — evaluate first, override all subsequent logic.
    if posture_total is not None and posture_total < 8:
        stance = "reduce_risk"
    elif stress_score is not None and stress_score < 4:
        stance = "reduce_risk"
    elif actions:
        stance = "rebalance"
    elif total_score < 45:
        stance = "reduce_risk"
    elif total_score < 60:
        stance = "watch_closely"
    else:
        stance = "hold"

    if actions and stance != "reduce_risk":
        rec_actions = actions
    else:
        rec_actions = [{
            "asset": "PORTFOLIO",
            "action": stance.replace("_", " ").upper(),
            "reason": "No direct signal action fired; stance is derived from the composite weekly score." if not (posture_total is not None and posture_total < 8 or stress_score is not None and stress_score < 4) else "Posture/Stress veto: portfolio risk floor breached, structural risk reduction required.",
        }]

    rationale = [rule["message"] for rule in triggered_rules[:3]] or ["Current report remains broadly stable."]
    return {
        "stance": stance,
        "actions": rec_actions,
        "rationale": rationale,
    }
```

- [ ] **Step 4: Update the single call site to pass `posture=posture_score`**

In `build_weekly_report` (around line 190):

```python
recommendation = ReportService._build_recommendation(
    action_report, total_score, triggered_rules, posture=posture_score,
)
```

- [ ] **Step 5: Run veto tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_recommendation_veto.py -v`
Expected: 5 passed.

- [ ] **Step 6: Run full backend suite**

Run: `cd backend && .venv/bin/python -m pytest tests -q`
Expected: green.

- [ ] **Step 7: Commit (closes Phase 1)**

```bash
git add backend/app/services/report_service.py backend/tests/test_recommendation_veto.py
git commit -m "feat(score): add Posture<8 and Stress<4 veto branches to _build_recommendation"
```

---

## Phase 2 — Macro Indicators Expansion

Wire Sahm Rule, NFCI, and T10Y3M into `MacroService.get_macro_snapshot()`. Migrate hardcoded thresholds (CPI 2.5/3.5, GDP 2.0/0.5, etc.) to consume `INDICATOR_META.baseline_thresholds`. Rename `Liquidity` bucket to `Liquidity/FCI` in `BUCKET_ORDER`. Add the core-indicator override to bucket aggregation.

### Task P2-T1: Rename `Liquidity` → `Liquidity/FCI` in `BUCKET_ORDER`

**Files:**
- Modify: `backend/app/services/macro_service.py`

- [ ] **Step 1: Update the constant**

```python
# OLD: BUCKET_ORDER = ["Liquidity", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment"]
BUCKET_ORDER = ["Liquidity/FCI", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment"]
```

- [ ] **Step 2: Update every existing indicator that sets `bucket="Liquidity"`**

Three occurrences in `_build_net_liquidity` and the M2 indicator block. Change each to `"Liquidity/FCI"`.

- [ ] **Step 3: Run macro-related tests**

```bash
cd backend && .venv/bin/python -m pytest tests -q -k macro
```

Expected: green. If any existing test asserts the literal string `"Liquidity"`, update to `"Liquidity/FCI"`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/macro_service.py
git commit -m "refactor(macro): rename Liquidity bucket to Liquidity/FCI"
```

### Task P2-T2: Add helper `_state_from_meta` that consumes baseline_thresholds

**Files:**
- Modify: `backend/app/services/macro_service.py`
- Create: `backend/tests/test_macro_state_from_meta.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_macro_state_from_meta.py
import pandas as pd
from app.services.macro_service import MacroService


def test_cpi_uses_meta_supportive_below_25():
    series = pd.Series([1.0, 1.5, 2.4])
    assert MacroService._state_from_meta("cpi_yoy", series) == "supportive"


def test_cpi_uses_meta_adverse_above_35():
    series = pd.Series([3.0, 3.4, 3.7])
    assert MacroService._state_from_meta("cpi_yoy", series) == "adverse"


def test_cpi_neutral_in_band():
    series = pd.Series([2.6, 2.9, 3.0])
    assert MacroService._state_from_meta("cpi_yoy", series) == "neutral"


def test_sahm_rule_thresholds():
    assert MacroService._state_from_meta("sahm_rule", pd.Series([0.20])) == "supportive"
    assert MacroService._state_from_meta("sahm_rule", pd.Series([0.40])) == "neutral"
    assert MacroService._state_from_meta("sahm_rule", pd.Series([0.55])) == "adverse"


def test_nfci_thresholds():
    assert MacroService._state_from_meta("nfci", pd.Series([-0.30])) == "supportive"
    assert MacroService._state_from_meta("nfci", pd.Series([0.0])) == "neutral"
    assert MacroService._state_from_meta("nfci", pd.Series([0.30])) == "adverse"


def test_empty_series_returns_neutral():
    assert MacroService._state_from_meta("cpi_yoy", pd.Series(dtype=float)) == "neutral"
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_state_from_meta.py -v`
Expected: AttributeError on `_state_from_meta`.

- [ ] **Step 3: Implement helper**

In `macro_service.py`, add a static method (place above `_series_to_indicator`):

```python
@staticmethod
def _state_from_meta(indicator_key: str, series: pd.Series) -> str:
    """Generic threshold-based classifier driven by INDICATOR_META.baseline_thresholds.
    Used for indicators where absolute level has policy/academic precedent
    (CPI, Core PCE, GDP, NFP, Sahm, NFCI, T10Y3M)."""
    from ..data.macro_indicator_meta import INDICATOR_META
    if series.empty:
        return "neutral"
    meta = INDICATOR_META.get(indicator_key)
    if meta is None:
        return "neutral"
    thresholds = meta.baseline_thresholds
    current = float(series.iloc[-1])
    if "supportive_below" in thresholds and current <= thresholds["supportive_below"]:
        return "supportive"
    if "supportive_above" in thresholds and current >= thresholds["supportive_above"]:
        return "supportive"
    if "adverse_above" in thresholds and current >= thresholds["adverse_above"]:
        return "adverse"
    if "adverse_below" in thresholds and current <= thresholds["adverse_below"]:
        return "adverse"
    if "neutral_below" in thresholds and current < thresholds["neutral_below"]:
        return "neutral"
    return "neutral"
```

- [ ] **Step 4: Run tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_state_from_meta.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/macro_service.py backend/tests/test_macro_state_from_meta.py
git commit -m "feat(macro): add _state_from_meta classifier driven by INDICATOR_META"
```

### Task P2-T3: Add Sahm Rule indicator

**Files:**
- Modify: `backend/app/services/macro_service.py`

- [ ] **Step 1: Insert the Sahm Rule block in `get_macro_snapshot` (after NFP)**

```python
sahm_series = MacroService._safe_series("SAHMREALTIME", 365 * 10)
indicators.append(MacroService._series_to_indicator(
    key="sahm_rule",
    bucket="Growth/Labor",
    label="Sahm Rule",
    series=sahm_series,
    unit="pp",
    source="FRED",
    state=MacroService._state_from_meta("sahm_rule", sahm_series),
    trend_window=3,
))
```

- [ ] **Step 2: Manual smoke test**

```bash
cd backend && .venv/bin/python -c "
from app.services.macro_service import MacroService
snap = MacroService.get_macro_snapshot()
sahm = next((i for i in snap['indicators'] if i['key'] == 'sahm_rule'), None)
print('Sahm Rule:', sahm)
assert sahm is not None, 'sahm_rule missing'
assert sahm['bucket'] == 'Growth/Labor', sahm
"
```

Expected: prints a populated dict (live FRED fetch). If FRED is unreachable, the indicator returns the empty `value=None` shape — also acceptable.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/macro_service.py
git commit -m "feat(macro): add Sahm Rule indicator to Growth/Labor bucket"
```

### Task P2-T4: Add NFCI indicator

**Files:**
- Modify: `backend/app/services/macro_service.py`

- [ ] **Step 1: Insert NFCI block in `get_macro_snapshot` (after M2)**

```python
nfci_series = MacroService._safe_series("NFCI", 365 * 5)
indicators.append(MacroService._series_to_indicator(
    key="nfci",
    bucket="Liquidity/FCI",
    label="NFCI",
    series=nfci_series,
    unit="index",
    source="FRED",
    state=MacroService._state_from_meta("nfci", nfci_series),
    trend_window=4,
))
```

- [ ] **Step 2: Smoke test**

```bash
cd backend && .venv/bin/python -c "
from app.services.macro_service import MacroService
snap = MacroService.get_macro_snapshot()
nfci = next((i for i in snap['indicators'] if i['key'] == 'nfci'), None)
print('NFCI:', nfci)
assert nfci is not None, 'nfci missing'
"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/macro_service.py
git commit -m "feat(macro): add NFCI indicator to Liquidity/FCI bucket"
```

### Task P2-T5: Add T10Y3M indicator with 4-week persistence

**Files:**
- Modify: `backend/app/services/macro_service.py`
- Create: `backend/tests/test_macro_t10y3m_persistence.py`

- [ ] **Step 1: Write a persistence-rule test**

```python
# backend/tests/test_macro_t10y3m_persistence.py
import pandas as pd
from app.services.macro_service import MacroService


def test_t10y3m_inversion_under_4_weeks_is_neutral():
    """3-week inversion does NOT yet trigger adverse — policy threshold is 4 weeks."""
    # 4-week run of inversion at the END requires 4 negative weeks; supply 3
    series = pd.Series([0.5] * 10 + [-0.1, -0.1, -0.1])  # only 3 inverted weeks
    state = MacroService._t10y3m_state(series)
    assert state in {"neutral", "supportive"}


def test_t10y3m_inversion_4_weeks_is_adverse():
    series = pd.Series([0.5] * 10 + [-0.1, -0.1, -0.1, -0.1])  # 4 inverted weeks
    state = MacroService._t10y3m_state(series)
    assert state == "adverse"


def test_t10y3m_positive_is_supportive():
    series = pd.Series([1.0] * 8)
    state = MacroService._t10y3m_state(series)
    assert state == "supportive"


def test_t10y3m_empty_is_neutral():
    state = MacroService._t10y3m_state(pd.Series(dtype=float))
    assert state == "neutral"
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_t10y3m_persistence.py -v`
Expected: AttributeError on `_t10y3m_state`.

- [ ] **Step 3: Implement classifier and add the indicator**

```python
# Add helper method
@staticmethod
def _t10y3m_state(series: pd.Series) -> str:
    """T10Y3M with persistence — adverse only if inverted (<0) for the last
    4 consecutive observations (NY Fed model standard, persistence_weeks=4
    in INDICATOR_META)."""
    if series.empty:
        return "neutral"
    last_4 = series.dropna().iloc[-4:] if len(series) >= 4 else series.dropna()
    if len(last_4) >= 4 and (last_4 < 0).all():
        return "adverse"
    if float(series.iloc[-1]) >= 0:
        return "supportive"
    return "neutral"
```

Then insert the indicator block in `get_macro_snapshot` (after the existing 10Y-2Y spread block):

```python
spread_3m_series = MacroService._safe_series("T10Y3M", 365 * 5)
indicators.append(MacroService._series_to_indicator(
    key="yield_spread_10y3m",
    bucket="Rates",
    label="10Y-3M Spread",
    series=spread_3m_series,
    unit="%",
    source="FRED",
    state=MacroService._t10y3m_state(spread_3m_series),
    trend_window=4,
))
```

- [ ] **Step 4: Run tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_t10y3m_persistence.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/macro_service.py backend/tests/test_macro_t10y3m_persistence.py
git commit -m "feat(macro): add T10Y3M indicator with 4-week persistence rule"
```

### Task P2-T6: Migrate hardcoded CPI/Core PCE/GDP/NFP thresholds to META consumer pattern

**Files:**
- Modify: `backend/app/services/macro_service.py`

The four indicators currently use hardcoded thresholds inline. Replace each `state` computation with `_state_from_meta(key, series)`.

- [ ] **Step 1: Replace CPI threshold block**

```python
# OLD
cpi_state = "neutral"
if not cpi_series.empty:
    latest_cpi = float(cpi_series.iloc[-1])
    if latest_cpi <= 2.5:
        cpi_state = "supportive"
    elif latest_cpi >= 3.5:
        cpi_state = "adverse"
indicators.append(... state=cpi_state ...)

# NEW
indicators.append(MacroService._series_to_indicator(
    key="cpi_yoy",
    bucket="Inflation",
    label="CPI YoY",
    series=cpi_series,
    unit="%",
    source="FRED",
    state=MacroService._state_from_meta("cpi_yoy", cpi_series),
    trend_window=3,
))
```

- [ ] **Step 2: Same migration for Core PCE, Real GDP Growth, NFP 3M Avg**

Mirror the pattern: drop the inline `if/elif`, replace with `state=MacroService._state_from_meta("<key>", <series>)`.

- [ ] **Step 3: Run macro suite + smoke test**

```bash
cd backend && .venv/bin/python -m pytest tests -q -k macro
cd backend && .venv/bin/python -c "
from app.services.macro_service import MacroService
snap = MacroService.get_macro_snapshot()
print(f'Indicators: {len(snap[\"indicators\"])}')
print(f'Buckets: {[(b[\"bucket\"], b[\"state\"]) for b in snap[\"buckets\"]]}')
assert len(snap['indicators']) == 13, f'Expected 13, got {len(snap[\"indicators\"])}'
"
```

Expected: 13 indicators printed, all 5 buckets surface a state.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/macro_service.py
git commit -m "refactor(macro): migrate hardcoded thresholds to INDICATOR_META consumer"
```

### Task P2-T7: Apply core-indicator override in bucket aggregation

**Files:**
- Modify: `backend/app/services/macro_service.py`
- Create: `backend/tests/test_macro_core_indicator_override.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_macro_core_indicator_override.py
"""Core indicator must floor/ceiling the bucket score deterministically."""
from app.services.macro_service import MacroService


def test_growth_labor_capped_when_sahm_strong_adverse():
    indicators = [
        {"key": "real_gdp_growth", "bucket": "Growth/Labor", "state": "supportive"},
        {"key": "nfp_change_3m_avg", "bucket": "Growth/Labor", "state": "supportive"},
        {"key": "sahm_rule", "bucket": "Growth/Labor", "state": "adverse"},  # core
    ]
    summary = MacroService._aggregate_bucket("Growth/Labor", indicators)
    assert summary["state"] == "adverse", "Core indicator (Sahm) adverse must override majority"


def test_inflation_lifted_when_core_pce_supportive():
    indicators = [
        {"key": "cpi_yoy", "bucket": "Inflation", "state": "neutral"},
        {"key": "core_pce_yoy", "bucket": "Inflation", "state": "supportive"},  # core
    ]
    summary = MacroService._aggregate_bucket("Inflation", indicators)
    assert summary["state"] == "supportive"


def test_stress_sentiment_no_core_uses_majority():
    """Stress/Sentiment retains binary majority — no core_indicator entry."""
    indicators = [
        {"key": "vxn", "bucket": "Stress/Sentiment", "state": "adverse"},
        {"key": "credit_spread", "bucket": "Stress/Sentiment", "state": "adverse"},
    ]
    summary = MacroService._aggregate_bucket("Stress/Sentiment", indicators)
    assert summary["state"] == "adverse"


def test_neutral_core_falls_back_to_majority():
    """When core is neutral, majority among non-core indicators decides."""
    indicators = [
        {"key": "real_gdp_growth", "bucket": "Growth/Labor", "state": "supportive"},
        {"key": "nfp_change_3m_avg", "bucket": "Growth/Labor", "state": "supportive"},
        {"key": "sahm_rule", "bucket": "Growth/Labor", "state": "neutral"},  # core neutral
    ]
    summary = MacroService._aggregate_bucket("Growth/Labor", indicators)
    assert summary["state"] == "supportive"
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_core_indicator_override.py -v`
Expected: AttributeError on `_aggregate_bucket`.

- [ ] **Step 3: Extract aggregation logic into `_aggregate_bucket` and apply core override**

In `macro_service.py`, replace the inline aggregation loop in `get_macro_snapshot` with:

```python
@staticmethod
def _aggregate_bucket(bucket_name: str, bucket_indicators: list) -> dict:
    """Bucket-state aggregator with core-indicator override.

    If the bucket has a core_indicator (per INDICATOR_META) and that core's
    state is supportive or adverse, the bucket inherits the core's state.
    Otherwise majority among bucket_indicators.state values decides; tie
    falls back to neutral."""
    from ..data.macro_indicator_meta import INDICATOR_META

    core_state: str | None = None
    for ind in bucket_indicators:
        meta = INDICATOR_META.get(ind.get("key"))
        if meta is not None and meta.core_indicator:
            state = ind.get("state")
            if state in {"supportive", "adverse"}:
                core_state = state
                break

    if core_state is not None:
        confidence = "high"
        return {
            "bucket": bucket_name,
            "state": core_state,
            "confidence": confidence,
            "summary": f"{bucket_name} bucket is {core_state} (core indicator override).",
        }

    state_values = [i.get("state", "neutral") for i in bucket_indicators]
    supportive = state_values.count("supportive")
    adverse = state_values.count("adverse")
    if supportive > adverse:
        state, confidence = "supportive", "high" if supportive >= 2 else "medium"
    elif adverse > supportive:
        state, confidence = "adverse", "high" if adverse >= 2 else "medium"
    else:
        state = "neutral"
        confidence = "medium" if supportive != adverse else "low"
    return {
        "bucket": bucket_name,
        "state": state,
        "confidence": confidence,
        "summary": f"{bucket_name} bucket is {state}.",
    }
```

Then in `get_macro_snapshot`, replace the inline aggregation loop:

```python
# OLD
for bucket_name in MacroService.BUCKET_ORDER:
    bucket_indicators = bucket_map.get(bucket_name, [])
    state_values = [...]  # delete inline block
    bucket_summaries.append({...})

# NEW
for bucket_name in MacroService.BUCKET_ORDER:
    summary = MacroService._aggregate_bucket(bucket_name, bucket_map.get(bucket_name, []))
    states.append(summary["state"])
    bucket_summaries.append(summary)
```

- [ ] **Step 4: Run tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_core_indicator_override.py tests/test_macro_state_from_meta.py tests/test_macro_indicator_meta.py -v`
Expected: all green.

- [ ] **Step 5: Run full suite**

Run: `cd backend && .venv/bin/python -m pytest tests -q`
Expected: green.

- [ ] **Step 6: Commit (closes Phase 2)**

```bash
git add backend/app/services/macro_service.py backend/tests/test_macro_core_indicator_override.py
git commit -m "feat(macro): apply core-indicator override in bucket aggregation"
```

---

## Phase 3 — Read-Model Service + Endpoint + Caching

Add `ScoreService.explain_fit` (read-model with structured causal trace + sleeve projection), `MacroContextService` (composer), `GET /api/intelligence/macro-context` endpoint, T1/T2 SystemCache wrap, and cron warm-up.

### Task P3-T1: Add `ScoreService.explain_fit` read-model

**Files:**
- Modify: `backend/app/services/score_service.py`
- Create: `backend/tests/test_explain_fit.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_explain_fit.py
"""explain_fit returns structured causal trace + sleeve projection."""

from app.services.score_service import ScoreService


def _alloc(weights: dict[str, float]) -> list[dict]:
    return [{"asset": s, "weight": w} for s, w in weights.items()]


def _snapshot(buckets: list[tuple[str, str]]) -> dict:
    return {
        "overallState": "neutral",
        "buckets": [{"bucket": b, "state": s} for b, s in buckets],
        "indicators": [],
        "knownAsOf": "2026-04-27",
    }


def test_explain_fit_returns_total_and_per_bucket_traces():
    snapshot = _snapshot([
        ("Liquidity/FCI", "supportive"),
        ("Rates", "neutral"),
        ("Inflation", "neutral"),
        ("Growth/Labor", "supportive"),
        ("Stress/Sentiment", "neutral"),
    ])
    allocation = _alloc({"NDX_1X": 0.30, "DBMF": 0.30, "BRAZIL": 0.10, "MSTR": 0.10, "GLDM": 0.10, "BIL": 0.10})
    result = ScoreService.explain_fit(snapshot, allocation)
    assert "totalFit" in result
    assert 0 <= result["totalFit"] <= 30
    assert len(result["buckets"]) == 5
    for b in result["buckets"]:
        assert {"bucket", "state", "points", "narrative", "rule", "sleeveProjection"} <= set(b.keys())


def test_explain_fit_sleeve_projection_includes_compatibility_band():
    snapshot = _snapshot([
        ("Liquidity/FCI", "supportive"),
        ("Rates", "neutral"),
        ("Inflation", "neutral"),
        ("Growth/Labor", "supportive"),
        ("Stress/Sentiment", "neutral"),
    ])
    allocation = _alloc({"NDX_1X": 0.30, "DBMF": 0.30, "BRAZIL": 0.10, "MSTR": 0.10, "GLDM": 0.10, "BIL": 0.10})
    result = ScoreService.explain_fit(snapshot, allocation)
    bands = {s["sleeve"]: s["compatibilityBand"] for b in result["buckets"] for s in b["sleeveProjection"]}
    assert {"NDX", "MSTR", "DBMF", "GLDM", "BRAZIL", "BONDS/CASH"} <= set(bands.keys())
    for band in bands.values():
        assert band in {"below", "in", "above"}


def test_explain_fit_exposure_aggregates_in_result():
    snapshot = _snapshot([
        ("Liquidity/FCI", "supportive"),
        ("Rates", "neutral"),
        ("Inflation", "neutral"),
        ("Growth/Labor", "supportive"),
        ("Stress/Sentiment", "neutral"),
    ])
    allocation = _alloc({"NDX_1X": 0.50, "DBMF": 0.30, "BIL": 0.20})
    result = ScoreService.explain_fit(snapshot, allocation)
    aggs = result["exposureAggregates"]
    assert {"risk_beta", "duration", "inflation_defense", "diversifier", "reserve"} <= set(aggs.keys())
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_explain_fit.py -v`
Expected: ImportError on `ScoreService` (the class form does not exist; the module exposes free functions today).

- [ ] **Step 3: Add a `ScoreService` class wrapper**

Append to `backend/app/services/score_service.py`:

```python
class ScoreService:
    """Class-form facade. Existing free functions remain the implementation;
    this class adds the explain_fit read-model and namespacing for new
    surfaces (MacroContextService consumes ScoreService.explain_fit)."""

    compute_fit_score = staticmethod(compute_fit_score)
    compute_alignment_score = staticmethod(compute_alignment_score)
    compute_posture_diversification_score = staticmethod(compute_posture_diversification_score)
    asset_to_category = staticmethod(asset_to_category)

    @staticmethod
    def _project_to_sleeves(rule: FitRuleSpec, allocation: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sleeve-level compatibility band derivation from SLEEVE_FACTOR_MAP.

        Read-only projection — not a normative target. The band reflects
        whether the sleeve's contributing factors align with the matched
        FitRuleSpec direction.
        """
        from .score_rules import SLEEVE_FACTOR_MAP
        weights_by_category: Dict[str, float] = {}
        for item in allocation:
            cat = asset_to_category(item.get("asset", ""))
            if cat == "OTHER":
                continue
            weights_by_category[cat] = weights_by_category.get(cat, 0.0) + float(item.get("weight", 0.0) or 0.0)

        # Determine the rule's direction: positive (supportive/full match favors risk),
        # negative (adverse / favor ballast), or zero (neutral).
        # Direction sign is heuristic per state:
        if rule.state == "supportive":
            direction = +1
        elif rule.state == "adverse":
            direction = -1
        else:
            direction = 0

        sleeves: List[Dict[str, Any]] = []
        for sleeve, factors in SLEEVE_FACTOR_MAP.items():
            current = weights_by_category.get(sleeve, 0.0)
            target = CATEGORY_TARGETS.get(sleeve, 0.0)
            # Compatibility band is computed from drift in the direction the rule favors:
            # - direction +1 (supportive): under-allocated to risk sleeve = "below"
            # - direction -1 (adverse): over-allocated to risk sleeve = "above"
            # - direction 0: in-band by default
            score_for_sleeve = sum(factors.values())
            if direction == 0 or target <= 0:
                band = "in"
            elif direction * score_for_sleeve > 0:
                # Rule favors this sleeve direction
                drift = (current - target) / target
                if drift < -0.10:
                    band = "below"
                elif drift > 0.10:
                    band = "above"
                else:
                    band = "in"
            else:
                # Rule disfavors; use mirror
                drift = (current - target) / target
                if drift > 0.10:
                    band = "above"
                elif drift < -0.10:
                    band = "below"
                else:
                    band = "in"
            sleeves.append({
                "sleeve": sleeve,
                "currentWeight": round(current, 4),
                "targetWeight": round(target, 4),
                "compatibilityBand": band,
                "contributingFactors": factors,
            })
        return sleeves

    @staticmethod
    def explain_fit(snapshot: Dict[str, Any], allocation: List[Dict[str, Any]]) -> Dict[str, Any]:
        from .score_rules import FIT_RULES
        exposures = _build_exposures(allocation)
        bucket_results: List[Dict[str, Any]] = []
        for bucket_state in snapshot.get("buckets", []):
            bucket_name = bucket_state.get("bucket", "Unknown")
            state = bucket_state.get("state", "neutral")
            try:
                rule = _lookup_fit_rule(bucket_name, state)
            except KeyError:
                continue
            points, narrative = _score_fit_bucket(bucket_name, state, exposures)
            bucket_results.append({
                "bucket": rule.bucket,
                "state": state,
                "points": points,
                "narrative": narrative,
                "rule": {
                    "predicatesFull": [{"field": p.field, "op": p.op, "value": p.value} for p in rule.predicates_full],
                    "predicatesPartial": [{"field": p.field, "op": p.op, "value": p.value} for p in rule.predicates_partial],
                    "pointsFullMatch": rule.points_full_match,
                    "pointsPartialMatch": rule.points_partial_match,
                    "pointsMiss": rule.points_miss,
                },
                "sleeveProjection": ScoreService._project_to_sleeves(rule, allocation),
            })
        return {
            "totalFit": sum(r["points"] for r in bucket_results),
            "buckets": bucket_results,
            "exposureAggregates": {k: round(v, 4) for k, v in exposures.items()},
        }
```

- [ ] **Step 4: Run tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_explain_fit.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/score_service.py backend/tests/test_explain_fit.py
git commit -m "feat(score): add ScoreService.explain_fit read-model with sleeve projection"
```

### Task P3-T2: Wrap `MacroService.get_macro_snapshot` with T1/T2 SystemCache

**Files:**
- Modify: `backend/app/services/macro_service.py`
- Create: `backend/tests/test_macro_snapshot_cached.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_macro_snapshot_cached.py
"""T2 cache: snapshot-with-meta-version key. Hit short-circuits the upstream
fetch."""

from unittest.mock import patch

from app.services.macro_service import MacroService
from app.data.macro_indicator_meta import META_LOGIC_VERSION
from app.services.cache_service import CacheService


def _today_key() -> str:
    from datetime import date
    return f"macro_snapshot:{date.today().isoformat()}_v{META_LOGIC_VERSION}"


def test_cached_snapshot_short_circuits_on_hit(db_session):
    payload = {"overallState": "neutral", "buckets": [], "indicators": [], "knownAsOf": "2026-04-27"}
    CacheService.set_cache(db_session, _today_key(), payload)
    with patch.object(MacroService, "get_macro_snapshot", side_effect=AssertionError("upstream should NOT be called")):
        result = MacroService.get_macro_snapshot_cached(db_session)
    assert result == payload


def test_cached_snapshot_writes_through_on_miss(db_session):
    CacheService.invalidate_cache(db_session, _today_key())
    fake_snapshot = {"overallState": "supportive", "buckets": [], "indicators": [], "knownAsOf": "2026-04-27"}
    with patch.object(MacroService, "get_macro_snapshot", return_value=fake_snapshot) as upstream:
        result = MacroService.get_macro_snapshot_cached(db_session)
        assert upstream.call_count == 1
    assert result == fake_snapshot
    assert CacheService.get_cache(db_session, _today_key()) == fake_snapshot
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_snapshot_cached.py -v`
Expected: AttributeError on `get_macro_snapshot_cached`.

- [ ] **Step 3: Implement cached wrapper**

Add to `MacroService`:

```python
@staticmethod
def get_macro_snapshot_cached(db) -> dict:
    """T2 cache wrapper. Key = macro_snapshot:{YYYY-MM-DD}_v{META_LOGIC_VERSION}.
    On hit, short-circuit the upstream FRED+Yahoo fetch. On miss, fetch and
    write through. Per coding-style.md: date-keyed, no TTL — date rollover
    invalidates automatically."""
    from datetime import date
    from .cache_service import CacheService
    from ..data.macro_indicator_meta import META_LOGIC_VERSION
    key = f"macro_snapshot:{date.today().isoformat()}_v{META_LOGIC_VERSION}"
    cached = CacheService.get_cache(db, key)
    if cached is not None:
        return cached
    snapshot = MacroService.get_macro_snapshot()
    CacheService.set_cache(db, key, snapshot)
    return snapshot
```

- [ ] **Step 4: Run tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_snapshot_cached.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/macro_service.py backend/tests/test_macro_snapshot_cached.py
git commit -m "feat(macro): add get_macro_snapshot_cached (T2 SystemCache, date-keyed)"
```

### Task P3-T3: Add `IntelligenceService.get_attribution_history(weeks)`

**Files:**
- Modify: `backend/app/services/intelligence_service.py`
- Create: `backend/tests/test_attribution_history.py`

The existing `IntelligenceService` already exposes `get_attributions`. The new helper just trims to the most recent N weeks and shapes the output for the macro-context surface.

- [ ] **Step 1: Read the existing `get_attributions` to confirm shape**

```bash
grep -n "def get_attributions\|return" /home/lg/dev/Portfolio_Tracker/backend/app/services/intelligence_service.py | head -30
```

- [ ] **Step 2: Write failing test**

```python
# backend/tests/test_attribution_history.py
from app.services.intelligence_service import IntelligenceService


def test_get_attribution_history_returns_at_most_n_weeks(db_session):
    history = IntelligenceService.get_attribution_history(db_session, weeks=26)
    assert isinstance(history, list)
    assert len(history) <= 26
    if history:
        first = history[0]
        assert {"weekEnding", "totalScore", "fitScore", "alignmentScore", "postureScore"} <= set(first.keys())


def test_get_attribution_history_ordered_oldest_first(db_session):
    history = IntelligenceService.get_attribution_history(db_session, weeks=26)
    if len(history) >= 2:
        assert history[0]["weekEnding"] <= history[-1]["weekEnding"]
```

- [ ] **Step 3: Verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_attribution_history.py -v`
Expected: AttributeError on `get_attribution_history`.

- [ ] **Step 4: Implement helper**

Add to `IntelligenceService`:

```python
@staticmethod
def get_attribution_history(db: Session, weeks: int = 26) -> list[dict]:
    """Trims the most recent N weeks of frozen ScoringAttribution into
    sparkline-shape rows. Oldest first, so the chart x-axis reads left→right."""
    from ..models import ScoringAttribution, WeeklySnapshot
    rows = (
        db.query(ScoringAttribution, WeeklySnapshot.snapshot_date)
        .join(WeeklySnapshot, ScoringAttribution.snapshot_id == WeeklySnapshot.id)
        .order_by(WeeklySnapshot.snapshot_date.desc())
        .limit(weeks)
        .all()
    )
    out = [
        {
            "weekEnding": snap_date.isoformat(),
            "totalScore": int(attr.total_score) if attr.total_score is not None else None,
            "fitScore": int(attr.fit_score) if attr.fit_score is not None else None,
            "alignmentScore": int(attr.alignment_score) if attr.alignment_score is not None else None,
            "postureScore": int(attr.posture_score) if attr.posture_score is not None else None,
        }
        for attr, snap_date in rows
    ]
    out.reverse()  # oldest first
    return out
```

If `ScoringAttribution`'s field names differ (e.g., `posture_diversification_score`), adjust accordingly — read the model definition first if uncertain.

- [ ] **Step 5: Run tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_attribution_history.py -v`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/intelligence_service.py backend/tests/test_attribution_history.py
git commit -m "feat(intelligence): add get_attribution_history(weeks=26) for sparkline"
```

### Task P3-T4: Create `MacroContextService` composer

**Files:**
- Create: `backend/app/services/macro_context_service.py`
- Create: `backend/tests/test_macro_context_service.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_macro_context_service.py
from unittest.mock import patch

from app.services.macro_context_service import MacroContextService


@patch("app.services.macro_context_service.MacroService.get_macro_snapshot_cached")
@patch("app.services.macro_context_service.PortfolioService.get_portfolio_allocation")
@patch("app.services.macro_context_service.IntelligenceService.get_attribution_history")
def test_macro_context_envelope_shape(mock_history, mock_alloc, mock_snap, db_session):
    mock_snap.return_value = {
        "overallState": "supportive",
        "buckets": [{"bucket": b, "state": "neutral"} for b in ["Liquidity/FCI", "Rates", "Inflation", "Growth/Labor", "Stress/Sentiment"]],
        "indicators": [{"key": "cpi_yoy", "bucket": "Inflation", "label": "CPI YoY", "value": 2.4, "unit": "%", "state": "supportive", "trend": "down"}],
        "knownAsOf": "2026-04-27",
    }
    mock_alloc.return_value = [{"asset": "NDX_1X", "weight": 0.30}, {"asset": "DBMF", "weight": 0.30}, {"asset": "BRAZIL", "weight": 0.10}, {"asset": "MSTR", "weight": 0.10}, {"asset": "GLDM", "weight": 0.10}, {"asset": "BIL", "weight": 0.10}]
    mock_history.return_value = [{"weekEnding": "2026-01-02", "totalScore": 65, "fitScore": 20, "alignmentScore": 22, "postureScore": 23}]

    result = MacroContextService.get_macro_context(db_session)

    assert {"indicators", "causalMap", "positioning", "performance", "logicVersion", "knownAsOf"} <= set(result.keys())
    assert result["logicVersion"]["rules"] == "1.0.0"
    assert result["logicVersion"]["meta"] == "1.0.0"
    assert result["knownAsOf"] == "2026-04-27"
    # indicators must each carry meta-attached fields
    for ind in result["indicators"]:
        assert "definition" in ind
        assert "leadLagTier" in ind
    # causalMap fields
    assert {"bucketRules", "currentBucketStates", "sleeveImpacts"} <= set(result["causalMap"].keys())
    # positioning has 6 sleeves
    assert len(result["positioning"]["sleeves"]) == 6
    # performance shape
    assert {"fit", "alignment", "posture", "trends"} <= set(result["performance"].keys())
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_context_service.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement composer**

```python
# backend/app/services/macro_context_service.py
"""Read-model composer for /api/intelligence/macro-context.

Composition only — never recomputes scoring rules, never persists.
Sibling to a future PredictionService that will own forward-looking
expectation reads (Phase 2, deferred to office-hours)."""

from __future__ import annotations

from typing import Any, Dict

from sqlalchemy.orm import Session

from ..data.macro_indicator_meta import INDICATOR_META, META_LOGIC_VERSION
from .intelligence_service import IntelligenceService
from .macro_service import MacroService
from .portfolio_service import PortfolioService
from .score_service import (
    CATEGORY_TARGETS,
    ScoreService,
    compute_alignment_score,
    compute_posture_diversification_score,
)
from .score_rules import RULES_LOGIC_VERSION


class MacroContextService:

    @staticmethod
    def _attach_meta(indicators: list[dict]) -> list[dict]:
        out: list[dict] = []
        for ind in indicators:
            meta = INDICATOR_META.get(ind.get("key"))
            if meta is None:
                out.append(ind)
                continue
            out.append({
                **ind,
                "definition": meta.definition,
                "methodology": meta.methodology,
                "whyItMatters": meta.why_it_matters,
                "leadLagTier": meta.lead_lag_tier,
                "thresholdRationale": meta.threshold_rationale,
                "thresholdRationaleSource": meta.threshold_rationale_source,
                "coreIndicator": meta.core_indicator,
                "signalAsymmetry": meta.signal_asymmetry,
                "persistenceWeeks": meta.persistence_weeks,
                "refreshFrequency": meta.refresh_frequency,
            })
        return out

    @staticmethod
    def _build_causal_map(snapshot: dict, score_explain: dict) -> dict:
        return {
            "bucketRules": [
                {
                    "bucket": b["bucket"],
                    "state": b["state"],
                    "points": b["points"],
                    "narrative": b["narrative"],
                    "rule": b["rule"],
                }
                for b in score_explain["buckets"]
            ],
            "currentBucketStates": [
                {"bucket": b["bucket"], "state": b["state"], "confidence": b.get("confidence")}
                for b in snapshot.get("buckets", [])
            ],
            "sleeveImpacts": [
                {"bucket": b["bucket"], "sleeves": b["sleeveProjection"]}
                for b in score_explain["buckets"]
            ],
        }

    @staticmethod
    def _build_positioning(allocation: list, score_explain: dict) -> dict:
        # First bucket's sleeve projection is canonical for the band display
        # (every bucket's projection uses the same SLEEVE_FACTOR_MAP shape; the
        # band differs per bucket's rule direction, so we pick the most-adverse
        # bucket's projection as the surfaced row — this is the "macro pressure"
        # band the user cares about).
        most_adverse = next(
            (b for b in score_explain["buckets"] if b["state"] == "adverse"),
            score_explain["buckets"][0] if score_explain["buckets"] else None,
        )
        sleeves = most_adverse["sleeveProjection"] if most_adverse else []
        return {
            "sleeves": sleeves if sleeves else [
                {"sleeve": s, "currentWeight": 0.0, "targetWeight": t, "compatibilityBand": "in", "contributingFactors": {}}
                for s, t in CATEGORY_TARGETS.items()
            ],
            "bands": [
                {"band": "below", "meaning": "Sleeve under-allocated for current macro stance"},
                {"band": "in", "meaning": "Sleeve allocation aligned with current macro stance"},
                {"band": "above", "meaning": "Sleeve over-allocated for current macro stance"},
            ],
        }

    @staticmethod
    def _build_performance(score_explain: dict, alignment: dict, posture: dict, trends: list) -> dict:
        last = trends[-1] if trends else None
        prior = trends[-2] if len(trends) >= 2 else None
        avg_window = trends[-4:] if trends else []
        avg_total = (sum(r["totalScore"] for r in avg_window if r["totalScore"] is not None) / len(avg_window)) if avg_window else None

        def _delta(curr: int | None, ref: int | None) -> int | None:
            if curr is None or ref is None:
                return None
            return curr - ref

        return {
            "fit": {
                "score": score_explain["totalFit"],
                "max": 30,
                "deltaVsPriorWeek": _delta(score_explain["totalFit"], prior["fitScore"] if prior else None),
            },
            "alignment": {
                "score": alignment["score"],
                "max": 30,
                "deltaVsPriorWeek": _delta(alignment["score"], prior["alignmentScore"] if prior else None),
            },
            "posture": {
                "score": posture["score"],
                "max": 40,
                "deltaVsPriorWeek": _delta(posture["score"], prior["postureScore"] if prior else None),
            },
            "trends": trends,
            "avgTotalLast4Weeks": int(avg_total) if avg_total is not None else None,
            "lastTotal": last["totalScore"] if last else None,
        }

    @staticmethod
    def get_macro_context(db: Session) -> dict:
        snapshot = MacroService.get_macro_snapshot_cached(db)
        allocation = PortfolioService.get_portfolio_allocation(db)
        score_explain = ScoreService.explain_fit(snapshot, allocation)
        alignment = compute_alignment_score(allocation)
        posture = compute_posture_diversification_score(db, allocation)
        trends = IntelligenceService.get_attribution_history(db, weeks=26)

        return {
            "indicators": MacroContextService._attach_meta(snapshot.get("indicators", [])),
            "causalMap": MacroContextService._build_causal_map(snapshot, score_explain),
            "positioning": MacroContextService._build_positioning(allocation, score_explain),
            "performance": MacroContextService._build_performance(score_explain, alignment, posture, trends),
            "logicVersion": {"rules": RULES_LOGIC_VERSION, "meta": META_LOGIC_VERSION},
            "knownAsOf": snapshot.get("knownAsOf"),
        }

    @staticmethod
    def get_macro_context_safe(db: Session) -> dict:
        """Empty-state-shaped fallback when upstream fetch errors. Same envelope
        structure with empty arrays / null leaves so frontend skeleton == loaded."""
        return {
            "indicators": [],
            "causalMap": {"bucketRules": [], "currentBucketStates": [], "sleeveImpacts": []},
            "positioning": {
                "sleeves": [
                    {"sleeve": s, "currentWeight": 0.0, "targetWeight": t, "compatibilityBand": "in", "contributingFactors": {}}
                    for s, t in CATEGORY_TARGETS.items()
                ],
                "bands": [],
            },
            "performance": {
                "fit": None,
                "alignment": None,
                "posture": None,
                "trends": [],
                "avgTotalLast4Weeks": None,
                "lastTotal": None,
            },
            "logicVersion": {"rules": RULES_LOGIC_VERSION, "meta": META_LOGIC_VERSION},
            "knownAsOf": None,
        }
```

- [ ] **Step 4: Run tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_context_service.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/macro_context_service.py backend/tests/test_macro_context_service.py
git commit -m "feat(macro-context): add MacroContextService composer (read-only)"
```

### Task P3-T5: Add `GET /api/intelligence/macro-context` endpoint

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_macro_context_endpoint.py`

- [ ] **Step 1: Write failing endpoint test**

```python
# backend/tests/test_macro_context_endpoint.py
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app


def test_macro_context_endpoint_envelope():
    with patch("app.services.macro_context_service.MacroContextService.get_macro_context") as mock_ctx:
        mock_ctx.return_value = {
            "indicators": [],
            "causalMap": {"bucketRules": [], "currentBucketStates": [], "sleeveImpacts": []},
            "positioning": {"sleeves": [], "bands": []},
            "performance": {"fit": None, "alignment": None, "posture": None, "trends": [], "avgTotalLast4Weeks": None, "lastTotal": None},
            "logicVersion": {"rules": "1.0.0", "meta": "1.0.0"},
            "knownAsOf": "2026-04-27",
        }
        client = TestClient(app)
        response = client.get("/api/intelligence/macro-context")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "data" in body
    assert body["data"]["logicVersion"] == {"rules": "1.0.0", "meta": "1.0.0"}


def test_macro_context_endpoint_returns_empty_envelope_on_upstream_error():
    with patch("app.services.macro_context_service.MacroContextService.get_macro_context", side_effect=RuntimeError("FRED down")):
        client = TestClient(app)
        response = client.get("/api/intelligence/macro-context")
    assert response.status_code == 200
    body = response.json()
    # Empty-state envelope must have status=ok with empty arrays per spec §4.5
    assert body["status"] == "ok"
    assert body["data"]["indicators"] == []
    assert body["data"]["knownAsOf"] is None
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_context_endpoint.py -v`
Expected: 404s.

- [ ] **Step 3: Add the endpoint**

In `backend/app/main.py`, add an import then a new endpoint near the other `/api/intelligence/...` routes:

```python
from .services.macro_context_service import MacroContextService

# ... near the other intelligence endpoints

@app.get("/api/intelligence/macro-context")
def get_intelligence_macro_context(db: Session = Depends(get_db)):
    try:
        data = MacroContextService.get_macro_context(db)
    except Exception as e:
        logger.warning("intelligence_macro_context_upstream_unavailable", exc_info=e)
        data = MacroContextService.get_macro_context_safe(db)
    return {"status": "ok", "data": data}
```

- [ ] **Step 4: Run tests — green**

Run: `cd backend && .venv/bin/python -m pytest tests/test_macro_context_endpoint.py -v`
Expected: 2 passed.

- [ ] **Step 5: Run full backend suite**

Run: `cd backend && .venv/bin/python -m pytest tests -q`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_macro_context_endpoint.py
git commit -m "feat(api): add GET /api/intelligence/macro-context endpoint"
```

### Task P3-T6: Add cron warm-up

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Identify the cron handler**

```bash
grep -n "/api/cron/update-signals\|update_signals\|update-signals" /home/lg/dev/Portfolio_Tracker/backend/app/main.py | head -5
```

- [ ] **Step 2: Append a warm-up call at the end of the handler**

Inside the cron handler function body, add (just before the return):

```python
try:
    MacroService.get_macro_snapshot_cached(db)
except Exception as e:
    logger.warning("cron_macro_snapshot_warmup_failed", exc_info=e)
```

This populates the T2 cache so the user's first morning request is hot.

- [ ] **Step 3: Smoke-run the cron handler in test**

Add or extend an existing cron-handler test to assert that `MacroService.get_macro_snapshot_cached` is invoked once per cron tick. If a clean test scaffold doesn't exist, skip the assertion and rely on the manual smoke:

```bash
cd backend && .venv/bin/python -c "
from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)
# Forge the cron secret check if your handler requires the header
print('warm-up wiring sanity OK')
"
```

- [ ] **Step 4: Commit (closes Phase 3)**

```bash
git add backend/app/main.py
git commit -m "feat(cron): warm macro_snapshot T2 cache at end of update-signals tick"
```

---

## Phase 4 — Frontend Sub-Page

Build `/intelligence/macro-context/page.tsx` with the five `<Suspense>` sections, the `IndicatorCard` + `CausalMapSection` + `PerformanceTrendChart` components, and add the 5th NavGrid card on `/intelligence`.

### Task P4-T1: Add `MacroContext` types and `fetchMacroContext` to `api.ts`

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Append types and fetch function**

At the bottom of `frontend/src/lib/api.ts`:

```typescript
// =====================================================================
// Macro Context — /intelligence/macro-context (v2.4, 2026-04-27)
// =====================================================================

export type IndicatorState = 'supportive' | 'neutral' | 'adverse';
export type LeadLagTier = 'strong_lead_12_18m' | 'mid_lead_6_12m' | 'coincident' | 'weak_lag_1_3m' | 'strong_lag_quarterly';
export type CompatibilityBand = 'below' | 'in' | 'above';

export interface IndicatorWithMeta {
  key: string;
  bucket: string;
  label: string;
  value: number | null;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  state: IndicatorState;
  source: string;
  observationDate: string | null;
  releaseDate: string | null;
  knownAsOf: string;
  definition?: string;
  methodology?: string;
  whyItMatters?: string;
  leadLagTier?: LeadLagTier;
  thresholdRationale?: string;
  thresholdRationaleSource?: 'academic' | 'policy' | 'historical_percentile' | 'custom';
  coreIndicator?: boolean;
  signalAsymmetry?: 'fn_dominant' | 'fp_dominant' | 'symmetric';
  persistenceWeeks?: number;
  refreshFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface SleeveCompatibility {
  sleeve: string;
  currentWeight: number;
  targetWeight: number;
  compatibilityBand: CompatibilityBand;
  contributingFactors: Record<string, number>;
}

export interface BucketRule {
  bucket: string;
  state: IndicatorState;
  points: number;
  narrative: string;
  rule: {
    predicatesFull: { field: string; op: string; value: number | [number, number] }[];
    predicatesPartial: { field: string; op: string; value: number | [number, number] }[];
    pointsFullMatch: number;
    pointsPartialMatch: number;
    pointsMiss: number;
  };
}

export interface ScoreBreakdown {
  score: number;
  max: number;
  deltaVsPriorWeek: number | null;
}

export interface WeeklyScoreHistory {
  weekEnding: string;
  totalScore: number | null;
  fitScore: number | null;
  alignmentScore: number | null;
  postureScore: number | null;
}

export interface MacroContext {
  indicators: IndicatorWithMeta[];
  causalMap: {
    bucketRules: BucketRule[];
    currentBucketStates: { bucket: string; state: IndicatorState; confidence?: string }[];
    sleeveImpacts: { bucket: string; sleeves: SleeveCompatibility[] }[];
  };
  positioning: {
    sleeves: SleeveCompatibility[];
    bands: { band: CompatibilityBand; meaning: string }[];
  };
  performance: {
    fit: ScoreBreakdown | null;
    alignment: ScoreBreakdown | null;
    posture: ScoreBreakdown | null;
    trends: WeeklyScoreHistory[];
    avgTotalLast4Weeks: number | null;
    lastTotal: number | null;
  };
  logicVersion: { rules: string; meta: string };
  knownAsOf: string | null;
}

export interface MacroContextEnvelope {
  status: EnvelopeStatus;
  data: MacroContext | null;
}

export async function fetchMacroContext(): Promise<MacroContextEnvelope> {
  const url = `${API_BASE_URL}/api/intelligence/macro-context`;
  const response = await fetch(url, { next: { tags: ['macro-context'] } });
  if (!response.ok) {
    return { status: 'error', data: null };
  }
  const body = await response.json();
  return { status: body.status, data: body.data ?? null };
}
```

If `API_BASE_URL` is named differently in the file, match the existing convention.

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: passes (only the new types added, no live consumer yet).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add MacroContext types + fetchMacroContext client"
```

### Task P4-T2: Add `unstable_cache` RSC fetcher

**Files:**
- Create: `frontend/src/lib/macro-context-fetchers-rsc.ts`

- [ ] **Step 1: Write the fetcher**

```typescript
// frontend/src/lib/macro-context-fetchers-rsc.ts
import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { fetchMacroContext } from './api';

const fetchMacroContextWithDataCache = unstable_cache(
  async () => fetchMacroContext(),
  ['macro-context'],
  { revalidate: 86400, tags: ['macro-context'] },
);

// React `cache()` dedupes within a single render pass; `unstable_cache`
// persists across requests with tag-based invalidation. Both are required:
// without `cache()`, each <Suspense> child would re-enter unstable_cache.
export const getMacroContextCached = cache(fetchMacroContextWithDataCache);
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/macro-context-fetchers-rsc.ts
git commit -m "feat(rsc): add macro-context unstable_cache + cache() fetcher"
```

### Task P4-T3: Build IndicatorCard primitive

**Files:**
- Create: `frontend/src/components/intelligence/macro-context/IndicatorCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { IndicatorWithMeta } from '@/lib/api';

const STATE_BADGE: Record<IndicatorWithMeta['state'], string> = {
  supportive: 'bg-[#0a2010] text-[#4ADE80]',
  neutral: 'bg-[#11161d] text-[#8b95a5] border border-[#2a3040]',
  adverse: 'bg-[#200a0a] text-[#F87171]',
};

const BUCKET_ABBREV: Record<string, string> = {
  'Liquidity/FCI': 'LIQ',
  'Rates': 'RAT',
  'Inflation': 'INF',
  'Growth/Labor': 'GRO',
  'Stress/Sentiment': 'STR',
};

const TIER_LABEL: Record<string, string> = {
  strong_lead_12_18m: 'STRONG LEAD · 12-18M',
  mid_lead_6_12m: 'MID LEAD · 6-12M',
  coincident: 'COINCIDENT',
  weak_lag_1_3m: 'WEAK LAG · 1-3M',
  strong_lag_quarterly: 'STRONG LAG · QUARTERLY',
};

export function IndicatorCard({ indicator }: { indicator: IndicatorWithMeta }) {
  const abbrev = BUCKET_ABBREV[indicator.bucket] ?? '???';
  const stateLabel = indicator.state === 'supportive' ? 'SUP' : indicator.state === 'adverse' ? 'ADV' : 'NEU';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="bg-card rounded-lg p-4 border border-border/40 hover:border-primary/40 transition-colors flex flex-col gap-2 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-mono uppercase px-2 py-[2px] rounded ${STATE_BADGE[indicator.state]}`}>
                {abbrev} · {stateLabel}
              </span>
              {indicator.coreIndicator && (
                <span className="text-[10px] font-mono uppercase text-[#D4A574]">CORE</span>
              )}
            </div>
            <p className="text-sm text-white">{indicator.label}</p>
            <p className="text-2xl font-mono text-white">
              {indicator.value !== null ? `${indicator.value}${indicator.unit === '%' ? '%' : ''}` : '—'}
              {indicator.unit !== '%' && indicator.value !== null && (
                <span className="text-sm text-muted-foreground ml-1">{indicator.unit}</span>
              )}
            </p>
            {indicator.leadLagTier && (
              <span className="text-[10px] font-mono uppercase text-[#5a6577]">
                {TIER_LABEL[indicator.leadLagTier]}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-2 text-xs">
            <p className="font-mono uppercase text-[#5a6577]">{indicator.bucket}</p>
            {indicator.definition && (
              <div>
                <p className="font-medium text-white mb-0.5">Definition</p>
                <p className="text-muted-foreground">{indicator.definition}</p>
              </div>
            )}
            {indicator.methodology && (
              <div>
                <p className="font-medium text-white mb-0.5">Methodology</p>
                <p className="text-muted-foreground">{indicator.methodology}</p>
              </div>
            )}
            {indicator.whyItMatters && (
              <div>
                <p className="font-medium text-white mb-0.5">Why it matters</p>
                <p className="text-muted-foreground">{indicator.whyItMatters}</p>
              </div>
            )}
            {indicator.thresholdRationale && (
              <p className="text-[10px] text-muted-foreground italic">{indicator.thresholdRationale} ({indicator.thresholdRationaleSource})</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/intelligence/macro-context/IndicatorCard.tsx
git commit -m "feat(ui): add IndicatorCard with shadcn Tooltip surfacing INDICATOR_META"
```

### Task P4-T4: Build CausalMapSection

**Files:**
- Create: `frontend/src/components/intelligence/macro-context/CausalMapSection.tsx`

- [ ] **Step 1: Write the section**

```tsx
"use client";

import { useState } from 'react';
import type { MacroContext } from '@/lib/api';

interface Props {
  causalMap: MacroContext['causalMap'];
  performance: MacroContext['performance'];
}

export function CausalMapSection({ causalMap, performance }: Props) {
  const [highlight, setHighlight] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif italic text-white">§2 Causal Map</h2>
      <p className="text-sm text-muted-foreground">Indicators → Buckets → Sleeve compatibility → Composite breakdown.</p>

      <div className="grid grid-cols-4 gap-4">
        {/* Column 1: bucket states */}
        <div className="bg-card rounded-lg p-4 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Buckets</p>
          <ul className="space-y-2">
            {causalMap.currentBucketStates.map((b) => (
              <li
                key={b.bucket}
                className={`text-sm font-mono uppercase cursor-pointer ${highlight === b.bucket ? 'text-[#D4A574]' : 'text-white'}`}
                onMouseEnter={() => setHighlight(b.bucket)}
                onMouseLeave={() => setHighlight(null)}
              >
                {b.bucket} · {b.state.toUpperCase()}
              </li>
            ))}
          </ul>
        </div>

        {/* Column 2: matched rule per bucket */}
        <div className="bg-card rounded-lg p-4 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Matched Rule</p>
          <ul className="space-y-2">
            {causalMap.bucketRules.map((b) => (
              <li
                key={b.bucket}
                className={`text-xs ${highlight === b.bucket ? 'text-white' : 'text-muted-foreground'}`}
                onMouseEnter={() => setHighlight(b.bucket)}
                onMouseLeave={() => setHighlight(null)}
              >
                <span className="font-mono">+{b.points} / {b.rule.pointsFullMatch}</span> — {b.narrative}
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: sleeve impacts */}
        <div className="bg-card rounded-lg p-4 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Sleeve Impact</p>
          <ul className="space-y-2 text-xs">
            {causalMap.sleeveImpacts.map((bucket) => (
              <li
                key={bucket.bucket}
                className={highlight === bucket.bucket ? 'text-white' : 'text-muted-foreground'}
                onMouseEnter={() => setHighlight(bucket.bucket)}
                onMouseLeave={() => setHighlight(null)}
              >
                <span className="font-mono uppercase text-[10px] text-[#5a6577]">{bucket.bucket}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {bucket.sleeves.slice(0, 4).map((s) => (
                    <span key={s.sleeve} className="font-mono text-[10px] px-1 py-[1px] rounded bg-[#11161d]">
                      {s.sleeve}:{s.compatibilityBand}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 4: composite breakdown */}
        <div className="bg-card rounded-lg p-4 border border-border/40">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Composite Breakdown</p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Fit (30)</p>
              <p className="font-mono text-white">{performance.fit?.score ?? '—'} / 30</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alignment (30)</p>
              <p className="font-mono text-white">{performance.alignment?.score ?? '—'} / 30</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Posture (40)</p>
              <p className="font-mono text-white">{performance.posture?.score ?? '—'} / 40</p>
            </div>
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-mono text-2xl text-[#D4A574]">{performance.lastTotal ?? '—'} / 100</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/intelligence/macro-context/CausalMapSection.tsx
git commit -m "feat(ui): add CausalMapSection 4-column flow visualization"
```

### Task P4-T5: Build PerformanceTrendChart

**Files:**
- Create: `frontend/src/components/intelligence/macro-context/PerformanceTrendChart.tsx`

- [ ] **Step 1: Verify recharts is installed**

```bash
cd frontend && grep -n "recharts" package.json
```

If absent, install: `cd frontend && npm install recharts`. (Most likely already present given existing intelligence charts.)

- [ ] **Step 2: Write the chart**

```tsx
"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeeklyScoreHistory } from '@/lib/api';

export function PerformanceTrendChart({ trends }: { trends: WeeklyScoreHistory[] }) {
  const data = trends.map((t) => ({ week: t.weekEnding, score: t.totalScore ?? 0 }));

  return (
    <div className="bg-card rounded-lg p-4 border border-border/40 h-48">
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No frozen scores accumulated yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4A574" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#D4A574" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{ background: '#11161d', border: '1px solid #2a3040', fontSize: '11px' }}
              labelStyle={{ color: '#8b95a5', fontFamily: 'monospace' }}
              formatter={(value) => [`${value} / 100`, 'Total']}
            />
            <Area type="monotone" dataKey="score" stroke="#D4A574" fill="url(#trendFill)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/intelligence/macro-context/PerformanceTrendChart.tsx
git commit -m "feat(ui): add PerformanceTrendChart 26-week recharts sparkline"
```

### Task P4-T6: Build the page itself with five Suspense sections

**Files:**
- Create: `frontend/src/app/intelligence/macro-context/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { Suspense } from 'react';

import { CausalMapSection } from '@/components/intelligence/macro-context/CausalMapSection';
import { IndicatorCard } from '@/components/intelligence/macro-context/IndicatorCard';
import { PerformanceTrendChart } from '@/components/intelligence/macro-context/PerformanceTrendChart';
import { Skeleton } from '@/components/ui/skeleton';
import { isReady } from '@/lib/envelope';
import { getMacroContextCached } from '@/lib/macro-context-fetchers-rsc';

export default function MacroContextPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
      <Suspense fallback={<HeroSkeleton />}><HeroSection /></Suspense>
      <Suspense fallback={<IndicatorsSkeleton />}><IndicatorsSection /></Suspense>
      <Suspense fallback={<CausalMapSkeleton />}><CausalMapAsync /></Suspense>
      <Suspense fallback={<PositioningSkeleton />}><PositioningSection /></Suspense>
      <Suspense fallback={<PerformanceSkeleton />}><PerformanceSection /></Suspense>
      <Footer />
    </main>
  );
}

async function HeroSection() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  return (
    <div className="flex items-baseline justify-between">
      <h1 className="text-3xl font-serif italic text-white">Macro Context</h1>
      <div className="flex gap-2 text-[10px] font-mono uppercase">
        <span className="px-2 py-[2px] bg-[#11161d] text-[#5a6577] rounded">RULES v{ctx?.logicVersion.rules ?? '—'}</span>
        <span className="px-2 py-[2px] bg-[#11161d] text-[#5a6577] rounded">META v{ctx?.logicVersion.meta ?? '—'}</span>
        <span className="px-2 py-[2px] bg-[#11161d] text-[#5a6577] rounded">{ctx?.knownAsOf ?? '—'}</span>
      </div>
    </div>
  );
}
function HeroSkeleton() { return <div className="flex items-baseline justify-between"><Skeleton className="h-9 w-56" /><Skeleton className="h-5 w-64" /></div>; }

async function IndicatorsSection() {
  const env = await getMacroContextCached();
  const indicators = isReady(env) ? env.data?.indicators ?? [] : [];
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif italic text-white">§1 Indicators</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {indicators.map((ind) => <IndicatorCard key={ind.key} indicator={ind} />)}
      </div>
    </section>
  );
}
function IndicatorsSkeleton() {
  return (
    <section className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 13 }).map((_, i) => <Skeleton key={i} className="h-[120px] w-full rounded-lg" />)}
      </div>
    </section>
  );
}

async function CausalMapAsync() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  if (!ctx) return <CausalMapSkeleton />;
  return <CausalMapSection causalMap={ctx.causalMap} performance={ctx.performance} />;
}
function CausalMapSkeleton() {
  return (
    <section className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}
      </div>
    </section>
  );
}

async function PositioningSection() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  const sleeves = ctx?.positioning.sleeves ?? [];
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif italic text-white">§3 Positioning</h2>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="text-left py-2">Sleeve</th><th className="text-right">Current</th><th className="text-right">Target</th><th className="text-left pl-4">Drift</th><th className="text-left pl-4">Band</th></tr>
        </thead>
        <tbody>
          {sleeves.map((s) => {
            const drift = s.targetWeight > 0 ? (s.currentWeight - s.targetWeight) / s.targetWeight : 0;
            const bandClass = s.compatibilityBand === 'below' ? 'bg-[#200a0a] text-[#F87171]' : s.compatibilityBand === 'above' ? 'bg-[#2a1a00] text-[#FBBF24]' : 'bg-[#0a2010] text-[#4ADE80]';
            return (
              <tr key={s.sleeve} className="border-t border-border/20">
                <td className="py-2 font-mono text-white">{s.sleeve}</td>
                <td className="text-right font-mono text-white">{(s.currentWeight * 100).toFixed(1)}%</td>
                <td className="text-right font-mono text-muted-foreground">{(s.targetWeight * 100).toFixed(0)}%</td>
                <td className="pl-4">
                  <div className="h-1 w-24 bg-[#11161d] rounded relative">
                    <div className="absolute h-full bg-[#D4A574] rounded" style={{ width: `${Math.min(Math.abs(drift) * 100, 100)}%` }} />
                  </div>
                </td>
                <td className="pl-4">
                  <span className={`text-[11px] font-mono uppercase px-2 py-[2px] rounded ${bandClass}`}>
                    {s.compatibilityBand}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
function PositioningSkeleton() { return <section className="space-y-4"><Skeleton className="h-7 w-32" /><Skeleton className="h-48 w-full rounded-lg" /></section>; }

async function PerformanceSection() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  const perf = ctx?.performance;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-serif italic text-white">§4 Performance</h2>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Fit', score: perf?.fit, max: 30 },
          { label: 'Alignment', score: perf?.alignment, max: 30 },
          { label: 'Posture', score: perf?.posture, max: 40 },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-lg p-5 border border-border/40">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-mono text-white">{stat.score?.score ?? '—'}<span className="text-sm text-muted-foreground"> / {stat.max}</span></p>
              {stat.score?.deltaVsPriorWeek !== undefined && stat.score?.deltaVsPriorWeek !== null && (
                <span className={`text-xs font-mono ${stat.score.deltaVsPriorWeek >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                  {stat.score.deltaVsPriorWeek >= 0 ? '+' : ''}{stat.score.deltaVsPriorWeek}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <PerformanceTrendChart trends={perf?.trends ?? []} />
    </section>
  );
}
function PerformanceSkeleton() { return <section className="space-y-4"><Skeleton className="h-7 w-32" /><div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div><Skeleton className="h-48 w-full rounded-lg" /></section>; }

async function Footer() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;
  return (
    <footer className="text-[10px] font-mono uppercase text-[#5a6577] pt-6 border-t border-border/20">
      rules v{ctx?.logicVersion.rules ?? '—'} · meta v{ctx?.logicVersion.meta ?? '—'} · known as of {ctx?.knownAsOf ?? '—'}
    </footer>
  );
}
```

- [ ] **Step 2: Type-check + lint**

```bash
cd frontend && npm run build 2>&1 | tail -30
cd frontend && npm run lint 2>&1 | tail -20
```

Expected: both green.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/intelligence/macro-context/page.tsx
git commit -m "feat(intelligence): add /intelligence/macro-context sub-page (5 Suspense sections)"
```

### Task P4-T7: Add 5th NavGrid card on `/intelligence`

**Files:**
- Modify: `frontend/src/app/intelligence/page.tsx`

- [ ] **Step 1: Update NavGrid to 5 columns**

```tsx
// In frontend/src/app/intelligence/page.tsx, replace NavGrid body:
function NavGrid() {
  return (
    <div className="grid grid-cols-5 gap-4">
      <Link href="/intelligence/macro-context" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
        <p className="text-sm font-medium text-white">Macro Context</p>
        <p className="text-xs text-muted-foreground mt-1">Indicator meaning · score causation · positioning · performance</p>
      </Link>
      <Link href="/intelligence/attributions" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
        <p className="text-sm font-medium text-white">Score Attribution</p>
        <p className="text-xs text-muted-foreground mt-1">Decompose scores over time</p>
      </Link>
      <Link href="/intelligence/outcomes" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
        <p className="text-sm font-medium text-white">Decision Outcomes</p>
        <p className="text-xs text-muted-foreground mt-1">Evaluate past decisions</p>
      </Link>
      <Link href="/intelligence/rules" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
        <p className="text-sm font-medium text-white">Rule Accuracy</p>
        <p className="text-xs text-muted-foreground mt-1">Track rule performance</p>
      </Link>
      <Link href="/intelligence/reviews" className="bg-card rounded-lg p-5 border border-border/40 hover:border-primary/40 transition-colors">
        <p className="text-sm font-medium text-white">Periodic Reviews</p>
        <p className="text-xs text-muted-foreground mt-1">Monthly, quarterly, annual</p>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint**

```bash
cd frontend && npm run build 2>&1 | tail -10
cd frontend && npm run lint 2>&1 | tail -10
```

- [ ] **Step 3: Manual smoke**

Run frontend dev server (in another shell) and verify the new card renders + navigates:
```bash
cd frontend && npm run dev
# In browser: http://localhost:3000/intelligence → click "Macro Context" → confirm /intelligence/macro-context renders
```

- [ ] **Step 4: Commit (closes Phase 4)**

```bash
git add frontend/src/app/intelligence/page.tsx
git commit -m "feat(intelligence): add Macro Context NavGrid card (5 columns)"
```

---

## Phase 5 — Friday Integration + Cache Invalidation

Add the `MacroContextSection.tsx` teaser at hierarchy position 3, wire `revalidateTag('macro-context')` into Friday-freeze and transaction-mutation server actions.

### Task P5-T1: Pre-flight — confirm placement options on `/friday`

**Files:** none (read-only).

- [ ] **Step 1: Read FridayDashboard structure**

```bash
grep -n "SinceLastFridayBriefing\|SleeveHealthPanel\|FridaySnapshot" /home/lg/dev/Portfolio_Tracker/frontend/src/app/friday/page.tsx 2>/dev/null
ls /home/lg/dev/Portfolio_Tracker/frontend/src/app/friday/ 2>&1
```

- [ ] **Step 2: Read the page composition**

```bash
cat /home/lg/dev/Portfolio_Tracker/frontend/src/app/friday/page.tsx
```

Note where the "Hero strip" ends and where SleeveHealthPanel begins — `MacroContextSection` lands between those two per DESIGN.md Friday Page Hierarchy item 3.

### Task P5-T2: Build the `MacroContextSection` teaser

**Files:**
- Create: `frontend/src/components/friday/MacroContextSection.tsx`

- [ ] **Step 1: Write the teaser**

```tsx
import Link from 'next/link';

import { isReady } from '@/lib/envelope';
import { getMacroContextCached } from '@/lib/macro-context-fetchers-rsc';

export async function MacroContextSection() {
  const env = await getMacroContextCached();
  const ctx = isReady(env) ? env.data : null;

  // Three-stat shape per spec §5.4 + DESIGN.md Friday Page Hierarchy item 3
  const buckets = ctx?.causalMap.currentBucketStates ?? [];
  const supCount = buckets.filter((b) => b.state === 'supportive').length;
  const advCount = buckets.filter((b) => b.state === 'adverse').length;
  const overall = supCount >= 3 ? 'supportive' : advCount >= 3 ? 'adverse' : 'neutral';

  const fitScore = ctx?.performance.fit?.score ?? null;
  const fitDelta = ctx?.performance.fit?.deltaVsPriorWeek ?? null;
  const knownAsOf = ctx?.knownAsOf ?? '—';
  const logicVersion = ctx?.logicVersion ? `rules v${ctx.logicVersion.rules} · meta v${ctx.logicVersion.meta}` : '—';

  return (
    <section className="bg-card rounded-lg p-5 border border-border/40">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Macro Context</p>
        <Link href="/intelligence/macro-context" className="text-xs text-[#D4A574] hover:underline">
          Open in Intelligence →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Macro state</p>
          <p className="text-lg font-mono text-white">
            {ctx ? `${supCount} SUP / ${advCount} ADV` : '—'}
          </p>
          <p className="text-[10px] font-mono uppercase text-[#5a6577]">{overall}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Fit Score</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-mono text-white">{fitScore ?? '—'}<span className="text-xs text-muted-foreground"> / 30</span></p>
            {fitDelta !== null && (
              <span className={`text-[10px] font-mono ${fitDelta >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                {fitDelta >= 0 ? '+' : ''}{fitDelta}
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Updated</p>
          <p className="text-sm font-mono text-white">{knownAsOf}</p>
          <p className="text-[10px] font-mono uppercase text-[#5a6577]">{logicVersion}</p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/friday/MacroContextSection.tsx
git commit -m "feat(friday): add MacroContextSection teaser (3 stats, links to sub-page)"
```

### Task P5-T3: Mount `MacroContextSection` between Hero and Sleeve Health on `/friday`

**Files:**
- Modify: `frontend/src/app/friday/page.tsx`

- [ ] **Step 1: Edit the page composition**

Add an import for `MacroContextSection` and a `<Suspense>`-wrapped mount between the Hero and Sleeve Health panels. Pattern (adapt to actual file structure):

```tsx
import { Suspense } from 'react';
// ... existing imports
import { MacroContextSection } from '@/components/friday/MacroContextSection';
import { Skeleton } from '@/components/ui/skeleton';

// ... in the page composition, between Hero block and SleeveHealthPanel:
<Suspense fallback={<Skeleton className="h-32 w-full rounded-lg" />}>
  <MacroContextSection />
</Suspense>
```

If the page is a client component without async children, lift the Suspense to the parent server-component layer.

- [ ] **Step 2: Build + manual smoke**

```bash
cd frontend && npm run build 2>&1 | tail -10
cd frontend && npm run dev  # browser /friday → confirm teaser sits between Hero and Sleeve Health
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/friday/page.tsx
git commit -m "feat(friday): mount MacroContextSection at hierarchy position 3"
```

### Task P5-T4: Wire `revalidateTag('macro-context')` into Friday-freeze and transaction server actions

**Files:**
- Modify: server-action files for Friday freeze + transactions

- [ ] **Step 1: Identify server-action call sites**

```bash
grep -rn "createFridayDecision\|createFridaySnapshot\|createFridaySlippage\|revalidateTag\|revalidatePath" /home/lg/dev/Portfolio_Tracker/frontend/src/lib/api.ts /home/lg/dev/Portfolio_Tracker/frontend/src/app/ 2>&1 | head -30
```

- [ ] **Step 2: For each Friday-freeze action, append `revalidateTag('macro-context')`**

In the server-action files (typically `frontend/src/app/friday/actions.ts` or similar), add:

```typescript
import { revalidateTag } from 'next/cache';
// ... after the freeze mutation succeeds:
revalidateTag('macro-context');
```

If freeze is implemented as a client-side fetch through a Next.js route handler, place the `revalidateTag` call inside the route handler instead.

- [ ] **Step 3: For each transaction-mutation action (add / edit / delete), repeat**

```bash
grep -rn "POST.*transactions\|deleteTransaction\|createTransaction\|updateTransaction" /home/lg/dev/Portfolio_Tracker/frontend/src/ 2>&1 | head -10
```

Add `revalidateTag('macro-context')` to each.

- [ ] **Step 4: Build**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Manual smoke**

In browser: `/friday` → run a freeze → reload `/intelligence/macro-context` → confirm `knownAsOf` reflects the latest run rather than the 86400s cache value.

- [ ] **Step 6: Commit (closes Phase 5)**

```bash
git add frontend/src/app/friday/ frontend/src/app/transactions/  # adjust paths to actual files touched
git commit -m "feat(cache): revalidateTag('macro-context') on Friday freeze + tx mutations"
```

---

## Final acceptance gate

- [ ] **All Phase 1-5 commits land cleanly on `main`** (or whichever branch the agent is using). Per project policy, default to `main` for solo work.

- [ ] **Backend suite green**

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

- [ ] **Frontend build green**

```bash
cd frontend && npm run build
```

- [ ] **Frontend lint green**

```bash
cd frontend && npm run lint
```

- [ ] **Spec acceptance criteria walk-through (spec §11):**
  - [ ] `compute_fit_score` returns 0–30 (verified by `test_score_fit_regression.py` post-rescale)
  - [ ] `compute_alignment_score` returns 0–30 (verified by `test_score_v24_reweight.py`)
  - [ ] `compute_posture_diversification_score` returns 0–40 = 20/12/8 (verified by `test_score_v24_reweight.py`)
  - [ ] `/api/intelligence/macro-context` responds in <100ms when T2 cache is warm (manual: hit endpoint twice, second call sub-100ms)
  - [ ] `/friday` page renders `MacroContextSection` teaser at position 3 (manual)
  - [ ] Posture < 8 → stance "reduce_risk" regardless of total score (verified by `test_recommendation_veto.py`)
  - [ ] Stress Resilience < 4 → stance "reduce_risk" regardless of total score (verified by `test_recommendation_veto.py`)
  - [ ] `/intelligence/macro-context` paints all 5 sections within 2.5s on cold path (manual)
  - [ ] `unstable_cache` `tags: ['macro-context']` invalidates on Friday freeze (manual smoke step in P5-T4)
  - [ ] Pre-2026-04-27 weekly reports retain original `logicVersion` and original scores — no in-place rewrite (verified by inspection: nothing in this plan touches existing `WeeklyReport.report_json` rows)

- [ ] **Out-of-scope items remain deferred** — confirm no commit accidentally introduces hysteresis, 5-state classification, risk-aware Alignment split, sleeve cluster correlation in Posture, full weighted bucket aggregation, empirical re-validation, or sub-page narrative reflow. These are PRODUCT.md §5 Future Evolution Path entries.

---

## Self-Review (run by writing-plans skill)

**Spec coverage walk-through:**
- §2 (Scope: 4 sections + teaser) — sections built in P4-T6, teaser in P5-T2. ✓
- §4.1 (`score_rules.py`, FIT_RULES, SLEEVE_FACTOR_MAP, RULES_LOGIC_VERSION) — P1-T3 + P1-T4. ✓
- §4.2 (`macro_indicator_meta.py`, INDICATOR_META, META_LOGIC_VERSION, 13 indicators, core_indicator) — P1-T1 + P2-T7. ✓
- §4.3 (`MacroContextService`, composer-only) — P3-T4. ✓
- §4.4 (`ScoreService.explain_fit`) — P3-T1. ✓
- §4.5 (`GET /api/intelligence/macro-context`, envelope, empty-state shape) — P3-T5. ✓
- §4.6 (T1/T2/T3/T4 caching) — T2 in P3-T2; T4 (unstable_cache + revalidateTag) in P4-T2 + P5-T4; T1 (raw FRED series) is delegated to `_safe_series` cache layer not added here per scope economy — recorded as informational. ◆
- §4.7 (frozen archive — no migration) — confirmed by codex (memory 997). No task needed. ✓
- §5.1-§5.5 (frontend page + components + RSC fetcher + Friday teaser + NavGrid 5th card) — P4-T1..T7 + P5-T2..T3. ✓
- §6 (v2.4 reweight) — P1-T5..T7. ✓
- §7 (Boundary Design Philosophy enforcement: rationale, source, asymmetry, persistence, core) — encoded in INDICATOR_META P1-T1. ✓
- §8 (Versioning + freeze consistency) — RULES + META versions emitted in envelope (P3-T4); historical preservation via existing `logicVersion` field (no new code, per spec §8). ✓
- §9 (Caching invalidation summary) — P3-T6 cron warm-up + P5-T4 revalidateTag. ✓
- §11 (Acceptance criteria) — final gate above. ✓

**Placeholder scan:** zero. Every step ships executable code or commands. The §4.6 T1 layer note is a *scope-deferral* not a placeholder — recorded for transparency.

**Type / signature consistency:**
- `_score_fit_bucket(bucket, state, exposures) -> Tuple[int, str]` — preserved across P1-T5.
- `compute_alignment_score` adds 30 max; tests validate.
- `compute_posture_diversification_score` adds 40 max + sub-decomposition keys `stressResilience`, `concentrationControl`, `diversifierReserve` — preserved (not renamed).
- `_build_recommendation(action_report, total_score, triggered_rules, posture)` — new kwarg added with default `None` so any other call site keeps working.
- `MacroContext` TypeScript shape mirrors backend envelope (verified via `test_macro_context_endpoint.py` + `test_macro_context_service.py`).

**Open questions for executor:**
- If `ScoringAttribution` field names in P3-T3 differ (e.g., `posture_diversification_score` vs `posture_score`), adjust the helper accordingly. Read the model definition first.
- If existing tests assert old maxes (35 / 25 / 10 / 5), update them in P1-T6 Step 6.
- If `frontend/src/app/friday/actions.ts` does not exist as a server-action file, the freeze flow may go through `lib/api.ts` client fetch + a Next route handler — wire `revalidateTag` in whichever file is the server side of the freeze.
