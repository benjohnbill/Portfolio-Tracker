# Macro Self-Development Loop — Phase 1 (Macro Context Sub-Page) Design

**Date:** 2026-04-27
**Status:** Approved (single-session brainstorm + codex consult + external AI review + risk-first reframing)
**Scope:** First sub-project of the larger macro self-development feedback loop. Subsequent phases (forward portfolio outcome prediction lines, Polymarket integration) are deferred to a separate gstack-office-hours session.
**Logic versions introduced:** `RULES_LOGIC_VERSION = "1.0.0"`, `META_LOGIC_VERSION = "1.0.0"` (both new).
**PRODUCT.md / ARCHITECTURE.md / DESIGN.md** receive companion patches in the same commit train.

---

## 1. Motivation

The user's verbatim motivation, which becomes the spec's north star:

> "그래서 각 indicator가 무슨 의미인데. 그를 기반으로 한 점수 산출 및 성과 지표들과는 무슨 관계인데? 내 Portfolio가 그래서 macro 기준 어떤 포지션이었고, 변화하는 경제 상황에서 자산배분/트레이딩 적인 관점에서 내 성과는 어떻게 점수화(수치화)가 되고 있는데"

Translation (working): "What does each indicator mean. What's its relationship to score calculation and performance metrics. So what positioning is my portfolio in based on macro, and how is my performance scored/quantified from an asset-allocation/trading perspective in changing economic conditions."

Mid-session, the user clarified that the deeper question underneath this surface is **risk-first**: not "does my portfolio match macro?" but "given my portfolio's risk-taking, is the macro environment supportive or hostile, and is the portfolio robust enough to survive when those two diverge?" This reframing is reflected in PRODUCT.md §1 + §5 (v2.4 patches).

## 2. Scope (this spec)

A new sub-page **`/intelligence/macro-context`** under the existing `/intelligence` menu. Single-page scroll narrative, four sections in this order:

- **§1 Indicators** (atom) — 13 indicator cards: bucket × state badge, current value, lead/lag tier, hover-tooltip with definition / methodology / why it matters.
- **§2 Causal Map** (cause) — 4-column flow visualization: Indicators → Buckets → Sleeve compatibility bands → Composite score breakdown.
- **§3 Positioning** (current) — 6-row sleeve table with current weight, target, drift, and compatibility band ("below" / "in" / "above") derived deterministically from fit predicates.
- **§4 Performance** (result) — Fit / Alignment / Posture decomposition with deltas, plus 26-week composite-score trend chart sourced from frozen `ScoringAttribution` history.

A `MacroContextSection.tsx` teaser card on `/friday` (which was previously a broken import) summarizes the same data in three stats and links to the Intelligence sub-page.

## 3. Out of scope (this spec)

- Forward expectation layer (Polymarket integration, forward portfolio outcome prediction lines) — deferred to a separate gstack-office-hours session that will produce its own spec under the same `MacroContextService` ↔ `PredictionService` sibling boundary.
- Hysteresis layer (Phase A); 5-state internal classification (Phase B); risk-aware Alignment split (Phase C); sleeve cluster correlation in Posture (Phase D); full weighted bucket aggregation 0.5/0.3/0.2 (Phase E); empirical score allocation re-validation (Phase F); risk-first sub-page narrative reflow (Phase G). All seven are documented as **PRODUCT.md §5 Future Evolution Path** entries with named placeholder fields where applicable.

## 4. Backend architecture

### 4.1 New module — `backend/app/services/score_rules.py`

