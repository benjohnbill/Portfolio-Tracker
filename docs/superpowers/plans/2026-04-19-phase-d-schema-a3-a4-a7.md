# Phase D Tier 1 Schema — A3 / A4 / A7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the backend schema migration + ORM + API-layer backward-compat shim that unblocks Phase D Tier 1 UI work for A3 (3-scalar confidence), A4 (structured invalidation), and A7 (weekly snapshot comment).

**Architecture:** Single additive Alembic revision on top of `b3e7f1a2c456`. Renames `weekly_decisions.confidence` → `confidence_vs_spy_riskadj`, adds four new nullable columns to `weekly_decisions` (`confidence_vs_cash`, `confidence_vs_spy_pure`, `expected_failure_mode`, `trigger_threshold`), adds one nullable column to `weekly_snapshots` (`comment`). API and service layer keep an alias for the legacy `confidence` field so the existing frontend (not yet updated) keeps working against the renamed primary scalar. No UI in this plan.

**Tech Stack:** Python 3, SQLAlchemy 1.4+, Alembic, FastAPI, Pydantic v1 (per existing `Field(ge=1, le=10)` syntax), Postgres (JSONB native), pytest.

**Out of scope (deferred to later Phase D plans):**
- `weekly_snapshots.risk_metrics` JSONB (B4 dependency)
- `weekly_snapshots.ritual_consistency_state` (A6 dependency)
- `decision_outcomes.outcome_delta_vs_spy_pure` / `outcome_delta_calmar_vs_spy` (B2/B5 dependencies)
- `execution_slippage` new table (C1 dependency)
- Frontend sliders / dropdown / textarea UI (requires a separate design-approved plan)
- Prior Invalidation retrieval (A5) — needs retrieval query, not schema

---

## File Structure

**Files created:**
- `backend/alembic/versions/<slug>_phase_d_tier1_schema.py` — single additive revision (exact slug produced by `alembic revision --autogenerate` naming or manual; we will hand-author the revision id).

**Files modified:**
- `backend/app/models.py` — update `WeeklyDecision` + `WeeklySnapshot` class columns
- `backend/app/services/friday_service.py` — update `add_decision` signature + `_serialize_decision`
- `backend/app/main.py` — update `FridayDecisionCreateRequest` Pydantic model + endpoint call site
- `backend/app/services/intelligence_service.py` — update decision payload shape in outcome query
- `backend/tests/test_friday_service.py` — update fixtures and assertions for new shape
- `backend/tests/test_friday_service.py` — add new tests for three new writable paths (3-scalar, failure_mode, threshold)

**Files NOT modified here (confirmed by grep):**
- `backend/app/services/macro_service.py` — its `confidence` is a local regime variable, unrelated.
- Frontend (`frontend/**`) — untouched; frontend will keep posting `{confidence: N}` and the API alias makes that still work.

---

## Backward-Compat Strategy (why this plan is non-breaking)

The legacy frontend sends `POST /api/v1/friday/decisions` with a required `confidence: int` field. The DB column is being renamed, but the API request shape keeps `confidence` as an **alias** that maps to the new `confidence_vs_spy_riskadj`. New fields (`confidence_vs_cash`, `confidence_vs_spy_pure`, `expected_failure_mode`, `trigger_threshold`) are optional.

Rule: for one release cycle, clients may send either `{confidence: N}` OR `{confidence_vs_spy_riskadj: N, confidence_vs_cash: ..., confidence_vs_spy_pure: ...}`. Exactly one primary-scalar form is required. When the frontend ships A3 UI, a follow-up PR drops the alias.

Response shape change: serialized decisions now include three scalar fields. The legacy `confidence` key is kept in the response body as a mirror of `confidence_vs_spy_riskadj` until the frontend switches.

---

## Task 1: Update `WeeklyDecision` + `WeeklySnapshot` ORM models

**Files:**
- Modify: `backend/app/models.py:104-131`

- [ ] **Step 1: Write failing test for new model shape**

Append to `backend/tests/test_friday_service.py` at the end of the file:

