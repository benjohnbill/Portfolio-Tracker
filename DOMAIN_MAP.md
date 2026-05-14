# DOMAIN_MAP.md

> **자가 기록 mandate.** 작업 중 새 어휘 / 정의 / cross-reference가 발견되면
> 즉시 이 파일에 반영. 시점 명기 (YYYY-MM-DD).

## §1 Domain Entities (측정 가능한 양 / 현실 객체)

- **weekly-report** — backend가 cron tick으로 생성하는 한 주 분량 dossier. score, portfolioSnapshot, triggeredRules, macroSnapshot, recommendation을 묶음. ✅
- **friday-snapshot** — 사용자가 freeze를 누른 시점에 보존된 weekly-report + decisions + comment. snapshot_date 키. ✅
- **friday-snapshot-summary** — snapshot list view용 경량 record (date / score). ✅
- **weekly-decision** — freeze 시점에 journal에 남기는 결정. decisionType, asset, confidence triplet (vsSpyRiskadj / vsCash / vsSpyPure), invalidation, expectedFailureMode, triggerThreshold. ✅
- **confidence-triplet** — `vsSpyRiskadj` (primary, required) / `vsCash` (optional) / `vsSpyPure` (optional). 기대 ordering: #1 ≥ #2 ≥ #3 (deviate 시 observation log). ✅
- **execution-slippage** — 지난 주 decision 실행 시점의 executed_at / executed_price / executed_qty / notes. ✅
- **sleeve** — portfolio asset 묶음 단위. 현 등록 set: NDX, DBMF, BRAZIL, MSTR, GLDM, BONDS-CASH. ✅
- **target-deviation** — sleeve의 currentWeight / targetWeight / deviation. drift severity color 분기: |drift|>5% 적색, >2% amber, 이하 primary. ✅
- **triggered-rules** — 이 주의 active rule list (ruleId, severity, message, affectedSleeves). ✅
- **sleeve-history** — sleeve별 최근 4주 rule firing count series. ✅
- **macro-snapshot** — frozen macro read (buckets, overallState, bucket별 summary). weekly-report에 포함. ✅
- **macro-context** — 별도 endpoint (/api/macro-context). causalMap.currentBucketStates + performance.fit + knownAsOf + logicVersion. ✅
- **fit-score** — macro-context의 0–30 점수. priorWeek 대비 delta surfaced. ✅
- **regime-transitions** — bucket이 supportive↔adverse↔neutral 사이 이동한 기록. since-last-friday briefing의 핵심 lens. ✅
- **decision-outcomes** — matured weekly-decision의 outcomeDeltaPct + horizon. mature된 항목만 briefing에 노출. ✅
- **cron-alert-history** — daily cron 성공/실패 카운트 + last failure message. ✅
- **weekly-comment** — freeze 시점에 사용자가 남기는 한 줄 회고 (Phase D A7). ✅
- **score-attribution** — 주간 totalScore의 fit(30) + alignment(30) + posture(40) 분해. AttributionData[] 시계열로 surface. ✅
- **alignment** — score-attribution의 alignment 축 (0-30). portfolio holding이 macro 신호와 얼마나 일치하는지. ✅
- **posture** — score-attribution의 posture 축 (0-40). 행동 적극도 / 방향성. ✅
- **fit-bucket** — fit 점수의 5 sub-bucket (liquidity, rates, inflation, growth, stress) 점수 분해. AttributionsView 표에서 latest / 4W avg / best / worst로 표시. ✅
- **macro-indicator** — IndicatorWithMeta. key, bucket, label, value, unit, state(supportive/neutral/adverse), leadLagTier, coreIndicator, definition, methodology, whyItMatters, thresholdRationale + source 포함. ✅
- **indicator-bucket** — macro-context의 5 분류: Liquidity/FCI, Rates, Inflation, Growth/Labor, Stress/Sentiment. 약어 LIQ/RAT/INF/GRO/STR. ✅
- **indicator-state** — supportive / neutral / adverse 3-state. IndicatorCard state badge 색 분기. ✅
- **lead-lag-tier** — indicator의 시간 선행성 분류: strong_lead_12_18m / mid_lead_6_12m / coincident / weak_lag_1_3m / strong_lag_quarterly. ✅
- **core-indicator** — bucket 내 primary 지표. IndicatorCard에서 CORE eyebrow로 강조. ✅
- **threshold-rationale** — indicator threshold 결정의 narrative + 출처(thresholdRationaleSource). tooltip footer에 italic 표기. ✅
- **bucket-state** — bucket 자체의 종합 state (supportive / neutral / adverse). causalMap.currentBucketStates[]. ✅
- **sleeve-compatibility** — bucket이 sleeve에 부여한 적합도. sleeveImpacts[bucket].sleeves[].compatibilityBand. ✅
- **compatibility-band** — sleeve-compatibility 값 표현: under / at / above (red/green/amber). ✅
- **composite-breakdown** — total score 100점의 가중 구성 (Fit 30 + Alignment 30 + Posture 40). CausalMapSection 4번째 column. ✅
- **rule-accuracy** — RuleAccuracyData. ruleId · severity · timesFired · timesFollowed · timesIgnored · timesPending · followRate. ✅
- **severity** — rule 심각도 4-tier: critical / high / medium / low. 색 매핑: red / amber / blue / emerald. ✅
- **follow-rate** — timesFollowed / timesFired (rule을 따른 비율). null 가능 (fire=0). ✅
- **outcome-delta** — decision-outcomes의 outcomeDeltaPct. mature된 horizon에서만 값 존재, 그 외 pending. ✅
- **score-delta** — decision 시점 ↔ horizon end 간 totalScore 변화. ±값으로 표시. ✅
- **review-summary** — ReviewSummaryData{months[], quarters[], years[], totalWeeks}. periodic-review 페이지의 entry. ✅
- **review-aggregation** — ReviewAggregation{period, count, scores{avg,min,max,trend}, fit/alignment/posture{avg}, ruleStats[]}. 특정 기간을 클릭하면 fetch. ✅
- **risk-adjusted-scorecard** — RiskAdjustedScorecardPayload. 6 metric × 3 horizon (6M/1Y/ITD), portfolio vs spy_krw. ✅
- **maturity-gate** — view unlock 조건. risk-adjusted 26주, calmar-trajectory 52주. 미통과 시 "Accumulating" empty state. ✅
- **cagr** — risk-adjusted metric: 복리 연환산 성장률. ✅
- **mdd** — maximum drawdown. ✅
- **sd** — standard deviation. ✅
- **sharpe** — sharpe ratio. ✅
- **calmar** — calmar ratio (CAGR / MDD). ✅
- **sortino** — sortino ratio. ✅
- **spy-krw** — KRW 환산 SPY 벤치마크. risk-adjusted-scorecard에서 portfolio와 병기. ✅
- **data-density** — DataDensityBadge가 표시하는 분석 가능한 주(week) 수 단계: <4 getting-started / <12 early-data / ≥12 analyzed. ✅
- **contribution-heatmap** — 지난 52주 totalScore를 셀별 opacity로 코딩한 grid. cell hover → tooltip(date · score/100). ✅
- **performance-trend** — frozen totalScore 주간 시계열 (WeeklyScoreHistory[]). PerformanceTrendChart sparkline. ✅

