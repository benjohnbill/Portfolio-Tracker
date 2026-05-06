# Product Vision Pivot — Handoff Note

**Date:** 2026-05-05
**Status:** Pivot decided; brainstorming deferred to next session
**Stakeholder:** 오라버니 (icarus.cho@gmail.com)
**Author:** Lotte (assistant)

---

## 1. Pivot context

### 1.1 기존 PT 의도

개인 portfolio dashboard. KRW-denominated multi-sleeve portfolio (ISA + Overseas + Brazil bonds)의 weekly review 도구. 솔로 사용자(오라버니) 본인 위해 만든 personal tool.

### 1.2 새 PT 의도

**질문 기반 맞춤형 금융 서비스.** 사용자의 needs에 맞춘 *완전히 맞춤형 정보*를 제공하는 finance product.

배포 방향:
- **오픈소스 공개** 가능성
- **상품화** 가능성 (구체적 모델은 미정)

### 1.3 두 의도의 차이

| 측면 | 기존 | 새 |
|---|---|---|
| Audience | 솔로 (오라버니 본인) | 다수 사용자 |
| 정보 모델 | "내 portfolio를 본다" | "내 질문에 맞춰 답이 나온다" |
| 핵심 기능 | NDX 250MA 같은 특정 signal 보여주기 | 사용자 질문 vocabulary에 따라 surface 동적 구성 |
| 데이터 source | KIS + Yahoo (한국 + 미국) | 일반화 가능 (다른 시장 / 다른 자산 클래스?) |
| 가격 모델 | 없음 (개인용) | 미정 (freemium / 구독 / OSS+SaaS?) |

---

## 2. 이전 세션 (2026-05-05 IA Redesign)의 발견

### 2.1 우연한 정렬

이전 세션은 *기존 의도* (개인 dashboard) 컨텍스트에서 진행됐지만, paradigm을 **PKM / question-cluster 모델**로 옮김. 이 paradigm이 *우연히 새 비전과 정확히 정렬*됨.

**핵심 통찰:**
> 기존 PT의 *데이터 모델*은 PKM (매 freeze가 다음 freeze를 풍부하게).
> *UI 모델*은 파일시스템 카테고리 (Friday/Performance/Intelligence).
> 이 paradigm mismatch가 "압도된다" 직감의 진짜 원인.

새 비전 ("질문 기반 맞춤형")은 사실 *PKM paradigm이 사용자에게 노출되는 자연스러운 형태*. 즉:
- *우연한 일치*가 아니라
- *PT가 그 방향으로 진화하려는 신호*를 오라버니가 직감으로 잡고 있었음

### 2.2 이전 세션 산출물 (참조)

- **Spec doc**: `docs/superpowers/specs/2026-05-05-ia-redesign-design.md`
  - Paradigm shift (PKM / question-cluster)
  - Framework (atom card schema, DOMAIN_MAP 단일, 자가 기록 mandate)
  - Grill 결정 10개
  - Component inventory (39 atom + ~10 inline 추정)
  - 4-phase plan (IA → Navigation → Page redesign → Aesthetic)

### 2.3 이전 세션 baseline commit

`b88474e` — DESIGN.md YAML frontmatter 포팅. PT의 design system이 cafe24-v1 같은 표준 형식으로 정렬됨.

---

## 3. 다음 세션 시작 trigger

### 3.1 Skill 선택

**`gstack-office-hours`** — 제품 ideation 전용 skill. YC 스타일 6 forcing question:

1. **Demand reality**: 사용자가 진짜 원하는가? 또는 우리가 *원했으면* 하는가?
2. **Status quo**: 사용자는 *지금* 무엇으로 이 문제를 해결하고 있는가?
3. **Desperate specificity**: *누가* / *언제* / *왜* 이걸 절박하게 필요로 하는가?
4. **Narrowest wedge**: 가장 작은 진입점은? 한 사용자, 한 질문, 한 surface로 시작 가능?
5. **Observation**: 우리가 *직접 본* 것 중 이 비전을 검증하는 일화는?
6. **Future-fit**: 5년 후 이게 어떻게 진화하나? 일회성 vs 누적 자산?

PT 컨텍스트에서 특히 valuable한 forcing question: **#3 (desperate specificity)** + **#4 (narrowest wedge)** + **#6 (future-fit)**.

### 3.2 미정 항목 (다음 세션 결정 대상)

| 영역 | 질문 |
|---|---|
| **사용자 페르소나** | 솔로 투자자? 자문가 / 매니저? 그룹 (가족 portfolio)? 기관 (소형 펀드)? |
| **가격 모델** | Freemium? 구독? OSS + paid SaaS? Pay-per-question? |
| **데이터 source 일반화** | KIS + Yahoo만? 한국 외 시장? 자산 클래스 확장 (crypto / bonds / 부동산)? |
| **Question vocabulary 일반화** | 현재는 본인 portfolio 전용 (NDX 250MA, MSTR Z-score). 다른 사용자의 질문은 어떻게 vocabulary에 편입? |
| **IA redesign과의 통합** | 이전 세션의 39 atom inventory가 새 비전에서 *그대로 유효*한가? 아니면 *재해석* 필요? |
| **OSS 전략** | 어디까지 오픈? 백엔드 / 프론트엔드 / 데이터 파이프라인 / scoring 알고리즘? |
| **차별화** | 기존 finance app (Toss, 토스증권, Robinhood, Koyfin)과 어떻게 다른가? |

