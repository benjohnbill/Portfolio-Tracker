# IA Redesign — Phase 1 Design Spec

**Date:** 2026-05-05
**Status:** Draft (Phase 1 brainstorming complete; implementation deferred pending product vision pivot — see handoff note)
**Stakeholder:** 오라버니 (icarus.cho@gmail.com)
**Author:** Lotte (assistant)

---

## 1. Background

### 1.1 Trigger

오라버니의 직감 보고:

> "이 페이지를 제작한 저조차도 너무 많아서 압도된 디자인이라고 생각합니다. Friday 탭이 스크롤을 엄청 많이 내려야 할 정도로 크고, 다른 탭도 다 스크롤이 길어요. FHD 모니터 100% 배율 기준으로 컴팩트하게 페이지가 나뉘었으면 좋겠어요. 토스(Toss)처럼 신생 금융 기업의 UI/UX를 최우선으로 여기는 그런 느낌."

### 1.2 진단

표면적 문제 ("스크롤 길다") 뒤에 *근본 paradigm 문제*가 있음:

| 표면 | 본질 |
|---|---|
| "스크롤이 길다" | 페이지가 *너무 많은 답*을 담고 있음 |
| "압도된다" | 정보 농도가 사용자 인지 부하를 넘어섬 |
| "컴팩트하게 나뉘어야" | 한 페이지 = 한 답변 (single-question surface) |
| "버튼 누르면 다른 메뉴로" | drill-down navigation grammar |
| "Toss처럼" | UX-first aesthetic |

핵심 한 줄: **증권사 dense UI → Toss-like calm UI**. 데이터는 그대로, 표현 농도는 낮춤.

### 1.3 Scope flag — IA 재설계 + 4-phase decomposition

이 규모는 *DESIGN.md 보강* 한 spec doc으로 못 다룸. 4가지 독립 subsystem:

| Phase | 영역 | 산출 | 도구 |
|---|---|---|---|
| **1. IA 재설계** | "한 페이지 = 한 답변" 원칙으로 surface 재분할 | 새 페이지 트리 + 페이지별 single responsibility 정의 | brainstorming + 텍스트 |
| **2. Navigation Grammar** | drill-down 패턴 / cross-link / back-flow | navigation pattern 라이브러리 + interaction spec | brainstorming + Visual Companion |
| **3. Page-level Compact Redesign** | FHD 100%에 한 화면에 담기는 페이지 단위 wireframe | 페이지별 wireframe + density spec | ui-ux-pro-max + Visual Companion |
| **4. Toss-style Aesthetic Uplift** | Palette evolution / typography / motion | DESIGN.md 진화 + 새 컴포넌트 token | ui-ux-pro-max |

이 spec은 **Phase 1**만 다룸. Phase 2-4는 *후속 spec*.

---

## 2. Paradigm Shift — PKM / Question-Cluster Model

### 2.1 기존 모델 (파일시스템)

페이지 = 카테고리 (Friday / Performance / Intelligence). 컴포넌트 = 페이지의 자식. Cross-link = 별도 작업.

### 2.2 새 모델 (PKM / Obsidian)

**페이지 = 질문 cluster** (같은 질문을 답하는 atom들의 모임). 컴포넌트 = 다중 태그를 가진 atom. Cross-link = 같은 태그 자동 연결 (Obsidian backlinks).

### 2.3 PT 본질과의 정렬

**PRODUCT.md §9 "Accumulation-as-Hero"는 사실 PKM 데이터 모델이에요.** 매 Friday freeze = note. Decisions Log = backlinks. Intelligence = aggregation views over notes. 6 accumulation axes = different *queries* over the note corpus.

문제: PT의 *데이터 모델*은 PKM인데 *UI 모델*은 파일시스템 카테고리. 두 layer 사이 paradigm mismatch가 압도감의 진짜 원인.

### 2.4 Bottom-up 도출

기존 IA: top-down (큰 카테고리 → 작은 페이지).
새 IA: **bottom-up** (atom → 질문 mapping → cluster 도출 → 새 sitemap).

```
1. Component inventory (얕은 단계)
   각 컴포넌트의 primary_question 후보 1줄

2. Batch atom card 작성 (깊은 단계)
   primary + secondary + connects_to + data_contract + pattern_notes

3. Codex Checkpoint 1 — framework sanity check

4. 키워드 자연 도출 + DOMAIN_MAP draft

5. Cluster 도출 (키워드 매칭 + 사용자 boundary)

6. 새 sitemap 도출

7. Phase 1 spec doc 작성

8. Codex Checkpoint 2 + 사용자 검토

9. writing-plans skill 진입
```

