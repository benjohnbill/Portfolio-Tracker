# Testing Rules (Portfolio_Tracker)

Project test infrastructure: **C+D hybrid**. Generic TDD principles are not repeated here.

## Test infrastructure

| Track | DB | Default? | When to use |
|---|---|---|---|
| C-track | sqlite (in-memory) | ✅ default | Unit + most integration tests |
| D-track | docker postgres | on-demand | Migration tests, postgres-specific features (ON CONFLICT, JSONB ops) |

## Running tests

```bash
# Default — full suite, sqlite C-track
cd backend && .venv/bin/python -m pytest tests -q

# Friday-specific path (most-touched surface)
cd backend && .venv/bin/python -m pytest tests/test_friday_service.py -q

# Single test
cd backend && .venv/bin/python -m pytest tests/test_friday_service.py::test_name -q

# D-track (docker postgres) — only when sqlite cannot represent the behavior
# See backend/tests/AGENTS.md for docker setup
```

> `pytest` is NOT on system PATH. Always invoke via `backend/.venv/bin/python -m pytest`.

## Critical caveats

**Alembic stamp hack (sqlite C-track):**
- sqlite test setup uses `alembic stamp head` rather than running migrations forward
- Migration tests requiring forward-application must run on D-track (postgres)
- If a new migration fails on sqlite stamp path, route the test to D-track

**ON CONFLICT routing:**
- sqlite and postgres handle `ON CONFLICT` differently
- If a test exercises ON CONFLICT semantics, mark it postgres-only or it will pass on sqlite but break on prod
- Cross-DB tests should use SQLAlchemy dialect-aware patterns, not raw SQL

**Service-layer tests:**
- Mock external services (FRED, Yahoo Finance, KIS API), never hit live endpoints
- Use fixtures in `backend/tests/conftest.py` for shared DB / client setup

## TDD workflow

For new features and bugfixes:
1. Write failing test (RED)
2. Run on C-track → confirm failure
3. Implement minimum code to pass (GREEN)
4. Run full suite — no regressions
5. Refactor (test must stay green)

## Pre-commit gate

- [ ] `cd backend && .venv/bin/python -m pytest tests -q` — all green (or pre-existing failures noted)
- [ ] `cd frontend && npm run build` — type-check passes
- [ ] `cd frontend && npm run lint` — no new lint errors
- [ ] Pre-existing failures reported separately from new ones
