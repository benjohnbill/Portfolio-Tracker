# ELT Price Migration — Design Spec

**Date:** 2026-05-14
**Status:** Draft (research complete; implementation deferred to a follow-up plan)
**Stakeholder:** 오라버니 (icarus.cho@gmail.com)
**Author:** Lotte (assistant)

> **자가 기록 mandate.** 작업 중 새 발견 / 결정 / cross-reference가 생기면 즉시 이 파일에 반영. 시점 명기 (YYYY-MM-DD). 다음 세션의 시작점으로 사용.

---

## 1. Background

### 1.1 Trigger

Page-load 3s budget plan (`2026-05-13-page-load-3s-budget.md`)이 끝난 직후, post-deploy 측정에서 `/portfolio?period=1y` cold-cache 시 4082ms 측정. 단일 컴포넌트(StressTestWidget, EquityCurveSection) cold spike가 원인. 옵션 C (commit `431a784`)로 ExchangeService + KISService 단일 캐시는 추가했지만, **근본 패턴 — "endpoint가 yfinance live call을 한다"** 자체는 그대로.

오라버니의 질문:
> "Portfolio의 탭이나 특정 Component는 어쩔 수 없이 백엔드 데이터 전송 떄문에 시간이 걸릴 수밖에 없는 건가? 항상 똑같이 로드되는 기존 가격 데이터나 매크로 데이터 등을 메모리 캐싱을 함에도 불구하고?"

답: **아니에요**, 메모리 캐싱은 첫 호출 + 프로세스 재기동마다 cold. "어제 종가는 영원히 어제 종가"인데 매번 yfinance round-trip을 한다는 것은 잘못된 기본 가정. 진짜 해결은 **DB가 source of truth, endpoint = DB read**.

### 1.2 Architecture pivot 정합

IA Redesign spec (`2026-05-05-ia-redesign-design.md`)에서:

- **페이지 = 질문 cluster**, **컴포넌트 = atom** (PKM 모델)
- atom card schema의 `data_contract` 필드 — "이 atom은 어떤 데이터에 의존하는가"를 명시

이 모델에서 yfinance live call은 **잘못된 abstraction layer 위치**. atom의 data_contract는 "yfinance API"가 아니라 "DB row/view"여야 함. 그 view는 daily cron이 채워둠. 사용자 read는 DB만.

PRODUCT.md §9 *"Accumulation-as-Hero"* — *"매 Friday freeze = note"* — 와 같은 PKM 비유를 가격 데이터에도 적용: **"매일 close price = note. PriceService = query."**

### 1.3 ELT 패턴이 이미 존재

backend는 이미 ELT 패턴을 일부 도입:

| 테이블 | 적재 service | 적재 시점 | 사용처 |
|---|---|---|---|
| `RawDailyPrice` | `PriceIngestionService.update_raw_prices()` | Daily cron Step 1 (blocking) | **현재 거의 사용 안 됨** ⚠️ |
| `VXNHistory` | `QuantService.update_vxn_history()` | Daily cron Step 3 | `/api/signals/vxn` (DB read) |
| `MSTRCorporateAction` | `QuantService.seed_mstr_corporate_actions()` | Daily cron Step 4 (manual seed) | MSTR Z-score 계산 |
| `PortfolioPerformanceSnapshot` | `PriceIngestionService.generate_portfolio_snapshots()` | Daily cron Step 2 | `/api/portfolio/history`, alpha 계산 |

**핵심 gap**: `RawDailyPrice`는 매일 채워지고 있는데 `PriceService.get_current_price()`가 이걸 안 봄. yfinance live call. **DB가 source of truth가 되도록 PriceService 재구현이 본 spec의 본질.**

이 spec은 **schema 변경 없이** 코드 변경만으로 ELT 패턴을 완성시킴.

---

## 2. Paradigm

### 2.1 두 호출 시점의 분리

| 시점 | Who | What |
|---|---|---|
| **Write path** (드물게, 예측 가능) | Daily cron, 외부 API 변동 시 manual | yfinance/FDR → DB |
| **Read path** (자주, latency-critical) | 모든 endpoint | DB → response |