---

## 3. Framework

### 3.1 Three-layer documentation

```
[Layer A] atom card (.meta.yaml)         "컴포넌트 자체 정의"
            │
    ┌───────┴───────────┐
    │                   │
    ↓                   ↓
[Layer B]           [Layer C]
DOMAIN_MAP.md       DESIGN.md
("vocabulary")      ("미학 + impl")
```

### 3.2 Atom card schema (.meta.yaml)

각 컴포넌트 옆에 위치 (예: `SleeveHealthPanel.tsx` ↔ `SleeveHealthPanel.meta.yaml`).

```yaml
name: SleeveHealthPanel
file: frontend/src/components/friday/SleeveHealthPanel.tsx

keywords:                       # Layer A → Layer B 참조 (후행 도출)
  - "[[sleeve-drift]]"
  - "[[rule-firing]]"
  - "[[signal-recency]]"

primary_question: "각 sleeve의 health(drift+신호+누적)가 어떤가?"

secondary_questions:
  - "어떤 sleeve가 target에서 5%+ 벗어나 즉시 rebalance가 필요한가?"
  - "drift가 큰 sleeve와 rule이 발화한 sleeve가 *겹치는가*?"

connects_to:                    # drill-down 출구
  - target: "[[rules]]"
    trigger: "active rule 클릭 → /intelligence/rules"
  - target: "[[macro-fit]]"
    trigger: "drift가 큰 sleeve의 macro 정합성 확인 → /intelligence/macro-context"

data_contract:                  # backend contract
  - report.portfolioSnapshot.targetDeviation
  - report.triggeredRules
  - sleeveHistory

uses_design_components:         # Layer A → Layer C 참조
  - card
  - badge-bucket-state-supportive

rendered_in:                    # 현재 사용처 (영구)
  - location: /friday
    via: FridaySleeveSection

pattern_notes:
  type: "multi-question atom"   # → DOMAIN_MAP §3 참조
```

### 3.3 작성 순서

**중요**: keywords 후행화. 의미적 항목 먼저, 어휘는 자연 발견.

```
1. 코드 (.tsx) 읽기
2. primary_question
3. secondary_questions
4. connects_to
5. data_contract
6. uses_design_components
7. rendered_in
8. pattern_notes (atom-type)
9. ✨ keywords (위 단계에서 자연스럽게 발견된 단어)
```

### 3.4 DOMAIN_MAP.md (단일 파일)

루트 `DOMAIN_MAP.md`. 글로벌 권장 위치 정렬. **3-section 분류:**

```markdown
# DOMAIN_MAP.md

> **자가 기록 mandate.** 작업 중 새 어휘 / 정의 / cross-reference가 발견되면
> 즉시 이 파일에 반영. 시점 명기 (YYYY-MM-DD).

## §1 Domain Entities (측정 가능한 양 / 현실 객체)

### [[sleeve-drift]]

각 sleeve의 current weight가 target에서 벗어난 정도. 절대값(%) 기준.

- 사용 컨텍스트: SleeveHealthPanel의 drift bar, compute_alignment_score
- 관련: [[target-allocation]], [[rebalance-flag]]
- 사용 atom: SleeveHealthPanel.meta.yaml, TargetDeviationChart.meta.yaml

## §2 Behaviors (동작 / 시간 변화)

### [[rule-firing]]
...

## §3 Cluster-Level Concepts (여러 entity의 종합 / 묶음)

### [[sleeve-health]]
sleeve의 drift + 활성 신호 + 4주 누적의 종합 상태.

- 사용 atom: SleeveHealthPanel
- 구성 entity: [[sleeve-drift]], [[rule-firing]], [[signal-recency]]

## §4 Atom Types (컴포넌트 역할 분류 vocabulary)

### multi-question atom
한 컴포넌트가 여러 sub-question을 *함께* 답함. 분리하면 cross-lens 통찰 손실.
사용 atom: SleeveHealthPanel, IndicatorCard

### gateway-thin atom
짧은 요약 + 다른 surface로의 다리. 깊이는 destination에.
사용 atom: MacroContextSection

## §5 Interaction Patterns (deferred — vocabulary 5+ 모이면 분리)

## §6 API Field Registry (docs/DOMAIN_MAP에서 흡수)

[envelope rule, term registry, exceptions, naming conventions]

## §7 Cross-reference

- 컴포넌트 메타: frontend/src/components/**/*.meta.yaml
- 디자인 토큰: DESIGN.md frontmatter
- 제품 결정: PRODUCT.md
- 아키텍처: ARCHITECTURE.md

## §8 Change Log

- 2026-05-05 — [vocab] initial vocabulary derived from atom card batch 1-3
- ...
```

