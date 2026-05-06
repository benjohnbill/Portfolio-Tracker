# PT v2 Evolution — Vision Pivot Resolution

**Date:** 2026-05-06
**Status:** Decided — back to Path A (personal tool evolution) + light future-sharing options deferred
**Stakeholder:** 오라버니 (icarus.cho@gmail.com)
**Author:** Lotte (assistant)
**Mode:** Builder (light) — supersedes startup-mode framing in `2026-05-05-product-vision-pivot.md`
**Carry from:** commit `86db4a2`

---

## 1. Decision summary

이번 session에서 `gstack-office-hours` startup mode로 진행 중, *premature commercialization 함정*을 회피하기 위해 framing을 정정.

**최종 결정:**

| 영역 | 결정 |
|---|---|
| 상품화 (paid product) | 🔴 영구 off |
| Active OSS (maintenance commitment) | 🔴 영구 off |
| **Path A (본인용 PT 진화)** | 🟢 진짜 default. 이전 세션 IA Phase 1 plan 그대로 진행 |
| 가벼운 공유 (블로그 / 트위터 / passive OSS) | 🟡 deferred option, 미래 가능성 |

**왜 startup framing이 안 맞았나:** 이전 세션의 "오픈소스 + 상품화 가능성" 표현이 *real product intent*가 아닌 *가벼운 wish + brainstorming 차원*이었음. Lotte가 그것을 *startup intent*로 inflate한 건 추정 오류. 오라버니가 "굉장히 가벼운 마음" 명시해서 진단 정확화.

---

## 2. Carry-over discoveries (PT v2 진화 priority data)

이번 session 발견들. framework이 안 맞았어도 *발견 자체는 valuable*. 다음 세션이 활용해야.

### (a) Founder usage history — 진짜 사용자 행동 데이터

- 이전 desperate state: 매일 2-10시간, 4개월 지속 (대학생 휴학 + 독일어 공부 시기)
- 포트폴리오 specific 추리면 **주당 20시간 × 16주 ≈ 320시간**
- AI 도구: Gemini Pro + Perplexity Pro (학생 무료 구독)
- 사용 패턴: *매크로 / 전략 / 자산배분 specific 질문* — 예: "중기채 → 초장기 ETF rotation 시 risk/FX/historical 종합"
- 현재 (graduated): 주당 10분 (rule 정해놓음)

### (b) 두 답답함 — PT v2가 메우려는 진짜 gap

- **Strategy validation gap**: 전략은 시간 지나야 입증, 즉시 가시적 성과 X → 결국 *믿음으로 견디기*
- **Social validation gap**: 어디 얘기할 공간 없음, 분산 투자에 FOMO

→ PRODUCT.md §9 (Accumulation-as-Hero)의 *trust calibration + counterfactual + decision-latency*가 정확히 이 gap을 메우는 것. 우연 아님.

### (c) Self-directed tool framing

- Tool ≠ Advisor
- 한국 CFP / 미국 RIA 라이선스 무관 (information tool)
- 자산 규모 axis 자유

### (d) 한국 visible segment (미래 공유 시 reach 가능)

- 박곰희 portfolio / All-Weather / 슈카월드 코스피 6:4 추종자
- 단 quality of demand 모름 (passive hold일 가능성 큼)

### (e) Founder = past self 가설 깨짐

- 본인은 *graduated user* (주당 10분)
- PT v2 진화 시 *desperate self의 needs를 의식적으로 imagine*해야 함 — 자연스럽게 안 옴

---

## 3. Premises (agreed)

| # | Premise |
|---|---|
| P1 | PT는 본인용 도구. 상품화 / Active OSS 영구 off |
| P2 | PKM / question-cluster paradigm valid, carry over (이전 세션 결정) |
| P3 | 이번 session 발견 (§2 a-e)이 PT v2 진화 priority data |
| P4 | Founder ≠ past self. desperate self의 needs를 의식적으로 imagine 필요 |
| P5 | 데이터 축적이 진화 동력 (본인 사용 + 미래 opt-in 주변 데이터) |

---

## 4. Approaches considered

### Approach A: 이전 세션 IA Phase 1 plan 그대로
- Pros: 명확, 즉시 시작 가능
- Cons: 이번 session 발견의 *carry over 약함*
- Effort: M