현재: 두 path가 섞여 있음 (`PriceService.get_current_price()`가 양쪽 다 함). Migration 후: 명확히 분리.

### 2.2 데이터 freshness 보장

cron이 매일 0:30 KST에 도는 한, "최신 가격"은 늘 어제 종가까지. Intraday는 다음 cron이 처리. 이 trade-off는 PT의 product framing (Friday freeze 중심, 매주 단위 의사결정)에 자연스러움 — intraday volatility은 의사결정 input이 아님.

만약 미래에 intraday가 필요하면 그건 별도 stream (websocket subscriber 등) — ELT pattern과 무관.

### 2.3 atom data_contract와의 연결

(IA Phase 1 implementation 시점에 구체화)

| 현재 (live) | After ELT migration |
|---|---|
| `data_contract: [yfinance.AAPL.current]` (불명확) | `data_contract: [raw_daily_price.AAPL]` (DB row 참조) |

atom card 작성 시 `data_contract` 필드가 자연스럽게 "DB query"가 됨. atom-to-cache invalidation matrix 자동 도출 가능 (DB row mutation → atom re-render).

**단** 본 spec은 contract style의 구체적 결합 형식 (예: SQL view auto-generation)은 결정하지 않음 — IA Phase 1 implementation 시 brainstorming 통해 결정.

---

## 3. Scope

### 3.1 In Scope

**A. `PriceService.get_current_price()` 재구현**
- yfinance/FDR live call 제거
- `RawDailyPrice` 테이블의 가장 최근 row 조회
- Signature 보존 (`(symbol, source) -> float`)
- 캐시 (`_PRICE_CACHE` dict)는 그대로 두되, DB read 결과를 캐시. miss 시 DB.

**B. Request-time fetch site 정리**
- `main.py:276` (`POST /api/transactions` auto-fetch when price missing) — DB read로 전환. Fallback 정책: DB miss 시 명확한 에러 응답 ("symbol not yet ingested; try again after next cron" 또는 별도 sync trigger).
- `main.py:448` (`GET /api/portfolio/stress-test`) — DB read.

**C. 신규 symbol 등록 시 자동 backfill** *(사용자 명시 요청)*
- `POST /api/transactions`이 새 Asset 생성하는 경우, 그 symbol의 historical price를 즉시 backfill하는 sync trigger 호출
- 이미 존재하는 `PriceIngestionService.update_raw_prices()`를 단일 symbol 모드로 확장 (또는 별도 단순 helper)
- Synchronous (transaction 등록 끝나기 전 완료) vs asynchronous (background) 결정은 implementation plan에서

**D. `daily-quant-update` cron 확장 검증**
- 현재 cron이 모든 등록된 Asset의 price를 적재하는지 audit
- 새 symbol이 등록 후 첫 cron에 자동 포함되는지 확인 (모델 audit + 테스트)

### 3.2 Out of Scope

- **macro_service** ELT 이전 — 이미 `SystemCache` DB cache로 충분 (Task 1.1 검증: 352ms). 별도 mini-task로 daily warm-up만 추가 가치 있음.
- **KIS service** ELT 이전 — auth + IP whitelist 운영 복잡성 별도. 옵션 C (commit `431a784`)의 date-keyed 메모리 캐시로 충분.
- **PriceService.get_historical_prices()** — 이미 daily cron의 ingestion path에서만 사용. Read path에서 직접 호출하는 곳 없음 (확인됨).
- **atom data_contract와의 깊은 결합 (SQL view auto-generation 등)** — IA Phase 1 implementation 시 결정.
- **Intraday price subscription** — 별도 product 영역.

### 3.3 Schema Changes

**없음.** `RawDailyPrice`, `Asset`, `Transaction` 모두 기존 schema 사용. Alembic migration 불필요.

(데이터 freshness 추적이 필요해지면 `RawDailyPrice`에 `ingested_at` 컬럼 추가 alembic migration이 추가될 수 있음 — out of scope의 follow-up.)