**중요**: ✅✓⛔ 마커는 **적용 X** (1인 dev 컨텍스트에서 audience 부재; 코드가 source of truth로 충분).

### 3.5 자가 기록 mandate (5 spec 파일)

각 spec 파일 헤더에 *짧은 mandate* 명시. Forget 방지.

대상: `PRODUCT.md`, `ARCHITECTURE.md`, `DESIGN.md`, `PLAN.md`, `DOMAIN_MAP.md`.

형식:
```markdown
> **자가 기록 mandate.** 작업 중 새 발견 / 결정 / cross-reference가 생기면
> 즉시 이 파일에 반영. 시점 명기 (YYYY-MM-DD). 다음 세션의 시작점으로 사용.
```

### 3.6 Cross-reference 끈끈함

세 layer 간 6가지 참조 방향:

| # | 방향 | 명시 위치 |
|---|---|---|
| ① | atom → DOMAIN | atom의 `keywords: [[...]]` |
| ② | DOMAIN → atom | DOMAIN_MAP 각 entry의 *사용 atom* |
| ③ | atom → DESIGN | atom의 `uses_design_components` |
| ④ | DESIGN → atom | DESIGN.md (자동 도출 권장) |
| ⑤ | DOMAIN → DESIGN | DOMAIN_MAP §4의 design link (deferred) |
| ⑥ | DESIGN → DOMAIN | DESIGN.md interaction spec의 [[wikilink]] (deferred) |

### 3.7 .meta.yaml 위치

각 컴포넌트 같은 폴더 (예: `friday/SleeveHealthPanel.tsx` 옆 `friday/SleeveHealthPanel.meta.yaml`). **임시 결정** — Phase 1 후반부 (cluster 도출 + 폴더 정리) 시점에 별도 폴더 (`_meta/`) 옵션 재검토.

---

## 4. Grill 결정 10개

`/grill-me` skill 흐름으로 design tree 모든 미해결 결정 walk down. 결과:

| # | 결정사항 | 결정값 | 핵심 이유 |
|---|---|---|---|
| 1 | 전수조사 진행 방식 | **C → A** (inventory 먼저, 그 후 batch) | 인지 부담 분산 + cherry-pick 회피 |
| 2 | Inventory scope | **C** (질문에 답하는 atom만) | atom의 정의 일관성 — primitive UI / page wrapper는 *질문에 답하지 않음* |
| 3 | Inventory entry 형식 | **C** (이름 + 경로 + primary_question 후보 1줄) | batch 단계 시간 절약, *얕은 답*만 |
| 4 | Inventory 운명 | **A 임시** | DRY 원칙 — atom card에 흡수되면 사라짐 |
| 5 | atom card에 `rendered_in` 필드 추가 | **A 추가** | self-containment, grep 의존 제거 |
| 6 | `.meta.yaml` 명명/위치 | **A 임시** (코드 옆) | locality, IDE 한눈에. Phase 1 후반부 재검토 |
| 7 | DOMAIN_MAP 위치 | **루트** | 글로벌 권장 위치 정렬 |
| 8 | DOMAIN_MAP 내부 형식 | **3-section + atom-types** | navigation 명확, vocabulary 분류 |
| 9 | atom card에 `uses_design_components` 필드 추가 | **C 부분** (component만, token X) | 끈끈함 + atom card 비대화 회피 |
| 10 | DOMAIN_MAP 통합 | **단일 파일** | 1인 dev 컨텍스트 + 권한 분리 명확 |

### 추가 결정사항 (정리)

- ✅✓⛔ 마커 **적용 X** (1인 dev 컨텍스트)
- 자가 기록 mandate **5 spec 파일에 적용** (헤더 짧은 줄)
- AGENTS.md 호환성 — **deferred** (별도 논의)

---

## 5. Component Inventory

