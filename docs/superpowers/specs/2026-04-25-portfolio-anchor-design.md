# Portfolio Anchor & Naming Convention Design

**Date:** 2026-04-25
**Status:** Approved (Track A locked)
**Scope:** Track A — Anchor + Forward Processing + Leverage NDX Onboarding
**Out of scope:** Tracks B/C/D (deferred to separate specs)

---

## 1. Problem Statement

The portfolio tracker has accumulated a structural data-quality problem: the production database holds 12 BUY/SELL transactions but zero DEPOSIT/WITHDRAW rows. Without explicit cashflow events, the cashflow-neutral performance series (`portfolio_performance_snapshots`) reports `unavailable` for every date, and the archive series (`portfolio_snapshots`) carries placeholder `invested_capital=0` and `cash_balance=0` for all 492 rows.

Independently, the `assets` table uses placeholder symbols that borrow underlying US tickers for KR-listed ETFs (e.g., `id=1` is the Korean KODEX 미국나스닥100 with `code=379810` but `symbol="QQQ"`). This naming convention was adopted as a temporary shortcut when ISA-account ETF names were too verbose, and it now collides with the algorithm code that expects semantic labels (e.g., `algo_service.py` matches `"KODEX_1X" in holdings`, which never fires against the current `"QQQ"` symbol — a silent bug suppressing NDX rotation recommendations).

A new trading regime starts next Friday: the user will begin actively executing the NDX 250-day MA rotation by buying TIGER 미국나스닥100레버리지(합성) (KR code 418660). For this transaction to be processed correctly as a cashflow-neutral asset rotation rather than as an unrecognised external deposit, the system needs a verified anchor point with accurate holdings, cash balance, and naming.

## 2. Goals

1. Establish a verified anchor row at 2026-04-25 capturing total wealth, holdings composition, and cash balance, sourced from the user's brokerage app (Toss).
2. Begin a forward-only `portfolio_performance_snapshots` series from the anchor date using a Time-Weighted Return (TWR) algorithm.
3. Define and document a stable asset naming convention separating semantic label, entity code, and human-readable name across three fields.
4. Onboard the new TIGER_2X asset (code 418660) so that next Friday's purchase enters the system as a tracked holding.
5. Correct the silent bug in `algo_service.py` where NDX rotation recommendations fail to fire because the existing KODEX 1× asset uses placeholder symbol `"QQQ"`.

## 3. Non-Goals

- Reconstructing accurate archive history before the anchor date. Pre-anchor archive is rendered as an interpolated estimate from existing BUY/SELL transactions, with a visual "estimated region" treatment. Pre-anchor performance is explicitly `unavailable`.
- Backfilling missing transaction prices (notably the 5 transactions on 2026-03-20 with `price=0`). Deferred to Track B.
- Adding PUT/DELETE endpoints for transaction editing or an audit log. Deferred to Track C.
- Modifying sleeve weight calculation to apply leverage multipliers (e.g., `TIGER_2X × 2 = effective NDX exposure`). Deferred to Track D.
- Renaming all KR ETF assets across the table. Track A migrates only `id=1` (KODEX_1X); the remaining KR ETF rename pass is in Track B.
- Frontend display refactor (switching primary identifier from `asset.symbol` to `asset.name`). Deferred to Track B.

## 4. Phase 0 Reconciliation Findings

A read-only audit of the production Supabase database against the user's Toss screenshots (captured 2026-04-25 19:53 KT) produced the following:

### Holdings reconciliation

| Toss display | DB asset id | Symbol (current) | Code | Source | DB qty | Toss qty | Match |
|---|---|---|---|---|---|---|---|
| KODEX 미국나스닥100 (249주) | 1 | QQQ | 379810 | KR | 251 | 249 | **−2 mismatch** |
| ACE 미국30년국채액티브 (202주) | 3 | TLT | 476760 | KR | 202 | 202 | match |
| DBMF (133.951716주) | 6 | DBMF | DBMF | US | 133.951716 | 133.951716 | match |
| 스트래티지 (9.839654주) | 8 | MSTR | MSTR | US | 9.839654 | 9.839654 | match |
| GLDM (15주) | 7 | GLDM | GLDM | US | 15 | 15 | match |
| BNTNF | 14 | BRAZIL_BOND | BRAZIL_BOND | US | 1 | 1 (implied) | match |

