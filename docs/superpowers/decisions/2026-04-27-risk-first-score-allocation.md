# Decision: Risk-First Score Allocation (v2.4 — 2026-04-27)

**Status:** Locked
**Related spec:** `docs/superpowers/specs/2026-04-27-self-development-loop-design.md`
**Companion patches:** PRODUCT.md §1 + §5, ARCHITECTURE.md §3.2 + §3.3 + §4 + §5 + §8, DESIGN.md (Component Patterns, Friday Page Hierarchy, Intelligence Page Hierarchy, Decisions Log)

## Context

Through v1.x.x the composite score allocated **Fit 40 / Alignment 35 / Posture 25**. ARCHITECTURE.md §8 explicitly acknowledged this split as "subjective; no empirical optimization." The macro self-development feedback loop spec (2026-04-27 brainstorm) surfaced that the user's deeper motivation — phrased as "각 지표와 점수의 이유" — is fundamentally **risk-first**: not "does my portfolio match macro?" but "given my portfolio's risk-taking, is the macro environment supportive or hostile, and is the portfolio robust enough to survive when those two diverge?"

External AI macro-engineering review (same session) independently recommended elevating Posture to a veto-class bucket, citing crisis-survivorship dominance over macro fit when the two diverge.

## Decision

1. **Reallocate composite score to Fit 30 / Alignment 30 / Posture 40 (= 100).** Posture/Diversification becomes the largest single dimension; Fit and Alignment are equal-weighted second-tier.
2. **Reweight Posture sub-components to Stress 20 / Concentration 12 / Reserve 8 (= 40).** Stress Resilience receives the largest sub-weight because crisis-event survivorship is the dimension whose breach triggers the veto branches below.
3. **Add two veto branches to `_build_recommendation` stance logic**:
   - `Posture/Diversification < 8 (out of 40)` → stance auto-overrides to `reduce_risk`.
   - `Stress Resilience < 4 (out of 20)` → stance auto-overrides to `reduce_risk`.
   These branches sit *above* the existing 4-branch logic (`signal actions → rebalance`, `total < 45 → reduce_risk`, `total < 60 → watch_closely`, `else → hold`).
4. **PRODUCT.md §1 Vision wording shift** from "combines macro context, quantitative signals, and portfolio state" to "**frames portfolio risk-taking against macro context** — the composite score signals whether the portfolio's current risk profile is justified by the current macro environment, and whether the portfolio is robust enough to survive when those two diverge."
5. **PRODUCT.md §2 User Persona wording shift** from "macro-aware signals that respect regime changes" to "**risk-aware signals where macro regime contextualizes the portfolio's risk-taking** rather than dictating it."

## Rationale

### Why risk-first over macro-aware

The user explicitly identified the reframing during the spec brainstorm: "사실 그게 결국 내가 이번 세션에서 그토록 찾아 해맸던 '각 지표와 점수들의 이유'라는 키워드와 연결이 되는 것 같거든." The motivation phrase that drove this entire spec — wanting to know "what does each indicator mean and how does it connect to my portfolio" — turned out to be *not* a request for richer macro narrative but a request for **clarity on how much risk the portfolio carries against the macro backdrop**. PRODUCT.md §1 and §5 are corrected to reflect this true motivation rather than the original macro-aware framing that pre-dated the brainstorm.

### Why 30/30/40 specifically

The split is a reasoned prior, not an empirical optimum:
- **Posture 40 (largest)** — portfolio survivorship dominates other dimensions when regime turns adverse. Risk-first philosophy expressed in weight.
- **Fit 30 (equal-weighted second)** — macro fit informs whether risk-taking is justified, but no longer the primary signal.
- **Alignment 30 (equal-weighted second)** — operational discipline against published targets stays meaningful but is no longer ranked above structural risk.
- External AI review noted that the legacy 35-point Alignment was likely overweight given that weight drift is a *proxy* for risk drift rather than a direct measure of it. Reducing Alignment to 30 is consistent with that observation. Fully separating Alignment into Structural + Risk components remains deferred (Phase C in PRODUCT.md §5 Future Evolution Path).

