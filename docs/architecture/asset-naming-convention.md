# Asset Naming Convention

**Status:** Active (updated 2026-04-28 — added price-feed lookup, signal-only asset table, and `asset_to_category` bare-name contract; 2026-04-26 — B1 NDX symbol revision; originally locked 2026-04-25, see `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`)

## Rule

The `assets` table uses three fields with disjoint roles:

| Field | Role | Example values |
|---|---|---|
| `asset.symbol` | In-code semantic label, used by services for category and signal matching | `NDX_1X`, `NDX_2X`, `ACE_TLT`, `MSTR`, `DBMF`, `GLDM`, `BRAZIL_BOND` |
| `asset.code` | Entity unique identifier, used for DB integrity and price-feed lookup | `379810`, `418660`, `476760`, `MSTR`, `DBMF`, `GLDM`, `BRAZIL_BOND` |
| `asset.name` | Human-facing full name (Korean for KR-listed, native for foreign), used for frontend display | `KODEX 미국나스닥100`, `TIGER 미국나스닥100레버리지(합성)`, `ACE 미국30년국채액티브` |

## Convention: `{INDEX}_{MULTIPLIER}`

Symbols follow the pattern `{INDEX}_{MULTIPLIER}`, where:

- `INDEX` is the underlying index or asset class (e.g., `NDX` for NASDAQ-100)
- `MULTIPLIER` is the leverage factor (e.g., `1X`, `2X`)

This replaces the earlier `{ISSUER}_{LEVERAGE}` convention (e.g., `KODEX_1X`, `TIGER_2X`) which was revised in Track B. Issuer brand (KODEX, TIGER) is replaced by underlying index (NDX) — portfolio management semantics, not issuer identity.

**Exception:** `ACE_TLT` uses the `{ISSUER}_{PROXY}` form — a legacy pattern for bond ETFs where no leverage is involved. `ACE` is the issuer brand; `TLT` is the US proxy ticker for duration matching.

## Rationale

The semantic-label convention was selected over alternatives:

- **Code-first** (`symbol="418660"`): rejected because `algo_service` and `score_service` substring matching depend on labels like `NDX_`. A pure-code symbol would silently break category resolution.
- **US ticker borrowing** (`symbol="QLD"` for KR 418660): rejected because it perpetuates KR-US collisions. The existing `TLT` / `TLT_US` workaround pattern is evidence of how this fails.

The semantic label aligns with `algo_service.py` (`"NDX_1X" in holdings`), `score_service.asset_to_category` (substring `"NDX_"` covers both `NDX_1X` and `NDX_2X`), and PRODUCT.md §6 sleeve tables.

## Price-feed lookup mechanism

`portfolio_service.get_price_lookup_ticker(asset)` resolves which ticker string to query against `raw_daily_prices.ticker`:

```python
return asset.code or asset.symbol
```

**Rules:**
- KR-listed ETFs: `code` is the 6-digit KRX code (e.g., `379810`, `418660`) — this is what Yahoo Finance and the daily cron store in `raw_daily_prices`.
- US-listed assets where `symbol ≠ ticker`: `code` holds the correct yfinance ticker (e.g., asset `symbol='TLT_US'`, `code='TLT'` → lookup uses `'TLT'`).
- Assets where symbol == ticker (e.g., `MSTR`, `GLDM`, `DBMF`): `code` and `symbol` are identical; either works.

**Critical invariant:** `raw_daily_prices.ticker` must always equal `asset.code` (or `asset.symbol` if code is null). If you add a new asset and price data isn't appearing, the mismatch is almost certainly here.

## Signal-only assets

Some assets live in the `assets` table solely to drive daily price-fetch cron — they have no portfolio transactions and carry zero allocation weight. The cron (`update_raw_prices`) iterates all rows in `assets` and fetches prices for each.

Current signal-only assets (as of 2026-04-28):

| symbol | code | Purpose |
|---|---|---|
| `QQQ` | `QQQ` | NDX price proxy for signal computation |
| `SPY` | `SPY` | Benchmark for TWR equity curve |
| `TLT_US` | `TLT` | US 20yr bond signal proxy |
| `BIL` | `BIL` | Cash equivalent (bonds defensive sleeve) |
| `VBIL` | `VBIL` | Cash equivalent (gold defensive sleeve) |
| `PFIX` | `PFIX` | Rate hedge signal |
| `TQQQ` | `TQQQ` | Stress test proxy |

**Do not remove signal-only assets** from the table even when they appear unused. Removing them stops daily price ingestion; stale prices silently break signal computation.

## `asset_to_category` bare-name contract

`algo_service` emits action items using bare sleeve labels (`"NDX"`, `"BONDS/CASH"`, `"BRAZIL"`) rather than full asset symbols. Both `score_service.asset_to_category` (Python) and frontend `assetToCategory` (TypeScript) must recognise these bare labels alongside the prefixed symbol forms.

**Rule:** For every sleeve category, add an exact-match guard (`s == "NDX"`) *before* any prefix/substring check. The prefix check alone (`"NDX_" in s`) misses bare labels.

```python
# Correct pattern:
if s == "NDX" or any(token in s for token in ["NDX_", "379810", "418660"]):
    return "NDX"

# Wrong — misses bare "NDX":
if any(token in s for token in ["NDX_", "379810", "418660"]):
    return "NDX"
```

The same applies to TypeScript `assetToCategory` in `TargetDeviationChart.tsx`.

## How to add a new asset

1. Pick a `symbol` that is a stable semantic label using `{INDEX}_{MULTIPLIER}` (e.g., `NDX_1X`, not `KODEX 미국나스닥100`). Prefer underscores over hyphens. ASCII-only.
2. Set `code` to the entity's authoritative identifier (KR 6-digit code for Korean ETFs, US ticker for US-listed, internal token like `BRAZIL_BOND` for non-public assets). **`code` must match the ticker stored in `raw_daily_prices`.**
3. Set `name` to the full human-readable name in the language of the listing market (Korean for KR-listed).
4. If the asset belongs to an existing sleeve, ensure `score_service.asset_to_category` substring matching catches it (and add the exact-match guard if the sleeve label is also emitted bare). If a new sleeve, add a token to the appropriate sleeve list in both Python and TypeScript.
5. If the asset participates in stress tests, add a key to `stress_service.TICKER_PROXY` mapping its semantic label to a US-listed historical proxy ticker.
6. If the asset is signal-only (no portfolio transactions), add it to the signal-only table above and verify the daily cron fetches its prices correctly.
7. After inserting, run the cron endpoint once to backfill recent prices, then verify `raw_daily_prices` has rows for the new `code`.

## Migration history

- 2026-04-25: Convention formalised. `id=1` migrated from `symbol="QQQ"` → `symbol="KODEX_1X"`. New asset `TIGER_2X` (code 418660) added. Remaining KR ETF rename pass deferred to Track B.
- 2026-04-26: B1 NDX symbol revision. `id=1` renamed `KODEX_1X` → `NDX_1X`; `id=5` renamed `TIGER_2X` → `NDX_2X`. Convention revised from `{ISSUER}_{LEVERAGE}` to `{INDEX}_{MULTIPLIER}`.
- 2026-04-28: Added price-feed lookup mechanism section (root cause of TLT_US/QQQ staleness bugs). Added signal-only asset table. Added `asset_to_category` bare-name contract (root cause of NDX recognition failures across backend and frontend). Fixed `ARCHITECTURE.md` algo rules table (TIGER_2X/KODEX_1X → NDX_2X/NDX_1X).
