# Handoff — ELT Migration Complete, Plan 2/3 Next

**Date:** 2026-05-14 (afternoon)
**Previous handoff:** [2026-05-14-page-load-and-elt-handoff.md](2026-05-14-page-load-and-elt-handoff.md) (page-load done, ELT/Macro/IA queued)
**This session:** ELT migration (Plan 1) shipped + deployed + measured

---

## 1. What landed

**ELT Price Migration — 13 commits on main** (`a75b3d9` → measurement doc).

- `PriceService.get_current_price(db, symbol, source)` — DB-only read, signature changed across 3 callers (main.py + score_service).
- `RawDailyPrice.ingested_at` column (nullable, alembic migration ran on Render).
- `PriceIngestionService.backfill_single_symbol(db, asset)` — sync (no timeout) on new-asset POST.
- `StressService._fetch_scenario_closes(db, scenario, tickers)` — SystemCache-backed; scenario windows fixed, never stale.
- Guard test `test_no_live_api_in_read_path.py` — `assert_not_called()` + pre-seeded cache.

**Post-deploy:**
- `/api/stress-test` warm: 2.0s → 0.88-1.01s (~50% improvement).
- `/api/stress-test` cold (Render restart 후): 5.37s (cache miss for COVID + BEAR sequential).
- Measurement: `docs/superpowers/measurements/2026-05-14-elt-after.md`.
- Tests: 387 → 395 passed + 1 pre-existing failure (`test_get_friday_sleeve_history_returns_zeros_when_no_reports`).

**§Decisions:** all 5 resolved. Row 3 (sync timeout) was rewritten after Phase 2 review (`with ThreadPoolExecutor()` can't bound wall-clock latency).

---

## 2. Next session entry — choose one

### Plan 2 — Macro warmup cron (5분 작업, 권장 첫 진입)
- 파일: `docs/superpowers/plans/2026-05-14-macro-warmup-cron.md`
- 한 줄 추가 + 한 commit. `/api/macro-vitals` first-request cold path 제거.
- macro_service는 ELT migration scope에서 빠진 마지막 read-path yfinance 호출 site.

### Stress cron warmup mini-task (Plan 2 다음, ~10분)
- `stress_service.py` 상단에 TODO 코멘트로 표시됨.
- daily cron이 `_fetch_scenario_closes`를 사전 호출해서 cache 시드 → `/api/stress-test` cold path (5.37s) 제거.
- Plan 작성된 게 없음. 짧으므로 inline implementer로 충분.

### Plan 3 — IA Phase 1 (docs only, 큰 작업)
- 파일: `docs/superpowers/plans/2026-05-14-ia-phase-1-implementation.md`
- 39 atom card + DOMAIN_MAP + 새 sitemap 도출. 코드 변경 없음.
- ELT/Macro 끝난 후가 자연스러운 순서.

---

## 3. Backlog (낮은 우선순위)

- `datetime.utcnow()` → `datetime.now(timezone.utc)` file-wide cleanup. ingestion_service.py 특히.
- `backfill_single_symbol` per-row → bulk insert (3년 ≈ 756 round-trips on new-asset POST).
- `score_service.py` 류의 indirect caller path 전반 audit — 다른 signature drift 잠복 가능성.
- 잔여 architecture 후보 (#7-#10): api.ts 분할, friday/report/briefing 통합, intelligence 분리, 외부 API seam.

---

## 4. Operational state

| | 값 |
|---|---|
| Backend (Render) | warm via UptimeRobot 5min ping |
| `/api/healthz` HEAD | 200 (245ms) |
| `/api/stress-test` warm | 0.88-1.0s (was 2.0s) |
| `/api/stress-test` cold | 5.37s on Render restart — cron warmup TODO 우선순위 |
| Test baseline | 395 passed + 1 pre-existing failure |

---

## 5. 세션 학습 (메모리에 저장됨)

- `feedback_grep_audit_signature_drift.md` — signature 변경 시 grep으로 caller 찾기만으로는 부족. Phase 1에서 score_service.py:221 누락, Phase 3 cache 작업 중 발견.
- `feedback_threadpoolexecutor_timeout_misconception.md` — `with ThreadPoolExecutor()` + future.result(timeout=) 패턴은 wall-clock을 bound하지 못함. Plan timeout 명시 시 enforceability 검증.

---

## 6. 다음 세션 시작 prompt 예시

```
docs/superpowers/handoff/2026-05-14-elt-complete-handoff.md 읽고
Plan 2 Macro warmup cron부터 진행. 끝나면 stress cron warmup도.
```

또는 짧게:

```
Portfolio Tracker — Plan 2 Macro warmup. handoff doc 참조.
```
