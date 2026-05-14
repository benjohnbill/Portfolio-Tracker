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
- **transaction** — POST /api/transactions의 unit. type: BUY/SELL/DEPOSIT/WITHDRAW. trade는 symbol/quantity/price, cashflow는 total_amount + note. ✅
- **account-silo** — 계좌 silo 분류: ISA_ETF / OVERSEAS_ETF / BRAZIL_BOND / PENSION. account_type은 silo에서 추론(ISA_ETF→ISA, 그 외→OVERSEAS). ✅
- **cashflow** — DEPOSIT 또는 WITHDRAW 한 transaction. archive-wealth에는 포함, twr에서는 sterilize. ✅
- **trade** — BUY 또는 SELL transaction. symbol + quantity 필수, price 비우면 자동 시세. ✅
- **symbol** — asset의 ticker. 기존 KR ETF는 심볼 그대로(NDX_1X, ACE_TLT), 신규 KR ETF는 6자리 KRX 코드(예: 476760), 해외 자산은 티커(MSTR, DBMF). ✅
- **archive-wealth** — cashflow 포함 절대 자산 시계열. portfolio/history.archive.series. y축 KRW. ✅
- **absolute-wealth-curve** — archive-wealth의 chart-level 명칭. HistoryChart가 단일 area로 시각화. ✅
- **mstr-zscore** — MSTR price의 rolling z-score signal. zone: <0 AGG BUY, 0-2 HOLD, 2-3.5 PROFIT LOCK, ≥3.5 HARD EXIT. ✅
- **zone-threshold** — mstr-zscore zone 경계값(0, 2.0, 3.5). chart에 ReferenceLine + 색 ReferenceArea로 시각화. ✅
- **mnav-ratio** — MSTR mnav ratio (BTC NAV 대비 시총 배수). zscore와 병기 표시. ✅
- **mstr-rotation-rule** — MSTR↔DBMF rotation rule. zscore zone이 신호 driver. ✅
- **ndx-250ma** — NDX(또는 임의 ticker) 가격 vs 250-day moving average. above/below 분기가 trend regime. ✅
- **trend-regime** — above-MA(GROWTH MODE) / below-MA(SAFETY MODE) binary. NDX/GLDM/TLT 각각에 적용. ✅
- **asset-signal** — ticker-agnostic 신호 chart. AssetSignalSection이 QQQ/GLDM/TLT 3개 인스턴스로 재사용. ✅
- **asset-history** — GET /api/asset/{ticker}/history → NDXHistoryPoint[]. price + ma_250 시계열. ✅
- **ndx-rotation-rule** — NDX_2X↔NDX_1X rotation rule. 250MA above/below가 신호 driver. ✅
- **mstr-history** — GET /api/mstr/history → MSTRHistoryPoint[]. date · z_score · mnav_ratio. ✅
- **core-6-target** — sleeve별 target weight Record: NDX 30 / DBMF 30 / BRAZIL 10 / MSTR 10 / GLDM 10 / BONDS-CASH 10. TargetDeviationChart의 TARGETS 상수. ✅
- **rebalance-threshold** — |deviation/target| > 0.3 → rebalance 필요 신호. TargetDeviationChart의 needsRebalance bit. ✅
- **asset-category-mapping** — symbol → core-6 category 분류 함수 assetToCategory(). prefix/substring 기반(NDX/DBMF/BRAZIL/MSTR/GLDM/BONDS-CASH/OTHER). ✅
- **twr** — time-weighted return. cashflow 영향 sterilize 후 누적 수익률. PerformanceHistoryPoint.performance_value. ✅
- **spy-benchmark** — KRW 환산 SPY benchmark, indexed to 100. PerformanceHistoryPoint.benchmark_value. ✅
- **indexed-to-100** — TWR/SPY 모두 시작점 100 기준 누적으로 normalize → 직접 비교. ✅
- **cashflow-neutral** — twr이 deposit/withdraw 영향 배제한 순수 수익률이라는 성질. TwrEquityCurve CardDescription이 명시. ✅
- **portfolio-allocation** — GET /api/portfolio/allocation → PortfolioAllocationData[]. asset · name · quantity · value · weight · account_type · account_silo. ✅
- **holdings** — portfolio-allocation을 silo별로 그룹화한 list. silo 카드 안 row 단위. ✅
- **portfolio-summary** — GET /api/portfolio/summary → PortfolioSummary. total_value · invested_capital · metrics{cagr, mdd, volatility, sharpe_ratio}. ✅
- **structural-metrics** — CAGR / MDD / Volatility / Sharpe — long-horizon 누적 지표 (this-week 지표와 의도적으로 대비). PortfolioSummaryCard의 6 metric tile. ✅
- **daily-delta** — archive.series 마지막 두 포인트로 계산한 오늘자 ₩ + % 변화. EquityCurveSection 헤더 pill. ✅
- **performance-coverage** — performance.status === 'unavailable' 일 때 coverage_start 안내. cashflow coverage 완료 전에는 benchmark-relative history 미산출. ✅
- **envelope** — { status, data, error } 표준 envelope. PortfolioSummaryCard가 legacy envelope ↔ ApiResult 두 shape를 isReady gate로 정규화. ✅
- **llm-summary** — WeeklyReport.llmSummary { provider, model, headline, whyScoreChanged, keyChanges[] }. WeeklyReportView가 존재 시 AI Summary card로 표시. ✅
- **data-freshness** — WeeklyReport.dataFreshness { signalsAsOf, portfolioAsOf, macroKnownAsOf, staleFlags[], portfolioValuation? }. Freshness pill의 색은 24h/72h 임계. ✅
- **this-week** — / route surface 명칭. Sidebar nav 첫 항목. 현재 cluster naming에서 /friday(this-week 결정)와 의도적으로 분리 — Phase 5 sitemap 재배치 후보. ✅

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
- **router-refresh** — AddAssetModal이 createTransaction 성공 후 next/navigation router.refresh()로 RSC 재요청 → portfolio 화면 즉시 갱신. ✅
- **silo-grouping** — portfolio-allocation을 account_silo 키로 reduce → ISA/OVERSEAS/BRAZIL_BOND 카드. siloLabelMap이 legacy + 신규 silo 라벨을 모두 매핑. ✅
- **indexed-normalization** — benchmark/portfolio 두 시계열을 first non-zero 시점 100 기준으로 나누어 누적 비교 가능하게 만드는 처리. TwrEquityCurve 안에서 firstBv 변수로 inline. ✅
- **props-driven-framing** — 같은 component(예: WeeklyReportView)를 두 host(ArchiveReportDetailSection, FridayReportSection)가 eyebrow/title/backHref props로 각자 frame. *navigation context as prop* 패턴. ✅

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
- **portfolio-long-horizon** — equity-curve(archive + twr) + portfolio-summary + portfolio-allocation을 한 surface로 묶음. /portfolio가 대표. friday cluster의 this-week 지향과 의도적으로 대비. ✅
- **signal-pulse-grid** — NDX(asset-signal) + MSTR(mstr-zscore) + GLDM(asset-signal) + TLT(asset-signal) 4-cell signal grid. 각 cell은 rotation-rule driver. ✅
- **target-deviation-cluster** — core-6-target + rebalance-threshold + holdings + portfolio-allocation을 strategy deviation chart + silo list 두 sub-section으로 결합. AssetAllocationSection이 한 surface. ✅
- **inputs-entry** — AddAssetModal 단일 atom으로 trade + cashflow를 같이 입력. Phase 2 navigation grammar에서 별도 /inputs surface 후보. ✅
- **composer-page** — 한 component가 다양한 entity의 한 페이지 view를 통째로 표현. WeeklyReportView (archive/friday 양 surface가 props로 frame) 가 archetype. 분리 시 cross-entity narrative arc 손실. ✅