---

## 4. Framework

### 4.1 Three steps of implementation

```
Step 1: PriceService.get_current_price() → DB read
  ↓
Step 2: New-symbol backfill on transaction creation
  ↓
Step 3: Cron coverage audit + test
```

각 단계는 독립적으로 deployable. Step 1 만 land해도 가장 큰 win (StressTestWidget cold spike 제거).

### 4.2 Read path detail

```python
# New PriceService.get_current_price (sketch)
@staticmethod
def get_current_price(symbol: str, source: str = "US") -> float:
    cache_key = (symbol, source, date.today().isoformat())
    if cache_key in _PRICE_CACHE:
        return _PRICE_CACHE[cache_key]

    # DB read — most-recent row for this ticker
    row = db.query(RawDailyPrice).filter(
        RawDailyPrice.ticker == symbol
    ).order_by(RawDailyPrice.date.desc()).first()

    if row is None:
        # No data yet (new symbol not yet ingested, or first deploy).
        # Caller decides what to do — sync trigger? error?
        return 0.0  # or raise

    price = float(row.close_price)
    _PRICE_CACHE[cache_key] = price
    return price
```

**`db` 인자 추가 필요** — 현재 static method라 session 없음. 호출 site에서 주입. 이건 signature 변경이므로 호출 site 14개(approx) 전체 업데이트.

**대안**: PriceService를 dependency-injected service 인스턴스로 전환. 더 큰 refactor지만 미래 architecture와 정합. Implementation plan 시 결정.

### 4.3 Write path (이미 존재)

`PriceIngestionService.update_raw_prices(db)` — daily cron Step 1. 변경 없음.

새 symbol backfill을 위해 단일 symbol 모드 추가:

```python
# Helper to add
@staticmethod
def backfill_single_symbol(db, asset: Asset, since: date = None):
    """Pull historical prices for a single asset and upsert to RawDailyPrice."""
    # Reuse update_raw_prices logic, scoped to one symbol
    ...
```

`create_transaction` handler에서 새 Asset 생성 시 이 helper 호출.

### 4.4 신규 symbol UX 결정 사항

(implementation 시 결정, spec에 명시만)

- **Sync vs async**: Sync면 첫 거래 등록이 ~3초 (yfinance 3-year history fetch). 사용자는 등록 직후 historical chart를 볼 수 있음. Async면 등록 즉시, 차트는 다음 cron까지 비어 있음.
- **추천**: sync, 다만 latency budget 명시 (max 5초, timeout 시 etl_status='pending' 마크).

### 4.5 Failure modes

| 시나리오 | 동작 |
|---|---|
| Symbol이 DB에 없음 (신규 + backfill 아직 안 됨) | `get_current_price` returns 0.0 또는 raise. 호출 site별 정책. |
| Cron 실패로 데이터 stale (어제 종가가 없음) | 가장 최근 row 반환. UI에 staleness 표시 (별도 follow-up). |
| yfinance 자체가 죽음 | Cron Step 1 실패, 다음 cron까지 stale. Render 무료 티어이므로 alerting 미흡, follow-up 가치. |

### 4.6 Testing strategy

- **Unit**: mock DB, assert `get_current_price` returns latest `RawDailyPrice.close_price`
- **Integration**: seed `RawDailyPrice` rows, call `get_current_price`, verify
- **End-to-end (deferred)**: full cron run + endpoint hit, verify no yfinance call in request path (mocking yfinance to raise — if endpoint calls it, test fails)

---

## 5. 영향 받는 surface

### 5.1 직접 변경

| File | 변경 |
|---|---|
| `backend/app/services/price_service.py` | `get_current_price` 재구현 (DB read), `_PRICE_CACHE` 유지 |
| `backend/app/main.py:276` (`create_transaction`) | Auto-fetch path를 sync backfill로 |
| `backend/app/main.py:448` (`stress-test`) | DB session 주입 |
| `backend/app/services/ingestion_service.py` | `backfill_single_symbol` helper 추가 |
| `backend/tests/test_price_service.py` | DB read 테스트 추가, mock yfinance call removal |
| 신규 테스트: `backend/tests/test_new_symbol_backfill.py` | 등록 → backfill → endpoint 흐름 |