```python
def test_weekly_decision_model_has_three_confidence_scalars_and_invalidation_fields():
    # Smoke test: the ORM class exposes the new Phase D A3 / A4 columns.
    from app.models import WeeklyDecision

    column_names = {c.name for c in WeeklyDecision.__table__.columns}
    assert "confidence_vs_spy_riskadj" in column_names
    assert "confidence_vs_cash" in column_names
    assert "confidence_vs_spy_pure" in column_names
    assert "expected_failure_mode" in column_names
    assert "trigger_threshold" in column_names
    assert "confidence" not in column_names  # legacy name must be gone at ORM level


def test_weekly_snapshot_model_has_comment_column():
    from app.models import WeeklySnapshot

    column_names = {c.name for c in WeeklySnapshot.__table__.columns}
    assert "comment" in column_names
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd backend && pytest tests/test_friday_service.py::test_weekly_decision_model_has_three_confidence_scalars_and_invalidation_fields tests/test_friday_service.py::test_weekly_snapshot_model_has_comment_column -v
```

Expected: both FAIL with `AssertionError` (new columns missing).

- [ ] **Step 3: Update `WeeklyDecision` class**

In `backend/app/models.py`, replace lines 117–130 (the entire `class WeeklyDecision` block) with:

```python
class WeeklyDecision(Base):
    __tablename__ = "weekly_decisions"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("weekly_snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    decision_type = Column(String, nullable=False)
    asset_ticker = Column(String, nullable=True)
    note = Column(Text, nullable=False)

    # Phase D A3 — 3-scalar confidence (1..10).
    # #1 primary risk-adjusted, #2 baseline vs cash, #3 stretch vs SPY-KRW pure return.
    # Historical rows hold only #1; #2 and #3 are NULL until recorded on new freezes.
    confidence_vs_spy_riskadj = Column(Integer, nullable=False)
    confidence_vs_cash = Column(Integer, nullable=True)
    confidence_vs_spy_pure = Column(Integer, nullable=True)

    # Phase D A4 — structured invalidation (enum coerced in app layer).
    invalidation = Column(Text, nullable=True)
    expected_failure_mode = Column(String, nullable=True)
    trigger_threshold = Column(Float, nullable=True)

    snapshot = relationship("WeeklySnapshot", back_populates="decisions")
    outcomes = relationship("DecisionOutcome", back_populates="decision", cascade="all, delete-orphan")
```

- [ ] **Step 4: Update `WeeklySnapshot` class**

In `backend/app/models.py`, inside `class WeeklySnapshot` (between `snapshot_metadata` on line 111 and the `decisions` relationship on line 113), add one column:

Replace line 111:
```python
    snapshot_metadata = Column("metadata", JSONB, nullable=False)
```
with:
```python
    snapshot_metadata = Column("metadata", JSONB, nullable=False)
    # Phase D A7 — optional per-freeze observation (1-2 lines), surfaced on /archive.
    comment = Column(Text, nullable=True)
```

- [ ] **Step 5: Run tests — expect PASS on new tests, existing tests MAY fail**

```bash
cd backend && pytest tests/test_friday_service.py::test_weekly_decision_model_has_three_confidence_scalars_and_invalidation_fields tests/test_friday_service.py::test_weekly_snapshot_model_has_comment_column -v
```

Expected: 2 passed.

Existing tests referencing `confidence=` kwarg on the ORM constructor (lines 210, 230, 241, 249) will now fail because the column no longer exists under that name. Leave them failing for now — Task 4 fixes them in lockstep with the service update.

- [ ] **Step 6: No commit yet** — model, migration, service, and tests must all land together.

---

## Task 2: Create Alembic revision `phase_d_tier1_schema`

**Files:**
- Create: `backend/alembic/versions/a2b8f4d1c901_phase_d_tier1_schema.py`

- [ ] **Step 1: Write the revision file**

Create `backend/alembic/versions/a2b8f4d1c901_phase_d_tier1_schema.py`:

```python
"""Phase D Tier 1 schema — 3-scalar confidence, structured invalidation, weekly snapshot comment

Revision ID: a2b8f4d1c901
Revises: b3e7f1a2c456
Create Date: 2026-04-19 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2b8f4d1c901'
down_revision: Union[str, Sequence[str], None] = 'b3e7f1a2c456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A3 — rename legacy confidence column; values are preserved in place.
    op.alter_column(
        'weekly_decisions',
        'confidence',
        new_column_name='confidence_vs_spy_riskadj',
        existing_type=sa.Integer(),
        existing_nullable=False,
    )

    # A3 — two additional confidence scalars, nullable since historical rows have none.
    op.add_column('weekly_decisions', sa.Column('confidence_vs_cash', sa.Integer(), nullable=True))
    op.add_column('weekly_decisions', sa.Column('confidence_vs_spy_pure', sa.Integer(), nullable=True))

    # A4 — structured invalidation alongside the existing free-text `invalidation` column.
    op.add_column('weekly_decisions', sa.Column('expected_failure_mode', sa.String(), nullable=True))
    op.add_column('weekly_decisions', sa.Column('trigger_threshold', sa.Float(), nullable=True))

    # A7 — optional per-freeze observation field.
    op.add_column('weekly_snapshots', sa.Column('comment', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('weekly_snapshots', 'comment')

    op.drop_column('weekly_decisions', 'trigger_threshold')
    op.drop_column('weekly_decisions', 'expected_failure_mode')
    op.drop_column('weekly_decisions', 'confidence_vs_spy_pure')
    op.drop_column('weekly_decisions', 'confidence_vs_cash')

    op.alter_column(
        'weekly_decisions',
        'confidence_vs_spy_riskadj',
        new_column_name='confidence',
        existing_type=sa.Integer(),
        existing_nullable=False,
    )
```

- [ ] **Step 2: Dry-run alembic to confirm chain is valid**

```bash
cd backend && alembic history | head -20
```

Expected: the new revision `a2b8f4d1c901` appears as head, with `b3e7f1a2c456` as down-revision.

- [ ] **Step 3: Apply upgrade in a throwaway transaction to confirm SQL is well-formed**

```bash
cd backend && alembic upgrade a2b8f4d1c901 --sql | head -60
```

Expected output: SQL containing `ALTER TABLE weekly_decisions RENAME COLUMN confidence TO confidence_vs_spy_riskadj`, plus five `ADD COLUMN` statements. No errors.

- [ ] **Step 4: If a live Postgres is available, apply against it**

```bash
cd backend && alembic upgrade head
```

Expected: revision applied, `alembic current` shows `a2b8f4d1c901 (head)`. If no live DB is available in this session, document this step as a deploy-time action.

- [ ] **Step 5: No commit yet.**

---

## Task 3: Update `FridayService.add_decision` + serializer

**Files:**
- Modify: `backend/app/services/friday_service.py:51-62` (serializer) and `:285-313` (`add_decision`)

- [ ] **Step 1: Write failing tests for the new service behavior**

Append to `backend/tests/test_friday_service.py`:

```python
def test_add_decision_accepts_three_confidence_scalars_and_structured_invalidation():
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    payload = FridayService.add_decision(
        db,
        snapshot_id=7,
        decision_type="rebalance",
        asset_ticker="QQQ",
        note="Trim exposure",
        confidence_vs_spy_riskadj=8,
        confidence_vs_cash=7,
        confidence_vs_spy_pure=6,
        invalidation="Macro improves",
        expected_failure_mode="regime_shift",
        trigger_threshold=0.05,
    )

    assert payload["confidenceVsSpyRiskadj"] == 8
    assert payload["confidenceVsCash"] == 7
    assert payload["confidenceVsSpyPure"] == 6
    assert payload["expectedFailureMode"] == "regime_shift"
    assert payload["triggerThreshold"] == 0.05
    # Backward-compat mirror during transition.
    assert payload["confidence"] == 8


def test_add_decision_backward_compat_accepts_legacy_confidence_kwarg():
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    payload = FridayService.add_decision(
        db,
        snapshot_id=7,
        decision_type="hold",
        note="Stay put",
        confidence=7,  # legacy single-scalar call site
    )

    assert payload["confidenceVsSpyRiskadj"] == 7
    assert payload["confidenceVsCash"] is None
    assert payload["confidenceVsSpyPure"] is None
    assert payload["confidence"] == 7


def test_add_decision_rejects_invalid_confidence_scalar_range():
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    # Primary scalar out of range.
    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(db, snapshot_id=7, decision_type="hold", note="x", confidence_vs_spy_riskadj=11)

    # vs_cash out of range.
    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(
            db, snapshot_id=7, decision_type="hold", note="x",
            confidence_vs_spy_riskadj=5, confidence_vs_cash=0,
        )


def test_add_decision_rejects_both_legacy_and_new_confidence():
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(
            db, snapshot_id=7, decision_type="hold", note="x",
            confidence=5, confidence_vs_spy_riskadj=6,
        )
```