## §4 Atom Types (컴포넌트 역할 분류 vocabulary)

### multi-question atom
한 컴포넌트가 여러 sub-question을 *함께* 답함. 분리하면 cross-lens 통찰 손실.
- Batch 1: FridayDashboard, FridaySnapshotPanel, SinceLastFridayBriefing, SleeveHealthPanel.
- Batch 2: OutcomesView, ReviewsView, RulesView, CausalMapSection, IndicatorCard.
- Batch 4: WeeklyReportView (composer-page archetype — 10+ Card sub-sections + Suspense charts + props-driven-framing).

### gateway-thin atom
짧은 요약 + 다른 surface로의 다리. 깊이는 destination에.
- Batch 1: MacroContextSection.
- Batch 2: CalmarTrajectoryPlaceholder (pre-maturity-gate placeholder; gate 통과 시 본격 chart로 전환).

### chart atom
recharts-based 또는 table-shaped; one quantitative view.
- Batch 1: 없음.
- Batch 2: AttributionsView (stacked area + table), RiskAdjustedScorecard (6×3 metric table), PerformanceTrendChart (single-series sparkline).
- Batch 3: HistoryChart, MSTRZScoreChart, NDXTrendChart, TargetDeviationChart, TwrEquityCurve.

### data-fetcher atom
RSC wrapper — fetch + error/empty handling, then renders a display atom.
- Batch 1: FridayBriefingSection, FridayReportSection, FridaySleeveSection, FridaySnapshotSection.
- Batch 2: IntelligenceAttributionsSection, IntelligenceOutcomesSection, IntelligenceRegimeHistorySection, IntelligenceReviewsSection, IntelligenceRulesSection.
- Batch 3: AssetAllocationSection, AssetSignalSection, EquityCurveSection, MSTRSignalSection, PortfolioSummaryCard.
- Batch 4: ArchiveTimelineSection, ArchiveReportDetailSection (delegating data-fetcher — body는 props mapping만 + WeeklyReportView 위임).