Total holdings value: 21,253,002 KRW (Toss).
Cash balance: 100,131 KRW (KRW 71,911 + USD 19.06 = 28,220 KRW at current FX).
Total anchor wealth: **21,353,133 KRW**.

### Resolved anomalies

1. **QQQ −2 share mismatch (DB 251 vs Toss 249)**: confirmed by user as a stray over-sell of 2 shares (operator error, "한 해프닝"). Track B will record a compensating SELL of 2 shares dated to the actual sale date so DB-derived holdings reconcile to the Toss state. Anchor itself uses Toss quantity (249 shares) and is unaffected.

2. **2026-03-20 price=0 on 5 transactions** (id=7,8,9,10,11): historical input failure where prices were not captured at trade time. Approximate missing total: ~8.6M KRW based on (Toss-implied cost basis 19.63M − DB net BUY 10.99M). Backfill deferred to Track B; not a blocker for Track A because the anchor uses present-day Toss values, not derived archive history.

3. **Asset symbol naming drift**: confirmed as a legacy convention. Track A migrates `id=1` only; the rest is Track B.

## 5. Architecture

### 5.1 Two-series separation (already established by prior PRD)

```
Archive series (portfolio_snapshots)
  - Absolute wealth time series, cashflow-inclusive
  - Tolerant to estimation; visual continuity is the priority
  - Field: total_value, invested_capital, cash_balance

Performance series (portfolio_performance_snapshots)
  - Cashflow-neutral relative-return time series (TWR)
  - Requires accurate cashflow logging; intolerant to gaps
  - Field: performance_value, benchmark_value, daily_return, alpha,
    coverage_start_date, coverage_status, source_version
```

### 5.2 Anchor concept

The anchor is a single date (2026-04-25) at which both series are pinned to known values, with the performance base set to 100.0. From the anchor forward:

- **Performance**: deterministically computable via TWR using complete cashflow logs.
- **Archive**: deterministically computable from previous-day total + cashflow + price changes.

Before the anchor:

- **Performance**: explicitly `unavailable`. Series starts at 2026-04-25.
- **Archive**: estimated from existing BUY/SELL transaction events with visual "estimated region" treatment. No interpolated performance values.

### 5.3 Visual model

```
                  estimated initial    anchor (2026-04-25)            today
Archive:          - - - - - - - - - ─────────────────────────────────
                  (greyed dashed,         (solid line, daily snapshot
                   reconstructed from     from cashflow + price)
                   12 transactions)

Performance:                            ▎ ───────────────────────────
                  "Series starts here"      (solid line, TWR with full
                                             cashflow logging)
```

The two series have different time-axis lengths in the anchor era. This is intentional — performance is a metric whose definition requires accurate cashflow data, and synthesising it across the pre-anchor gap would constitute false precision.

### 5.4 TWR algorithm (forward path)

For each day `t` after the anchor:

1. Collect cashflow events on day `t`: `transactions WHERE date = t AND type IN (DEPOSIT, WITHDRAW)`.
2. Split day `t` into sub-periods at each cashflow boundary.
3. For each sub-period, compute `(end_value / start_value)` where the cashflow is excluded from both numerator and denominator.
4. Chain-multiply sub-period ratios to get day `t`'s return ratio.
5. `performance_value[t] = performance_value[t-1] × ratio`.

Same-day swap transactions (BUY + SELL on the same date with no DEPOSIT/WITHDRAW) produce a single sub-period whose ratio reflects only price movement — the swap itself is internal asset rotation and contributes no cashflow.

## 6. Data Model Changes

### 6.1 New asset row

```python
Asset(
    symbol="TIGER_2X",
    code="418660",
    name="TIGER 미국나스닥100레버리지(합성)",
    source="KR",
    account_type=AccountType.ISA,
    account_silo=AccountSilo.ISA_ETF,
)
```

### 6.2 Asset id=1 migration

```
BEFORE  symbol="QQQ"        name="KODEX Nasdaq100 TR"
AFTER   symbol="KODEX_1X"   name="KODEX 미국나스닥100"
        (code, source, account_type, account_silo unchanged)
```

### 6.3 Anchor rows

**Archive anchor** — `portfolio_snapshots[2026-04-25]`:

```
date              = 2026-04-25
total_value       = 21353133
invested_capital  = 21253002
cash_balance      = 100131
```

**Performance anchor** — `portfolio_performance_snapshots[2026-04-25]`:

```
date                  = 2026-04-25
performance_value     = 100.0
benchmark_value       = 100.0
daily_return          = 0.0
alpha                 = 0.0
coverage_start_date   = 2026-04-25
coverage_status       = "ready"
source_version        = "manual-anchor-v1"
```

### 6.4 Cash balance representation

Use the existing `PortfolioSnapshot.cash_balance` field, storing a single KRW total (USD positions converted at the snapshot-date FX rate). Per-currency breakdown (`cash_balance_krw` / `cash_balance_usd`) is deferred to a later track.

## 7. Service Code Changes

### 7.1 `portfolio_service.infer_account_silo` simplification

```python
# BEFORE
asset.source == "KR" and (
    asset.code in PortfolioService.ISA_KR_CODES
    or asset.symbol in {"QQQ", "CSI300", "TLT", "NIFTY"}
)

# AFTER
asset.source == "KR" and asset.code in PortfolioService.ISA_KR_CODES
```

The symbol-based fallback set is removed. Entity identity is the responsibility of `code`.

### 7.2 `ISA_KR_CODES` extension

```python
ISA_KR_CODES = {"379810", "418660", "463300", "476760", "453870"}
```

### 7.3 `stress_service.TICKER_PROXY` re-keyed

```python
TICKER_PROXY = {
    'KODEX_1X':    'QQQ',   # was: 'QQQ': 'QQQ'
    'TIGER_2X':    'QLD',   # NEW (US 2× NDX historical proxy)
    'ACE_TLT':     'TLT',   # was: 'TLT': 'TLT'
    'CSI300':      'ASHR',
    'NIFTY':       'INDA',
    'MSTR':        'MSTR',
    'DBMF':        'DBMF',
    'GLDM':        'GLD',
    'BIL':         'BIL',
    'PFIX':        'PFIX',
    'VBIL':        'BND',
    'SPY':         'SPY',
}
```

The leverage multiplier for TIGER_2X-as-2× NDX is **not** applied here. This table maps current holdings to historical proxy tickers for stress replay; leverage exposure modeling is a Track D concern.

### 7.4 TWR algorithm entry point

The forward TWR computation lives inside `portfolio_service.py` alongside the existing daily snapshot generator. The expected shape is a function that, given a target date `t`, reads transactions and prices for `[t-1, t]`, performs the sub-period split, and writes the resulting `performance_value` row. The exact function signature, integration with the cron job, and idempotency semantics are deferred to the implementation plan.

### 7.5 No-change services (verified compatible)

- `score_service.asset_to_category`: substring OR matching already includes `"TIGER"` and `"KODEX_1X"` tokens, and `"TLT"` substring-matches `"ACE_TLT"`. No edits needed.
- `algo_service`: holdings matching against `"KODEX_1X"` and `"TIGER_2X"` becomes correct as a side effect of the asset migration (silent NDX rotation bug auto-fixes).
- `quant_service`, `attribution_service`, `briefing_service`, `report_service`: do not match against asset.symbol; unaffected.

## 8. Naming Convention (formalised)

**Field separation rule:**

| Field | Purpose | Example values |
|---|---|---|
| `asset.symbol` | In-code semantic label, used by services for category and signal matching | `KODEX_1X`, `TIGER_2X`, `ACE_TLT`, `MSTR`, `DBMF`, `GLDM`, `BRAZIL_BOND` |
| `asset.code` | Entity unique identifier, used for DB integrity and price-feed lookup | `379810`, `418660`, `476760`, `MSTR`, `DBMF`, `GLDM`, `BRAZIL_BOND` |
| `asset.name` | Human-facing full name (Korean for KR-listed, native for foreign), used for frontend display | `KODEX 미국나스닥100`, `TIGER 미국나스닥100레버리지(합성)`, `ACE 미국30년국채액티브` |

**Selection rationale:**

The semantic-label convention was selected over alternatives:

- **Code-first (e.g., `symbol="418660"`)**: rejected because it breaks `algo_service` and `score_service` substring matching, which depend on labels like `TIGER` and `KODEX_1X`.
- **US ticker borrowing (e.g., `symbol="QLD"` for KR 418660)**: rejected because it perpetuates KR-US collisions (the TLT / TLT_US workaround pattern is evidence of how this fails).