### 3.3 다음 세션 starting prompt

오라버니가 다음 세션 열 때 그대로 붙여넣기:

```
PT(/home/lg/dev/Portfolio_Tracker) product 비전 pivot 세션.

배경:
- 기존: 개인 portfolio dashboard (솔로 사용자, 본인 portfolio 전용)
- 새 방향: 질문 기반 맞춤형 금융 서비스. 오픈소스 + 상품화 가능성.

이전 세션 산출물:
- docs/superpowers/specs/2026-05-05-ia-redesign-design.md
  (PKM paradigm, 39 atom inventory, framework, grill 결정 10개)
- docs/superpowers/handoff/2026-05-05-product-vision-pivot.md
  (vision pivot context, 미정 항목 목록)

목표:
- gstack-office-hours skill로 시작
- 6 forcing question 적용 (특히 #3 desperate specificity / #4 narrowest wedge / #6 future-fit)
- 결과물: product vision spec
  (페르소나 / 가격 / 데이터 source 일반화 / question vocabulary / 차별화 / OSS 전략)

이전 세션의 paradigm shift (PKM / question-cluster) 가 새 비전의 자연스러운 형태라는 점 인지하고 시작.
AI 협업 4단계 (분석·공유 → DDD → 작은 단위 검증 → 규칙성 유지) 따름.
```

---

## 4. IA redesign과의 관계 (deferred)

이전 세션의 IA redesign Phase 1 brainstorming은 *완료*. 그러나 **Phase 1 implementation은 deferred**.

이유: 새 product 비전이 IA에 영향을 줄 수 있음. 예를 들어:

- 페르소나가 *솔로*가 아니라 *자문가*면 → cluster boundary가 달라짐
- 데이터 source가 일반화되면 → atom card의 data_contract 재정의
- Question vocabulary가 일반화되면 → DOMAIN_MAP §1-3 entries 재구성

→ **새 product 비전 spec이 나온 후 Phase 1 implementation 재검토.** 39 atom inventory가 그대로 baseline으로 유효할 가능성 큼 (PKM paradigm이 두 비전 모두에 정렬되니까), 단 일부 atom의 *cluster 소속*이 달라질 수 있음.

---

## 5. 작업 흐름 권장

```
Session N (this) — IA Redesign Phase 1 brainstorming
   ↓ deferred (vision pivot 발견)
   ↓
Session N+1 — gstack-office-hours: product vision spec
   ↓
Session N+2 — vision spec review + IA Phase 1 재검토
   ↓
Session N+3 — IA Phase 1 implementation (batch atom cards)
   ↓
Session N+4~ — IA Phase 2-4 (Navigation / Page redesign / Aesthetic)
```

각 세션은 독립적 spec doc 또는 plan 산출. PLAN.md에 reference 추가.

---

## 6. 위험 (next session에서 다룰 것)

- **Premature commercialization**: 비전이 crystallize 안 된 상태에서 가격 모델 / OSS 전략을 결정하면 *실제 사용자 needs와 어긋남*. 6 forcing question이 demand reality를 먼저 검증해야 함.
- **Scope creep**: 새 비전이 너무 broad하면 (예: "모든 투자자를 위한 finance OS") narrowest wedge 발견 어려움. 작은 진입점부터.
- **IA과 비전의 desync**: 이전 세션의 39 atom inventory가 새 비전에 맞지 않으면 *재작업*. 그러나 PKM paradigm 자체는 두 비전 모두에 작동.
- **OSS의 hidden 비용**: 오픈소스는 *공개* 자체가 아닌 *유지*가 비용. maintenance 부담 / 커뮤니티 응답 / 보안 / 라이선스 결정 등.

---

## 7. References

- **이번 세션 IA redesign spec**: `docs/superpowers/specs/2026-05-05-ia-redesign-design.md`
- **이전 세션 baseline**: commit `b88474e`
- **글로벌 룰**: `~/.claude/CLAUDE.md`
- **PRODUCT.md** (기존): `Portfolio_Tracker/PRODUCT.md` — 기존 PT 의도 / 6 accumulation axes / freeze contract

---

> **자가 기록 mandate.** 다음 세션 진행 중 새 발견 / 결정 / 미정 항목 변경이 생기면 이 파일에 즉시 반영. 시점 명기 (YYYY-MM-DD).

---

## ⚠ Resolution (2026-05-06) — superseded

이 handoff note는 *2026-05-06 session에서 superseded*됨.

**결과:** 상품화 / Active OSS는 *real intent가 아니었음* (가벼운 wish). 진짜 default = Path A (본인용 PT 진화). 가벼운 공유는 deferred option.

**자세한 결정 + carry-over discoveries + 다음 세션 plan:** [`2026-05-06-vision-pivot-resolution.md`](./2026-05-06-vision-pivot-resolution.md)

→ **다음 세션은 *resolution doc*을 진입점으로 사용. 이 doc은 *historical reference*로만.**