### form-input atom
사용자 입력 받음.
- Batch 3: AddAssetModal (inventory의 유일한 form-input — trade ↔ cashflow state-shape switching).

### shell / utility atom
navigation / shared primitives. atom 정의 약화 (질문에 답 X), 그러나 inventory 일관성 위해 포함.
- Batch 2: IntelligenceSharedUI (DataDensityBadge + ContributionHeatmap 묶음 — utility A/B 결정 = A).
- Batch 4: Sidebar (top-level 5-route nav shell — current sitemap의 명시적 anchor).

## §5 Interaction Patterns

_(deferred — vocabulary 5+ 모이면 분리)_

## §6 API Field Registry

_(no-op — docs/DOMAIN_MAP.md 부재 확인 (handoff §3에서 사전 확인됨). 흡수할 source 없음. 후속 API field registry 작성은 별도 작업으로 이월.)_

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

- 2026-05-14 — [batch-3] features/ + features/portfolio/ 11 atoms done. Vocab additions:
  - §1 Entities (+30): transaction, account-silo, cashflow, trade, symbol, archive-wealth, absolute-wealth-curve, mstr-zscore, zone-threshold, mnav-ratio, mstr-rotation-rule, ndx-250ma, trend-regime, asset-signal, asset-history, ndx-rotation-rule, mstr-history, core-6-target, rebalance-threshold, asset-category-mapping, twr, spy-benchmark, indexed-to-100, cashflow-neutral, portfolio-allocation, holdings, portfolio-summary, structural-metrics, daily-delta, performance-coverage, envelope.
  - §2 Behaviors (+3): router-refresh, silo-grouping, indexed-normalization.
  - §3 Clusters (+4): portfolio-long-horizon, signal-pulse-grid, target-deviation-cluster, inputs-entry.
  - §4 Atom-type instances (batch 3): 0 multi-question, 0 gateway-thin, 5 chart, 5 data-fetcher, 1 form-input, 0 shell.

  **Framework reflections (Checkpoint 3):**
  - Chart-heavy batch as predicted. 5 chart atoms (vs 3 in Batch 2) — features/ folder의 본질이 노출. portfolio/ data-fetcher 5개는 각각 *정확히 1개 chart atom*을 wrap하는 N:1 composition (intelligence/ data-fetcher가 multi-question view를 wrap한 것과 다른 패턴).
  - AssetSignalSection이 한 atom card로 3 인스턴스(QQQ, GLDM, TLT)를 cover하는 첫 케이스. *ticker-agnostic wrapper* — 한 component file이지만 rendered_in에 3 위치 명시. atom card의 schema가 instance-level이 아니라 file-level이라는 점 재확인 (39 atoms 카운트 일관성 유지).
  - `[[core-6-target]]`이 hardcoded constant인데 entity로 등록 — single source of truth로 DOMAIN_MAP에 올라간 첫 *configuration-as-entity* 케이스. legacy QQQ/TIGER residue가 features/ 전역에 흩어진 이유(885 observation)는 정확히 이 backbone 부재 때문. Phase 2 refactor에서 TARGETS 상수를 DOMAIN_MAP 참조 형태로 끌어올릴 후보.
  - `[[twr]]` vs `[[archive-wealth]]` 분리가 EquityCurveSection의 2-chart layout으로 명시적으로 노출 — `[[cashflow-neutral]]` 개념이 user에게 보이는 가장 직접적인 surface. friday surface의 freeze-only briefing과 정성이 다름(연속 곡선 vs 점-결정).
  - `[[form-input]]` atom type 처음 등장(AddAssetModal). 한 개 atom뿐인데도 atom-type carve-out 한 가치 있음 — `[[router-refresh]]` 같은 mutation-side behavior가 다른 type에는 안 나타남(이건 form-input 전유). Phase 2 navigation grammar에서 inputs-entry cluster가 독립 surface(/inputs/add) 후보로 거론될 수 있음.
  - Hardcoded color는 features/ 전체에 만연(1721 audit). 5 chart 모두 pattern_notes에 "Colors hardcoded — flagged in 1721 audit" 적힘. Phase 4 aesthetic uplift의 가장 명확한 entry point.
  - `[[envelope]]` entity가 batch 3에서 처음 명시 — PortfolioSummaryCard가 legacy envelope ↔ ApiResult 두 shape를 isReady gate로 정규화하는 comment block이 backend ↔ frontend 계약의 진화 흔적. UX-1 envelope 통일 과제(memory)와 직접 연결.
  - Cumulative atom-type tally after Batch 3: 9 multi-question, 2 gateway-thin, 8 chart, 14 data-fetcher, 1 form-input, 1 utility = 35 atoms / 39 total. data-fetcher 우세는 유지(40%), chart 비중 8/35 (23%)로 상승. Batch 4(archive + reports + shell) 4 atoms 추가 후 39 total 도달 예상.

