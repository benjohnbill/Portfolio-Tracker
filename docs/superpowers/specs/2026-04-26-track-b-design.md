# Track B Design Spec
# Naming Hygiene + Archive Backfill + Frontend Display Switch

**Created:** 2026-04-26
**Status:** Approved
**Predecessor:** Track A (shipped 2026-04-25, local main, not yet deployed to production)
**Handoff source:** `docs/superpowers/handoff/2026-04-25-track-b-kickoff.md`

---

## Scope Overview

Track B delivers four groups of changes that complete the naming convention rollout started in Track A and correct known data anomalies in the transaction history.

**Implementation order:** B3 → B4 → B1 → B2 (within each session, TDD discipline applies)

**Deploy phasing:**

| Phase | Groups | Deploy condition |
|---|---|---|
| Phase 1 | B3 + B4 | Anytime — independent of Track A |
| Phase 2 | B1 | After Track A production migrations applied |
| Phase 3 | B2 | After 2026-05-04 Track A verification passes |

All code can be written now. Deploy gating is environment-only.

---

## Group B3 — Frontend Display Switch (Phase 1)

### Goal

Switch the primary visible asset identifier from `asset.symbol` (internal naming convention label) to `asset.name` (human-readable Korean/English full name). Track A introduced `KODEX_1X` and `TIGER_2X` as real symbols — end-users should see the full product names instead.

### Changes

**1. `AssetAllocationSection.tsx`**
- Current: `{asset.asset}` bold, `{asset.name}` muted (`PortfolioAllocationData` exposes `asset` field, not `symbol`)
- Target: `{asset.name}` bold, `{asset.asset}` muted (secondary, smaller)
- No API change required — both fields already in the response payload.

**2. `friday/archive/page.tsx:181-182`**
- Current: raw `{item.symbol}` in sleeve-shift descriptions
- Target: `{item.name ?? item.symbol}` — name as primary, symbol as fallback
- **Note:** `HoldingsChanged` type in `friday_service.py` and `api.ts` currently exposes only `symbol`, not `name`. This requires a small backend + type change: add `name` field to the holdings-changed serialization in `friday_service._holdings_map` / `compare_snapshots` output, and update the `FridayComparison` TypeScript type accordingly.

**3. `AddAssetModal.tsx` — helper text update**
- Input field is free text, unchanged in structure.
- Update placeholder and helper text to reflect naming convention:

```
Placeholder:  e.g. KODEX_1X, MSTR
Helper text:
  기존 KR ETF: 심볼 그대로 (KODEX_1X, ACE_TLT)
  신규 KR ETF: 6자리 KRX 코드 (e.g. 476760)
  해외 자산: 티커 그대로 (MSTR, DBMF)
```

- Rationale: existing assets in DB are found by symbol lookup. New KR ETFs need the KRX code because `get_price_lookup_ticker` uses `asset.code` for KR source assets; the naming convention symbol is applied afterward via migration.

### Data contract

No backend or API changes. Frontend reads `asset.name` and `asset.symbol` from the same response shape as today.

### Tests

- Visual regression: confirm name appears as primary label in allocation and archive views.
- Unit: `AddAssetModal` renders updated helper text.

---

## Group B4 — Service Code Residue (Phase 1)

Three small opportunistic fixes. No migration required.

### B4-1: `score_service.asset_to_category` dead token

**File:** `backend/app/services/score_service.py` ~line 23
**Change:** Remove `"QQQ"` from the NDX substring match list. `"KODEX_1X"` and `"TIGER"` (substring, covers `TIGER_2X`) already cover NDX after Track A T2 migration.
**Verify:** `"KODEX_1X"` classified as `NDX` via exact match; `TIGER_2X` classified via `"TIGER"` substring; `"QQQ"` no longer needed.

### B4-2: `quant_service.py` undocumented ticker

**File:** `backend/app/services/quant_service.py`
**Occurrences (Codex-verified):**
- Line 304: `ticker = "QQQ"` — may already have an inline proxy comment; check and update/add if absent.
- Lines 363-364: docstring reference + `get_asset_history(db, "QQQ", period)` call.

**Change:** Ensure each occurrence has a clear single-line comment:
```python
# Yahoo Finance ticker for NDX index price feed — distinct from the renamed KODEX_1X asset symbol
```
**Rationale:** Without this, a future reader will wonder why `"QQQ"` appears after the Track A rename.

### B4-3: Test seed cleanup (opportunistic)

**Files:** `test_cashflow_consumer_rebinding.py`, `test_friday_service.py`, `test_api.py` and any other test files seeding `WeeklyDecision.asset_ticker="QQQ"`
**Change:** Update seeds to `"KODEX_1X"`.
**Rationale:** `asset_ticker` is a free-text journalling field with no FK constraint; seeds are semantically correct either way. This is consistency-only cleanup.

### Tests

All existing tests must pass without modification (B4-3 updates the seeds themselves). Run full suite after each sub-task.

---

## Group B1 — KR ETF Naming Hygiene (Phase 2)

### Goal

Complete the KR ETF symbol/name migration that Track A started with id=1. Two assets need updates.

### Prerequisites

- Track A production migrations applied: `8e08d095c59e` (track_a_asset_naming) and `393b0d9c9ffd` (track_a_anchor_rows)
- `TICKER_PROXY` already has `ACE_TLT` → `TLT` key (Track A T4)

### Migration 1 — `track_b_ace_tlt_rename`