## §2 Behaviors (동작 / 시간 변화)

- **freeze** — 현재 weekly-report를 friday-snapshot으로 굳히는 action. createFridaySnapshot. 사용자 한 주에 한 번. ✅
- **journal-entry** — freeze 시점에 weekly-decision을 createFridayDecision으로 저장. ✅
- **slippage-log** — 지난 주 decision의 실제 체결 후 createFridaySlippage. per-decision form. ✅
- **macro-revalidate** — macro-context cache를 server action revalidateMacroContext로 무효화. ✅
- **bucket-state-derivation** — buckets 중 supportive ≥3 → 전체 supportive, adverse ≥3 → adverse, 그 외 neutral. MacroContextSection 내부 규칙. ✅
- **sleeve-label-normalize** — backend `_normalize`와 lockstep: '-', '_', ' ', '/' 제거 + upper. ✅
- **partial-snapshot-safety** — snapshot panel은 모든 sub-section을 `?? fallback`으로 보호. envelope partial / ready 모두 렌더 가능. ✅
- **regime-overlay-toggle** — AttributionsView 차트에 regimeHistory를 ReferenceLine 점선으로 overlay하는 view-local 토글. ✅
- **horizon-refetch** — OutcomesView가 horizon chip 클릭 시 getIntelligenceOutcomes(h) 재호출 → 상태 갱신. ✅
- **period-refetch** — ReviewsView가 period chip 클릭 시 getMonthlyReview/Quarterly/Annual 1건 fetch → AggregationCard 렌더. ✅
- **causal-hover-sync** — CausalMapSection 4 column이 single highlight state로 cross-column row를 sync 강조. ✅
- **maturity-gating** — based_on_freezes < required_weeks 면 view 본체 대신 "Accumulating" placeholder 노출. risk-adjusted-scorecard, calmar-trajectory에 적용. ✅

## §3 Cluster-Level Concepts (여러 entity의 종합 / 묶음)

