<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# maestro

## Purpose
PostgreSQL migration planning and historical state snapshots from the maestro orchestration phase.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `plans/` | PostgreSQL migration design and implementation plans (2026-03-21) |
| `state/` | Historical state snapshots for workstreams (algo-engine, dashboard, ELT, PG migration, quant pipeline) |

## For AI Agents

### Working In This Directory
- Migration plans document the SQLite → PostgreSQL transition decisions
- State snapshots are point-in-time records from 2026-03-21 — treat as historical context
- For current migration status, check Alembic versions and `backend/app/models.py`

<!-- MANUAL: -->
