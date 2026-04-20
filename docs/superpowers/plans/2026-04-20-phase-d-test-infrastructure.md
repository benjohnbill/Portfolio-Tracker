# Phase D Test Infrastructure (C + D Hybrid) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish hermetic unit/component tests against in-memory SQLite (C track) and integration/migration tests against ephemeral PostgreSQL (D track), so Phase D ship-now freeze-flow QA can be automated without prod pollution.

**Architecture:** (1) A `JsonVariant` SQLAlchemy `TypeDecorator` maps to `JSONB` on PostgreSQL and `JSON` on SQLite, unblocking `Base.metadata.create_all()` on SQLite. (2) A shared `backend/tests/conftest.py` provides a function-scoped in-memory SQLite engine + `FastAPI.dependency_overrides[get_db]` helper — C track. (3) `backend/tests/integration/conftest.py` uses `testcontainers-python` to spin up a session-scoped PostgreSQL container + run `alembic upgrade head` — D track. (4) A `tests/fixtures/seeds.py` module exposes small function-based seed helpers (`seed_asset`, `seed_daily_price`, `seed_weekly_report`, `seed_weekly_snapshot`, `seed_decision`) used by both tracks. Existing 72 `_FakeDB` tests stay intact.

**Tech Stack:** pytest 9, SQLAlchemy 2 `TypeDecorator`, `testcontainers-python[postgres]`, `freezegun`, Alembic, FastAPI `TestClient`, Docker Desktop (WSL2 integration).

---

## Scope Lock (2026-04-20)

Authoritative record: `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` Progress log (2026-04-20 entry).

**Locked for current phase:**
- C = default track (sqlite), unit/component tests
- D = integration track (postgres), freeze E2E + migration roundtrip; run manually pre-merge, not on every commit
- B = user dogfooding every Friday (DevTools Network tab capture) — observational, no code work in this plan

**Explicitly deferred (re-open via `Revisit triggers` in the scope-lock decision doc):**
- CI integration (GitHub Actions etc.)
- `respx` upgrade for external HTTP mocks — keep existing `monkeypatch + _FakeClient`
- `factory_boy` — keep plain function seed helpers
- Broad `freezegun` rollout — only the freeze-flow E2E uses it
- Service-level clock-parameter injection — not this phase
- Expanding D beyond freeze E2E + migration roundtrip
- Migrating existing 72 `_FakeDB`-based tests to the new tracks — leave them intact

## Prerequisites

- **Docker Desktop running (with WSL2 integration enabled)** before any D task or `pytest -m integration` run. Task 5 includes a verification step.
- Python 3.12 `.venv` already at `backend/.venv/` (existing).

## Branching / Commit Policy

- **Plan doc commit:** this file commits directly to `main` (solo-dev doc convention, memory 242).
- **Implementation:** run on a feature branch `feature/phase-d-test-infra-c-d`. Fast-forward merge to `main` after all 8 tasks green.
- Each task lands as one conventional-commit-style commit (`test:` / `chore:` / `feat:` as appropriate).

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Create | `backend/app/types.py` | `JsonVariant` TypeDecorator — `JSONB` on PG, `JSON` on SQLite |
| Modify | `backend/app/models.py` (L2, L110, L111, L179, L182, L185) | Swap `JSONB` import + 5 column types to `JsonVariant` |
| Create | `backend/requirements-dev.txt` | Dev deps: `pytest`, `freezegun`, `testcontainers[postgres]` |
| Create | `backend/pytest.ini` | Register `integration` marker, deselect by default |
| Create | `backend/tests/conftest.py` | Shared C fixtures: `sqlite_engine`, `db_session`, `client` |
| Create | `backend/tests/fixtures/__init__.py` | Package marker (empty) |
| Create | `backend/tests/fixtures/seeds.py` | 5 function-based seed helpers |
| Create | `backend/tests/test_types_smoke.py` | Smoke for `JsonVariant` + conftest |
| Create | `backend/tests/integration/__init__.py` | Package marker (empty) |
| Create | `backend/tests/integration/conftest.py` | Session-scoped PG container + Alembic upgrade fixture |
| Create | `backend/tests/integration/test_freeze_flow.py` | Freeze E2E with `freezegun` (Plan C regression lock) |
| Create | `backend/tests/integration/test_migrations.py` | Alembic `upgrade head` + one up/down roundtrip |
| Modify | `backend/tests/AGENTS.md` | Routing rules: when to put a test in C vs D |

The existing fake-DB tests (`test_api.py`, `test_friday_service.py`, `test_briefing_service.py`, `test_notification_service.py`, `test_discord_notifier.py`, `test_report_service_fx.py`, `test_portfolio_service_fx_regression.py`) are **not modified** by this plan.

---

## Task 1: `JsonVariant` TypeDecorator + model swap

**Files:**
- Create: `backend/app/types.py`
- Modify: `backend/app/models.py:2,110,111,179,182,185`
- Test: `backend/tests/test_types_smoke.py` (will be completed in Task 3; here we only add a free-standing smoke run)

