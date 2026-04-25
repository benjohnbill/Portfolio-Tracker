# Track A Deployment Checklist (Production Supabase)

**Track:** A (Anchor + Forward Processing + Leverage NDX Onboarding)
**Spec:** `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`
**Plan:** `docs/superpowers/plans/2026-04-25-portfolio-anchor-track-a.md`
**Target deadline:** 2026-05-01 (next Friday's NDX rotation buy)

## Track A commits

```
a3a034c  docs(track-a): asset naming convention + PRODUCT sleeve corrections
aaffc69  feat(track-a): asset migration — KODEX_1X rename + TIGER_2X onboard
f8d4838  refactor(track-a): infer_account_silo uses code only, drop symbol fallback
3b4c889  refactor(track-a): stress_service.TICKER_PROXY re-keyed for new convention
8b8ad28  feat(track-a): anchor rows at 2026-04-25 — archive + performance base
65dcfd0  feat(track-a): anchor-aware get_equity_curve + cron protection
a9c7df7  test(track-a): same-day swap is cashflow-neutral
b0d4663  test(track-a): algo_service NDX rotation regression coverage
bc39014  docs(track-a): flag portfolio_service.py split + cron prefix + comment as follow-ups
```

Plus the deployment handoff (this document).

## Pre-deploy verification

- [ ] **Verify production Supabase has migration `d2c4f6a8b901_add_portfolio_performance_snapshots` applied.**
      Per project memory (audit 2026-04-23), this table did not exist on production. If still missing, apply
      it as a prerequisite — Track A's anchor row migration depends on the table existing.

      ```bash
      # Read-only check (does not commit):
      cd /home/lg/dev/Portfolio_Tracker/backend
      .venv/bin/python -c "
      from sqlalchemy import create_engine, text
      import os; from dotenv import load_dotenv
      load_dotenv('.env')
      e = create_engine(os.environ['DATABASE_URL'].replace('postgres://','postgresql://',1))
      with e.connect() as c:
          r = c.execute(text(\"SELECT to_regclass('portfolio_performance_snapshots')\")).scalar()
          print('Table exists:', r is not None)
      "
      ```

- [ ] **Capture production transactions and assets state** (read-only audit) and verify it matches the
      reconciliation snapshot in spec §4. If holdings drift since 2026-04-25 (e.g., user made an unscheduled
      trade), pause and re-verify anchor values against current Toss state.

- [ ] **Verify all Track A migrations ran clean on the C-track sqlite test DB** with the full pytest suite
      green:

      ```bash
      cd /home/lg/dev/Portfolio_Tracker/backend
      .venv/bin/pytest tests/ -q
      ```

      Expected: 232+ passed, 0 failures.

## Deploy steps (production Supabase)

- [ ] **Take Supabase backup** (or confirm point-in-time restore is enabled and recent).

- [ ] **Apply migrations against production:**

      ```bash
      cd /home/lg/dev/Portfolio_Tracker/backend
      DATABASE_URL='<PROD_DSN>' .venv/bin/alembic upgrade head
      ```

      Expected output includes the two Track A revision lines:
      - `8e08d095c59e` (track_a_asset_naming)
      - `393b0d9c9ffd` (track_a_anchor_rows)

- [ ] **Verify anchor invariants on production:**

      ```bash
      DATABASE_URL='<PROD_DSN>' .venv/bin/python -c "
      from sqlalchemy import create_engine, text
      import os
      e = create_engine(os.environ['DATABASE_URL'].replace('postgres://','postgresql://',1))
      with e.connect() as c:
          c.execute(text('BEGIN READ ONLY'))
          r = c.execute(text('SELECT * FROM portfolio_snapshots WHERE date = :d'), {'d':'2026-04-25'}).fetchone()
          print('Archive anchor:', dict(r._mapping) if r else 'MISSING')
          r = c.execute(text('SELECT * FROM portfolio_performance_snapshots WHERE date = :d'), {'d':'2026-04-25'}).fetchone()
          print('Performance anchor:', dict(r._mapping) if r else 'MISSING')
          r = c.execute(text(\"SELECT id, symbol, code, name FROM assets WHERE code = '418660' OR id = 1\")).fetchall()
          for row in r: print('Asset:', dict(row._mapping))
          c.execute(text('ROLLBACK'))
      "
      ```

      Expected:
      - Archive anchor: `total_value=21353133.0`, `invested_capital=21253002.0`, `cash_balance=100131.0`
      - Performance anchor: `performance_value=100.0`, `source_version='manual-anchor-v1'`
      - Asset id=1: `symbol='KODEX_1X'`, `name='KODEX 미국나스닥100'`
      - Asset code=418660: `symbol='TIGER_2X'`, `name='TIGER 미국나스닥100레버리지(합성)'`

- [ ] **Trigger one cron run of `generate_portfolio_snapshots`** (or wait for the scheduled run) and re-verify
      that the manual-anchor row is preserved (`source_version` still `'manual-anchor-v1'`,
      `performance_value` still `100.0`).

- [ ] **Verify NDX rotation algorithm now fires.** With KODEX_1X in production holdings and assuming NDX > 250MA,
      `algo_service.get_action_report()` should now emit a Growth Mode signal recommending
      `SELL KODEX_1X -> BUY TIGER_2X`. Hit the relevant API endpoint or invoke the service directly to confirm
      the signal appears in the action list.

## Post-deploy

- [ ] **Friday 2026-05-01 — record the rotation buy.** When the user executes the BUY TIGER_2X / SELL KODEX_1X
      transactions, enter them via the existing `POST /api/transactions` endpoint. Verify same-day after entry
      that `portfolio_performance_snapshots[2026-05-01]` has `performance_value` close to 100.0 (modulo intraday
      price movement) and `coverage_status='ready'`.

- [ ] **Update Track B backlog** with discovered residue:
      - QQQ −2 share compensating SELL still pending (operator over-sell from earlier session)
      - 2026-03-20 5 transactions price backfill still pending (~8.6M KRW total missing)
      - Asset id=3 (current symbol="TLT") rename to "ACE_TLT" still pending
      - Asset id=14 BRAZIL_BOND name localisation to "BNTNF 10 01/01/37 NTNF" still pending
      - Frontend display: switch `asset.symbol` → `asset.name` as primary identifier

- [ ] **Update Track C backlog** (editable transactions infrastructure) with the cron-skip generalisation flag
      from `docs/superpowers/decisions/2026-04-25-service-layer-split-deferred.md`. When Track C introduces a
      `manual-correction-v1` source_version, the cron skip in `ingestion_service.generate_portfolio_snapshots`
      must be expanded to a `manual-*` allowlist.

## Rollback

If the migration causes production issues:

```bash
DATABASE_URL='<PROD_DSN>' .venv/bin/alembic downgrade -2
```

This reverses both Track A migrations:
1. `393b0d9c9ffd` (anchor rows) — removes performance anchor row; archive row preserved (intentional, see
   migration docstring).
2. `8e08d095c59e` (asset naming) — reverts asset id=1 symbol back to "QQQ" and removes TIGER_2X.

After rollback, manually delete the leftover archive anchor row at 2026-04-25 if needed:

```sql
DELETE FROM portfolio_snapshots WHERE date = '2026-04-25';
```

(Only if it was inserted by the Track A migration and not by an earlier cron run — check `total_value` to
distinguish.)

## Known limitations

- **Pre-anchor history**: archive series before 2026-04-25 is reconstructed from BUY/SELL transactions alone
  and contains the 5 zero-priced rows from 2026-03-20 (~8.6M KRW understated). This is acknowledged in spec
  §11.3 and is a Track B backfill task. Performance series before 2026-04-25 is explicitly `unavailable`.
- **Currency separation**: anchor `cash_balance` is a single KRW total (KRW 71,911 + USD 19.06 converted at
  capture-time FX = 28,220 KRW). Per-currency breakdown is deferred to a later track.
- **Leverage exposure modeling**: TIGER_2X is treated as 1× exposure in current sleeve weight calculations.
  Effective NDX exposure (`KODEX_1X × 1 + TIGER_2X × 2`) modeling is Track D scope.