Also update the three existing tests that use `confidence=` via `WeeklyDecision(...)` constructor to use the new column name. In `tests/test_friday_service.py`:

Replace line 210:
```python
    decision = WeeklyDecision(id=9, snapshot_id=7, created_at=datetime.now(timezone.utc), decision_type="hold", asset_ticker="QQQ", note="Stay put", confidence=7, invalidation="Break trend")
```
with:
```python
    decision = WeeklyDecision(id=9, snapshot_id=7, created_at=datetime.now(timezone.utc), decision_type="hold", asset_ticker="QQQ", note="Stay put", confidence_vs_spy_riskadj=7, invalidation="Break trend")
```

Leave lines 230, 241, 249 as-is (they call `FridayService.add_decision(... confidence=N ...)` — covered by the new legacy-kwarg path).

- [ ] **Step 2: Run new tests — expect FAIL**

```bash
cd backend && pytest tests/test_friday_service.py -k "three_confidence_scalars or backward_compat or invalid_confidence_scalar or both_legacy_and_new" -v
```

Expected: 4 fails with `TypeError` (unexpected kwarg) or `AttributeError`.

- [ ] **Step 3: Update the serializer**

In `backend/app/services/friday_service.py`, replace the `_serialize_decision` method (lines 51–62):

```python
    @staticmethod
    def _serialize_decision(decision: WeeklyDecision) -> Dict[str, Any]:
        primary = decision.confidence_vs_spy_riskadj
        return {
            "id": decision.id,
            "snapshotId": decision.snapshot_id,
            "createdAt": decision.created_at.isoformat() if decision.created_at else None,
            "decisionType": decision.decision_type,
            "assetTicker": decision.asset_ticker,
            "note": decision.note,
            "confidenceVsSpyRiskadj": primary,
            "confidenceVsCash": decision.confidence_vs_cash,
            "confidenceVsSpyPure": decision.confidence_vs_spy_pure,
            # Backward-compat mirror for legacy frontend that still reads `confidence`.
            "confidence": primary,
            "invalidation": decision.invalidation,
            "expectedFailureMode": decision.expected_failure_mode,
            "triggerThreshold": decision.trigger_threshold,
        }
```

- [ ] **Step 4: Update `FridayService.add_decision`**

Replace `add_decision` (lines 285–313) with:

```python
    @staticmethod
    def add_decision(
        db: Session,
        snapshot_id: int,
        decision_type: str,
        note: str,
        confidence_vs_spy_riskadj: Optional[int] = None,
        confidence_vs_cash: Optional[int] = None,
        confidence_vs_spy_pure: Optional[int] = None,
        asset_ticker: Optional[str] = None,
        invalidation: Optional[str] = None,
        expected_failure_mode: Optional[str] = None,
        trigger_threshold: Optional[float] = None,
        confidence: Optional[int] = None,  # legacy alias; remove after frontend A3 ships
    ) -> Dict[str, Any]:
        snapshot = FridayService._find_snapshot_by_id(db, snapshot_id)
        if not snapshot:
            raise SnapshotNotFoundError(f"Snapshot {snapshot_id} not found")

        # Resolve primary scalar: exactly one of (legacy `confidence`) or (new `confidence_vs_spy_riskadj`) must be provided.
        if confidence is not None and confidence_vs_spy_riskadj is not None:
            raise SnapshotValidationError(
                "Pass either `confidence` (legacy) or `confidence_vs_spy_riskadj` (new), not both",
            )
        primary = confidence_vs_spy_riskadj if confidence_vs_spy_riskadj is not None else confidence
        if primary is None:
            raise SnapshotValidationError("A confidence scalar is required")

        for label, value in (
            ("confidence_vs_spy_riskadj", primary),
            ("confidence_vs_cash", confidence_vs_cash),
            ("confidence_vs_spy_pure", confidence_vs_spy_pure),
        ):
            if value is None:
                continue
            if not (1 <= value <= 10):
                raise SnapshotValidationError(f"{label} must be between 1 and 10")

        decision = WeeklyDecision(
            snapshot_id=snapshot_id,
            created_at=datetime.now(timezone.utc),
            decision_type=decision_type,
            asset_ticker=asset_ticker,
            note=note,
            confidence_vs_spy_riskadj=primary,
            confidence_vs_cash=confidence_vs_cash,
            confidence_vs_spy_pure=confidence_vs_spy_pure,
            invalidation=invalidation,
            expected_failure_mode=expected_failure_mode,
            trigger_threshold=trigger_threshold,
        )
        db.add(decision)
        db.commit()
        db.refresh(decision)
        return FridayService._serialize_decision(decision)
```