- [ ] **Step 1: Create `backend/app/types.py` with the `JsonVariant` decorator**

Write:

```python
# backend/app/types.py
"""Dialect-aware JSON column type.

Stores data as `JSONB` on PostgreSQL (production engine) and as `JSON` on
SQLite (unit-test engine). All existing model columns that previously used
`from sqlalchemy.dialects.postgresql import JSONB` should import and use
`JsonVariant` from this module instead.

This is the single adapter that lets `Base.metadata.create_all()` succeed
against an in-memory SQLite engine, which is a prerequisite for the C-track
test fixtures (see `backend/tests/conftest.py`).
"""

from __future__ import annotations

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator


class JsonVariant(TypeDecorator):
    """`JSONB` on PostgreSQL, `JSON` on every other dialect (notably SQLite)."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())
```

- [ ] **Step 2: Swap the `JSONB` import in `backend/app/models.py` line 2**

Change line 2 from:

```python
from sqlalchemy.dialects.postgresql import JSONB
```

to:

```python
from app.types import JsonVariant
```

- [ ] **Step 3: Replace 5 column types in `backend/app/models.py`**

Replace these exact lines (keep the rest of each line intact):

```
L110: frozen_report = Column(JSONB, nullable=False)
L111: snapshot_metadata = Column("metadata", JSONB, nullable=False)
L179: regime_snapshot = Column(JSONB, nullable=True)
L182: indicator_values = Column(JSONB, nullable=True)
L185: rules_fired = Column(JSONB, nullable=True)
```

with `JsonVariant` instead of `JSONB` (e.g., `frozen_report = Column(JsonVariant, nullable=False)`). Use `replace_all` since `JSONB` appears only as the column type after the import swap.

- [ ] **Step 4: Regression-check the existing 72-test suite**

Run: `cd backend && ./.venv/bin/pytest -q`

Expected: **72/72 passing** (the existing tests use `_FakeDB` objects that never touch SQLAlchemy engine compilation, so the type swap is transparent to them).

If anything fails, stop and investigate — the column-type swap should be transparent.

- [ ] **Step 5: Verify sqlite `create_all` now works**

Run this one-liner to prove the bug the scope-lock decision doc flagged ("CompileError: can't render element of type JSONB") is gone:

```bash
cd backend && ./.venv/bin/python -c "
from sqlalchemy import create_engine
from app.database import Base
import app.models  # noqa: F401 — register mappers
engine = create_engine('sqlite:///:memory:')
Base.metadata.create_all(engine)
print('sqlite create_all OK, tables:', len(Base.metadata.tables))
"
```

Expected stdout: `sqlite create_all OK, tables: <N>` (non-zero).

- [ ] **Step 6: Commit**

```bash
git checkout -b feature/phase-d-test-infra-c-d
git add backend/app/types.py backend/app/models.py
git commit -m "refactor(types): add JsonVariant TypeDecorator for JSONB/JSON dialect split"
```

---

## Task 2: Dev dependencies file

**Files:**
- Create: `backend/requirements-dev.txt`

- [ ] **Step 1: Create `backend/requirements-dev.txt`**

Write:

```
# Dev-only dependencies for the Phase D test infrastructure (C + D tracks).
# Production deps remain in requirements.txt.
#
# Install:  ./.venv/bin/pip install -r requirements-dev.txt
-r requirements.txt

pytest>=9.0,<10
freezegun>=1.5,<2
testcontainers[postgres]>=4.8,<5
```

- [ ] **Step 2: Install dev deps into the existing venv**

Run: `cd backend && ./.venv/bin/pip install -r requirements-dev.txt`

Expected: three new packages installed — `freezegun`, `testcontainers-*`, plus their transitive deps (`docker`, etc.). `pytest` is already present; pip should say "Requirement already satisfied".

- [ ] **Step 3: Smoke-verify imports**

Run:

```bash
cd backend && ./.venv/bin/python -c "import freezegun; import testcontainers.postgres; print('dev-deps OK')"
```

Expected stdout: `dev-deps OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/requirements-dev.txt
git commit -m "chore(deps): add freezegun + testcontainers[postgres] as dev deps"
```

---

## Task 3: Shared C fixtures (sqlite + TestClient) + smoke test

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_types_smoke.py`

- [ ] **Step 1: Write the failing smoke test (C track)**

Create `backend/tests/test_types_smoke.py`:

```python
"""Smoke tests for the C-track (sqlite) fixtures + JsonVariant round-trip."""

from __future__ import annotations

from datetime import date, datetime, timezone

from app.models import WeeklySnapshot


