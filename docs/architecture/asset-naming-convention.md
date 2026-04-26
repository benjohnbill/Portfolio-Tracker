# Asset Naming Convention

**Status:** Active (updated 2026-04-26 — B1 NDX symbol revision; originally locked 2026-04-25, see `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`)

## Rule

The `assets` table uses three fields with disjoint roles:

| Field | Role | Example values |
|---|---|---|
| `asset.symbol` | In-code semantic label, used by services for category and signal matching | `NDX_1X`, `NDX_2X`, `ACE_TLT`, `MSTR`, `DBMF`, `GLDM`, `BRAZIL_BOND` |
| `asset.code` | Entity unique identifier, used for DB integrity and price-feed lookup | `379810`, `418660`, `476760`, `MSTR`, `DBMF`, `GLDM`, `BRAZIL_BOND` |
| `asset.name` | Human-facing full name (Korean for KR-listed, native for foreign), used for frontend display | `KODEX 미국나스닥100`, `TIGER 미국나스닥100레버리지(합성)`, `ACE 미국30년국채액티브` |

## Convention: `{INDEX}_{MULTIPLIER}`

Symbols follow the pattern `{INDEX}_{MULTIPLIER}`, where:

- `INDEX` is the underlying index or asset class (e.g., `NDX` for NASDAQ-100, `ACE` for Korean ETF brand prefix)
- `MULTIPLIER` is the leverage factor (e.g., `1X`, `2X`)

This replaces the earlier `{ISSUER}_{LEVERAGE}` convention (e.g., `KODEX_1X`, `TIGER_2X`) which was revised in Track B. Issuer brand (KODEX, TIGER) is replaced by underlying index (NDX) — portfolio management semantics, not issuer identity.

## Rationale

The semantic-label convention was selected over alternatives:

- **Code-first** (`symbol="418660"`): rejected because `algo_service` and `score_service` substring matching depend on labels like `NDX_`. A pure-code symbol would silently break category resolution.
- **US ticker borrowing** (`symbol="QLD"` for KR 418660): rejected because it perpetuates KR-US collisions. The existing `TLT` / `TLT_US` workaround pattern is evidence of how this fails.

The semantic label aligns with `algo_service.py` (`"NDX_1X" in holdings`), `score_service.asset_to_category` (substring `"NDX_"` covers both `NDX_1X` and `NDX_2X`), and PRODUCT.md §6 sleeve tables.

## How to add a new asset

1. Pick a `symbol` that is a stable semantic label using `{INDEX}_{MULTIPLIER}` (e.g., `NDX_1X`, not `KODEX 미국나스닥100`). Prefer underscores over hyphens. ASCII-only.
2. Set `code` to the entity's authoritative identifier (KR 6-digit code for Korean ETFs, US ticker for US-listed, internal token like `BRAZIL_BOND` for non-public assets).
3. Set `name` to the full human-readable name in the language of the listing market (Korean for KR-listed).
4. If the asset belongs to an existing sleeve, ensure `score_service.asset_to_category` substring matching catches it. If not, add a token to the appropriate sleeve list.
5. If the asset participates in stress tests, add a key to `stress_service.TICKER_PROXY` mapping its semantic label to a US-listed historical proxy ticker.

## Migration history

- 2026-04-25: Convention formalised. `id=1` migrated from `symbol="QQQ"` → `symbol="KODEX_1X"`. New asset `TIGER_2X` (code 418660) added. Remaining KR ETF rename pass deferred to Track B.
- 2026-04-26: B1 NDX symbol revision. `id=1` renamed `KODEX_1X` → `NDX_1X`; `id=5` renamed `TIGER_2X` → `NDX_2X`. Convention revised from `{ISSUER}_{LEVERAGE}` to `{INDEX}_{MULTIPLIER}`.
