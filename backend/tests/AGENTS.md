<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# tests

## Purpose
Backend test suite — unit and integration tests for API endpoints and services.

## Key Files

| File | Description |
|------|-------------|
| `test_api.py` | FastAPI endpoint tests — root route, health check, portfolio history with mocks |
| `test_friday_service.py` | FridayService unit tests — snapshot creation, conflict detection, validation |
| `test_portfolio_service_fx_regression.py` | FX regression tests — USD/KRW conversion accuracy in PortfolioService |
| `test_report_service_fx.py` | ReportService FX tests — macro aggregation and report generation with mocked rates |

## For AI Agents

### Working In This Directory
- Run all: `cd backend && .venv/bin/python -m pytest tests -q`
- Run specific: `cd backend && .venv/bin/python -m pytest tests/test_friday_service.py -q`
- External APIs (KIS, yfinance, LLM) must be mocked in tests
- Report pre-existing failures separately from issues introduced by your edits
- Test coverage is sparse — when adding features, add corresponding tests

### Common Patterns
- Mock database sessions and external API calls
- Test both happy path and error conditions
- FX tests use fake exchange rate data to verify conversion accuracy

## Dependencies

### Internal
- `../app/services/` — services under test
- `../app/models.py` — SQLAlchemy models
- `../app/main.py` — FastAPI app instance for endpoint tests

<!-- MANUAL: -->

## Test Routing — C (sqlite) vs D (postgres)

*Established 2026-04-20. See `docs/superpowers/plans/2026-04-20-phase-d-test-infrastructure.md` and `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` (§Playwright MCP QA Progress log).*

### Default: C track (sqlite, in-memory)

- File location: `backend/tests/*.py` (top-level)
- Fixtures: `db_session`, `client` (from `backend/tests/conftest.py`)
- Seeds: `from tests.fixtures.seeds import seed_*`
- Run: `python -m pytest -q`  (fast, no Docker)

### Integration: D track (ephemeral postgres)

- File location: `backend/tests/integration/*.py`
- Fixtures: `pg_session`, `pg_client`, `pg_engine` (from `backend/tests/integration/conftest.py`)
- Seeds: same `tests.fixtures.seeds` module
- Run: `python -m pytest -m integration -q`  (requires Docker Desktop)
- **Every D test must carry `@pytest.mark.integration`.**

### Routing rule

Put a test in **D** (not C) if any of these apply:

1. Code under test imports `from sqlalchemy.dialects.postgresql import insert` (`ON CONFLICT ... DO UPDATE`). Current list: `ingestion_service.py`, `report_service.py`, `cache_service.py`, `quant_service.py`.
2. Test asserts on Alembic migration behavior (up / down / DDL shape).
3. Test covers the full freeze flow (`POST /api/v1/friday/snapshot` → `POST /api/v1/friday/decisions`) or any multi-table transaction that would need postgres isolation semantics.
4. Test uses a JSONB *query operator* (`->>`, `@>`, `jsonb_path_query`). As of 2026-04-20 no service code does; if that changes, the Revisit triggers in the scope-lock decision doc apply.

Otherwise default to C.

### Legacy `_FakeDB` tests

`test_api.py`, `test_friday_service.py`, `test_briefing_service.py`, `test_notification_service.py`, `test_discord_notifier.py`, `test_report_service_fx.py`, `test_portfolio_service_fx_regression.py` use hand-rolled `_FakeDB`/`_FakeQuery` objects. **Do not rewrite them in this phase.** They stay green against the new infrastructure because they never construct a SQLAlchemy engine.

### Scope marker

This split is **locked for the current Phase D scope** (features fed by macro / price / archive data only). `Revisit triggers` in `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` list the conditions that reopen this decision — notably, any service adopting JSONB query operators expands D's remit.
