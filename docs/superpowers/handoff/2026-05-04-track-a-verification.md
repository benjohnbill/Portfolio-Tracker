# Track A Post-Deploy Verification Prompt

**Run at:** 2026-05-04 (Monday) 18:00 KT — first trading day after 2026-05-01 NDX rotation buy.
**Trigger from user:** paste `Read docs/superpowers/handoff/2026-05-04-track-a-verification.md and execute it.` into Claude Code at that time.
**Refs:** `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`, `docs/superpowers/handoff/2026-04-25-track-a-deployment.md`.

---

## What you (Claude) are doing

The user shipped Track A on 2026-04-25 (anchor + naming convention + leverage NDX onboarding) and executed the planned NDX rotation buy on 2026-05-01 (BUY TIGER_2X / SELL KODEX_1X). By 18:00 KT today (2026-05-04, Monday), the daily ingestion cron has processed 5/4 prices and updated `portfolio_snapshots` and `portfolio_performance_snapshots`. Your job: verify all Track A invariants survived the first post-anchor cron run, and post the result to the production Discord webhook.

This is read-only verification. **Do not commit code or mutate the database.**

## Step 1 — Run six verification queries (read-only against production Supabase)

Use `DATABASE_URL` from `backend/.env`. Wrap all queries in a single `BEGIN READ ONLY` transaction; `ROLLBACK` at the end.

A self-contained Python script you can run from repo root:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/python <<'PY'
import os, sys, json
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("/home/lg/dev/Portfolio_Tracker/backend/.env")
dsn = os.environ["DATABASE_URL"]
if dsn.startswith("postgres://"):
    dsn = dsn.replace("postgres://", "postgresql://", 1)

engine = create_engine(dsn)
results = {}

with engine.connect() as conn:
    conn.execute(text("BEGIN READ ONLY"))

    # Q1: Anchor row preservation
    r = conn.execute(text("""
        SELECT date, performance_value, benchmark_value, source_version, coverage_status
        FROM portfolio_performance_snapshots WHERE date = '2026-04-25'
    """)).fetchone()
    results["q1_anchor"] = dict(r._mapping) if r else None

    # Q2: Rotation buy day — swap was cashflow-neutral
    r = conn.execute(text("""
        SELECT date, performance_value, benchmark_value, daily_return, alpha, coverage_status
        FROM portfolio_performance_snapshots WHERE date = '2026-05-01'
    """)).fetchone()
    results["q2_rotation_day"] = dict(r._mapping) if r else None

    # Q3: First post-rotation cron output (5/4)
    r = conn.execute(text("""
        SELECT date, performance_value, daily_return, source_version
        FROM portfolio_performance_snapshots WHERE date = '2026-05-04'
    """)).fetchone()
    results["q3_post_cron"] = dict(r._mapping) if r else None

    # Q4: Transaction log captured the swap
    rows = conn.execute(text("""
        SELECT t.id, t.date, t.type, a.symbol, t.quantity, t.total_amount
        FROM transactions t JOIN assets a ON a.id = t.asset_id
        WHERE t.date::date = '2026-05-01' AND a.symbol IN ('KODEX_1X', 'TIGER_2X')
        ORDER BY t.id
    """)).fetchall()
    results["q4_swap_transactions"] = [dict(r._mapping) for r in rows]

    # Q5: Holdings derivation includes both NDX assets
    rows = conn.execute(text("""
        SELECT a.symbol, SUM(CASE WHEN t.type='BUY' THEN t.quantity ELSE -t.quantity END) AS qty
        FROM transactions t JOIN assets a ON a.id = t.asset_id
        WHERE a.symbol IN ('KODEX_1X', 'TIGER_2X')
        GROUP BY a.symbol HAVING SUM(CASE WHEN t.type='BUY' THEN t.quantity ELSE -t.quantity END) > 0
    """)).fetchall()
    results["q5_holdings"] = [dict(r._mapping) for r in rows]

    # Q6: NDX sleeve allocation (snapshot-based; alternatively call /api/portfolio/allocation if backend is running)
    r = conn.execute(text("""
        SELECT date, total_value, invested_capital, cash_balance
        FROM portfolio_snapshots WHERE date = '2026-05-04'
    """)).fetchone()
    results["q6_archive_5_4"] = dict(r._mapping) if r else None

    conn.execute(text("ROLLBACK"))

print(json.dumps(results, default=str, indent=2))
PY
```

## Step 2 — Evaluate against PASS criteria

| Check | PASS criteria |
|---|---|
| Q1 anchor preserved | `source_version == 'manual-anchor-v1'`, `performance_value == 100.0` |
| Q2 rotation day | row exists, `coverage_status == 'ready'`, `performance_value` within ±5% of 100.0 (price movement only) |
| Q3 post-rotation cron | row exists, `source_version != 'manual-anchor-v1'` (cron-generated, distinct from protected anchor) |
| Q4 swap transactions | at least one `SELL KODEX_1X` and one `BUY TIGER_2X` on 2026-05-01 |
| Q5 holdings | both `KODEX_1X` and `TIGER_2X` have positive net quantity |
| Q6 archive 5/4 | row exists, `total_value` is consistent with current Toss state (sanity check, not strict equality) |

If all six PASS → invariants held. If any FAIL → at least one Track A guarantee broke; investigate.

## Step 3 — Post the result to Discord

Read `DISCORD_WEBHOOK_URL` from `backend/.env`. Post a single message via `curl` or `requests`:

**On all-pass:**
```
✅ Track A Post-Deploy Verification — 2026-05-04 18:00 KT
Anchor: preserved (source_version=manual-anchor-v1, performance_value=100.0)
Rotation 5/1: swap cashflow-neutral, performance_value=<X>
Cron 5/4: row generated, performance_value=<Y>, source_version=<Z>
Holdings: KODEX_1X qty=<a>, TIGER_2X qty=<b>
Archive 5/4: total_value=<W> KRW
All invariants held. Track A is production-stable.
```

**On any failure:**
```
🚨 Track A Post-Deploy Verification FAILED — 2026-05-04 18:00 KT
Failed checks: <list of Qn>
Details:
<relevant query outputs as JSON>
Recommended action: <e.g., "Anchor row was overwritten — investigate ingestion_service cron protection at line 152" or "rotation transactions missing — confirm user entered them via /api/transactions">
```

The webhook payload format is:
```bash
curl -H "Content-Type: application/json" -d '{"content": "<message>"}' "$DISCORD_WEBHOOK_URL"
```

## Step 4 — Final report

After posting to Discord, write a short (≤200 word) text summary back to the user covering:
1. Pass/fail count (6 checks)
2. Specific values that landed (anchor `performance_value`, rotation day `performance_value`, 5/4 archive `total_value`)
3. Any anomalies that warrant attention before next Friday's freeze ritual

If everything passed, suggest closing the loop:
- Mark Track A as "production-stable, monitoring complete" in the user's notes
- Offer to start Track B brainstorming (Track B kickoff: `docs/superpowers/handoff/2026-04-25-track-b-kickoff.md`)

If anything failed, do NOT auto-fix — escalate with the failed check details so the user can decide whether the bug is in Track A code or the production cron environment.

## Notes

- This is read-only verification; no `INSERT`/`UPDATE`/`DELETE` permitted.
- The script wraps in `BEGIN READ ONLY ... ROLLBACK` to enforce that at the DB layer.
- If `DATABASE_URL` is missing or malformed, halt and report to the user — do not invent a connection.
- If the Discord webhook returns non-2xx, retry once after 5 seconds; if still failing, log to stderr and continue (don't block the report-back).
