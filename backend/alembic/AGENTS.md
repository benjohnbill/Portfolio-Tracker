<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# alembic

## Purpose
Database migration environment. Manages schema evolution for the PostgreSQL database (and legacy SQLite).

## Key Files

| File | Description |
|------|-------------|
| `env.py` | Migration environment config — loads `.env`, configures SQLAlchemy engine and migration context |
| `script.py.mako` | Mako template for generating new migration file boilerplate |
| `README` | Alembic placeholder documentation |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `versions/` | Individual migration scripts in chronological order (see `versions/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `env.py` loads environment via `load_backend_env()` from `app/env_loader.py`
- New migrations: `cd backend && alembic revision --autogenerate -m "description"`
- Apply migrations: `cd backend && alembic upgrade head`
- Always verify migration compatibility with `app/models.py`
- Never add request-time DDL — schema changes go through Alembic only

### Testing Requirements
- After creating a migration, verify it applies cleanly: `alembic upgrade head`
- Check downgrade path exists and works

<!-- MANUAL: -->
