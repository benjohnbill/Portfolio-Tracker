# C1 Slippage Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional post-freeze slippage recording feature: a new `execution_slippage` DB table, `POST /api/v1/friday/slippage` endpoint, and a per-decision "Log execution" collapsible form on `/friday`.

**Architecture:** New `ExecutionSlippage` model (FK → `weekly_decisions`), three methods on `FridayService` (`add_slippage`, `get_slippage_for_decision`, `_serialize_slippage`), one POST endpoint in `main.py`, and a minimal collapsible form per decision card in `FridayDashboard.tsx`. N3 preserved: the form records factual execution data only — no routing, no suggestions.

**Tech Stack:** SQLAlchemy + Alembic (PostgreSQL + SQLite C-track tests), FastAPI/Pydantic, Next.js 14 (Server Components + Client Component form), existing conftest.py fixtures.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/alembic/versions/f1966ce042d3_add_execution_slippage_table.py` | **Create** | Schema migration for `execution_slippage` table |
| `backend/app/models.py` | **Modify** | Add `ExecutionSlippage` ORM model + relationship on `WeeklyDecision` |
| `backend/app/services/friday_service.py` | **Modify** | `DecisionNotFoundError`, `_serialize_slippage`, updated `_serialize_decision`, `add_slippage`, `get_slippage_for_decision` |
| `backend/app/main.py` | **Modify** | `SlippageCreateRequest` Pydantic model + `POST /api/v1/friday/slippage` endpoint |
| `backend/tests/test_slippage.py` | **Create** | C-track unit + API integration tests (service + endpoint) |
| `frontend/src/lib/api.ts` | **Modify** | `ExecutionSlippage` interface, update `FridayDecision.slippageEntries`, `createFridaySlippage()` |
| `frontend/src/components/friday/FridayDashboard.tsx` | **Modify** | Per-decision "Log execution" collapsible form + display of existing slippage entries |

---

## Task 1: Alembic migration

**Files:**
- Create: `backend/alembic/versions/f1966ce042d3_add_execution_slippage_table.py`

- [ ] **Step 1: Write the migration file**

```python
# backend/alembic/versions/f1966ce042d3_add_execution_slippage_table.py
"""Add execution_slippage table — C1 slippage log

Revision ID: f1966ce042d3
Revises: c9e5f2a8d410
Create Date: 2026-04-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1966ce042d3'
down_revision: Union[str, Sequence[str], None] = 'c9e5f2a8d410'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'execution_slippage',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            'decision_id',
            sa.Integer(),
            sa.ForeignKey('weekly_decisions.id', ondelete='CASCADE'),
            nullable=False,
            index=True,
        ),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('executed_at', sa.Date(), nullable=True),
        sa.Column('executed_price', sa.Float(), nullable=True),
        sa.Column('executed_qty', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('execution_slippage')
```

- [ ] **Step 2: Verify the migration chain is correct**

Run:
```bash
cd backend && .venv/bin/alembic history | head -5
```
Expected: `c9e5f2a8d410` is in the chain. `f1966ce042d3` does NOT appear yet (it's only a file, not applied to dev DB).

> Note: Do NOT run `alembic upgrade head` against the dev/prod DB at this stage — the model must exist first (Task 2). Apply migration at the end of Task 2.

---

## Task 2: SQLAlchemy model + relationship

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add `ExecutionSlippage` model at the end of `models.py`** (after the `DecisionOutcome` class, before the file ends)

```python
class ExecutionSlippage(Base):
    __tablename__ = "execution_slippage"

    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer, ForeignKey("weekly_decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    executed_at = Column(Date, nullable=True)
    executed_price = Column(Float, nullable=True)
    executed_qty = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    decision = relationship("WeeklyDecision", back_populates="slippage_entries")
```

- [ ] **Step 2: Add the relationship on `WeeklyDecision`** (line ~145, after `outcomes = relationship(...)`)

Find:
```python
    outcomes = relationship("DecisionOutcome", back_populates="decision", cascade="all, delete-orphan")
```

Replace with:
```python
    outcomes = relationship("DecisionOutcome", back_populates="decision", cascade="all, delete-orphan")
    slippage_entries = relationship("ExecutionSlippage", back_populates="decision", cascade="all, delete-orphan", order_by="ExecutionSlippage.created_at")
```

- [ ] **Step 3: Apply the migration to dev DB**

```bash
cd backend && .venv/bin/alembic upgrade head
```
Expected: `Running upgrade c9e5f2a8d410 -> f1966ce042d3, Add execution_slippage table`

- [ ] **Step 4: Verify migration applied**

```bash
cd backend && .venv/bin/alembic current
```
Expected: `f1966ce042d3 (head)`

- [ ] **Step 5: Verify model imports compile**

```bash
cd backend && .venv/bin/python -c "from app.models import ExecutionSlippage, WeeklyDecision; print('OK')"
```
Expected: `OK`

---

## Task 3: FridayService — slippage methods

**Files:**
- Modify: `backend/app/services/friday_service.py`

- [ ] **Step 1: Add `DecisionNotFoundError` next to the other error classes** (after `SnapshotValidationError`)

Find:
```python
class SnapshotValidationError(ValueError):
    pass
```

Replace with:
```python
class SnapshotValidationError(ValueError):
    pass


class DecisionNotFoundError(LookupError):
    pass
```

- [ ] **Step 2: Add `ExecutionSlippage` import in the models import line**

Find:
```python
from ..models import EventAnnotation, WeeklyDecision, WeeklySnapshot
```

Replace with:
```python
from ..models import EventAnnotation, ExecutionSlippage, WeeklyDecision, WeeklySnapshot
```

- [ ] **Step 3: Add `_serialize_slippage` static method to `FridayService`** (insert before `_serialize_decision`)

```python
    @staticmethod
    def _serialize_slippage(entry: "ExecutionSlippage") -> Dict[str, Any]:
        return {
            "id": entry.id,
            "decisionId": entry.decision_id,
            "createdAt": entry.created_at.isoformat() if entry.created_at else None,
            "executedAt": entry.executed_at.isoformat() if entry.executed_at else None,
            "executedPrice": entry.executed_price,
            "executedQty": entry.executed_qty,
            "notes": entry.notes,
        }
```

- [ ] **Step 4: Update `_serialize_decision` to include slippage entries**

The legacy `_FakeDB` tests use detached `WeeklyDecision` instances that cannot lazy-load. Use try/except to keep backwards compatibility.

Find the existing `_serialize_decision` method and replace its body:

```python
    @staticmethod
    def _serialize_decision(decision: WeeklyDecision) -> Dict[str, Any]:
        try:
            slippage_entries = list(decision.slippage_entries)
        except Exception:
            slippage_entries = []
        return {
            "id": decision.id,
            "snapshotId": decision.snapshot_id,
            "createdAt": decision.created_at.isoformat() if decision.created_at else None,
            "decisionType": decision.decision_type,
            "assetTicker": decision.asset_ticker,
            "note": decision.note,
            "confidenceVsSpyRiskadj": decision.confidence_vs_spy_riskadj,
            "confidenceVsCash": decision.confidence_vs_cash,
            "confidenceVsSpyPure": decision.confidence_vs_spy_pure,
            "invalidation": decision.invalidation,
            "expectedFailureMode": decision.expected_failure_mode,
            "triggerThreshold": decision.trigger_threshold,
            "slippageEntries": [FridayService._serialize_slippage(s) for s in slippage_entries],
        }
```

- [ ] **Step 5: Add `add_slippage` static method** (insert after `add_decision`, before `_get_nested`)

```python
    @staticmethod
    def add_slippage(
        db: Session,
        decision_id: int,
        executed_at=None,
        executed_price=None,
        executed_qty=None,
        notes=None,
    ) -> Dict[str, Any]:
        decision = db.query(WeeklyDecision).filter(WeeklyDecision.id == decision_id).first()
        if not decision:
            raise DecisionNotFoundError(f"Decision {decision_id} not found")

        entry = ExecutionSlippage(
            decision_id=decision_id,
            created_at=datetime.now(timezone.utc),
            executed_at=executed_at,
            executed_price=executed_price,
            executed_qty=executed_qty,
            notes=notes,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return FridayService._serialize_slippage(entry)

    @staticmethod
    def get_slippage_for_decision(db: Session, decision_id: int) -> List[Dict[str, Any]]:
        entries = (
            db.query(ExecutionSlippage)
            .filter(ExecutionSlippage.decision_id == decision_id)
            .order_by(ExecutionSlippage.created_at.asc())
            .all()
        )
        return [FridayService._serialize_slippage(e) for e in entries]
```

- [ ] **Step 6: Verify the service compiles**

```bash
cd backend && .venv/bin/python -c "from app.services.friday_service import FridayService, DecisionNotFoundError; print('OK')"
```
Expected: `OK`

---

## Task 4: API endpoint

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add `DecisionNotFoundError` to the import from `friday_service`**

Find:
```python
from .services.friday_service import FridayService, SnapshotConflictError, SnapshotNotFoundError, SnapshotValidationError
```

Replace with:
```python
from .services.friday_service import FridayService, DecisionNotFoundError, SnapshotConflictError, SnapshotNotFoundError, SnapshotValidationError
```

- [ ] **Step 2: Add `SlippageCreateRequest` Pydantic model** (insert after `FridayDecisionCreateRequest`, before the CORS config block)

```python
class SlippageCreateRequest(BaseModel):
    decision_id: int
    executed_at: Optional[str] = None   # YYYY-MM-DD
    executed_price: Optional[float] = None
    executed_qty: Optional[float] = None
    notes: Optional[str] = None
```

- [ ] **Step 3: Add `POST /api/v1/friday/slippage` endpoint** (insert after the `POST /api/v1/friday/decisions` block, before `GET /api/v1/friday/compare`)

```python
@app.post("/api/v1/friday/slippage")
def create_friday_slippage(payload: SlippageCreateRequest, db: Session = Depends(get_db)):
    try:
        executed_at = datetime.strptime(payload.executed_at, "%Y-%m-%d").date() if payload.executed_at else None
    except ValueError:
        raise HTTPException(status_code=400, detail="executed_at must be YYYY-MM-DD")

    try:
        return FridayService.add_slippage(
            db,
            decision_id=payload.decision_id,
            executed_at=executed_at,
            executed_price=payload.executed_price,
            executed_qty=payload.executed_qty,
            notes=payload.notes,
        )
    except DecisionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as e:
        print(f"Error in POST /api/v1/friday/slippage: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 4: Verify main.py compiles**

```bash
cd backend && .venv/bin/python -c "from app.main import app; print('OK')"
```
Expected: `OK`

---

## Task 5: Tests

**Files:**
- Create: `backend/tests/test_slippage.py`

These tests use the C-track conftest fixtures (`db_session`, `client`) — no `_FakeDB`.

- [ ] **Step 1: Write the test file**

```python
# backend/tests/test_slippage.py
"""C1 Slippage Log — service + API tests (C-track, SQLite)."""
from datetime import date, datetime, timezone

import pytest

from app.models import ExecutionSlippage, WeeklyDecision, WeeklySnapshot
from app.services.friday_service import DecisionNotFoundError, FridayService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_snapshot(db_session):
    snap = WeeklySnapshot(
        snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report={"score": {"total": 65}, "weekEnding": "2026-04-18", "status": "final"},
        snapshot_metadata={"coverage": {}, "partial": False, "errors": {}},
    )
    db_session.add(snap)
    db_session.commit()
    db_session.refresh(snap)
    return snap


def _seed_decision(db_session, snapshot_id):
    dec = WeeklyDecision(
        snapshot_id=snapshot_id,
        created_at=datetime.now(timezone.utc),
        decision_type="hold",
        note="Stay put",
        confidence_vs_spy_riskadj=7,
    )
    db_session.add(dec)
    db_session.commit()
    db_session.refresh(dec)
    return dec


# ---------------------------------------------------------------------------
# Service unit tests
# ---------------------------------------------------------------------------

def test_add_slippage_creates_record(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    result = FridayService.add_slippage(
        db_session,
        decision_id=dec.id,
        executed_at=date(2026, 4, 19),
        executed_price=500.25,
        executed_qty=10.0,
        notes="Filled in two tranches",
    )

    assert result["decisionId"] == dec.id
    assert result["executedAt"] == "2026-04-19"
    assert result["executedPrice"] == pytest.approx(500.25)
    assert result["executedQty"] == pytest.approx(10.0)
    assert result["notes"] == "Filled in two tranches"
    assert result["id"] is not None


def test_add_slippage_all_fields_optional(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    result = FridayService.add_slippage(db_session, decision_id=dec.id)

    assert result["executedAt"] is None
    assert result["executedPrice"] is None
    assert result["executedQty"] is None
    assert result["notes"] is None


def test_add_slippage_raises_for_missing_decision(db_session):
    with pytest.raises(DecisionNotFoundError):
        FridayService.add_slippage(db_session, decision_id=99999)


def test_get_slippage_for_decision_empty(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    result = FridayService.get_slippage_for_decision(db_session, dec.id)

    assert result == []


def test_get_slippage_for_decision_returns_all_entries(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)
    FridayService.add_slippage(db_session, decision_id=dec.id, notes="first")
    FridayService.add_slippage(db_session, decision_id=dec.id, notes="second")

    result = FridayService.get_slippage_for_decision(db_session, dec.id)

    assert len(result) == 2
    assert result[0]["notes"] == "first"
    assert result[1]["notes"] == "second"


def test_serialize_decision_includes_slippage_entries(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)
    FridayService.add_slippage(db_session, decision_id=dec.id, executed_price=123.45, notes="logged")

    db_session.refresh(dec)
    result = FridayService._serialize_decision(dec)

    assert len(result["slippageEntries"]) == 1
    assert result["slippageEntries"][0]["executedPrice"] == pytest.approx(123.45)


def test_get_snapshot_includes_decision_slippage(db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)
    FridayService.add_slippage(db_session, decision_id=dec.id, notes="partial fill")

    payload = FridayService.get_snapshot(db_session, date(2026, 4, 18))

    assert len(payload["decisions"]) == 1
    assert len(payload["decisions"][0]["slippageEntries"]) == 1
    assert payload["decisions"][0]["slippageEntries"][0]["notes"] == "partial fill"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

def test_post_slippage_success(client, db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    res = client.post("/api/v1/friday/slippage", json={
        "decision_id": dec.id,
        "executed_at": "2026-04-19",
        "executed_price": 502.10,
        "executed_qty": 5.0,
        "notes": "Bought at open",
    })

    assert res.status_code == 200
    body = res.json()
    assert body["decisionId"] == dec.id
    assert body["executedAt"] == "2026-04-19"
    assert body["executedPrice"] == pytest.approx(502.10)


def test_post_slippage_minimal_body(client, db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    res = client.post("/api/v1/friday/slippage", json={"decision_id": dec.id})

    assert res.status_code == 200
    assert res.json()["executedAt"] is None


def test_post_slippage_404_for_missing_decision(client):
    res = client.post("/api/v1/friday/slippage", json={"decision_id": 99999})
    assert res.status_code == 404


def test_post_slippage_400_for_bad_date(client, db_session):
    snap = _seed_snapshot(db_session)
    dec = _seed_decision(db_session, snap.id)

    res = client.post("/api/v1/friday/slippage", json={
        "decision_id": dec.id,
        "executed_at": "19-April-2026",
    })

    assert res.status_code == 400
```

- [ ] **Step 2: Run tests — expect all to fail** (service methods not yet written at test-file creation time, but here we write them together — run to confirm GREEN)

```bash
cd backend && .venv/bin/python -m pytest tests/test_slippage.py -v
```
Expected: all 12 tests PASS

- [ ] **Step 3: Run full suite to confirm no regressions**

```bash
cd backend && .venv/bin/python -m pytest tests -q
```
Expected: all tests pass (previously 72 passing + 12 new = 84 total)

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/f1966ce042d3_add_execution_slippage_table.py \
        backend/app/models.py \
        backend/app/services/friday_service.py \
        backend/app/main.py \
        backend/tests/test_slippage.py
git commit -m "feat(c1): add execution_slippage table, service methods, and POST /api/v1/friday/slippage endpoint"
```

---

## Task 6: Frontend types and API function

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add `ExecutionSlippage` interface** (insert before `FridayDecision`)

Find:
```typescript
export interface FridayDecision {
```

Insert before it:
```typescript
export interface ExecutionSlippage {
  id: number;
  decisionId: number;
  createdAt: string | null;
  executedAt: string | null;
  executedPrice: number | null;
  executedQty: number | null;
  notes: string | null;
}

```

- [ ] **Step 2: Add `slippageEntries` to `FridayDecision`** (at the end of the interface body)

Find:
```typescript
  triggerThreshold: number | null;
}
```

Replace with:
```typescript
  triggerThreshold: number | null;
  slippageEntries: ExecutionSlippage[];
}
```

- [ ] **Step 3: Add `createFridaySlippage` function** (insert after `createFridayDecision`, before any blank line that separates next export)

```typescript
export async function createFridaySlippage(payload: {
  decision_id: number;
  executed_at?: string;
  executed_price?: number;
  executed_qty?: number;
  notes?: string;
}): Promise<ExecutionSlippage> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/v1/friday/slippage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

---

## Task 7: Frontend UI — per-decision slippage form

**Files:**
- Modify: `frontend/src/components/friday/FridayDashboard.tsx`

The form appears below each decision card in the decisions list. It is collapsible (`<details>`), matching the existing freeze-comment `<details>` pattern already in the component. N3 preserved: label is "Log execution" (recording), not "Execute" or "Route."

- [ ] **Step 1: Add `ExecutionSlippage` to the type import**

Find:
```typescript
import type { FridayBriefingData, FridaySnapshot, FridaySnapshotSummary, SleeveHistoryData, WeeklyReport } from '@/lib/api';
```

Replace with:
```typescript
import type { ExecutionSlippage, FridayBriefingData, FridaySnapshot, FridaySnapshotSummary, SleeveHistoryData, WeeklyReport } from '@/lib/api';
```

- [ ] **Step 2: Add `createFridaySlippage` to the function import**

Find:
```typescript
import { createFridayDecision, createFridaySnapshot } from '@/lib/api';
```

Replace with:
```typescript
import { createFridayDecision, createFridaySlippage, createFridaySnapshot } from '@/lib/api';
```

- [ ] **Step 3: Add local `SlippageDraft` type and state** (insert after the existing `decisionError` state, before the `latestSnapshot` line)

Find:
```typescript
  const latestSnapshot = snapshots[0] ?? null;
```

Insert before it:
```typescript
  interface SlippageDraft {
    executed_at: string;
    executed_price: string;
    executed_qty: string;
    notes: string;
  }
  const EMPTY_SLIPPAGE: SlippageDraft = { executed_at: '', executed_price: '', executed_qty: '', notes: '' };

  const [slippageDrafts, setSlippageDrafts] = useState<Record<number, SlippageDraft>>({});
  const [slippageState, setSlippageState] = useState<Record<number, 'idle' | 'saving' | 'error'>>({});

```

- [ ] **Step 4: Add `handleSlippageSubmit` function** (insert after `handleDecisionSubmit`, before the `return (` statement)

Find:
```typescript
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
```

Insert before it:
```typescript
  async function handleSlippageSubmit(decisionId: number, e: React.FormEvent) {
    e.preventDefault();
    const draft = slippageDrafts[decisionId] ?? EMPTY_SLIPPAGE;
    setSlippageState(prev => ({ ...prev, [decisionId]: 'saving' }));
    try {
      await createFridaySlippage({
        decision_id: decisionId,
        executed_at: draft.executed_at || undefined,
        executed_price: draft.executed_price ? Number(draft.executed_price) : undefined,
        executed_qty: draft.executed_qty ? Number(draft.executed_qty) : undefined,
        notes: draft.notes || undefined,
      });
      setSlippageDrafts(prev => ({ ...prev, [decisionId]: EMPTY_SLIPPAGE }));
      setSlippageState(prev => ({ ...prev, [decisionId]: 'idle' }));
      router.refresh();
    } catch {
      setSlippageState(prev => ({ ...prev, [decisionId]: 'error' }));
    }
  }

```

- [ ] **Step 5: Add slippage display + form inside each decision card**

Find the closing `</div>` of each decision card (after the `expectedFailureMode`/`triggerThreshold` block):

```typescript
                    {(decision.expectedFailureMode || decision.triggerThreshold != null) && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        {decision.expectedFailureMode && <>Mode: <span className="text-white/80">{decision.expectedFailureMode}</span></>}
                        {decision.expectedFailureMode && decision.triggerThreshold != null && ' · '}
                        {decision.triggerThreshold != null && <>Threshold: <span className="text-white/80">{decision.triggerThreshold}</span></>}
                      </p>
                    )}
                  </div>
```

Replace with:
```typescript
                    {(decision.expectedFailureMode || decision.triggerThreshold != null) && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        {decision.expectedFailureMode && <>Mode: <span className="text-white/80">{decision.expectedFailureMode}</span></>}
                        {decision.expectedFailureMode && decision.triggerThreshold != null && ' · '}
                        {decision.triggerThreshold != null && <>Threshold: <span className="text-white/80">{decision.triggerThreshold}</span></>}
                      </p>
                    )}
                    {(decision.slippageEntries ?? []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {(decision.slippageEntries ?? []).map((s: ExecutionSlippage) => (
                          <p key={s.id} className="text-[11px] text-muted-foreground/70">
                            Executed{s.executedAt ? ` ${s.executedAt}` : ''}{s.executedPrice != null ? ` @ ${s.executedPrice}` : ''}{s.executedQty != null ? ` × ${s.executedQty}` : ''}{s.notes ? ` — ${s.notes}` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-muted-foreground/60 hover:text-muted-foreground select-none">Log execution</summary>
                      <form
                        className="mt-2 space-y-2"
                        onSubmit={(e) => handleSlippageSubmit(decision.id, e)}
                      >
                        <div className="flex gap-2">
                          <input
                            type="date"
                            className="flex-1 rounded bg-background border border-white/10 px-2 py-1 text-[11px] text-white"
                            value={slippageDrafts[decision.id]?.executed_at ?? ''}
                            onChange={e => setSlippageDrafts(prev => ({ ...prev, [decision.id]: { ...(prev[decision.id] ?? EMPTY_SLIPPAGE), executed_at: e.target.value } }))}
                          />
                          <input
                            type="number"
                            step="any"
                            placeholder="Price"
                            className="w-24 rounded bg-background border border-white/10 px-2 py-1 text-[11px] text-white"
                            value={slippageDrafts[decision.id]?.executed_price ?? ''}
                            onChange={e => setSlippageDrafts(prev => ({ ...prev, [decision.id]: { ...(prev[decision.id] ?? EMPTY_SLIPPAGE), executed_price: e.target.value } }))}
                          />
                          <input
                            type="number"
                            step="any"
                            placeholder="Qty"
                            className="w-20 rounded bg-background border border-white/10 px-2 py-1 text-[11px] text-white"
                            value={slippageDrafts[decision.id]?.executed_qty ?? ''}
                            onChange={e => setSlippageDrafts(prev => ({ ...prev, [decision.id]: { ...(prev[decision.id] ?? EMPTY_SLIPPAGE), executed_qty: e.target.value } }))}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          className="w-full rounded bg-background border border-white/10 px-2 py-1 text-[11px] text-white"
                          value={slippageDrafts[decision.id]?.notes ?? ''}
                          onChange={e => setSlippageDrafts(prev => ({ ...prev, [decision.id]: { ...(prev[decision.id] ?? EMPTY_SLIPPAGE), notes: e.target.value } }))}
                        />
                        <button
                          type="submit"
                          disabled={slippageState[decision.id] === 'saving'}
                          className="rounded bg-white/10 px-3 py-1 text-[11px] text-white hover:bg-white/20 disabled:opacity-50"
                        >
                          {slippageState[decision.id] === 'saving' ? 'Saving...' : 'Save'}
                        </button>
                        {slippageState[decision.id] === 'error' && (
                          <p className="text-[11px] text-red-400">Failed to save. Try again.</p>
                        )}
                      </form>
                    </details>
                  </div>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/components/friday/FridayDashboard.tsx
git commit -m "feat(c1): add slippage log UI — per-decision collapsible form on /friday"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| `execution_slippage` Alembic migration | Task 1 |
| `id` PK, `decision_id` FK, `executed_at` DATE, `executed_price` NUMERIC, `executed_qty` NUMERIC, `notes` TEXT | Task 1+2 |
| `POST /api/v1/friday/slippage` endpoint | Task 4 |
| `/friday` post-freeze optional form, per decision | Task 7 |
| N3 preserved (record-only, no routing) | Task 7 — label "Log execution", no suggestions |
| Slippage entries visible on snapshot fetch | Task 3 (`_serialize_decision` updated) |

### Placeholder scan

No TBD, no "implement later", no "similar to Task N", no missing code blocks.

### Type consistency

- `ExecutionSlippage` used in `api.ts` interface and in `FridayDashboard.tsx` map → matches.
- `add_slippage` returns `_serialize_slippage(entry)` → keys match `ExecutionSlippage` interface (`decisionId`, `executedAt`, `executedPrice`, `executedQty`, `notes`).
- `_serialize_decision` adds `slippageEntries` key → `FridayDecision.slippageEntries` in `api.ts` matches.
- `createFridaySlippage` payload matches `SlippageCreateRequest` field names (`decision_id`, `executed_at`, `executed_price`, `executed_qty`, `notes`).