- **friday-ritual** — weekly-report + freeze + journal-entry + slippage-log + macro-revalidate를 한 주 한 번 묶어내는 user-facing ritual. /friday surface가 대표. ✅
- **friday-archive** — frozen friday-snapshot의 시점별 list + per-date detail. /friday/archive 경로. ✅
- **sleeve-health** — drift × active rules × recency strip을 하나의 3-축 view로 결합. SleeveHealthPanel이 single atom으로 답함. ✅
- **since-freeze-briefing** — 직전 freeze 이후 regime-transitions × decision-outcomes × cron-alert-history × weekly-comment 4 lens 통합. ✅
- **attribution-cluster** — score-attribution + contribution-heatmap + regime-overlay + data-density를 묶은 한 surface. /intelligence와 /intelligence/attributions이 공유. ✅
- **outcome-evaluation** — decision-outcomes + horizon-filter + regime-shift 마커 + outcome-delta + score-delta를 묶은 사후평가 cluster. /intelligence/outcomes. ✅
- **rule-accuracy-cluster** — rule-accuracy + severity + follow-rate + triggered-rules 누적 view. /intelligence/rules. ✅
- **macro-causation** — macro-indicator → indicator-bucket → bucket-state → sleeve-compatibility → composite-breakdown 인과 chain. CausalMapSection이 한 화면에 압축. ✅
- **review-roll-up** — review-summary + review-aggregation의 weekly → monthly → quarterly → annual 시간 단위 누적 view. ✅
- **maturity-progression** — freeze-count gate (26주 risk-adj, 52주 calmar). 같은 게이트 패밀리지만 unlock 후 답하는 질문이 다름. ✅

## §4 Atom Types (컴포넌트 역할 분류 vocabulary)

### multi-question atom
한 컴포넌트가 여러 sub-question을 *함께* 답함. 분리하면 cross-lens 통찰 손실.
- Batch 1: FridayDashboard, FridaySnapshotPanel, SinceLastFridayBriefing, SleeveHealthPanel.
- Batch 2: OutcomesView, ReviewsView, RulesView, CausalMapSection, IndicatorCard.

### gateway-thin atom
짧은 요약 + 다른 surface로의 다리. 깊이는 destination에.
- Batch 1: MacroContextSection.
- Batch 2: CalmarTrajectoryPlaceholder (pre-maturity-gate placeholder; gate 통과 시 본격 chart로 전환).

### chart atom
recharts-based 또는 table-shaped; one quantitative view.
- Batch 1: 없음.
- Batch 2: AttributionsView (stacked area + table), RiskAdjustedScorecard (6×3 metric table), PerformanceTrendChart (single-series sparkline).

### data-fetcher atom
RSC wrapper — fetch + error/empty handling, then renders a display atom.
- Batch 1: FridayBriefingSection, FridayReportSection, FridaySleeveSection, FridaySnapshotSection.
- Batch 2: IntelligenceAttributionsSection, IntelligenceOutcomesSection, IntelligenceRegimeHistorySection, IntelligenceReviewsSection, IntelligenceRulesSection.

### form-input atom
사용자 입력 받음. _(Batch 1-2 instances 없음 — Batch 3에 AddAssetModal 예정)_

### shell / utility atom
navigation / shared primitives. atom 정의 약화 (질문에 답 X), 그러나 inventory 일관성 위해 포함.
- Batch 2: IntelligenceSharedUI (DataDensityBadge + ContributionHeatmap 묶음 — utility A/B 결정 = A).

## §5 Interaction Patterns

_(deferred — vocabulary 5+ 모이면 분리)_

## §6 API Field Registry

_(흡수 from docs/DOMAIN_MAP — Batch 4 마무리 시 통합)_

## §7 Cross-reference

- 컴포넌트 메타: frontend/src/components/**/*.meta.yaml
- 디자인 토큰: DESIGN.md frontmatter
- 제품 결정: PRODUCT.md
- 아키텍처: ARCHITECTURE.md

## §8 Change Log

