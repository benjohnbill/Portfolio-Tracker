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