The semantic label convention aligns with existing service code that treats `KODEX_1X` and `TIGER_2X` as labels, with PRODUCT.md §6/§7 sleeve tables, and with the entity-vs-display field separation pattern.

A new file `docs/architecture/asset-naming-convention.md` will be created (within Track A) documenting this rule with examples and a decision matrix for future asset additions.

## 9. PRODUCT.md Corrections

```diff
## 6. Asset Categories (Sleeves)

| Sleeve | Target Weight | Constituent Assets |
|---|---|---|
- | NDX | 30% | QQQ, TIGER_2X (379810), KODEX_1X |
+ | NDX | 30% | KODEX_1X (379810), TIGER_2X (418660) |
| DBMF | 30% | DBMF |
| BRAZIL | 10% | BRAZIL_BOND |
| MSTR | 10% | MSTR |
| GLDM | 10% | GLDM, GLD |
- | BONDS/CASH | 10% | TLT, BIL, VBIL, IEF |
+ | BONDS/CASH | 10% | ACE_TLT (476760), BIL, VBIL, IEF |

## 7. Account Structure

| Account Silo | Description | Examples |
|---|---|---|
- | ISA (ISA_ETF) | ... | TIGER_2X (379810), KODEX_1X (463300), TLT proxy (476760) |
+ | ISA (ISA_ETF) | ... | KODEX_1X (379810), TIGER_2X (418660), ACE_TLT (476760) |
```

(Note: 463300 is RISE China CSI300 in the actual database, not KODEX_1X; the prior §7 example was incorrect on multiple codes.)

## 10. Testing

### 10.1 Anchor invariants

- `portfolio_snapshots[2026-04-25].total_value == 21353133`
- `portfolio_snapshots[2026-04-25].invested_capital == 21253002`
- `portfolio_snapshots[2026-04-25].cash_balance == 100131`
- `portfolio_performance_snapshots[2026-04-25].performance_value == 100.0`
- `portfolio_performance_snapshots[2026-04-25].coverage_status == "ready"`
- `portfolio_performance_snapshots[2026-04-25].source_version == "manual-anchor-v1"`

### 10.2 Same-day swap is cashflow-neutral

`test_same_day_swap_is_cashflow_neutral`:

- Anchor row at D-1 with `performance_value = 100.0`.
- On day D: BUY TIGER_2X 100 shares at price `p_T` and SELL KODEX_1X 50 shares at price `p_K` simultaneously, with no DEPOSIT/WITHDRAW.
- Assert: `performance_value[D] / performance_value[D-1]` equals the holdings-weighted price-change ratio for day D, with no sub-period split applied.

### 10.3 Asset migration

- After migration, `Asset(id=1).symbol == "KODEX_1X"` and `Asset(id=1).name == "KODEX 미국나스닥100"`.
- New `Asset(symbol="TIGER_2X", code="418660")` exists with correct sleeve attributes.
- `score_service.asset_to_category("KODEX_1X") == "NDX"`.
- `score_service.asset_to_category("TIGER_2X") == "NDX"`.
- `score_service.asset_to_category("ACE_TLT") == "BONDS/CASH"` (forward compatibility check; only relevant once Track B renames id=3).

### 10.4 algo_service NDX rotation unblocked

- With holdings containing `"KODEX_1X"` and NDX > 250MA, `algo_service` Growth Mode signal fires (i.e., recommends `SELL KODEX_1X -> BUY TIGER_2X`).
- With holdings containing `"TIGER_2X"` and NDX < 250MA, Safety Mode signal fires.

### 10.5 `infer_account_silo` simplification regression check

- For each existing KR ETF asset (`code in ISA_KR_CODES`), `infer_account_silo` returns `ISA_ETF` regardless of symbol value.
- For BRAZIL_BOND asset, returns `BRAZIL_BOND`.
- For OVERSEAS_ETF assets (US source), returns `OVERSEAS_ETF`.

## 11. Risks and Caveats

### 11.1 Anchor truth depends on screenshot accuracy

