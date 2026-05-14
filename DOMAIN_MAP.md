# DOMAIN_MAP.md

> **자가 기록 mandate.** 작업 중 새 어휘 / 정의 / cross-reference가 발견되면
> 즉시 이 파일에 반영. 시점 명기 (YYYY-MM-DD).

## §1 Domain Entities (측정 가능한 양 / 현실 객체)

_(populated bottom-up during Phase 1 batch writing)_

## §2 Behaviors (동작 / 시간 변화)

_(populated bottom-up)_

## §3 Cluster-Level Concepts (여러 entity의 종합 / 묶음)

_(populated bottom-up)_

## §4 Atom Types (컴포넌트 역할 분류 vocabulary)

### multi-question atom
한 컴포넌트가 여러 sub-question을 *함께* 답함. 분리하면 cross-lens 통찰 손실.

### gateway-thin atom
짧은 요약 + 다른 surface로의 다리. 깊이는 destination에.

### chart atom
recharts-based; one quantitative time-series view.

### data-fetcher atom
RSC wrapper — fetch + error/empty handling, then renders a display atom.

### form-input atom
사용자 입력 받음.

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