### 5.1 통계

총 39개 file-backed atom 후보. + 추가 inline atom (page.tsx 안) 8-12개 추정 = **약 47-51개 total atom 예상**.

### 5.2 분류 분포

| 분류 | 수 | 의미 |
|---|---|---|
| Display (순수 시각) | ~17 | 받은 데이터를 *시각으로* 표현 |
| Chart (recharts 기반) | 5 | display의 한 종류 — 그래프 |
| Data-fetcher (RSC wrapper) | ~9 | API + error/empty 처리 후 display에 전달 |
| Composer (mega-layout) | ~3-4 | 여러 atom을 *한 페이지에 묶음* |
| Form-input | 1 | 사용자 *답을 받는* 곳 |
| Shell / Utility | 2 | navigation / shared primitive |

### 5.3 39개 atom 표

#### §1 Shell / Navigation (1)

| # | atom | file | primary_question 후보 | 라벨 |
|---|---|---|---|---|
| 1 | Sidebar | components/Sidebar.tsx | 어떤 페이지로 갈 수 있는가? | shell |

#### §2 archive/ (2)

| # | atom | file | primary_question 후보 | 라벨 |
|---|---|---|---|---|
| 2 | ArchiveReportDetailSection | archive/ArchiveReportDetailSection.tsx | 특정 주차의 frozen weekly report 상세가 무엇이었나? | data-fetcher → WeeklyReportView |
| 3 | ArchiveTimelineSection | archive/ArchiveTimelineSection.tsx | 지난 52주 frozen report들이 시간순 카드로 어떻게 펼쳐져있나? | data-fetcher + display |

#### §3 features/ + features/portfolio/ (10)

| # | atom | file | primary_question 후보 | 라벨 |
|---|---|---|---|---|
| 4 | AddAssetModal | features/AddAssetModal.tsx | 거래(BUY/SELL/DEPOSIT/WITHDRAW)를 어떻게 입력하고 어느 silo로 분류되는가? | form-input |
| 5 | HistoryChart | features/HistoryChart.tsx | 절대 자산 wealth가 시간에 따라 어떻게 변했나? | chart |
| 6 | MSTRZScoreChart | features/MSTRZScoreChart.tsx | MSTR이 어떤 stance인가? (AGG.BUY / HOLD / PROFIT LOCK / HARD EXIT) | chart |
| 7 | NDXTrendChart | features/NDXTrendChart.tsx | NDX가 250-day MA 기준 어느 trend zone인가? | chart |
| 8 | TargetDeviationChart | features/TargetDeviationChart.tsx | 각 카테고리의 current vs target deviation? rebalance 필요한가? | chart |
| 9 | TwrEquityCurve | features/TwrEquityCurve.tsx | TWR 곡선이 SPY 대비 어떻게 흘러왔나? | chart |
| 10 | AssetAllocationSection | features/portfolio/AssetAllocationSection.tsx | 각 silo에 어떤 자산을 얼마나 가지고 있나? | data-fetcher + display |
| 11 | AssetSignalSection | features/portfolio/AssetSignalSection.tsx | 특정 ticker의 trend signal이 무엇인가? | data-fetcher → NDXTrendChart |
| 12 | EquityCurveSection | features/portfolio/EquityCurveSection.tsx | 기간별 wealth + TWR + 일일 변화량을 한 번에? | data-fetcher + composer |
| 13 | MSTRSignalSection | features/portfolio/MSTRSignalSection.tsx | MSTR Z-Score signal — mean-reversion 어디 단계? | data-fetcher → MSTRZScoreChart |
| 14 | PortfolioSummaryCard | features/portfolio/PortfolioSummaryCard.tsx | 구조적 portfolio 지표가 어떤가? | data-fetcher + display |

#### §4 friday/ (9)