def test_sqlite_jsonvariant_roundtrip(db_session):
    """Inserting a WeeklySnapshot with a dict in `frozen_report` and re-reading
    it should yield the same dict — proving JsonVariant works on SQLite."""
    snap = WeeklySnapshot(
        snapshot_date=date(2026, 4, 17),
        created_at=datetime.now(timezone.utc),
        frozen_report={"status": "final", "score": 92, "buckets": [1, 2, 3]},
        snapshot_metadata={"generator": "test"},
    )
    db_session.add(snap)
    db_session.commit()

    fetched = (
        db_session.query(WeeklySnapshot)
        .filter_by(snapshot_date=date(2026, 4, 17))
        .one()
    )
    assert fetched.frozen_report == {
        "status": "final",
        "score": 92,
        "buckets": [1, 2, 3],
    }
    assert fetched.snapshot_metadata == {"generator": "test"}


def test_client_hits_health(client):
    """TestClient wired through the sqlite-backed `get_db` override returns
    200 on /health — proves dependency override is hooked up."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run the smoke test — it should fail**

Run: `cd backend && ./.venv/bin/pytest tests/test_types_smoke.py -q`

Expected: **ERRORS** with `fixture 'db_session' not found` and `fixture 'client' not found`. This is the intended RED state.

- [ ] **Step 3: Create `backend/tests/conftest.py` with the C fixtures**

Write:

```python
"""Shared pytest fixtures — C track (in-memory SQLite).

Three fixtures exposed to every test under `backend/tests/`:

    sqlite_engine   — function-scoped fresh in-memory DB with all tables.
    db_session      — function-scoped SQLAlchemy `Session` bound to the engine.
    client          — function-scoped `fastapi.testclient.TestClient` with
                      `get_db` overridden to yield `db_session`.

Legacy tests (test_api.py, test_friday_service.py, …) still bake their own
`_FakeDB` and do not consume these fixtures — they are opt-in by argument name.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — ensure all mappers are registered before create_all
from app.database import Base, get_db
from app.main import app


@pytest.fixture
def sqlite_engine():
    """Fresh in-memory SQLite with all tables. One DB per test (function scope)."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db_session(sqlite_engine) -> Session:
    SessionLocal = sessionmaker(
        bind=sqlite_engine, autoflush=False, autocommit=False
    )
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
```

- [ ] **Step 4: Run the smoke test — it should now pass**

Run: `cd backend && ./.venv/bin/pytest tests/test_types_smoke.py -q`

Expected: **2 passed**.

- [ ] **Step 5: Run the full suite — existing 72 tests must still pass**

Run: `cd backend && ./.venv/bin/pytest -q`

Expected: **74 passed** (72 legacy + 2 new). If any legacy test fails, investigate — `conftest.py` should not be picked up by them because they don't request the new fixtures by argument name.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/conftest.py backend/tests/test_types_smoke.py
git commit -m "test(c-track): add shared sqlite conftest + JsonVariant smoke tests"
```

---

## Task 4: Seed factories module

**Files:**
- Create: `backend/tests/__init__.py` (makes `tests` importable as a package so `from tests.fixtures.seeds import ...` resolves)
- Create: `backend/tests/fixtures/__init__.py`
- Create: `backend/tests/fixtures/seeds.py`
- Test: extend `backend/tests/test_types_smoke.py`

- [ ] **Step 1: Write the failing factory-usage tests**

Append to `backend/tests/test_types_smoke.py`:

```python
from datetime import date as _date

from tests.fixtures.seeds import (
    seed_asset,
    seed_daily_price,
    seed_weekly_report,
    seed_weekly_snapshot,
    seed_decision,
)


def test_seed_asset_roundtrip(db_session):
    asset = seed_asset(db_session, symbol="QQQ")
    assert asset.id is not None
    assert asset.symbol == "QQQ"


def test_seed_daily_price_roundtrip(db_session):
    asset = seed_asset(db_session, symbol="SPY")
    px = seed_daily_price(db_session, asset=asset, price_date=_date(2026, 4, 17), close=512.3)
    assert px.asset_id == asset.id
    assert px.close == 512.3


def test_seed_weekly_report_roundtrip(db_session):
    report = seed_weekly_report(db_session, week_ending=_date(2026, 4, 17))
    assert report.week_ending == _date(2026, 4, 17)
    assert report.status == "final"


def test_seed_weekly_snapshot_with_comment(db_session):
    snap = seed_weekly_snapshot(
        db_session,
        snapshot_date=_date(2026, 4, 17),
        comment="QA seed comment",
    )
    assert snap.comment == "QA seed comment"
    assert snap.frozen_report == {"status": "final"}


def test_seed_decision_plan_c_fields(db_session):
    snap = seed_weekly_snapshot(db_session, snapshot_date=_date(2026, 4, 17))
    dec = seed_decision(
        db_session,
        snapshot=snap,
        confidence_vs_spy_riskadj=7,
        confidence_vs_cash=9,
        confidence_vs_spy_pure=5,
        expected_failure_mode="price_drop",
        trigger_threshold=0.05,
        invalidation="if SPY drops >5% in 2 weeks",
    )
    assert dec.confidence_vs_spy_riskadj == 7
    assert dec.confidence_vs_cash == 9
    assert dec.confidence_vs_spy_pure == 5
    assert dec.expected_failure_mode == "price_drop"
    assert dec.trigger_threshold == 0.05
    assert dec.invalidation == "if SPY drops >5% in 2 weeks"
```

- [ ] **Step 2: Run — should fail with ImportError**

Run: `cd backend && ./.venv/bin/pytest tests/test_types_smoke.py -q`

Expected: **ImportError: No module named 'tests.fixtures'**.

- [ ] **Step 3: Create both package markers**

Write `backend/tests/__init__.py` as an empty file (zero bytes).
Write `backend/tests/fixtures/__init__.py` as an empty file (zero bytes).

Rationale: `tests/__init__.py` turns `tests/` into a Python package so test files can do `from tests.fixtures.seeds import ...`. Without it, the import would fail. `conftest.py` files are auto-discovered by pytest regardless, but regular imports across test modules require the package marker.

- [ ] **Step 4: Create `backend/tests/fixtures/seeds.py`**

Write:

```python
"""Function-based seed helpers for C (sqlite) and D (postgres) tests.