- 2026-05-14 — [vocab] DOMAIN_MAP initialized (IA Phase 1 implementation start)
- 2026-05-14 — [batch-1] friday/ 9 atoms done. Vocab additions:
  - §1 Entities: weekly-report, friday-snapshot, friday-snapshot-summary, weekly-decision, confidence-triplet, execution-slippage, sleeve, target-deviation, triggered-rules, sleeve-history, macro-snapshot, macro-context, fit-score, regime-transitions, decision-outcomes, cron-alert-history, weekly-comment.
  - §2 Behaviors: freeze, journal-entry, slippage-log, macro-revalidate, bucket-state-derivation, sleeve-label-normalize, partial-snapshot-safety.
  - §3 Clusters: friday-ritual, friday-archive, sleeve-health, since-freeze-briefing.
  - §4 Atom-type instances: 4 multi-question, 1 gateway-thin, 4 data-fetcher, 0 chart, 0 form-input, 0 shell.

  **Framework reflections (Checkpoint 1):**
  - 9-field schema: `secondary_questions` was the most generative field — forced articulating *what else* an atom answered. `connects_to` arrows clustered tightly around `[[friday-snapshot]]` (5 incoming) and `[[weekly-report]]` (3), which validates that friday is a true single-surface cluster.
  - Atom that resisted single-question framing: FridayDashboard. Hero + decision form + slippage form + macro action — answers 5 questions in one component. Tagged multi-question but flagged as Phase 2-4 split candidate.
  - Data-fetcher 4 of the 9 cards — confirms IA spec's RSC envelope pattern. Schema fit was clean.
  - New cluster discovery: `since-freeze-briefing` was implicit; surfaced naturally by SinceLastFridayBriefing's 4-lens design. Worth promoting to top-level navigation noun.
  - Pattern notes for next batch: `partial-snapshot-safety` is friday-specific; intelligence/ likely won't have it. Watch.

- 2026-05-14 — [batch-2] intelligence/ + macro-context/ 15 atoms done. Vocab additions:
  - §1 Entities (+33): score-attribution, alignment, posture, fit-bucket, macro-indicator, indicator-bucket, indicator-state, lead-lag-tier, core-indicator, threshold-rationale, bucket-state, sleeve-compatibility, compatibility-band, composite-breakdown, rule-accuracy, severity, follow-rate, outcome-delta, score-delta, review-summary, review-aggregation, risk-adjusted-scorecard, maturity-gate, cagr, mdd, sd, sharpe, calmar, sortino, spy-krw, data-density, contribution-heatmap, performance-trend.
  - §2 Behaviors (+5): regime-overlay-toggle, horizon-refetch, period-refetch, causal-hover-sync, maturity-gating.
  - §3 Clusters (+6): attribution-cluster, outcome-evaluation, rule-accuracy-cluster, macro-causation, review-roll-up, maturity-progression.
  - §4 Atom-type instances (batch 2): 5 multi-question, 1 gateway-thin, 3 chart, 5 data-fetcher, 0 form-input, 1 utility.

  **Framework reflections (Checkpoint 2):**
  - Schema fit was clean for chart + data-fetcher atoms. `connects_to` arrows showed the predicted intelligence-side clustering: `[[score-attribution]]` is the most-incoming target (4: AttributionsView, IntelligenceAttributionsSection, IntelligenceSharedUI, PerformanceTrendChart), validating that "attribution" is the gravity well of /intelligence.
  - The case-by-case `IntelligenceSharedUI` decision (Option A: keep merged) felt right at write-time but flagged: ContributionHeatmap is reused in /intelligence (page-level Heatmap section) AND /intelligence/attributions, while DataDensityBadge is reused in both surfaces too. If Phase 2 refactor surfaces the heatmap as its own section, splitting becomes mechanical — Phase 1 mapping survives unchanged.
  - `partial-snapshot-safety` prediction confirmed: zero intelligence atoms used it. Intelligence/ uses `isReady(envelope)` gate + binary fallback card (no partial render). This is a cleaner pattern — friday-specific safety is friday-specific because its envelopes are *bigger* (snapshot has 7+ sub-sections).
  - New atom-type observation: gateway-thin's CalmarTrajectoryPlaceholder is *both* gateway-thin AND maturity-gated — same pre-maturity pattern as RiskAdjustedScorecard's empty state, but they're typed differently (chart vs gateway-thin). Suggests maturity-gating is orthogonal to atom-type (a behavior trait, not a type).
  - `[[macro-causation]]` cluster discovery: CausalMapSection compresses 5 entity-types into one composer-level view. This is the IA spec's "don't fragment" principle made concrete — splitting would lose the narrative arc.
  - `[[review-roll-up]]` cluster: ReviewsView owns 2-stage state (periodType → period). This is the most state-heavy multi-question atom seen so far; flagged as Phase 2-4 candidate for "selection grammar" extraction.
  - Risk-adjusted page is the lone client-component-with-useEffect holdout (vs RSC pattern elsewhere). Migration noted in RiskAdjustedScorecard.meta pattern_notes.
  - Cumulative atom-type tally after Batch 2: 9 multi-question, 2 gateway-thin, 3 chart, 9 data-fetcher, 0 form-input, 1 utility. data-fetcher + multi-question dominate (75%) — confirms RSC envelope + composite-question patterns as the spine.