```python
RULES_LOGIC_VERSION = "1.0.0"

@dataclass(frozen=True)
class ThresholdPredicate:
    field: str           # exposure factor: risk_beta | duration | inflation_defense | diversifier | reserve
    op: Literal[">=", "<=", ">", "<", "between"]
    value: float | tuple[float, float]

@dataclass(frozen=True)
class FitRuleSpec:
    bucket: str          # one of MacroService.BUCKET_ORDER (Liquidity/FCI, Rates, Inflation, Growth/Labor, Stress/Sentiment)
    state: str           # supportive | neutral | adverse
    predicates: list[ThresholdPredicate]   # AND-combined within a spec; OR via separate spec entries
    points_full_match: int                  # awarded when all predicates pass
    points_partial_match: int               # awarded when some predicates pass
    points_miss: int                        # awarded when all predicates fail
    narrative_template: str                 # template substituted into causal-map UI

FIT_RULES: list[FitRuleSpec] = [
    # 5 buckets × 3 states = 15 entries
    # Stress/Sentiment is now explicit (was implicit default branch in v1.x.x)
    ...
]
```

Implementation note: the exact `predicates` content for each of the 15 entries is derived during implementation by reading `score_service._score_fit_bucket` line-by-line and translating the existing nonlinear predicate logic (range checks, OR conditions, threshold ladders at lines 134, 145, 156, 167, 178) into the spec form. Behavior must remain identical, validated by a regression test over all 5 buckets × 3 states × representative exposure profiles.

Since Posture/Diversification was reallocated to 40 points in v2.4 risk-first, `compute_posture_diversification_score` thresholds also shift:
- Stress Resilience (0–20): `>= -15% AND >= -20% MDD = 20`; `>= -25% / -35% = 12`; else 4.
- Concentration Control (0–12): `top1 <= 25% AND top2 <= 45% AND HHI <= 0.18 = 12`; `top1 <= 35% AND top2 <= 60% = 7`; else 2.
- Diversifier Reserve (0–8): `reserve + diversifier >= 15% = 8`; `>= 5% = 5`; else 0.

These updated point values are codified as constants in `score_service.py` (or imported from `score_rules.py` if a structured form is appropriate).

### 4.2 New module — `backend/app/data/macro_indicator_meta.py`

```python
META_LOGIC_VERSION = "1.0.0"

@dataclass(frozen=True)
class IndicatorMeta:
    key: str
    label: str
    bucket: str           # Liquidity/FCI | Rates | Inflation | Growth/Labor | Stress/Sentiment
    lead_lag_tier: Literal[
        "strong_lead_12_18m",
        "mid_lead_6_12m",
        "coincident",
        "weak_lag_1_3m",
        "strong_lag_quarterly",
    ]
    definition: str
    methodology: str
    why_it_matters: str
    baseline_thresholds: dict[str, float]
    threshold_rationale: str
    threshold_rationale_source: Literal["academic", "policy", "historical_percentile", "custom"]
    computation_window_weeks: int
    signal_asymmetry: Literal["fn_dominant", "fp_dominant", "symmetric"]
    core_indicator: bool       # at most one True per bucket; floors / ceilings the bucket score
    persistence_weeks: int     # = 1 in v2.4 (no hysteresis); reserved for Phase A
    source: str                # FRED | Yahoo Finance
    refresh_frequency: str     # daily | weekly | monthly | quarterly

INDICATOR_META: dict[str, IndicatorMeta] = { ... 13 entries ... }
```

Indicator roster (13 entries, +3 vs v1.x.x):

| Bucket | Indicators | Core? |
|---|---|---|
| Liquidity/FCI | Net Liquidity, M2 YoY, **NFCI** (new) | NFCI = core |
| Rates | 10Y Real Yield, 10Y-2Y Spread, **10Y-3M Spread** (new) | T10Y3M = core |
| Inflation | CPI YoY, Core PCE YoY | Core PCE = core (sticky) |
| Growth/Labor | Real GDP Growth, NFP 3M Avg, **Sahm Rule** (new) | Sahm Rule = core |
| Stress/Sentiment | VXN, Credit Spread | (no core; binary majority) |

`SLEEVE_FACTOR_MAP` (sensitivity prior) lives in `score_rules.py`:

```python
SLEEVE_FACTOR_MAP = {
    "NDX":        {"growth": +1, "liquidity": +1, "inflation": -1, "tight_fci": -1},
    "MSTR":       {"liquidity": +2, "growth": +1, "risk_off": -2},
    "DBMF":       {"dispersion": +1, "trend_persistence": +1, "equity_beta": 0},
    "GLDM":       {"real_rate": -1, "stress": +1},
    "BRAZIL":     {"dollar_liquidity": +1, "global_risk_on": +1, "rates": -1},
    "BONDS/CASH": {"growth_slowdown": +1, "inflation_reaccel": -1},
}
```

Hardcoded indicator cutoffs that currently live inside `macro_service.py` (CPI 2.5/3.5, GDP 2.0/0.5, NFP 50/150, etc.) move into `INDICATOR_META.baseline_thresholds`. The `macro_service` becomes a *consumer* of META rather than the keeper of magic numbers.

### 4.3 New service — `backend/app/services/macro_context_service.py`

```python
class MacroContextService:
    """Read-model service. Composes macro snapshot, score decomposition,
    portfolio positioning, and frozen attribution trends into a single
    explanation envelope. Sibling to a future PredictionService that will
    handle forward-looking expectation reads.

    Time orientation: backward-looking (current state lens).
    """

    @staticmethod
    def get_macro_context() -> dict:
        snapshot      = MacroService.get_macro_snapshot_cached()
        allocation    = PortfolioService.get_current_allocation()
        score_explain = ScoreService.explain_fit(snapshot, allocation)
        trends        = IntelligenceService.get_attribution_history(weeks=26)

        return {
            "indicators":  _attach_meta(snapshot["indicators"]),
            "causalMap":   _build_causal_map(snapshot, score_explain),
            "positioning": _build_positioning(allocation, score_explain),
            "performance": _build_performance(score_explain, trends),
            "logicVersion": {"rules": RULES_LOGIC_VERSION, "meta": META_LOGIC_VERSION},
            "knownAsOf":   snapshot["knownAsOf"],
        }
```

Composition only. Scoring rules live in `ScoreService`; metadata lives in `INDICATOR_META`. The new service is a pure composer.

### 4.4 ScoreService extension — `explain_fit`

A new read-model method on `ScoreService` (existing `compute_*_score` methods are unchanged):

```python
@staticmethod
def explain_fit(snapshot: dict, allocation: dict) -> dict:
    """Read-model: fit score with structured causal trace + sleeve projection."""
    aggregates = ScoreService._compute_exposure_aggregates(allocation)
    bucket_results = []
    for bucket_state in snapshot["buckets"]:
        rule = _lookup_rule(bucket_state["bucket"], bucket_state["state"])
        points, narrative = _evaluate_rule(rule, aggregates)
        sleeve_projection = _project_to_sleeves(rule, allocation)
        bucket_results.append({
            "bucket": bucket_state["bucket"],
            "state":  bucket_state["state"],
            "points": points,
            "narrative": narrative,
            "rule": {"predicates": rule.predicates, "rationale": rule.narrative_template},
            "sleeveProjection": sleeve_projection,
        })
    return {
        "totalFit": sum(r["points"] for r in bucket_results),
        "buckets":  bucket_results,
        "exposureAggregates": aggregates,
    }
```

`_project_to_sleeves` returns the per-sleeve `compatibilityBand` ("below" / "in" / "above") + `currentWeight` + `contributingFactors` derived from `SLEEVE_FACTOR_MAP`. This is the deterministic projection layer specified in PRODUCT.md §5 Sleeve-Level Fit Projection.

### 4.5 New endpoint — `GET /api/intelligence/macro-context`

Envelope follows the project's API envelope pattern (`coding-style.md` §"API envelope pattern (CRITICAL)"):

```python
return {"status": "ok", "data": data}
```

The `data` payload shape:

```typescript
{
  indicators: IndicatorWithMeta[];
  causalMap: { bucketRules: BucketRule[]; currentBucketStates: BucketState[]; sleeveImpacts: SleeveImpact[] };
  positioning: { sleeves: SleeveCompatibility[]; bands: BandLegend[] };
  performance: { fit: ScoreBreakdown | null; alignment: ScoreBreakdown | null; posture: ScoreBreakdown | null; trends: WeeklyScoreHistory[] };
  logicVersion: { rules: string; meta: string };
  knownAsOf: string | null;
}
```

Empty-state payload (when external fetch fails or cold path errors) has the **same shape with empty arrays / null leaves** so frontend skeleton and loaded layouts match. True 5xx error path returns `{"status": "error", "data": null, "error": {"code": ..., "message": ...}}`.

### 4.6 Caching — date-keyed, no TTL

Per `coding-style.md` §"First-paint UX priority": SystemCache is `date-keyed, no TTL mechanism, key by date`.

| Tier | Source | Key | Invalidation |
|---|---|---|---|
| T1 | FRED + Yahoo raw series | `macro_series:{indicator_key}:{YYYY-MM-DD}` | automatic on date rollover |
| T2 | Computed snapshot | `macro_snapshot:{YYYY-MM-DD}_v{META_LOGIC_VERSION}` | automatic on date rollover or version bump |
| T3 | (no cache) | — | composed fresh per request (~35ms hot path) |
| T4 | Frontend RSC | Next.js `unstable_cache` with `tags: ['macro-context']` | `revalidateTag` on Friday freeze + transactions; fallback `revalidate: 86400` |

`MacroService.get_macro_snapshot_cached()` wraps `get_macro_snapshot()` with T1/T2 SystemCache lookups. Cron warm-up (added at the end of `/api/cron/update-signals`) calls this method to populate the cache before the user's first request of the day.

### 4.7 Frozen archive — verified, no migration needed

The codex consult (2026-04-27) verified that `frozen_report` JSONB at `report_service.py:226` and `friday_service.py:340` already includes `macroSnapshot`. No migration required. Phase B (forward prediction lines) will read this existing time series.

## 5. Frontend architecture

### 5.1 Page — `frontend/src/app/intelligence/macro-context/page.tsx`

RSC + per-section `<Suspense>` (matching the existing `/intelligence/page.tsx` pattern):

```tsx
export default function MacroContextPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
      <Suspense fallback={<HeroSkeleton />}>          <HeroSection /> </Suspense>
      <Suspense fallback={<IndicatorsSkeleton />}>    <IndicatorsSection /> </Suspense>
      <Suspense fallback={<CausalMapSkeleton />}>     <CausalMapSection /> </Suspense>
      <Suspense fallback={<PositioningSkeleton />}>   <PositioningSection /> </Suspense>
      <Suspense fallback={<PerformanceSkeleton />}>   <PerformanceSection /> </Suspense>
    </main>
  );
}
```

Each section calls `getMacroContextCached()` — `unstable_cache` deduplicates within a request, so backend hits exactly once per page navigation.

### 5.2 Components — `frontend/src/components/intelligence/macro-context/`

| Component | Server / Client | Notes |
|---|---|---|
| `HeroSection` | Server | `logicVersion` badges + `knownAsOf` |
| `IndicatorsSection` | Server top | maps over 13 cards |
| `IndicatorCard` | Client | shadcn Tooltip on hover surfaces meta |
| `CausalMapSection` | Client | hover/click highlights row across columns |
| `PositioningSection` | Server | static read of compatibility bands |
| `PerformanceSection` | Server top | breakdown stat cards |
| `PerformanceTrendChart` | Client | recharts SVG sparkline |

shadcn primitives (Card, Badge, Tooltip, ScrollArea, Skeleton) are reused per `coding-style.md` "prefer composing existing primitives."

### 5.3 RSC fetcher — `frontend/src/lib/macro-context-fetchers-rsc.ts`