- [ ] **Step 5: Run all friday_service tests — expect PASS**

```bash
cd backend && pytest tests/test_friday_service.py -v
```

Expected: all tests green (new tests + updated existing tests).

- [ ] **Step 6: No commit yet.**

---

## Task 4: Update `POST /api/v1/friday/decisions` endpoint

**Files:**
- Modify: `backend/app/main.py:72-78` (Pydantic model) and `:435-453` (endpoint)

- [ ] **Step 1: Write failing API test**

Append to `backend/tests/test_api.py` (or create if first API test; inspect file first):

```python
def test_post_friday_decision_accepts_three_confidence_scalars(client, seeded_snapshot):
    response = client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": seeded_snapshot["id"],
            "decision_type": "rebalance",
            "asset_ticker": "QQQ",
            "note": "Trim",
            "confidence_vs_spy_riskadj": 8,
            "confidence_vs_cash": 7,
            "confidence_vs_spy_pure": 6,
            "invalidation": "Macro improves",
            "expected_failure_mode": "regime_shift",
            "trigger_threshold": 0.05,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["confidenceVsSpyRiskadj"] == 8
    assert body["confidenceVsCash"] == 7
    assert body["confidenceVsSpyPure"] == 6
    assert body["expectedFailureMode"] == "regime_shift"
    assert body["triggerThreshold"] == 0.05


def test_post_friday_decision_backward_compat_legacy_confidence(client, seeded_snapshot):
    response = client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": seeded_snapshot["id"],
            "decision_type": "hold",
            "note": "Stay put",
            "confidence": 7,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["confidenceVsSpyRiskadj"] == 7
    assert body["confidence"] == 7
```

Before writing tests, read `backend/tests/test_api.py` to locate the `client` / `seeded_snapshot` fixtures; if they do not exist, create them inline in the test module using FastAPI `TestClient(app)` and a minimal WeeklySnapshot seed. Match the patterns already used elsewhere in this test file.

- [ ] **Step 2: Run API tests — expect FAIL**

```bash
cd backend && pytest tests/test_api.py -k "post_friday_decision" -v
```

Expected: FAIL with 422 Unprocessable Entity (Pydantic rejects unknown fields) or endpoint 500.

- [ ] **Step 3: Update Pydantic model**

In `backend/app/main.py`, replace the `FridayDecisionCreateRequest` block (lines 72–78):

```python
class FridayDecisionCreateRequest(BaseModel):
    snapshot_id: int
    decision_type: str
    asset_ticker: Optional[str] = None
    note: str
    # Phase D A3 — three confidence scalars. Exactly one of (confidence_vs_spy_riskadj)
    # or legacy (confidence) is required; the rest are optional until the frontend ships A3 UI.
    confidence_vs_spy_riskadj: Optional[int] = Field(default=None, ge=1, le=10)
    confidence_vs_cash: Optional[int] = Field(default=None, ge=1, le=10)
    confidence_vs_spy_pure: Optional[int] = Field(default=None, ge=1, le=10)
    confidence: Optional[int] = Field(default=None, ge=1, le=10)  # legacy alias
    # Phase D A4 — structured invalidation alongside the existing free-text field.
    invalidation: Optional[str] = None
    expected_failure_mode: Optional[str] = None
    trigger_threshold: Optional[float] = None
```

- [ ] **Step 4: Update endpoint call site**

Replace the `create_friday_decision` body (lines 437–446):

