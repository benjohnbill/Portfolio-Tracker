# Handoff — Page Load 3s Complete, ELT/Macro/IA Plans Ready

**Date:** 2026-05-14
**From:** Lotte
**To:** Next session (whoever picks this up)

---

## 1. 30-second context

지난 세션에서 두 가지를 끝냈다:

1. **Page load 3s budget plan** — 9 fixes deploy + Phase 4 measurement = 3/4 pages PASS, 1 page PASS-WITH-EXCEPTION. EquityCurve/Stress cold-spike만 남고, 그 원인을 옵션 C로 추가 fix (commit `431a784`).
2. **3개 후속 plan + 1 spec** 작성. 다음 세션 즉시 실행 가능 상태.

UptimeRobot 5분 ping 운영 중 → backend cold start 없음 보장됨.

---

## 2. 다음 단계 — 사용자 결정한 실행 순서

```
ELT migration (Plan 1)  →  Macro warmup cron (Plan 2)  →  IA Phase 1 (Plan 3)
   ~7-9 commits             ~1 commit, 5min                4 batches, 39 atom cards
   Backend deep work        Backend trivial                Docs only
```

### Plan 1 — ELT price migration (이번 세션의 메인 다음 작업)

- **파일**: `docs/superpowers/plans/2026-05-14-elt-price-migration.md` (805 lines)
- **Spec 참조**: `docs/superpowers/specs/2026-05-14-elt-price-migration.md` (paradigm + scope)
- **Phase 구성**:
  - Phase 1 — `RawDailyPrice.ingested_at` 컬럼 + PriceService DB read
  - Phase 2 — 신규 symbol sync backfill on `POST /api/transactions`
  - Phase 3 — Audit + 측정
- **Open questions 다 결정됨** (plan §Decisions table) — 사용자가 plan 시작 시점에 다시 한번 review 권장

### Plan 2 — Macro warmup cron

- **파일**: `docs/superpowers/plans/2026-05-14-macro-warmup-cron.md` (215 lines)
- 한 줄 추가 + 한 commit. 5분 작업.

### Plan 3 — IA Phase 1

- **파일**: `docs/superpowers/plans/2026-05-14-ia-phase-1-implementation.md` (548 lines)
- **Spec 참조**: `docs/superpowers/specs/2026-05-05-ia-redesign-design.md` (paradigm + 39-atom inventory)
- 코드 변경 없음. 39개 atom card + DOMAIN_MAP + 새 sitemap 도출.
- Phase 2-4 (Navigation Grammar / Compact Redesign / Aesthetic Uplift)은 별도.

---

## 3. 지금 production 상태 (변경 시 검증 기준)

| | 값 |
|---|---|
| Backend (Render) | `https://portfolio-tracker-f8a3.onrender.com` — warm 유지 중 (UptimeRobot ping every 5min) |
| Frontend (Vercel) | `https://portfolio-tracker-omega-nine.vercel.app` |
| Test count baseline | 392 passed + 1 pre-existing failure (`test_get_friday_sleeve_history_returns_zeros_when_no_reports`) |
| `/api/healthz` | HEAD/GET 둘 다 200 (commit `<fix-head>`) |
| `/api/macro-vitals` | cache hit ≈350ms; cache miss는 첫 진입에만 (UptimeRobot이 keep-warm) |
| `/api/stress-test` | warm ≈2s, cold ≈4s. ELT migration 후 ≤50ms 예상 |
| 페이지 로딩 (warm) | `/` 625ms, `/friday` 523ms, `/portfolio?period=1y` 4082ms cold (warm <2s), `/intelligence` 258ms |

---

## 4. 진행 시 주의

### Subagent-driven 실행 시
- 각 Task 끝나면 spec review + code-quality review (스킬 가이드대로). Plan 1은 step이 많아서 batch 처리하면 review 부하 큼 — 각 Phase 끝나면 review 한 번씩 묶는 패턴 권장
- File zone 충돌 회피 — Plan 1의 Phase 1, 2, 3은 같은 `backend/app/main.py`를 만짐. 순차 진행 필수

### `PriceService` signature 변경
Plan 1 Phase 1에서 `get_current_price`가 첫 인자에 `db: Session`를 받게 됨. 모든 caller 업데이트 필요. Plan에 grep 명령어 있음.

### IA Phase 1 시작 전 pre-condition
Plan 3는 ELT migration이 끝난 후 시작 — sequence 1 → 3 → 2 → Plan 3. Plan 3 Phase 0이 pre-condition check 단계라 자동으로 확인.

---

## 5. Out-of-band manual

- UptimeRobot dashboard 가끔 확인 (24h uptime ≥ 99%)
- 잔여 architecture 후보 (#7-#10 from 진단 결과) — Plan 1/2/3 끝난 후 별도 brainstorming 가치: api.ts 분할, friday/report/briefing 통합, intelligence 분리, 외부 API seam

---

## 6. 다음 세션 시작 prompt 예시

```
docs/superpowers/handoff/2026-05-14-page-load-and-elt-handoff.md 읽고
ELT migration plan부터 subagent-driven으로 실행 시작. Plan §Decisions
의 5개 결정사항 한 번 review하고 진행.
```

또는 더 짧게:

```
Portfolio Tracker — ELT migration plan 진행. handoff doc 참조.
```