```typescript
export const getMacroContextCached = unstable_cache(
  async () => fetchMacroContext(),
  ['macro-context'],
  { revalidate: 86400, tags: ['macro-context'] }
);
```

`revalidateTag('macro-context')` is invoked from Friday-freeze server actions and transaction-mutation server actions so the user's portfolio change is visible immediately rather than waiting on the 86400s fallback.

### 5.4 `/friday` teaser — `frontend/src/components/friday/MacroContextSection.tsx`

This file currently has no source but is imported by `FridayDashboard.tsx:2,29` and `FridayReportSection.tsx:39` (codex finding). This spec creates the file, resolving the broken import and integrating the teaser at hierarchy position 3 (between Hero strip and Sleeve Health panel — see DESIGN.md Friday Page Hierarchy v2.4).

Three stats: macro state (n SUP / n ADV with overall), Fit Score (current/30 + delta vs 4-week avg), updated (`knownAsOf` + logicVersion footer). "Open in Intelligence →" link.

Empty-state (cold path / error) renders the same three-stat skeleton with `—` placeholders.

### 5.5 NavGrid update — `frontend/src/app/intelligence/page.tsx`

Add a fifth Link card to the existing 4-card NavGrid pointing to `/intelligence/macro-context`. Label: "Macro Context". Description: "Indicator meaning · score causation · positioning · performance".

## 6. Risk-first reframing impact (v2.4)

This spec ships alongside a PRODUCT.md / ARCHITECTURE.md / DESIGN.md patch train that re-allocates the composite score and adds Posture-stance veto. Implementation impact within this spec's scope:

- `score_service.compute_fit_score` now returns 0–30 (max 6 per bucket × 5 buckets, was 0–8 × 5).
- `score_service.compute_alignment_score` now returns 0–30 (`30 * target_weight` per category, was `35 * target_weight`).
- `score_service.compute_posture_diversification_score` now returns 0–40 with sub-scores 20/12/8 (was 10/10/5 totaling 25).
- `score_service._build_recommendation` (in `report_service.py`) gains two veto branches at the top: `Posture < 8 → reduce_risk` and `Stress Resilience < 4 → reduce_risk`.

These point-value changes are deterministic and do not introduce ML. Pre-2026-04-27 frozen weekly reports retain their original scores via existing `logicVersion` field; new reports use the v2.4 logic.

## 7. Boundary design philosophy enforcement

Per PRODUCT.md §5 Boundary Design Philosophy (v2.3):

1. Every threshold in `INDICATOR_META.baseline_thresholds` records its `threshold_rationale_source`.
2. Sahm Rule (0.50pp), NFCI (±0.25), T10Y3M (inversion + 4-week duration) carry `threshold_rationale_source = "policy"` (NBER-aligned, Chicago Fed publication, NY Fed model).
3. Net Liquidity / M2 YoY / VXN / Credit Spread use `historical_percentile` (existing logic, preserved).
4. `core_indicator = True` is set for Sahm Rule (Growth/Labor), Core PCE (Inflation), NFCI (Liquidity/FCI), T10Y3M (Rates). Stress/Sentiment retains binary majority (no core).
5. `signal_asymmetry`: Sahm Rule, Core PCE, T10Y3M = `fn_dominant`; VXN, Credit Spread, NFCI = `fp_dominant`; rest = `symmetric`.

## 8. Versioning + freeze consistency

- `RULES_LOGIC_VERSION` and `META_LOGIC_VERSION` are emitted in every `/api/intelligence/macro-context` envelope.
- Pre-existing `report_service.py:210` `logicVersion` field continues to mark frozen weekly reports; v2.4 weekly reports will carry the new version.
- Historical-rule preservation mechanism (lookup of frozen `logicVersion` to load the correct rule snapshot) is **not implemented in this spec** — it activates at the first version bump (v1.0.0 → v1.1.0). Until then, the current rules are sole source.