```sql
UPDATE assets
SET symbol = 'ACE_TLT',
    name   = 'ACE 미국30년국채액티브'
WHERE id = 3
  AND symbol = 'TLT'
  AND code   = '476760';
```

**Idempotency guard:** `WHERE symbol = 'TLT'` — safe to re-run if already applied (no-op).

**Post-apply verifications:**
- `"TLT" in "ACE_TLT"` → `score_service.asset_to_category` still classifies as `BONDS/CASH` ✅
- `stress_service.TICKER_PROXY["ACE_TLT"]` exists (returns `"TLT"` for stress proxy) ✅
- `algo_service` Defensive Mode check: `"TLT" in holdings` substring-matches `"ACE_TLT"` ✅

### Migration 2 — `track_b_brazil_bond_name`

```sql
UPDATE assets
SET name = 'BNTNF 10 01/01/37 NTNF'
WHERE id = 14
  AND symbol = 'BRAZIL_BOND';
```

Symbol unchanged — only the `name` field is localised.

### Assets untouched

| id | code | symbol | Decision |
|---|---|---|---|
| 2 | 463300 | `CSI300` | Keep — history-only asset, no active holding |
| 4 | 453870 | `NIFTY` | Keep — no current holding |

### Tests

- Migration applies cleanly on C-track sqlite and D-track postgres.
- Post-migration: query assets for id=3 and id=14 and assert expected symbol/name values.
- Full pytest suite passes (232+ tests).

---

## Group B2 — Archive Backfill (Phase 3)

### Goal

Correct two known data anomalies in the pre-anchor transaction history that distort the archive equity curve.

### Prerequisites

- 2026-05-04 Track A verification passes (see `docs/superpowers/handoff/2026-05-04-track-a-verification.md`)
- User provides actual prices from Toss/broker for the items below

### Anomaly 1 — 2026-03-20 zero-price transactions

Five transactions have `price=0`, `total_amount=0`:

| id | type | asset | qty |
|---|---|---|---|
| 7 | BUY | KODEX_1X (was QQQ) | 34 |
| 8 | BUY | ACE_TLT (was TLT) | 24 |
| 9 | BUY | DBMF | 16.95 |
| 10 | BUY | MSTR | 2.88 |
| 11 | SELL | CSI300 | 137 |

Total missing value ≈ 8,640,000 KRW (Toss cost basis 19.63M − DB net BUY 10.99M).

**Migration — `track_b_backfill_20260320_prices`:**

```sql
UPDATE transactions
SET price = <P_n>, total_amount = <qty_n * P_n>
WHERE id = <n> AND price = 0;
```

Run once per transaction (or batch). `WHERE price = 0` is the idempotency guard.

**Data to be gathered before B2 session:** actual prices for ids 7–11 from the 2026-03-20 Toss transaction history. The zero-price anomaly is documented in the Track A brainstorm (production DB audit) — not in any migration file; it exists only in the live Supabase DB.

### Anomaly 2 — QQQ −2 share over-sell

- DB-derived holdings: 251 shares KODEX_1X
- Toss actual: 249 shares
- Cause: user accidentally sold 2 shares (confirmed in Track A brainstorm)

**Migration — `track_b_qqq_compensating_sell`:**

```sql
INSERT INTO transactions
  (date, asset_id, type, quantity, price, total_amount, account_type, note)
VALUES
  ('<actual_date>', 1, 'SELL', 2, <price>, <2 * price>, 'ISA',
   'operator-error-correction-v1');
```

**Data to be gathered before B2 session:** actual date and price of the over-sell from Toss.

The `note` field value `'operator-error-correction-v1'` serves as an audit trail marker. Migration version enforcement prevents re-runs.

### Post-backfill verification

After both migrations:
- Run `generate_portfolio_snapshots` (or wait for cron) and verify pre-anchor archive series updates.
- Verify manual-anchor row at 2026-04-25 is preserved (`source_version='manual-anchor-v1'`, `performance_value=100.0`).
- Query derived KODEX_1X holdings: should equal 249.

---

## Cross-cutting Concerns

### Naming convention reference

Full convention documented at `docs/architecture/asset-naming-convention.md`.
- `symbol`: semantic label (`KODEX_1X`, `ACE_TLT`, `MSTR`)
- `code`: entity ID for price lookup (KRX numeric for KR, ticker for US)
- `name`: human display string (Korean full name or English)

### Adding new KR ETF assets (operational note)

The `AddAssetModal` / `POST /api/transactions` flow auto-creates assets. For new KR ETFs:
1. Enter the 6-digit KRX code in the modal → asset created with `code=<KRX>`, `symbol=<KRX>`, `source="KR"`
2. Request a naming convention migration from the operator to set the human-readable `symbol` and `name`

This is intentional — naming convention symbols are applied deliberately, not inferred from user input.

### Cron safety (B2 only)

B2 backfill changes pre-anchor archive values. The anchor row at 2026-04-25 (`source_version='manual-anchor-v1'`) is protected by Track A's cron-skip logic. Verify anchor invariants after each B2 migration run.

---

## Out of Scope

- Track C: editable transactions UI (B2 corrections are one-time migrations)
- Track D: leverage-aware sleeve metrics (TIGER_2X 2× exposure modeling)
- AddAssetModal typeahead / dropdown (free-text input sufficient for current usage)
- `PRODUCT.md §4` prose QQQ reference (deferred from Track A, noted in `bc39014`)