### Why Stress 20 / Concentration 12 / Reserve 8

Within Posture, Stress Resilience receives the largest share because:
- Stress simulation is the dimension whose breach triggers the new veto branch at threshold 4-of-20.
- External AI review emphasized that crisis-template MDD estimates are the most consequential read for survivorship — concentration and reserve are necessary but secondary risk dimensions.
- Reserve at 8 still preserves the diversifier signal proportionally (legacy 5/25 = 20%; new 8/40 = 20%).

### Why veto thresholds at Posture < 8 and Stress < 4

Both at the 20% mark of their respective scales (8/40 = 20%; 4/20 = 20%). 20% is conservative — the portfolio has to fail 80% of the relevant safety check before the veto fires. This is intentional: vetoes should be **rare but unconditional**, not regular noise overriding the composite signal.

These thresholds are reasoned priors, not empirically tuned values. PRODUCT.md §5 records an informational "Veto Threshold Recalibration" note: if observed firing frequency proves disproportionate to actual portfolio risk events (fires weekly without drawdown materializing, or fails to catch realized stress), thresholds should be recalibrated — reactively, not on a schedule, and bumping `RULES_LOGIC_VERSION`.

## Acknowledged uncertainties

- **No empirical validation.** The 30/30/40 split is a philosophical prior. Phase F (PRODUCT.md §5 Future Evolution Path) anticipates re-validation after 26+ weeks of accumulated frozen `ScoringAttribution` data, comparing portfolio outcome predictability across alternative allocations.
- **Veto threshold sensitivity unknown.** Until accumulated weekly_reports show how often Posture < 8 or Stress < 4 occurs in practice, we cannot yet say whether the thresholds are well-calibrated. Recalibration pathway documented above.
- **Pre-2026-04-27 historical data** is not retroactively rescored. Frozen weekly reports retain their original scores via `logicVersion` field. Any `/intelligence/macro-context` historical trend pulled from `ScoringAttribution` will reflect the original scoring at each point in time, not the v2.4 logic — this is the correct behavior (frozen records are facts of their moment, not values to recompute).
- **Sub-page narrative ordering** (Phase G) was not flipped to risk-first ordering in this spec. Current ordering (Indicators → Causal Map → Positioning → Performance) is retained pending usage feedback from the v2.4 ship; flipping to (Positioning → Performance → Causal Map → Indicators) would be a subsequent decision.

## Alternatives considered

**Option A — Keep 40/35/25, just glossing the rationale.** Rejected. ARCHITECTURE.md §8's "subjective; no empirical optimization" admission is honest, but does not address the user's actual reframing toward risk-first thinking. Wording-only patch would let the surface stay macro-first while motivation diverged.

**Option B — Posture格上 to 35, e.g., 35/30/35.** Considered. Rejected as middle-ground that does not commit to the philosophical shift; the user's explicit reframing toward risk-first warranted a clearer commitment.

**Option C — 40/25/35 (only Alignment lowered, Fit retained as primary).** Rejected. This still treats macro fit as primary, contradicting the reframing.

**Option D — Veto-only without weight change (legacy 40/35/25 + new vetoes).** Considered. Rejected because the user explicitly wanted the score allocation to *also* express the risk-first philosophy, not only the gating logic. Veto plus weight change together carry the philosophical signal more clearly.

## Implementation references

- Score formulae: `backend/app/services/score_service.py` (`compute_fit_score`, `compute_alignment_score`, `compute_posture_diversification_score`)
- Veto branches: `backend/app/services/report_service.py:_build_recommendation`
- Spec: `docs/superpowers/specs/2026-04-27-self-development-loop-design.md`
- Mockup: `docs/superpowers/specs/2026-04-27-macro-context-mockup.html` (Panel 1 reflects 30/30/40 in §2 Causal Map composite breakdown; Panel 3 illustrates Posture-stance veto scenario)

## Date

2026-04-27 (single-session decision; reaffirmed at confirm gate after the master decision sheet review).