| # | atom | file | primary_question 후보 | 라벨 |
|---|---|---|---|---|
| 15 | FridayBriefingSection | friday/FridayBriefingSection.tsx | 지난 freeze 이후 어떤 이벤트(regime/outcomes/alerts)가 있었나? | data-fetcher → SinceLastFridayBriefing |
| 16 | FridayDashboard | friday/FridayDashboard.tsx | 오늘 freeze에서 무엇을 lock해야 하나? (모든 결정이 한 페이지에) | composer |
| 17 | FridayReportSection | friday/FridayReportSection.tsx | 이번 주 weekly report + snapshots가 무엇인가? | data-fetcher → FridayDashboard |
| 18 | FridaySleeveSection | friday/FridaySleeveSection.tsx | 각 sleeve의 health(drift+신호+누적)가 어떤가? | data-fetcher → SleeveHealthPanel |
| 19 | FridaySnapshotPanel | friday/FridaySnapshotPanel.tsx | 특정 frozen Friday의 모든 결정과 컨텍스트가 무엇이었나? | display |
| 20 | FridaySnapshotSection | friday/FridaySnapshotSection.tsx | 특정 frozen Friday을 어떻게 보여주나? | data-fetcher → FridaySnapshotPanel |
| 21 | MacroContextSection | friday/MacroContextSection.tsx | 지금 macro 환경이 우호적인가, portfolio가 거기에 맞춰져 있나? (teaser) | gateway-thin |
| 22 | SinceLastFridayBriefing | friday/SinceLastFridayBriefing.tsx | 지난 freeze 이후 events가 무엇이었나? | display (multi-question) |
| 23 | SleeveHealthPanel | friday/SleeveHealthPanel.tsx | 각 sleeve의 health가 어떤가? | display (multi-question) |

#### §5 intelligence/ (12)

| # | atom | file | primary_question 후보 | 라벨 |
|---|---|---|---|---|
| 24 | AttributionsView | intelligence/AttributionsView.tsx | score가 시간에 따라 Fit/Alignment/Posture로 어떻게 분해되어왔나? | chart + control |
| 25 | CalmarTrajectoryPlaceholder | intelligence/CalmarTrajectoryPlaceholder.tsx | Calmar(Portfolio) − Calmar(SPY-KRW) trajectory? | chart (placeholder) |
| 26 | IntelligenceAttributionsSection | intelligence/IntelligenceAttributionsSection.tsx | Score attribution + heatmap 한 번에? | data-fetcher + composer |
| 27 | IntelligenceOutcomesSection | intelligence/IntelligenceOutcomesSection.tsx | Decision outcomes를 어떻게 보여주나? | data-fetcher → OutcomesView |
| 28 | IntelligenceRegimeHistorySection | intelligence/IntelligenceRegimeHistorySection.tsx | Regime이 어떻게 transition돼왔나? | data-fetcher + display |
| 29 | IntelligenceReviewsSection | intelligence/IntelligenceReviewsSection.tsx | 월/분기/연간 review summary가 어떤가? | data-fetcher → ReviewsView |
| 30 | IntelligenceRulesSection | intelligence/IntelligenceRulesSection.tsx | Rule accuracy를 어떻게 보여주나? | data-fetcher → RulesView |
| 31 | IntelligenceSharedUI | intelligence/IntelligenceSharedUI.tsx | (DataDensityBadge: 데이터 성숙도? / ContributionHeatmap: 52주 score 분포?) | utility — *2개 mini-atom 묶음* |
| 32 | OutcomesView | intelligence/OutcomesView.tsx | 각 decision이 horizon별로 어떤 outcome을 냈나? | display + control |
| 33 | ReviewsView | intelligence/ReviewsView.tsx | 월/분기/연간 review aggregation? | display + control |
| 34 | RiskAdjustedScorecard | intelligence/RiskAdjustedScorecard.tsx | Portfolio vs SPY-KRW의 risk-adjusted metrics 차이가 어떤가? | display |
| 35 | RulesView | intelligence/RulesView.tsx | 각 rule이 얼마나 fire/followed되었고 outcome은? | display |

#### §6 intelligence/macro-context/ (3)

| # | atom | file | primary_question 후보 | 라벨 |
|---|---|---|---|---|
| 36 | CausalMapSection | intelligence/macro-context/CausalMapSection.tsx | Indicators → Buckets → Sleeve compatibility → Composite의 인과 흐름? | display (multi-column flow) |
| 37 | IndicatorCard | intelligence/macro-context/IndicatorCard.tsx | 특정 macro indicator의 state와 의미는? | display (multi-question) |
| 38 | PerformanceTrendChart | intelligence/macro-context/PerformanceTrendChart.tsx | frozen score가 시간에 따라 어떻게 흘러왔나? | chart (sparkline) |

#### §7 reports/ (1)

| # | atom | file | primary_question 후보 | 라벨 |
|---|---|---|---|---|
| 39 | WeeklyReportView | reports/WeeklyReportView.tsx | 이 주차 weekly report 전체가 무엇인가? | display (mega-composer) |