- 2026-05-14 — [batch-4] archive/ + reports/ + Sidebar 4 atoms done. Vocab additions:
  - §1 Entities (+3): llm-summary, data-freshness, this-week.
  - §2 Behaviors (+1): props-driven-framing.
  - §3 Clusters (+1): composer-page.
  - §4 Atom-type instances (batch 4): 1 multi-question (WeeklyReportView), 0 gateway-thin, 0 chart, 2 data-fetcher, 0 form-input, 1 shell (Sidebar).
  - §6 API Field Registry: docs/DOMAIN_MAP.md 부재 확인 — 흡수 no-op.

  **Framework reflections (Checkpoint 4 — 마무리):**
  - WeeklyReportView가 inventory에서 가장 특수한 multi-question atom — *composer-page* archetype을 도입. 10+ Card sub-sections + lazy Suspense charts + 두 surface 동시 host. IA spec §4 "추가결정사항"의 "fragmenting harms"를 가장 명확히 보여주는 사례. Phase 2-4 어디서도 fragmentation 대상 아님.
  - ArchiveReportDetailSection이 *delegating data-fetcher* 첫 사례 — body는 envelope gate + props mapping만, 본체는 WeeklyReportView 위임. data-fetcher 안에 또 다른 atom이 있는 *thin host* 패턴. 인텔리전스 batch의 data-fetcher들이 body 자체를 직접 그리던 것과 대비.
  - `[[props-driven-framing]]` behavior 첫 등장 — 같은 composer를 archive와 friday surface가 각자 eyebrow/backHref로 frame. *navigation context as prop* 패턴. Phase 2 navigation grammar 작업의 흥미로운 input: cluster boundary를 atom 안이 아니라 host site가 결정.
  - Sidebar는 shell이라 약한 atom — 5-route registration 표만 의미. 그런데 Phase 5 sitemap proposal 입장에서는 *current state의 가장 명시적 anchor*. Sidebar의 navItems = 현재 sitemap. cluster derivation은 이 5-noun set과 cluster 가설을 비교하는 작업.
  - `[[friday-archive]]` cluster의 incoming connects_to 누적: ArchiveTimelineSection + ArchiveReportDetailSection + WeeklyReportView + Sidebar = 4. /archive surface가 friday-archive cluster의 단일 hosting locus 확인.
  - `[[envelope]]` 이번 batch에서도 두 번 명시 (ArchiveTimelineSection, ArchiveReportDetailSection) — UX-1 envelope 통일 과제가 cross-batch backbone. friday + intelligence + portfolio + archive 4 batch 모두에서 등장.
  - **Final tally (Batch 4 후): 10 multi-question, 2 gateway-thin, 8 chart, 16 data-fetcher, 1 form-input, 2 utility = 39 atoms / 39 total ✅**
  - Inventory 완전성: 9 (friday) + 15 (intel + macro-context) + 11 (features + portfolio) + 4 (archive + reports + Sidebar) = 39. Plan acceptance criterion 충족.
  - Atom-type 분포 (39 기준): data-fetcher 41% / multi-question 26% / chart 21% / utility 5% / gateway-thin 5% / form-input 3%. data-fetcher + multi-question 67% — RSC envelope + composite-question이 frontend backbone임을 inventory 차원에서 확인. Single-question atoms은 chart + gateway-thin + form-input의 28%만 차지.

  **Next phase entry:** Phase 5 cluster derivation + sitemap proposal — 키워드 frequency grep + 4-7 cluster boundary 그리기 + docs/superpowers/specs/2026-05-14-ia-phase-1-sitemap.md 작성.