## 9. Caching invalidation summary

| Event | T1 | T2 | T3 (no cache) | T4 RSC |
|---|---|---|---|---|
| Date rollover | new key | new key | n/a | revalidate after 86400s |
| `/api/cron/update-signals` (daily, 21:00 UTC) | refresh | refresh | n/a | no direct invalidation; backend warm-up only |
| Friday freeze server action | n/a | n/a | n/a | `revalidateTag('macro-context')` |
| Transaction add/edit/delete server action | n/a | n/a | n/a | `revalidateTag('macro-context')` |
| `RULES_LOGIC_VERSION` or `META_LOGIC_VERSION` bump | T2 key changes (auto) | new key (auto) | n/a | `revalidateTag('macro-context')` recommended |

## 10. Implementation phasing (within this spec)

A separate writing-plans pass will produce the implementation plan. Indicative ordering:

1. **Backend foundation**: `INDICATOR_META`, `score_rules.py` (FIT_RULES, SLEEVE_FACTOR_MAP), score_service refactor + regression test.
2. **Posture sub-score reweight + veto branches**: thresholds 20/12/8, two veto branches in `_build_recommendation`.
3. **Backend service + endpoint**: `MacroContextService`, `GET /api/intelligence/macro-context`, T1/T2 caching, cron warm-up.
4. **3 new indicators**: Sahm Rule, NFCI, T10Y3M wired into `MacroService.get_macro_snapshot()`.
5. **Frontend page + components**: `/intelligence/macro-context` page + 5 sections + IndicatorCard + PerformanceTrendChart.
6. **Frontend `/friday` integration**: `MacroContextSection.tsx` (resolves broken import), NavGrid 5th card, `revalidateTag` invocations on freeze + transaction actions.
7. **PRODUCT.md / ARCHITECTURE.md / DESIGN.md patches** committed atomically with the spec.

## 11. Acceptance criteria

- `compute_fit_score` returns 0–30 and matches v1.x.x formula structure (5 buckets × 6 max) preserving relative ordering across regression test inputs (modulo the new max).
- `compute_alignment_score` returns 0–30 for all `CATEGORY_TARGETS` with drift thresholds 10% / 30% preserved.
- `compute_posture_diversification_score` returns 0–40 = 20/12/8 sub-decomposition.
- `/api/intelligence/macro-context` responds in <100ms when T2 cache is warm.
- `/friday` page no longer shows the import-resolution warning for `MacroContextSection`.
- Posture < 8 returns stance "reduce_risk" regardless of total score (regression test).
- Stress Resilience < 4 returns stance "reduce_risk" regardless of total score (regression test).
- Frontend `/intelligence/macro-context` paints all 5 sections within 2.5s on cold path; <100ms on hot path.
- `unstable_cache` `tags: ['macro-context']` invalidates correctly when a Friday freeze fires.
- Pre-2026-04-27 weekly reports retain their original `logicVersion` and original scores (no in-place rewrite).

## 12. References

- Verbatim user motivation, v2.4 risk-first reframing decision, codex consult findings (envelope shape, frozen archive verification, predicate-spec extraction model), external AI macro engineering review (Sahm Rule, NFCI, T10Y3M, boundary design philosophy 5 principles, weighted aggregation).
- Companion patches: `PRODUCT.md` §1, §5; `ARCHITECTURE.md` §3.2, §3.3, §4, §5, §8; `DESIGN.md` Component Patterns + Macro Indicator Badge Convention + Friday Page Hierarchy + Intelligence Page Hierarchy + Decisions Log.
- Companion decision document: `docs/superpowers/decisions/2026-04-27-risk-first-score-allocation.md`.
- Mockup: `docs/superpowers/specs/2026-04-27-macro-context-mockup.html` (committed alongside this spec; reflects v2.4 30/30/40 + veto + 13 indicators).
