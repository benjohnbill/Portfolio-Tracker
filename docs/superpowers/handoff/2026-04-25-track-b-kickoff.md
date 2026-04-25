# Track B Kickoff Handoff

**From:** Track A — Portfolio Anchor (shipped 2026-04-25, 12 commits, 232/232 tests pass)
**To:** Track B — Archive Backfill + Naming Hygiene + Frontend Display Switch
**Created:** 2026-04-25 (post-Track A ship)
**Reason for handoff:** Track A session consumed substantial context; starting Track B in a fresh session.

---

## What Track A delivered (don't redo this)

**Spec / Plan / Decisions:**
- Spec: `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`
- Plan: `docs/superpowers/plans/2026-04-25-portfolio-anchor-track-a.md`
- Service-split deferred: `docs/superpowers/decisions/2026-04-25-service-layer-split-deferred.md`
- Deployment checklist: `docs/superpowers/handoff/2026-04-25-track-a-deployment.md`
- Post-deploy verification (run 2026-05-04 18:00 KT after rotation buy): `docs/superpowers/handoff/2026-05-04-track-a-verification.md`

**Track A commit chain (`d74a97a..8f193bc` on `main`):**
```
d74a97a  docs(specs): portfolio anchor & naming convention design
46ff756  docs(plans): track A implementation plan
a3a034c  docs(track-a): asset naming convention + PRODUCT sleeve corrections
aaffc69  feat(track-a): asset migration — KODEX_1X rename + TIGER_2X onboard
f8d4838  refactor(track-a): infer_account_silo uses code only, drop symbol fallback
3b4c889  refactor(track-a): stress_service.TICKER_PROXY re-keyed for new convention
8b8ad28  feat(track-a): anchor rows at 2026-04-25 — archive + performance base
65dcfd0  feat(track-a): anchor-aware get_equity_curve + cron protection
a9c7df7  test(track-a): same-day swap is cashflow-neutral
b0d4663  test(track-a): algo_service NDX rotation regression coverage
bc39014  docs(track-a): flag portfolio_service.py split + cron prefix + comment
8f193bc  docs(track-a): production deployment checklist
```

