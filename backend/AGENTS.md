<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# backend

## Purpose
FastAPI backend for the Portfolio Tracker. Contains the API layer, business logic services, database models/migrations, operational scripts, and test suite.

## Key Files

| File | Description |
|------|-------------|
| `requirements.txt` | Python dependencies (FastAPI, SQLAlchemy, yfinance, pandas, alembic, openai, etc.) |
| `alembic.ini` | Alembic migration configuration |
| `.env.example` | Environment variable template (credentials, API keys, DATABASE_URL) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `app/` | Core application: FastAPI routes, models, services (see `app/AGENTS.md`) |
| `alembic/` | Database migration environment and version scripts (see `alembic/AGENTS.md`) |
| `data/` | Local SQLite databases and CSV templates (see `data/AGENTS.md`) |
| `scripts/` | One-off operational helpers for setup and imports (see `scripts/AGENTS.md`) |
| `tests/` | Unit and integration tests (see `tests/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Runtime entry: `cd backend && uvicorn app.main:app --reload`
- Dependencies: `pip install -r requirements.txt`
- `.env` is local-only; never commit it. Use `.env.example` as reference.
- Root-level `test_*.py` and `inspect_*.py` files are ad-hoc operator scripts, not part of the formal test suite.

### Testing Requirements
- Formal tests live in `tests/`; run with `cd backend && .venv/bin/python -m pytest tests -q`
- Root-level test scripts are manual verification helpers, not CI targets

### Common Patterns
- Business logic belongs in `app/services/`, not in route handlers
- Schema changes require Alembic migrations
- `DATABASE_URL` must be set before the app starts

## Dependencies

### External
- FastAPI + Uvicorn (web framework)
- SQLAlchemy + Alembic (ORM + migrations)
- yfinance + FinanceDataReader (market data)
- pandas (data processing)
- OpenAI + Google GenAI (LLM summaries)

<!-- MANUAL: -->