```python
@app.post("/api/v1/friday/decisions")
def create_friday_decision(payload: FridayDecisionCreateRequest, db: Session = Depends(get_db)):
    try:
        return FridayService.add_decision(
            db,
            snapshot_id=payload.snapshot_id,
            decision_type=payload.decision_type,
            asset_ticker=payload.asset_ticker,
            note=payload.note,
            confidence=payload.confidence,
            confidence_vs_spy_riskadj=payload.confidence_vs_spy_riskadj,
            confidence_vs_cash=payload.confidence_vs_cash,
            confidence_vs_spy_pure=payload.confidence_vs_spy_pure,
            invalidation=payload.invalidation,
            expected_failure_mode=payload.expected_failure_mode,
            trigger_threshold=payload.trigger_threshold,
        )
    except SnapshotNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except SnapshotValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as e:
        print(f"Error in POST /api/v1/friday/decisions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 5: Run API tests — expect PASS**

```bash
cd backend && pytest tests/test_api.py -k "post_friday_decision" -v
```

Expected: 2 passed.

- [ ] **Step 6: No commit yet.**

---

## Task 5: Update `intelligence_service.py` decision payload

**Files:**
- Modify: `backend/app/services/intelligence_service.py:162-184`

- [ ] **Step 1: Write failing test for intelligence payload shape**

Inspect `backend/tests/` for existing intelligence test coverage. If an `intelligence` test file exists, append to it; otherwise add to `tests/test_friday_service.py` at the end as a cross-service test:

```python
def test_intelligence_outcome_payload_exposes_three_confidence_scalars():
    # The outcomes list view must surface the primary scalar plus the two new ones,
    # so the Intelligence UI can render quadrant calibration in follow-up work.
    from app.services.intelligence_service import IntelligenceService
    # Use whatever fixture / FakeDB pattern this file already relies on.
    # Assert: returned rows contain keys: confidenceVsSpyRiskadj, confidenceVsCash, confidenceVsSpyPure
    # and the legacy `confidence` mirror for transition.
    pass  # FILL IN using the existing fixtures for this module — see the test file it lives in
```

**Note:** if no intelligence test fixtures exist yet, skip this test and instead add a lightweight assertion inside the service's unit path. The risk here is low because the payload shape is mechanical. Record in the commit message that an intelligence test file should be added in a follow-up.

- [ ] **Step 2: Update the decision payload in `intelligence_service.py`**

In `backend/app/services/intelligence_service.py`, replace the `"decision": {...}` dict (lines 167–172):

```python
                "decision": {
                    "type": decision.decision_type,
                    "assetTicker": decision.asset_ticker,
                    "note": decision.note,
                    "confidenceVsSpyRiskadj": decision.confidence_vs_spy_riskadj,
                    "confidenceVsCash": decision.confidence_vs_cash,
                    "confidenceVsSpyPure": decision.confidence_vs_spy_pure,
                    "confidence": decision.confidence_vs_spy_riskadj,  # legacy mirror
                    "expectedFailureMode": decision.expected_failure_mode,
                    "triggerThreshold": decision.trigger_threshold,
                },