### 5.2 간접 영향 (호출 site 검토 필요)

`PriceService.get_current_price` 호출하는 모든 곳에 `db` 인자 추가:
- `main.py:276` (transactions)
- `main.py:448` (stress-test)
- 기타 (codebase grep 시 implementation 시 발견)

**대안**: signature 보존하고 PriceService 내부에서 SessionLocal 사용 — 단 dependency injection 패턴 깸. Implementation plan 시 trade-off 결정.

### 5.3 변경 없음

- 모든 frontend 코드
- `RawDailyPrice` schema
- daily cron pipeline
- 다른 endpoints (signals, friday, intelligence — 이미 DB read)

---

## 6. 핵심 합의 (요약)

| | 결정 |
|---|---|
| Paradigm | Read path = DB, Write path = cron. 두 path 명확 분리 |
| 1차 scope | yfinance/FDR price만. macro·KIS는 별도 영역 |
| Schema | 변경 없음 (RawDailyPrice 재사용) |
| 신규 symbol | 등록 시 sync backfill — UX latency 예산 5초 |
| Cron timing | 기존 daily-quant-update 그대로, ingestion Step 1이 source of truth |
| Atom data_contract 결합 | IA Phase 1 implementation 시 결정 (이 spec out of scope) |
| Sequence | ELT 먼저, IA Phase 1 atom card 작성은 후속 |

---

## 7. Open Questions (implementation 시 결정)

1. **PriceService session pattern** — static method에 `db` 추가 vs DI 인스턴스 vs SessionLocal 직접 사용. 각 trade-off 명시 필요.
2. **`get_current_price` DB miss policy** — 0.0 return vs raise vs fallback yfinance one-time. Caller별로 적정 정책 다를 수 있음.
3. **신규 symbol backfill의 sync/async** — 5초 budget 안에 들어가는지 측정 필요. 안 들어가면 async + UI status badge.
4. **데이터 staleness 표시 (UI)** — 별도 spec 또는 본 spec 후반 확장 결정.
5. **Migration rollback** — Phase 별로 하나씩 land해야. 1단계 (PriceService 만) 후에도 transactions/stress-test 정상 작동해야. 호환성 step plan 필요.

---

## 8. References

- **Page-load plan** (이번 세션의 직전 작업): `docs/superpowers/plans/2026-05-13-page-load-3s-budget.md`
- **Page-load 측정 결과** (ELT 필요성 증거): `docs/superpowers/measurements/2026-05-13-page-load-after.md`
- **Slow-vs-fast component table** (atom-level 영향 추적): `docs/superpowers/measurements/2026-05-13-slow-vs-fast-components.md`
- **IA Redesign spec** (paradigm 정렬): `docs/superpowers/specs/2026-05-05-ia-redesign-design.md`
- **Product vision pivot handoff** (Path A 확정): `docs/superpowers/handoff/2026-05-06-vision-pivot-resolution.md`
- **현재 ELT 코드**:
  - `backend/app/services/ingestion_service.py` — write path
  - `backend/app/services/price_service.py` — read path (target)
  - `backend/app/models.py:50-54` — RawDailyPrice schema
  - `backend/app/main.py:988-1139` — daily cron handler

---

## 9. Next steps

본 spec은 **paradigm + scope** 정의. Implementation은 별도 `docs/superpowers/plans/YYYY-MM-DD-elt-price-migration.md`에서 step-by-step 분해. Plan 작성 시:

1. 본 spec의 Open Questions 5개 결정
2. 단계별 sequencing (Step 1 → Step 2 → Step 3 각각 deployable)
3. 각 단계의 TDD red-green-refactor
4. Rollback 시나리오 (단계별 backward-compat)
5. Post-implementation 측정 (Phase 4 Task 4.1과 같은 패턴)