**Locked decisions (don't relitigate):**
- Naming convention β + field separation: `symbol` = semantic label, `code` = entity ID, `name` = human display.
- Anchor at 2026-04-25 with values from Toss screenshots: archive total 21,353,133 KRW, performance base 100.0, source_version `manual-anchor-v1`.
- Pre-anchor performance series = `unavailable`. Anchor-aware `get_equity_curve` only emits performance from anchor forward.
- New asset: `TIGER_2X` / 418660 / `TIGER 미국나스닥100레버리지(합성)`.
- Asset id=1 migrated: `QQQ` → `KODEX_1X` with Korean name.

---

## Track B scope

Track B is the *naming hygiene + archive backfill + frontend display switch* track. Three logical groups:

### Group B1 — KR ETF naming hygiene (continue what Track A started)

Track A migrated only `id=1`. The remaining KR ETF assets still use placeholder symbols.

| Asset id | Code | Current symbol | Current name | Track B target symbol | Track B target name |
|---|---|---|---|---|---|
| 3 | 476760 | `TLT` | `ACE US 30Y Treasury Active` | `ACE_TLT` | `ACE 미국30년국채액티브` |
| 2 | 463300 | `CSI300` | `RISE China CSI300` | (keep `CSI300`, history-only) | (keep) |
| 4 | 453870 | `NIFTY` | `TIGER India Nifty50` | (keep `NIFTY`, no holding) | (keep) |
| 14 | BRAZIL_BOND | `BRAZIL_BOND` | `BRAZIL_BOND` (placeholder) | (keep symbol) | `BNTNF 10 01/01/37 NTNF` |

For id=3 (`ACE_TLT`):
- Migration writes `UPDATE assets SET symbol='ACE_TLT', name='ACE 미국30년국채액티브' WHERE id=3 AND symbol='TLT' AND code='476760'`.
- Verify `score_service.asset_to_category` substring matching still catches it (`"TLT" in "ACE_TLT"` → `BONDS/CASH` ✓).
- Verify `stress_service.TICKER_PROXY` already has `ACE_TLT` → `TLT` key (Track A T4 prepared this).
- No `algo_service` impact — `algo` checks `"TLT" in holdings` for Defensive Mode, which substring-matches `ACE_TLT` correctly.

For id=14 (`BRAZIL_BOND`): just localise the `name` field. The symbol is already semantic.

### Group B2 — Archive backfill (correctness of pre-anchor history)

Two known data anomalies in production transactions that distort the pre-anchor archive series:

**Anomaly 1: 2026-03-20 — 5 transactions with `price=0`, `total_amount=0`**
```
id=7   BUY  QQQ      qty=34       (KODEX_1X after T2)
id=8   BUY  TLT      qty=24       (ACE_TLT after Track B)
id=9   BUY  DBMF     qty=16.95
id=10  BUY  MSTR     qty=2.88
id=11  SELL CSI300   qty=137      (full liquidation)
```
Total missing value: ≈ **8,640,000 KRW** (derived: Toss matched cost basis 19.63M − DB net BUY 10.99M).

Source for backfill: ask user for the Toss/broker transaction history on 2026-03-20 to obtain actual prices. Migration must `UPDATE transactions SET price=..., total_amount=... WHERE id IN (7,8,9,10,11)`. Idempotency guard: `WHERE price = 0` predicate to skip if already filled.

**Anomaly 2: QQQ −2 share over-sell**
- DB-derived holdings: 251 shares
- Toss actual holdings: 249 shares
- User confirmed (Track A brainstorming): "QQQ 두 개를 실수로 팔아버린 게 맞아"

Resolution: insert a compensating SELL transaction. Date should match the actual sale date (ask user). Migration writes:
```sql
INSERT INTO transactions (date, asset_id, type, quantity, price, total_amount, account_type)
VALUES ('<actual_date>', 1, 'SELL', 2, <price>, <2*price>, 'ISA')
```
This is *not* idempotent in the same way as Track A migrations — needs a sentinel field or comment to mark it as "operator-error correction" so it's not re-applied. Suggest adding an `import_source` or similar marker column, or use a journalled note.

### Group B3 — Frontend display switch

Currently the frontend uses `asset.symbol` as the primary visible identifier in:
- `frontend/src/components/features/portfolio/AssetAllocationSection.tsx:62` (`{asset.asset}` bold + `{asset.name}` muted)
- `frontend/src/app/friday/archive/page.tsx:181-182` (raw `{item.symbol}` in shift display)
- `frontend/src/components/features/AddAssetModal.tsx` (user-input symbol)

After Track A's KODEX_1X / TIGER_2X labels became real symbols, end-users now see those code-internal labels. Track B must:
1. Switch primary display to `asset.name` (Korean full names).
2. Decide AddAssetModal input UX (text input? typeahead? dropdown?). Currently free-text symbol entry.
3. Update `friday/archive/page.tsx` to show `name` instead of raw symbol in sleeve-shift descriptions.

### Group B4 — Service code residue (low priority, opportunistic cleanup)

From Track A's final review:
1. `score_service.asset_to_category` line 23 has a leftover `"QQQ"` token in the NDX match list — dead weight after T2 migration. Remove during Track B.
2. `quant_service.py:304,364` uses `"QQQ"` as a Yahoo Finance ticker for NDX index history. This is intentional (price-feed lookup, not asset symbol) but undocumented. Add a one-line comment distinguishing it from the renamed asset symbol.
3. Pre-Track A tests (`test_cashflow_consumer_rebinding.py`, `test_friday_service.py`, `test_api.py`, etc.) seed `WeeklyDecision.asset_ticker="QQQ"`. This is a free-text journalling field, not an asset FK, so the seeds are semantically correct. Update opportunistically for consistency once Track B's display switch lands.

---

## Track B suggested workflow

The work above is wide but each group is internally focused. Recommendation:

**Phase 1: brainstorm**
Use `superpowers:brainstorming` to:
- Confirm Track B scope (B1+B2+B3 must ship together, or can ship separately?)
- Decide editing infrastructure: does B2 need PUT/DELETE endpoints (would defer to Track C), or are migrations enough for one-time corrections?
- Decide AddAssetModal UX in B3 (text input minimal? typeahead with KR ETF index? deferred to Track D?)
- Backfill data sourcing: ask user for 2026-03-20 prices and the QQQ over-sell date

**Phase 2: spec**
Single Track B spec, with Group B1/B2/B3 as sections. Group B4 as appendix.

**Phase 3: plan + execute**
Same TDD-per-task discipline as Track A. Use `superpowers:subagent-driven-development` for execution.

**Estimated effort:** Track B is larger than Track A in line count but lower in risk — most changes are mechanical migrations and frontend display swaps.

---

## Timing & deploy sequencing

**Track B work can start immediately** (today or tomorrow). The dependency on Track A is purely about *production deploy timing*, not about when Track B code can be written / tested / committed.

| Track B group | Code + test (C-track sqlite) | Production deploy timing |
|---|---|---|
| B1 — KR ETF naming hygiene (id=3 ACE_TLT, id=14 BRAZIL_BOND name) | ✅ Start anytime | After Track A production migrations (`8e08d095c59e`, `393b0d9c9ffd`) are applied — needs the alembic chain in place |
| B2 — Archive backfill (2026-03-20 + QQQ −2 share) | ✅ Start anytime | After 2026-05-04 verification passes — backfill triggers cron archive recompute, and Track A's cron-protection invariants must be production-stable first |
| B3 — Frontend display switch (`asset.symbol` → `asset.name`) | ✅ Start anytime | ✅ Deploy anytime (independent of Track A) |
| B4 — Service code residue (score_service `"QQQ"` token, quant_service comment) | ✅ Start anytime | ✅ Deploy anytime (independent of Track A) |

### Recommended timeline

```
2026-04-26 ~ 04-30   Track A production deploy + Track B brainstorm/spec/plan/code in parallel
2026-05-01 (Fri)     User executes NDX rotation buy (BUY TIGER_2X / SELL KODEX_1X)
2026-05-04 (Mon) 18:00 KT   Run docs/superpowers/handoff/2026-05-04-track-a-verification.md
2026-05-04 verification passes   Track B B1+B2 deploy unlocked
2026-05-05 onwards   Track B production deploy (B1+B2 first, then sweep B3+B4)
```

### Critical sequencing constraint

Track A production deploy MUST happen **before 2026-05-01** so that the rotation-buy transactions enter the system through the anchor-aware path. If Track A is still on `main` only (not deployed) at 5/1, the buy will be processed by the legacy `explicit_cashflows` branch, which lacks the manual-anchor base — performance series initialisation will be wrong. See `docs/superpowers/handoff/2026-04-25-track-a-deployment.md` for the deploy steps.

## Cross-track dependencies and gotchas

**Track B should NOT redo:**
- Naming convention rule (locked in Track A; documented at `docs/architecture/asset-naming-convention.md`)
- Anchor row insertion (Track A T5)
- Anchor-aware `get_equity_curve` logic (Track A T6)
- TICKER_PROXY re-keying for the 3 KR ETF assets (Track A T4 already added `ACE_TLT` key — only need to ensure id=3 actually carries that symbol after Group B1)

**Track B impacts on production cron:**
- B2 backfill changes pre-anchor archive values → `generate_portfolio_snapshots` will recompute pre-anchor archive on next run. This is expected and desired.
- Anchor row at 2026-04-25 must remain protected (`source_version='manual-anchor-v1'`). The cron-protection logic from Track A T6 handles this, but verify after each B2 migration that the anchor invariants still hold (run the queries in `docs/superpowers/handoff/2026-04-25-track-a-deployment.md`).

**Track C (editable transactions infrastructure) overlap:**
- B2 corrections could be done as one-time migrations (Track B) OR via a UI (Track C).
- Recommendation: do B2 as migrations now (faster, traceable in alembic history). Track C builds the general-purpose UI later.

**Track D (leverage-aware sleeve metrics) is independent of Track B.** Can ship in parallel.

---

## Production state at handoff

- Repo: `/home/lg/dev/Portfolio_Tracker`
- Branch: `main` (12 Track A commits ahead of origin/main)
- Backend venv: `backend/.venv`
- Tests: 232 pass on C-track sqlite (`cd backend && .venv/bin/pytest tests/ -q`)
- AGENTS.md: **modified but unstaged** (project policy — `claude-mem-context` block auto-injected, never stage)
- Production Supabase: Track A migrations *not yet applied* — see deployment checklist before next Friday's rotation buy.

## Next-session entry instructions

The accompanying short-prompt at the bottom of this document is what the user will paste into the next Claude session. The new session should:
1. Read this handoff document.
2. Invoke `superpowers:brainstorming` to scope Track B.
3. Follow the Track A pattern (brainstorm → spec → plan → subagent-driven execution) for consistency.