The anchor values are sourced from a single Toss app screenshot pair captured at 2026-04-25 19:53 KT. KR market closed at 15:30 KT (4 hours prior); US-listed positions reflect the prior trading day's closing price; FX rate is moment-of-capture. The cumulative noise is small (sub-1% of total wealth) but the user should re-verify on Friday before anchor insertion.

### 11.2 KR ETF symbol migration ripple

Migrating `id=1` from `symbol="QQQ"` to `symbol="KODEX_1X"` may affect any service or query that joins on `Asset.symbol`. The audit in §7 verified no remaining matches require updates beyond `portfolio_service.infer_account_silo` and `stress_service.TICKER_PROXY`. The implementation plan should include a search-and-verify pass for any dynamically constructed `symbol` references not caught by static grep.

### 11.3 Performance series time-axis discontinuity

The archive series begins at the estimated initial date; the performance series begins at the anchor date. UI components that display both series side by side will show different x-axis lengths. Frontend treatment ("Performance series starts: 2026-04-25" label, greyed pre-anchor archive) is part of the implementation plan but not part of this design's binding decisions.

### 11.4 Track B/C/D coupling

Track B's frontend display refactor (switching `asset.symbol` → `asset.name` as the primary visible identifier) is not part of Track A. Until Track B ships, the migrated `symbol="KODEX_1X"` may briefly become user-visible in some surfaces (e.g., `friday/archive/page.tsx`). This is acceptable as a short-lived intermediate state.

## 12. Track A Lock Table (Decisions)

| ID | Decision |
|---|---|
| L1 | Naming convention: β + field separation (symbol = semantic label, code = entity, name = display) |
| L2 | New asset: TIGER_2X / 418660 / TIGER 미국나스닥100레버리지(합성) / KR / ISA / ISA_ETF |
| L3 | Asset id=1 migration: symbol QQQ→KODEX_1X, name 한글화 |
| L4 | `infer_account_silo`: drop symbol fallback, code-only matching |
| L5 | `TICKER_PROXY`: re-key to KODEX_1X / TIGER_2X / ACE_TLT, add TIGER_2X→QLD entry |
| L6 | `ISA_KR_CODES`: add 418660 |
| L7 | Archive anchor row at 2026-04-25 with values from §6.3 |
| L8 | Performance anchor row at 2026-04-25 with values from §6.3, source_version = "manual-anchor-v1" |
| L9 | Cash representation: existing `PortfolioSnapshot.cash_balance` field, single KRW total |
| L10 | TWR entry point: inside `portfolio_service.py` daily snapshot generator |
| L11 | Same-day swap unit test: `test_same_day_swap_is_cashflow_neutral` |
| L12 | PRODUCT.md §6/§7 corrections per §9 above |

## 13. Out of Scope (Tracked separately)

### Track B — Archive backfill and naming hygiene
- Backfill 2026-03-20 5 transactions with actual prices.
- Record QQQ −2 share compensating SELL.
- Migrate remaining KR ETF assets to semantic-label convention (id=3 ACE_TLT, etc.).
- Korean-localise `id=14` BRAZIL_BOND name.
- Frontend primary identifier switch: `asset.symbol` → `asset.name`.

### Track C — Editable transactions infrastructure
- PUT and DELETE endpoints for transactions with Pydantic validation.
- `transaction_audit_log` table capturing edit history.
- Frontend admin UI for transaction CRUD.

### Track D — Leverage-aware sleeve metrics
- Effective NDX exposure: `(KODEX_1X × 1) + (TIGER_2X × 2)`.
- Apply multiplier in `score_service` sleeve weight calculation.
- Stress test and Sleep Score handling of leveraged composition.

## 14. References

- PRODUCT.md §3 (Core Loop), §5 (Scoring Model), §6 (Asset Categories), §7 (Account Structure)
- `backend/app/models.py` (`PortfolioSnapshot`, `PortfolioPerformanceSnapshot`, `Asset`, `Transaction`)
- `backend/app/services/portfolio_service.py` (`infer_account_silo`, `ISA_KR_CODES`, snapshot generator)
- `backend/app/services/algo_service.py` (NDX 250MA rotation logic)
- `backend/app/services/score_service.py` (`asset_to_category`)
- `backend/app/services/stress_service.py` (`TICKER_PROXY`)
- Phase 0 reconciliation audit (read-only Supabase query, 2026-04-25)
- Toss app screenshots (2026-04-25 19:53 KT)
