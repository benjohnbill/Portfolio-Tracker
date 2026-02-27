# DOMAIN_MAP.md

Last updated: 2026-02-23  
Scope: `-01_Coding`

## Purpose

기술 파일 구조와 별개로, 업무 도메인 경계를 명시해
Control Tower와 작업 에이전트가 동일한 언어로 작업하도록 한다.

## Domains

1. Portfolio Core
- 책임: 자산 구성/리밸런싱 규칙/성과 계산
- 주요 코드: `js/finance.js`, `js/strategy.js`, `rebalance_calc.py`

2. Market Data and Backend API
- 책임: 시장 데이터 수집, API 응답 안정성, 캐시 경로
- 주요 코드: `server.py`

3. Visualization and Interaction
- 책임: 대시보드 렌더링, 차트/토글 상호작용, 클라이언트 상태
- 주요 코드: `index.html`, `css/style.css`, `js/app.js`, `js/charts.js`, `js/ui.js`

4. Orchestration and Governance
- 책임: task/result/handoff 계약, control tower 운영, 상태 동기화
- 주요 코드: `orchestration/`, `tools/validate_contracts.py`, `Agent.md`

## Boundary Rules

1. 도메인 간 계약 변경(API shape, schema 변경)은 control-tower 승인 필요.
2. Visualization 변경은 Backend API 계약을 임의로 변경하지 않는다.
3. Portfolio Core 수식/룰 변경은 Validation evidence를 필수로 남긴다.
4. Orchestration 도메인은 비즈니스 로직을 직접 구현하지 않는다.

