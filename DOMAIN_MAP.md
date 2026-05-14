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

## §2 Behaviors (동작 / 시간 변화)

- **freeze** — 현재 weekly-report를 friday-snapshot으로 굳히는 action. createFridaySnapshot. 사용자 한 주에 한 번. ✅
- **journal-entry** — freeze 시점에 weekly-decision을 createFridayDecision으로 저장. ✅
- **slippage-log** — 지난 주 decision의 실제 체결 후 createFridaySlippage. per-decision form. ✅
- **macro-revalidate** — macro-context cache를 server action revalidateMacroContext로 무효화. ✅
- **bucket-state-derivation** — buckets 중 supportive ≥3 → 전체 supportive, adverse ≥3 → adverse, 그 외 neutral. MacroContextSection 내부 규칙. ✅
- **sleeve-label-normalize** — backend `_normalize`와 lockstep: '-', '_', ' ', '/' 제거 + upper. ✅
- **partial-snapshot-safety** — snapshot panel은 모든 sub-section을 `?? fallback`으로 보호. envelope partial / ready 모두 렌더 가능. ✅

## §3 Cluster-Level Concepts (여러 entity의 종합 / 묶음)

- **friday-ritual** — weekly-report + freeze + journal-entry + slippage-log + macro-revalidate를 한 주 한 번 묶어내는 user-facing ritual. /friday surface가 대표. ✅
- **friday-archive** — frozen friday-snapshot의 시점별 list + per-date detail. /friday/archive 경로. ✅
- **sleeve-health** — drift × active rules × recency strip을 하나의 3-축 view로 결합. SleeveHealthPanel이 single atom으로 답함. ✅
- **since-freeze-briefing** — 직전 freeze 이후 regime-transitions × decision-outcomes × cron-alert-history × weekly-comment 4 lens 통합. ✅

## §4 Atom Types (컴포넌트 역할 분류 vocabulary)

### multi-question atom
한 컴포넌트가 여러 sub-question을 *함께* 답함. 분리하면 cross-lens 통찰 손실. Batch 1 instances: FridayDashboard, FridaySnapshotPanel, SinceLastFridayBriefing, SleeveHealthPanel.

### gateway-thin atom
짧은 요약 + 다른 surface로의 다리. 깊이는 destination에. Batch 1 instances: MacroContextSection.

### chart atom
recharts-based; one quantitative time-series view. _(Batch 1 instances 없음 — Batch 3 예정)_

### data-fetcher atom
RSC wrapper — fetch + error/empty handling, then renders a display atom. Batch 1 instances: FridayBriefingSection, FridayReportSection, FridaySleeveSection, FridaySnapshotSection.

### form-input atom
사용자 입력 받음. _(Batch 1 instances 없음 — FridayDashboard 내부 inline form, 분리되지 않음)_

### shell / utility atom
navigation / shared primitives. atom 정의 약화 (질문에 답 X), 그러나 inventory 일관성 위해 포함.

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