Each helper takes the session as first positional arg, keyword-only fields
for the rest, commits, refreshes, and returns the model instance.

Keep this module deliberately small and data-shape-focused — if test-suite
growth triggers the `Revisit triggers` clause for `factory_boy`, this module
becomes the migration seam.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    AccountSilo,
    AccountType,
    Asset,
    DailyPrice,
    WeeklyDecision,
    WeeklyReport,
    WeeklySnapshot,
)


def seed_asset(
    db: Session,
    *,
    symbol: str = "QQQ",
    code: str | None = None,
    name: str = "Test Asset",
    source: str = "US",
    account_type: AccountType = AccountType.OVERSEAS,
    account_silo: AccountSilo | None = AccountSilo.OVERSEAS_ETF,
) -> Asset:
    asset = Asset(
        symbol=symbol,
        code=code or symbol,
        name=name,
        source=source,
        account_type=account_type,
        account_silo=account_silo,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def seed_daily_price(
    db: Session,
    *,
    asset: Asset,
    price_date: date,
    close: float = 100.0,
) -> DailyPrice:
    row = DailyPrice(asset_id=asset.id, date=price_date, close=close)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def seed_weekly_report(
    db: Session,
    *,
    week_ending: date = date(2026, 4, 17),
    status: str = "final",
    report_json: dict[str, Any] | None = None,
    llm_summary_json: dict[str, Any] | None = None,
) -> WeeklyReport:
    report = WeeklyReport(
        week_ending=week_ending,
        generated_at=datetime.now(timezone.utc),
        logic_version="weekly-report-v0",
        status=status,
        report_json=report_json or {"score": 92, "regime": "neutral"},
        llm_summary_json=llm_summary_json,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def seed_weekly_snapshot(
    db: Session,
    *,
    snapshot_date: date = date(2026, 4, 17),
    comment: str | None = None,
    frozen_report: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> WeeklySnapshot:
    snap = WeeklySnapshot(
        snapshot_date=snapshot_date,
        created_at=datetime.now(timezone.utc),
        frozen_report=frozen_report or {"status": "final"},
        snapshot_metadata=metadata or {},
        comment=comment,
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


def seed_decision(
    db: Session,
    *,
    snapshot: WeeklySnapshot,
    decision_type: str = "hold",
    asset_ticker: str = "QQQ",
    note: str = "seeded test decision",
    confidence_vs_spy_riskadj: int = 5,
    confidence_vs_cash: int | None = 5,
    confidence_vs_spy_pure: int | None = 5,
    invalidation: str | None = None,
    expected_failure_mode: str | None = None,
    trigger_threshold: float | None = None,
) -> WeeklyDecision:
    decision = WeeklyDecision(
        snapshot_id=snapshot.id,
        decision_type=decision_type,
        asset_ticker=asset_ticker,
        note=note,
        confidence_vs_spy_riskadj=confidence_vs_spy_riskadj,
        confidence_vs_cash=confidence_vs_cash,
        confidence_vs_spy_pure=confidence_vs_spy_pure,
        invalidation=invalidation,
        expected_failure_mode=expected_failure_mode,
        trigger_threshold=trigger_threshold,
        created_at=datetime.now(timezone.utc),
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision
```

- [ ] **Step 5: Run — should pass**

Run: `cd backend && ./.venv/bin/pytest tests/test_types_smoke.py -q`

Expected: **7 passed** (2 from Task 3 + 5 from Task 4).

- [ ] **Step 6: Run full suite — 72 legacy + 7 new = 79**

Run: `cd backend && ./.venv/bin/pytest -q`

Expected: **79 passed**.

- [ ] **Step 7: Commit**

```bash
git add backend/tests/fixtures/__init__.py backend/tests/fixtures/seeds.py backend/tests/test_types_smoke.py
git commit -m "test(fixtures): add function-based seed helpers for C/D tracks"
```

---

## Task 5: D postgres testcontainers fixture + smoke

**Files:**
- Create: `backend/tests/integration/__init__.py`
- Create: `backend/tests/integration/conftest.py`
- Create: `backend/pytest.ini`

- [ ] **Step 1: Verify Docker Desktop is reachable from WSL**

Run: `docker info --format '{{.ServerVersion}}' 2>&1`

Expected: a version string (e.g., `24.0.7`). If you get "Cannot connect to the Docker daemon" or similar, start Docker Desktop on Windows and ensure WSL2 integration is enabled in Settings → Resources → WSL Integration, then re-run.

- [ ] **Step 2: Create `backend/pytest.ini` with the `integration` marker**

Write:

```ini
[pytest]
# Default: run C-track tests only (fast, hermetic, no Docker required).
# Run D-track with:  pytest -m integration
# Run everything:    pytest -m "integration or not integration"
markers =
    integration: tests that require Docker Desktop + ephemeral PostgreSQL (D track)
addopts = -m "not integration"
testpaths = tests
```

- [ ] **Step 3: Create the `integration/` package marker**

Write `backend/tests/integration/__init__.py` as an empty file.

- [ ] **Step 4: Create `backend/tests/integration/conftest.py` with the PG fixture**

Write:

```python
"""Session-scoped PostgreSQL container + Alembic upgrade — D track.

One container boots once per pytest session, runs `alembic upgrade head`
against it, and exposes `pg_engine` / `pg_session` / `pg_client` fixtures
parallel to the C track.

Every test in `tests/integration/` must be decorated with
`@pytest.mark.integration` so it is excluded from the default C-track run.
"""

from __future__ import annotations

import os

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from testcontainers.postgres import PostgresContainer

from app.database import get_db
from app.main import app


@pytest.fixture(scope="session")
def pg_container():
    """Boot one PostgreSQL container for the whole pytest session."""
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest.fixture(scope="session")
def pg_url(pg_container: PostgresContainer) -> str:
    """SQLAlchemy-compatible URL to the container."""
    return pg_container.get_connection_url()


@pytest.fixture(scope="session")
def pg_engine(pg_url: str):
    """Engine with all migrations applied via `alembic upgrade head`."""
    engine = create_engine(pg_url)

    # Point Alembic at this engine via env var; `alembic/env.py` reads
    # DATABASE_URL from the environment through `app.database`.
    prior = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = pg_url
    try:
        alembic_cfg = Config("alembic.ini")
        command.upgrade(alembic_cfg, "head")
    finally:
        if prior is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = prior

    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def pg_session(pg_engine) -> Session:
    """Function-scoped session. Cleanup via TRUNCATE at teardown to keep
    tests independent without paying for a container restart."""
    SessionLocal = sessionmaker(bind=pg_engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        # Wipe all rows, keep schema. Loop is cheap; ~ms for empty tables.
        with pg_engine.begin() as conn:
            # Alembic's own bookkeeping table must survive.
            conn.exec_driver_sql(
                "DO $$ DECLARE r RECORD; "
                "BEGIN "
                "  FOR r IN (SELECT tablename FROM pg_tables "
                "            WHERE schemaname = current_schema() "
                "              AND tablename <> 'alembic_version') LOOP "
                "    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE'; "
                "  END LOOP; "
                "END $$;"
            )


@pytest.fixture
def pg_client(pg_session):
    def _override_get_db():
        try:
            yield pg_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
```

- [ ] **Step 5: Add a smoke test inside `tests/integration/` to prove the container + Alembic work**

Create `backend/tests/integration/test_containers_smoke.py`:

```python
"""Smoke test — PostgreSQL container boots, Alembic runs, JsonVariant round-trips."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from app.models import WeeklySnapshot


@pytest.mark.integration
def test_postgres_jsonvariant_roundtrip(pg_session):
    snap = WeeklySnapshot(
        snapshot_date=date(2026, 4, 17),
        created_at=datetime.now(timezone.utc),
        frozen_report={"status": "final", "score": 92},
        snapshot_metadata={"src": "integration-smoke"},
    )
    pg_session.add(snap)
    pg_session.commit()

    fetched = (
        pg_session.query(WeeklySnapshot)
        .filter_by(snapshot_date=date(2026, 4, 17))
        .one()
    )
    assert fetched.frozen_report == {"status": "final", "score": 92}
    assert fetched.snapshot_metadata == {"src": "integration-smoke"}


@pytest.mark.integration
def test_pg_client_health(pg_client):
    r = pg_client.get("/health")
    assert r.status_code == 200
```

- [ ] **Step 6: Run the D-track smoke**

Run: `cd backend && ./.venv/bin/pytest -m integration -q`

Expected: **2 passed**. First run takes ~10–20 s (image pull + container boot + Alembic upgrade head); subsequent runs ~3–5 s.

- [ ] **Step 7: Run default (C-track only) — D tests must be deselected**

Run: `cd backend && ./.venv/bin/pytest -q`

Expected: **79 passed, 2 deselected** (the `-m "not integration"` default in `pytest.ini`).

- [ ] **Step 8: Commit**

```bash
git add backend/pytest.ini backend/tests/integration/__init__.py backend/tests/integration/conftest.py backend/tests/integration/test_containers_smoke.py
git commit -m "test(d-track): add ephemeral postgres container fixture + smoke tests"
```

---

## Task 6: Freeze flow E2E (D track, with `freezegun`)

**Files:**
- Create: `backend/tests/integration/test_freeze_flow.py`

This is the **Plan C regression lock** — the test that was SKIPPED as Item 12 in the 2026-04-20 Playwright QA.

- [ ] **Step 1: Verify the snapshot POST contract before writing the test**

Read the request body shape and service behavior:

Run: `grep -n 'FridaySnapshotCreateRequest\|FridayDecisionCreateRequest\|create_snapshot\b\|add_decision\b' backend/app/main.py backend/app/services/friday_service.py | head -30`

Verify three facts:
1. `POST /api/v1/friday/snapshot` accepts `{snapshot_date, comment?}` and delegates to `FridayService.create_snapshot(db, snapshot_date, comment=...)`.
2. `POST /api/v1/friday/decisions` accepts `{snapshot_id, decision_type, asset_ticker, note, confidence_vs_spy_riskadj (required), confidence_vs_cash?, confidence_vs_spy_pure?, invalidation?, expected_failure_mode?, trigger_threshold?}`.
3. `create_snapshot` requires a matching `WeeklyReport` for that week already present — the E2E must seed one first.

If any of these assumptions are off, adjust the test body in Step 2 to match; do not change service signatures.

- [ ] **Step 2: Write the failing freeze E2E test**

Create `backend/tests/integration/test_freeze_flow.py`:

```python
"""Phase D Ship Now — freeze flow E2E (Plan C regression lock).

Mirrors the Item 12 Playwright QA item that was skipped because the local
dev backend was bound to the prod Supabase DB. Here we exercise the same
flow against an ephemeral PostgreSQL container and assert the request +
response bodies have the Plan C shape (no legacy `confidence` key).

Uses `freezegun` so `FridayService.create_snapshot` sees the target Friday
regardless of wall-clock time.
"""

from __future__ import annotations

from datetime import date

import pytest
from freezegun import freeze_time

from tests.fixtures.seeds import seed_weekly_report


TARGET_FRIDAY = date(2026, 4, 24)


@pytest.mark.integration
@freeze_time("2026-04-24 12:00:00")
def test_freeze_flow_plan_c_fields_present_legacy_absent(pg_client, pg_session):
    """Create a snapshot (with comment) + a decision (with all Plan C fields)
    against ephemeral PG and assert:

      1. Snapshot POST request carries `comment` and is persisted.
      2. Decisions POST request carries all three confidence_vs_* scalars +
         expected_failure_mode + trigger_threshold.
      3. Response bodies of both POSTs contain NO legacy `confidence` key.
      4. DB state matches.
    """

    # --- Arrange: seed the WeeklyReport that create_snapshot freezes ---
    seed_weekly_report(pg_session, week_ending=TARGET_FRIDAY)
    pg_session.commit()

    # --- Act 1: POST /api/v1/friday/snapshot with a comment ---
    snap_resp = pg_client.post(
        "/api/v1/friday/snapshot",
        json={
            "snapshot_date": TARGET_FRIDAY.isoformat(),
            "comment": "QA freeze — Plan C regression lock",
        },
    )
    assert snap_resp.status_code == 201, snap_resp.text
    snap_body = snap_resp.json()
    assert snap_body["comment"] == "QA freeze — Plan C regression lock"
    assert "confidence" not in snap_body, (
        "Plan C regression: legacy `confidence` key leaked into snapshot response"
    )
    snapshot_id = snap_body["id"]

    # --- Act 2: POST /api/v1/friday/decisions with all Plan C fields ---
    dec_resp = pg_client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": snapshot_id,
            "decision_type": "hold",
            "asset_ticker": "QQQ",
            "note": "E2E test decision",
            "confidence_vs_spy_riskadj": 7,
            "confidence_vs_cash": 9,
            "confidence_vs_spy_pure": 5,
            "invalidation": "if SPY drops >5% in 2 weeks",
            "expected_failure_mode": "price_drop",
            "trigger_threshold": 0.05,
        },
    )
    assert dec_resp.status_code == 201, dec_resp.text
    dec_body = dec_resp.json()
    assert dec_body["confidenceVsSpyRiskadj"] == 7
    assert dec_body["confidenceVsCash"] == 9
    assert dec_body["confidenceVsSpyPure"] == 5
    assert dec_body["expectedFailureMode"] == "price_drop"
    assert dec_body["triggerThreshold"] == 0.05
    assert dec_body["invalidation"] == "if SPY drops >5% in 2 weeks"
    assert "confidence" not in dec_body, (
        "Plan C regression: legacy `confidence` key leaked into decision response"
    )

    # --- Assert 3: DB state matches request ---
    from app.models import WeeklyDecision, WeeklySnapshot

    snap_row = (
        pg_session.query(WeeklySnapshot)
        .filter_by(snapshot_date=TARGET_FRIDAY)
        .one()
    )
    assert snap_row.comment == "QA freeze — Plan C regression lock"

    dec_rows = (
        pg_session.query(WeeklyDecision).filter_by(snapshot_id=snap_row.id).all()
    )
    assert len(dec_rows) == 1
    dec = dec_rows[0]
    assert dec.confidence_vs_spy_riskadj == 7
    assert dec.confidence_vs_cash == 9
    assert dec.confidence_vs_spy_pure == 5
    assert dec.expected_failure_mode == "price_drop"
    assert dec.trigger_threshold == 0.05
    assert dec.invalidation == "if SPY drops >5% in 2 weeks"


@pytest.mark.integration
@freeze_time("2026-04-24 12:00:00")
def test_decision_requires_confidence_vs_spy_riskadj(pg_client, pg_session):
    """Plan C made `confidence_vs_spy_riskadj` required. Posting without it
    must 422."""
    seed_weekly_report(pg_session, week_ending=TARGET_FRIDAY)
    pg_session.commit()

    snap_resp = pg_client.post(
        "/api/v1/friday/snapshot",
        json={"snapshot_date": TARGET_FRIDAY.isoformat()},
    )
    snapshot_id = snap_resp.json()["id"]

    dec_resp = pg_client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": snapshot_id,
            "decision_type": "hold",
            "asset_ticker": "QQQ",
            "note": "missing the required field",
            # confidence_vs_spy_riskadj intentionally omitted
        },
    )
    assert dec_resp.status_code == 422, dec_resp.text


@pytest.mark.integration
@freeze_time("2026-04-24 12:00:00")
def test_decision_rejects_legacy_confidence_field(pg_client, pg_session):
    """Plan C removed the legacy `confidence` field. Posting it should either
    be ignored or 422 — the test asserts the response body never echoes it
    back regardless of whether Pydantic is strict or lenient."""
    seed_weekly_report(pg_session, week_ending=TARGET_FRIDAY)
    pg_session.commit()

    snap_resp = pg_client.post(
        "/api/v1/friday/snapshot",
        json={"snapshot_date": TARGET_FRIDAY.isoformat()},
    )
    snapshot_id = snap_resp.json()["id"]

    dec_resp = pg_client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": snapshot_id,
            "decision_type": "hold",
            "asset_ticker": "QQQ",
            "note": "client that still sends legacy field",
            "confidence_vs_spy_riskadj": 6,
            "confidence": 6,  # legacy — must be ignored or rejected
        },
    )
    # Response, whatever the status code, must not contain legacy `confidence`.
    body = dec_resp.json()
    assert "confidence" not in body
```

- [ ] **Step 3: Run — should either fail (assertion) or pass**

Run: `cd backend && ./.venv/bin/pytest tests/integration/test_freeze_flow.py -m integration -v`

Expected: **3 passed**.

If a test fails, read the failure closely — this is a real regression signal, not a plan bug. Typical causes:
- Snapshot endpoint returns 200 instead of 201 → adjust the assertion.
- `create_snapshot` requires more seeded data (e.g., a `PortfolioSnapshot` row) → extend the seed step, not the assertion.
- Do NOT modify `friday_service.py` or the legacy-confidence removal — those shipped in Plan C and are the contract under test.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration/test_freeze_flow.py
git commit -m "test(integration): freeze flow E2E with Plan C regression lock"
```

---

## Task 7: Alembic migration roundtrip (D track)

**Files:**
- Create: `backend/tests/integration/test_migrations.py`

- [ ] **Step 1: Write the failing roundtrip test**

Create `backend/tests/integration/test_migrations.py`:

```python
"""Alembic migration head-safety — D track.

The session-scoped `pg_engine` fixture already proves `alembic upgrade head`
succeeds against a fresh DB. This test goes one step further: downgrade by
one revision, re-upgrade, confirm the sentinel table column we added in
Phase D still works.

Sentinel: `weekly_decisions.confidence_vs_spy_riskadj` — added in
`a2b8f4d1c901_phase_d_tier1_schema`, made NOT NULL in Plan C.
"""

from __future__ import annotations

import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect


def _alembic_with_url(url: str) -> Config:
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


@pytest.mark.integration
def test_migration_roundtrip_preserves_plan_d_columns(pg_engine, pg_url):
    """Downgrade one step, upgrade back to head, verify Plan D columns exist."""

    prior = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = pg_url
    try:
        cfg = _alembic_with_url(pg_url)

        # Act: downgrade by one revision, then back to head.
        command.downgrade(cfg, "-1")
        command.upgrade(cfg, "head")

        # Assert: Plan D columns exist on weekly_decisions.
        insp = inspect(pg_engine)
        cols = {c["name"] for c in insp.get_columns("weekly_decisions")}
        assert "confidence_vs_spy_riskadj" in cols
        assert "confidence_vs_cash" in cols
        assert "confidence_vs_spy_pure" in cols
        assert "expected_failure_mode" in cols
        assert "trigger_threshold" in cols
        assert "invalidation" in cols

        # Assert: WeeklySnapshot.comment column exists.
        snap_cols = {c["name"] for c in insp.get_columns("weekly_snapshots")}
        assert "comment" in snap_cols
    finally:
        if prior is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = prior
```

- [ ] **Step 2: Run — should pass**

Run: `cd backend && ./.venv/bin/pytest tests/integration/test_migrations.py -m integration -v`

Expected: **1 passed**.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/test_migrations.py
git commit -m "test(integration): alembic up/down roundtrip preserves Phase D columns"
```

---

## Task 8: Docs — `backend/tests/AGENTS.md` routing rules

**Files:**
- Modify: `backend/tests/AGENTS.md`

- [ ] **Step 1: Read the current contents of `backend/tests/AGENTS.md`**

Run: `cat backend/tests/AGENTS.md`

- [ ] **Step 2: Append the routing-rules section**

Append the following to `backend/tests/AGENTS.md` (do not remove existing content):

```markdown

## Test Routing — C (sqlite) vs D (postgres)

*Established 2026-04-20. See `docs/superpowers/plans/2026-04-20-phase-d-test-infrastructure.md` and `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` (§Playwright MCP QA Progress log).*

### Default: C track (sqlite, in-memory)

- File location: `backend/tests/*.py` (top-level)
- Fixtures: `db_session`, `client` (from `backend/tests/conftest.py`)
- Seeds: `from tests.fixtures.seeds import seed_*`
- Run: `pytest -q`  (fast, no Docker)

### Integration: D track (ephemeral postgres)

- File location: `backend/tests/integration/*.py`
- Fixtures: `pg_session`, `pg_client`, `pg_engine` (from `backend/tests/integration/conftest.py`)
- Seeds: same `tests.fixtures.seeds` module
- Run: `pytest -m integration -q`  (requires Docker Desktop)
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

This split is **locked for the current Phase D scope** (features fed by macro / price / archive data only). `Revisit triggers` in `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` Progress log list the conditions that reopen this decision — notably, any service adopting JSONB query operators expands D's remit.
```

- [ ] **Step 3: Run full suite one more time as a sanity check**

Run: `cd backend && ./.venv/bin/pytest -q && ./.venv/bin/pytest -m integration -q`

Expected: **79 passed** (C default), then **6 passed** (D: 2 containers smoke + 3 freeze flow + 1 migration roundtrip).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/AGENTS.md
git commit -m "docs(tests): add C/D routing rules + scope-marker to AGENTS.md"
```

---

## Merge to `main`

After all 8 tasks pass and the branch is clean:

```bash
git checkout main
git merge --ff-only feature/phase-d-test-infra-c-d
git push origin main
git branch -d feature/phase-d-test-infra-c-d
```

## Post-merge TODOS.md update (separate commit on `main`)

Append to `TODOS.md` under a new `### Test infrastructure (shipped)` subsection under `Deploy / Cleanup`:

```markdown
### Test infrastructure (shipped 2026-04-20)

- [x] **Phase D test infrastructure — C + D hybrid**. Plan: `docs/superpowers/plans/2026-04-20-phase-d-test-infrastructure.md`. `JsonVariant` TypeDecorator + sqlite-backed C track (default) + ephemeral postgres D track (`pytest -m integration`, Docker Desktop required) + function-based seed helpers. Legacy `_FakeDB` tests unchanged. Routing rules in `backend/tests/AGENTS.md`. Revisit triggers in the 2026-04-19 scope-lock decision doc apply.
```

Commit: `docs(phase-d): record C+D test infra shipped` directly on `main`.

---

## Self-Review Checklist (already run)

- **Spec coverage:** Scope lock's 7 buckets ↔ Tasks 1 (C infra: JsonVariant) + 3 (conftest) + 4 (seeds) + 5 (D infra: testcontainers) + 5–7 (pytest config + freeze E2E + migration) + 8 (AGENTS.md docs). Clock policy locked to `freezegun` in Task 6, testcontainers choice locked in Task 5. Legacy `_FakeDB` explicitly untouched per scope lock.
- **Placeholder scan:** every step has exact code, exact command, exact expected output. No TBDs.
- **Type consistency:** `db_session`/`client` (C) and `pg_session`/`pg_client`/`pg_engine` (D) used consistently. Factory signatures referenced across Tasks 4 and 6 match.
- **Docker note:** Task 5 Step 1 gates on `docker info`; scope-lock re-entry condition documented in `AGENTS.md` (Task 8).

---

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — batch with checkpoints using `superpowers:executing-plans`.