```

- [ ] **Step 3: Run full backend test suite**

```bash
cd backend && pytest -v
```

Expected: all tests green. If anything else references `decision.confidence` (attribute access), it will `AttributeError` here — fix by replacing with `decision.confidence_vs_spy_riskadj`.

- [ ] **Step 4: No commit yet.**

---

## Task 6: Frontend type shim (non-breaking hand-off note)

**Files:**
- Inspect only: `frontend/src/**` for any TypeScript type that declares `confidence: number` on a decision shape.

- [ ] **Step 1: Grep for frontend consumers**

```bash
cd /home/lg/dev/Portfolio_Tracker && grep -rn "confidence" frontend/src --include="*.ts" --include="*.tsx" | head -40
```

- [ ] **Step 2: If consumers exist, DO NOT change them in this plan.**

The backend emits `confidence` as a mirror of `confidence_vs_spy_riskadj`, so the frontend's existing read path keeps working without edits. Document in the commit message: "frontend TypeScript types untouched — will be updated when A3 UI lands."

If the grep shows a frontend POST body that sets `confidence: value`, confirm the backend legacy alias handles it (it does, per Task 4). No frontend change required here.

- [ ] **Step 3: No commit yet.**

---

## Task 7: Verification + commit

- [ ] **Step 1: Full backend suite must pass**

```bash
cd backend && pytest -v
```

Expected: all tests green, count ≥ previous (43 + new tests added in Tasks 1, 3, 4).

- [ ] **Step 2: Verify working tree contains only the Phase D changes**

```bash
cd /home/lg/dev/Portfolio_Tracker && git status --short
```

Expected lines for this plan:
- `?? backend/alembic/versions/a2b8f4d1c901_phase_d_tier1_schema.py`
- `M  backend/app/models.py`
- `M  backend/app/main.py`
- `M  backend/app/services/friday_service.py`
- `M  backend/app/services/intelligence_service.py`
- `M  backend/tests/test_friday_service.py`
- `M  backend/tests/test_api.py` (if new tests added)

Untracked session artifacts (`.agent/`, `.codex`, root-level screenshots, `conductor/`, `.mcp.json`, etc.) must NOT be staged.

- [ ] **Step 3: Stage only Phase D files**

```bash
cd /home/lg/dev/Portfolio_Tracker && git add \
  backend/alembic/versions/a2b8f4d1c901_phase_d_tier1_schema.py \
  backend/app/models.py \
  backend/app/main.py \
  backend/app/services/friday_service.py \
  backend/app/services/intelligence_service.py \
  backend/tests/test_friday_service.py
# Include test_api.py only if it was modified.
```

- [ ] **Step 4: Verify staged diff**

```bash
git diff --cached --stat
```

Expected: 6 or 7 files listed, totals in the low hundreds of lines.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(schema): Phase D Tier 1 — 3-scalar confidence, structured invalidation, weekly snapshot comment

Adds Alembic revision a2b8f4d1c901 (head = b3e7f1a2c456):

weekly_decisions:
- RENAME confidence -> confidence_vs_spy_riskadj (values preserved; historical
  rows reinterpret as the primary risk-adjusted scalar per portfolio design
  intent recorded in PRODUCT.md section 9).
- ADD confidence_vs_cash INTEGER NULL.
- ADD confidence_vs_spy_pure INTEGER NULL.
- ADD expected_failure_mode VARCHAR NULL (enum coerced in app layer:
  price_drop / regime_shift / correlation_breakdown / liquidity_crunch /
  other).
- ADD trigger_threshold FLOAT NULL.

weekly_snapshots:
- ADD comment TEXT NULL (Phase D A7 — optional per-freeze observation;
  renders on /archive cards and echoes into the next week's Discord
  briefing per PRODUCT.md section 9 alert policy).

Service + API layer keep a legacy `confidence` alias so the frontend (no A3
UI yet) continues posting single-scalar bodies; they map into
confidence_vs_spy_riskadj. Response payloads mirror the primary scalar at
the legacy `confidence` key until the frontend switches. FridayService
validation rejects both-passed calls and out-of-range values on any scalar.

Deferred to later Phase D plans (and their dependent feature commits):
weekly_snapshots.risk_metrics (B4), ritual_consistency_state (A6),
decision_outcomes.outcome_delta_vs_spy_pure / outcome_delta_calmar_vs_spy
(B2 / B5), execution_slippage table (C1). Frontend UI for A3 sliders / A4
dropdown / A7 textarea is a separate plan.

Test coverage: new ORM shape assertions, three-scalar add_decision path,
legacy-kwarg compat path, validation-range path, mutual-exclusion path,
POST /api/v1/friday/decisions integration for both bodies.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Do NOT push**

User will review and push at their discretion.

---

## Self-Review Checklist

- [x] Every task has exact file paths with line numbers where applicable.
- [x] Every content block is complete (no TBD / implement later), except the intelligence test stub in Task 5 Step 1, which is explicitly marked optional with a fallback plan.
- [x] Commit message is complete and scoped to this plan.
- [x] Tasks 1–5 are ordered so that TDD red → green passes at each task boundary (except Task 1 which temporarily breaks legacy tests; Task 3 repairs them).
- [x] No secrets, no .env changes, no production DB operations inside the plan (alembic upgrade is guarded as optional).
- [x] Scope strictly matches user ask: schema for A3 / A4 / A7, with minimal non-breaking API glue. No UI, no other Tier 1 migrations, no feature rollout logic.
- [x] Types / names consistent across tasks (`confidence_vs_spy_riskadj` spelled identically everywhere; camelCase serialization keys match snake_case Python attributes per the project's established pattern in `_serialize_decision`).