### 5.4 발견 노트

- **Data-fetcher / Display 이중 구조가 PT 패턴.** 9개 RSC wrapper가 *fetch + error/empty handling*만 함. batch atom card 작성 시 *케이스별 통합/분리 결정*.
- **Multi-question atom**: SleeveHealthPanel, SinceLastFridayBriefing, IndicatorCard, OutcomesView, ReviewsView. 모두 여러 sub-question을 함께 답함.
- **Gateway-thin atom**: MacroContextSection 1개만 명확. 다른 cross-link 패턴 발견 X.
- **Chart atom**: 5개 (모두 recharts).
- **Form-input atom**: AddAssetModal 1개만. (Friday Decision Journal은 FridayDashboard inline.)
- **`IntelligenceSharedUI` 특이 케이스**: 한 파일에 2 mini-atom (DataDensityBadge + ContributionHeatmap). batch 단계에서 분리 권장.

### 5.5 누락 / 미포함 (의도적)

- **`page.tsx` inline section** — 약 8-12개 추정 (예: `/friday/page.tsx` Hero strip / Decision Journal form, `/intelligence/page.tsx` 3-stat row 등). batch atom card 작성 단계에서 발견 시 별도 추가.
- **`components/ui/`** — primitive UI 17개 (Card, Button, Badge, Input, Sheet, Tooltip 등). Grill #2 합의 — atom 아님 (building block).

---

## 6. 다음 세션 단계 (deferred)

Phase 1 brainstorming은 끝났음. 다음 세션 (Phase 1 implementation 또는 product vision pivot 후) 진입점:

### 6.1 Batch atom card 작성 plan

Batch 분할 (Lotte 추천):

```
Batch 1: friday/ (9 atoms) → Codex Checkpoint 1
Batch 2: intelligence/ (12 atoms) + macro-context/ (3 atoms)
Batch 3: features+portfolio/ (11 atoms)
Batch 4: archive/ (2) + reports/ (1) + Sidebar/IntelligenceSharedUI (2)
```

각 batch 후 *발견된 패턴*으로 framework refine.

### 6.2 미해결 결정사항 (다음 세션)

- (a) 39개 모두 atom card 작성? 또는 일부 제외 (Sidebar 짧게 / AddAssetModal 별도 schema)
- (b) Data-fetcher 9개 통합/분리? **케이스별** (Lotte 추천)
- (c) Batch 시작 폴더? **friday/** 먼저 (Lotte 추천)

### 6.3 Phase 2-4 후속 spec

- Phase 2: Navigation Grammar — drill-down 패턴, cross-link grammar
- Phase 3: Page Compact Redesign — wireframe + density spec
- Phase 4: Aesthetic Uplift — palette evolution, typography, motion

각 phase는 *별도 brainstorming + spec*. 본 spec은 Phase 1만.

---

## 7. 핵심 합의 (요약)

| | 결정 |
|---|---|
| Paradigm | PKM / question-cluster (페이지 = 질문 cluster) |
| Bottom-up | atom → cluster → sitemap |
| Atom card | `.meta.yaml` (코드 옆) — 9-필드 schema |
| DOMAIN_MAP | 단일 (루트) — 3-section + atom-types + API registry 흡수 |
| 마커 | ✅✓⛔ 적용 X (1인 dev) |
| 자가 기록 | 5 spec 파일 헤더 mandate |
| Cross-reference | 6방향 명시 (3개는 deferred) |
| Inventory | 39 atom + ~10 inline = ~50 total |

---

## 8. Out of Scope

- Phase 2-4 plan (별도 spec)
- 새 product 비전 (handoff note 참조: `2026-05-05-product-vision-pivot.md`)
- AGENTS.md 호환성 (deferred)
- Phase 1 implementation plan (writing-plans 진입 후 결정)

---

## 9. References

- **이전 세션 산출물**: `docs/superpowers/specs/2026-05-04-claude-md-harness-design.md` (CLAUDE.md harness 정렬)
- **vision pivot handoff**: `docs/superpowers/handoff/2026-05-05-product-vision-pivot.md`
- **글로벌 룰**: `~/.claude/CLAUDE.md` §프로젝트 CLAUDE.md 패턴
- **commit baseline**: `b88474e` (DESIGN.md YAML frontmatter 포팅)