### Approach B: ChatGPT 로그 4개월 전체 review → vocabulary 도출
- Pros: 진짜 사용자 질문이 vocabulary base
- Cons: 시간 cost 큼 (10-20시간), commitment level에 비해 과도
- Effort: L

### Approach C (✅ chosen): Hybrid
- 이전 세션 IA Phase 1 + sample 기반 ChatGPT 로그 review (20-30개)
- Pros: efficiency + 발견 활용 균형
- Cons: sample selection bias 약간
- Effort: M+

---

## 5. Recommended approach (C) — 다음 세션 plan

```
Step 1. 본인 ChatGPT/Gemini 로그에서 *대표 질문 20-30개* sample 가져오기
        - 매크로 질문 / 전략 질문 / 자산배분 질문 골고루
        - 본인 desperate 시절 (4개월) 중에서 representative

Step 2. Lotte와 vocabulary seed 도출 (1-2 turn)
        - 그 질문들에서 반복 등장하는 *개념 keyword* 추출
        - DOMAIN_MAP §1 (entities) / §2 (behaviors) / §3 (cluster-level) seed로 채워짐

Step 3. 이전 세션 IA Phase 1 batch atom card 작성 시작
        - friday/ batch 1 (8-10 atoms)
        - vocabulary seed가 keyword 채울 때 backing

Step 4. Codex Checkpoint 1 → 다음 batch → DOMAIN_MAP draft 완성

Step 5. Cluster 도출 → 새 sitemap
        (이번 session 발견의 두 답답함이 cluster boundary 결정에 영향 — desperate self 의식적 imagine)

Step 6. Phase 2-4 (Navigation / Page redesign / Aesthetic) — 후속 세션들
```

---

## 6. The Assignment (다음 세션 첫 task)

**한 가지 concrete action:**

다음 세션 첫 turn 전에, **본인 ChatGPT/Gemini 로그에서 *대표 질문 20-30개 sample*을 골라서 가져오기**. 4개월치 다 review 안 해도 됨. *기억나는 representative 질문*들로 충분.

가져오는 형태: text paste 또는 markdown list. 한 질문당 1-3줄.

이게 다음 세션 vocabulary seed 도출의 input.

---

## 7. Distribution plan

**현 단계: 본인용. 배포 X.**

**미래 가능성 (deferred):**

| 형식 | 무게 | 결정 시점 |
|---|---|---|
| Passive OSS (GitHub repo + README + MIT) | 가벼움 | PT v2 본인용 안정 후 |
| 블로그 글 / Substack 한 편 (PKM paradigm essay) | 가벼움 | 동일 |
| 트위터 thread (핵심 통찰) | 매우 가벼움 | 동일 |

위 모두 *결정 deferred*. PT v2가 본인용으로 안정된 *후* 결정.

---

## 8. References

- **Active artifacts:**
  - [`docs/superpowers/specs/2026-05-05-ia-redesign-design.md`](../specs/2026-05-05-ia-redesign-design.md) — Phase 1 IA plan, paradigm, framework, 39 atom inventory
  - [`docs/superpowers/handoff/2026-05-05-product-vision-pivot.md`](2026-05-05-product-vision-pivot.md) — vision pivot context (*이 doc이 정정 / supersede*)
- **Baseline commit**: `86db4a2`
- **글로벌 룰**: `~/.claude/CLAUDE.md`

---

## 9. What I noticed about how you think (light)

- *Premature commercialization*을 미리 본 wisdom. "BM 안 떠오름 + 본인이 돈 낸 경험 없음 + 본인이 과거의 본인 아님" 세 이유 모두 sound. founder discipline.
- *데이터 축적 mindset*을 자연스럽게 명시 — "*내 과거 데이터 혹은 주변 사람들 데이터로 축적하여 발전*". PRODUCT.md §9와 같은 결. 본인 paradigm을 반복적으로 자기 입으로 표현.
- *"가벼운 마음"* 솔직히 인정한 정직성. founder cosplay 함정 회피. 진짜 vision이 아닌 것을 vision으로 inflate하지 않음.

---

> **자가 기록 mandate.** 다음 세션 진행 중 새 발견 / 결정 / 미정 항목 변경이 생기면 이 파일에 즉시 반영. 시점 명기 (YYYY-MM-DD).
