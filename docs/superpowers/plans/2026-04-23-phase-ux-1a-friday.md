# Phase UX-1a — Weekly ritual + entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver first-paint instant HTML + per-panel async fill for the app's weekly-ritual cluster (`/`, `/friday`, `/friday/[snapshotDate]`, `/friday/archive`) by introducing a shared status-aware envelope contract and converting blocking `Promise.all` pages to RSC streaming.

**Architecture:** Every read-path endpoint returns a response with `status: 'ready' | 'partial' | 'unavailable'` at root plus surface-specific domain fields; empty-state shape equals loaded-state shape. Next.js server components stream HTML shells with per-panel `<Suspense>` boundaries; each async child fetches its own endpoint independently. Upstream failures resolve to `status: 'unavailable'` at HTTP 200, never to 5xx.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), Next.js 14 App Router + TypeScript + React Server Components + Suspense (frontend), pytest (C-track sqlite default) + Jest + React Testing Library, shadcn/ui `<Skeleton>` primitive.

**Scope:** Phase 1a only. Phase 1b (`/intelligence/*`) and Phase 1c (`/archive*` + `/portfolio` alignment) are separate plans authored after Phase 1a ships. Scope lock: `docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md`.

**Prerequisite status:** Cashflow closeout shipped (commits `88fdf7d..49f4c2b`). Keep-alive cron tightened to 10-minute interval (commit `b5261a6`). UX-1 scope lock committed (`c46a43f`).

---

## File Structure

### New files (backend)

- `backend/app/api/_envelope.py` — `wrap_response(status, **fields)` helper. Single responsibility: guarantee envelope shape at response boundary.
- `backend/tests/test_envelope_wrap_response.py` — unit tests for the helper.
- `backend/tests/test_ux1_envelope_contract.py` — per-endpoint contract tests (grows as each endpoint is wrapped).

### New files (frontend)

- `frontend/src/lib/envelope.ts` — `EnvelopeStatus` type, `StatusEnvelope` interface, `isReady`/`isPartial`/`isUnavailable` predicates.
- `frontend/src/lib/__tests__/envelope.test.ts` — predicate tests.
- `frontend/src/components/ui/skeleton-patterns.tsx` — composition on top of existing `<Skeleton>` primitive. Exports `SkeletonRow`, `SkeletonCard`, `SkeletonList`, `SkeletonHero`, `SkeletonForm`.
- `frontend/src/components/ui/__tests__/skeleton-patterns.test.tsx` — composition tests.
- `frontend/src/components/friday/FridayBriefingSection.tsx` — RSC async child; fetches `/api/v1/friday/briefing`, renders via `SinceLastFridayBriefing`.
- `frontend/src/components/friday/FridaySleeveSection.tsx` — RSC async child; fetches `/api/v1/friday/sleeve-history`, renders via `SleeveHealthPanel`.
- `frontend/src/components/friday/FridayReportSection.tsx` — RSC async child; fetches `/api/v1/friday/current`, renders via `FridayDashboard`.
- `frontend/src/components/friday/FridaySnapshotSection.tsx` — RSC async child; fetches `/api/v1/friday/snapshot/{date}`, renders via `FridaySnapshotPanel`.
- `frontend/src/components/friday/CompareClient.tsx` — client component for `/friday/archive` comparison feature (on-demand fetch).

### New files (docs)

- `docs/DOMAIN_MAP.md` — v1 minimal scope: envelope rule + term registry for the 13 Phase UX-1 surfaces.

### Modified files (backend)

- `backend/app/main.py` — 5 endpoint handlers wrapped with `wrap_response`:
  - `/api/reports/weekly/latest`
  - `/api/v1/friday/briefing`
  - `/api/v1/friday/sleeve-history`
  - `/api/v1/friday/snapshot/{snapshot_date}`
  - `/api/v1/friday/current`
  - `/api/v1/friday/snapshots`
  - `/api/v1/friday/compare`

### Modified files (frontend)

- `frontend/src/lib/api.ts` — `getLatestWeeklyReport`, `getFridayBriefing`, `getFridaySleeveHistory`, `getFridayCurrent`, `getFridaySnapshot`, `getFridaySnapshots`, `compareFridaySnapshots` updated to return envelope types. Plus new envelope types for each payload.
- `frontend/src/app/page.tsx` — restructured to RSC streaming with single `<Suspense>` boundary.
- `frontend/src/app/friday/page.tsx` — restructured to 4 `<Suspense>` boundaries (briefing, sleeve, report, snapshot).
- `frontend/src/app/friday/[snapshotDate]/page.tsx` — restructured to RSC streaming with single `<Suspense>` boundary.
- `frontend/src/app/friday/archive/page.tsx` — timeline in RSC streaming, compare lifted to client component (on-demand fetch).

### Scope notes

- `StatusAwareSuspense` was mentioned in the decision doc as a candidate helper. Implementation review concluded that React's native `<Suspense>` plus surface-level presentation components that branch on `envelope.status` covers the full need without a custom wrapper. This plan therefore does NOT add a `StatusAwareSuspense` component. Rationale: avoid thin shim with no behavior; let `<Suspense>` mean what React says it means.

---

## Task 1: Backend `wrap_response` helper

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/_envelope.py`
- Create: `backend/tests/test_envelope_wrap_response.py`

- [ ] **Step 1.1: Create package init**

Create `backend/app/api/__init__.py` with a single line:

```python
"""Internal HTTP response helpers shared across endpoint handlers."""
```

- [ ] **Step 1.2: Write failing test for `wrap_response`**

Create `backend/tests/test_envelope_wrap_response.py`:

```python
"""Contract tests for wrap_response — the envelope helper used by every
read-path endpoint to guarantee a consistent response shape."""

import pytest

from app.api._envelope import wrap_response


def test_wrap_response_includes_status_key():
    result = wrap_response(status="ready", events=[])
    assert "status" in result
    assert result["status"] == "ready"


def test_wrap_response_passes_through_domain_fields():
    result = wrap_response(status="ready", events=["a", "b"], since="2026-04-20")
    assert result["events"] == ["a", "b"]
    assert result["since"] == "2026-04-20"


def test_wrap_response_preserves_empty_shape_on_unavailable():
    result = wrap_response(status="unavailable", events=[], since=None)
    assert result["status"] == "unavailable"
    assert result["events"] == []
    assert result["since"] is None


def test_wrap_response_preserves_empty_shape_on_partial():
    result = wrap_response(
        status="partial",
        events=[{"id": 1}],
        missing_sources=["cron_run_log"],
    )
    assert result["status"] == "partial"
    assert len(result["events"]) == 1
    assert result["missing_sources"] == ["cron_run_log"]


@pytest.mark.parametrize("status", ["ready", "partial", "unavailable"])
def test_wrap_response_accepts_all_three_status_values(status):
    result = wrap_response(status=status, events=[])
    assert result["status"] == status


def test_wrap_response_rejects_invalid_status():
    with pytest.raises(ValueError, match="status"):
        wrap_response(status="pending", events=[])  # type: ignore[arg-type]
```

- [ ] **Step 1.3: Run test and confirm it fails**

Run:

```bash
cd backend && .venv/bin/python -m pytest tests/test_envelope_wrap_response.py -v
```

Expected: ModuleNotFoundError or ImportError for `app.api._envelope`. All tests fail at collection.

- [ ] **Step 1.4: Implement `wrap_response`**

Create `backend/app/api/_envelope.py`:

```python
"""Envelope helper used by every UX-1 read-path endpoint.

Every endpoint returns via `wrap_response` to guarantee:
- HTTP 200 at the API boundary (no 5xx for data-acquisition failures).
- Response root always contains a `status` field.
- Empty-state shape equals loaded-state shape (only `status` differs).

Cross-reference: docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md §4.
"""

from __future__ import annotations

from typing import Any, Literal

Status = Literal["ready", "partial", "unavailable"]

_VALID_STATUSES = frozenset({"ready", "partial", "unavailable"})


def wrap_response(*, status: Status, **fields: Any) -> dict[str, Any]:
    """Return an envelope-wrapped response.

    Args:
        status: 'ready' | 'partial' | 'unavailable'
        **fields: Surface-specific metadata and domain data fields.
                  Use [] or {} rather than None for empty arrays/objects
                  so empty-state shape matches loaded-state shape.

    Returns:
        Dict ready for FastAPI to JSON-serialize.

    Raises:
        ValueError: If status is not one of the three permitted values.
                    This catches typos at test time; production code paths
                    should type-check via the Literal alias.
    """
    if status not in _VALID_STATUSES:
        raise ValueError(
            f"status must be one of {sorted(_VALID_STATUSES)}, got {status!r}"
        )
    return {"status": status, **fields}
```

- [ ] **Step 1.5: Run test and confirm it passes**

Run:

```bash
cd backend && .venv/bin/python -m pytest tests/test_envelope_wrap_response.py -v
```

Expected: 7 passed (6 happy-path + 1 parametrized × 3 = 8 actually; confirm all green).

- [ ] **Step 1.6: Run full backend regression**

Run:

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

Expected: all existing tests still pass (no regression from adding new file).

---

## Task 2: Frontend envelope types + predicates

**Files:**
- Create: `frontend/src/lib/envelope.ts`
- Create: `frontend/src/lib/__tests__/envelope.test.ts`

- [ ] **Step 2.1: Write failing test for envelope predicates**

Create `frontend/src/lib/__tests__/envelope.test.ts`:

```typescript
import { isReady, isPartial, isUnavailable, type StatusEnvelope } from '../envelope';

describe('envelope predicates', () => {
  test('isReady returns true only for ready status', () => {
    const ready: StatusEnvelope = { status: 'ready' };
    const partial: StatusEnvelope = { status: 'partial' };
    const unavailable: StatusEnvelope = { status: 'unavailable' };
    expect(isReady(ready)).toBe(true);
    expect(isReady(partial)).toBe(false);
    expect(isReady(unavailable)).toBe(false);
  });

  test('isPartial returns true only for partial status', () => {
    expect(isPartial({ status: 'partial' })).toBe(true);
    expect(isPartial({ status: 'ready' })).toBe(false);
    expect(isPartial({ status: 'unavailable' })).toBe(false);
  });

  test('isUnavailable returns true only for unavailable status', () => {
    expect(isUnavailable({ status: 'unavailable' })).toBe(true);
    expect(isUnavailable({ status: 'ready' })).toBe(false);
    expect(isUnavailable({ status: 'partial' })).toBe(false);
  });

  test('predicates narrow types for envelopes with domain fields', () => {
    interface Briefing extends StatusEnvelope {
      events: string[];
    }
    const envelope: Briefing = { status: 'ready', events: ['a'] };
    if (isReady(envelope)) {
      // TS should still see `events` on the narrowed type.
      expect(envelope.events).toEqual(['a']);
    }
  });
});
```

- [ ] **Step 2.2: Run test and confirm it fails**

Run:

```bash
cd frontend && npx jest src/lib/__tests__/envelope.test.ts --runInBand
```

Expected: Module not found error for `../envelope`.

- [ ] **Step 2.3: Implement envelope types + predicates**

Create `frontend/src/lib/envelope.ts`:

```typescript
/**
 * Phase UX-1 envelope contract — frontend side.
 *
 * Every read-path API response has a `status` field at root and preserves its
 * shape regardless of status value. Use these predicates to branch rendering.
 *
 * See: docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md §4.
 */

export type EnvelopeStatus = 'ready' | 'partial' | 'unavailable';

export interface StatusEnvelope {
  status: EnvelopeStatus;
}

export function isReady<T extends StatusEnvelope>(envelope: T): boolean {
  return envelope.status === 'ready';
}

export function isPartial<T extends StatusEnvelope>(envelope: T): boolean {
  return envelope.status === 'partial';
}

export function isUnavailable<T extends StatusEnvelope>(envelope: T): boolean {
  return envelope.status === 'unavailable';
}
```

- [ ] **Step 2.4: Run test and confirm it passes**

Run:

```bash
cd frontend && npx jest src/lib/__tests__/envelope.test.ts --runInBand
```

Expected: 4 passed.

- [ ] **Step 2.5: Run tsc to verify no type errors**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

---

## Task 3: Skeleton composition components

**Files:**
- Create: `frontend/src/components/ui/skeleton-patterns.tsx`
- Create: `frontend/src/components/ui/__tests__/skeleton-patterns.test.tsx`

- [ ] **Step 3.1: Write failing test for skeleton compositions**

Create `frontend/src/components/ui/__tests__/skeleton-patterns.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { SkeletonRow, SkeletonCard, SkeletonList, SkeletonHero } from '../skeleton-patterns';

describe('skeleton-patterns', () => {
  test('SkeletonRow renders a single pulse div', () => {
    const { container } = render(<SkeletonRow data-testid="row" />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(1);
  });

  test('SkeletonCard renders a larger pulse div', () => {
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(1);
  });

  test('SkeletonList renders N items when given count=5', () => {
    const { container } = render(<SkeletonList count={5} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5);
  });

  test('SkeletonList renders 52 items for archive timeline case', () => {
    const { container } = render(<SkeletonList count={52} />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(52);
  });

  test('SkeletonHero renders hero-sized blocks', () => {
    const { container } = render(<SkeletonHero />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // Hero shape: large number placeholder + small badge placeholders + button placeholder.
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 3.2: Run test and confirm it fails**

Run:

```bash
cd frontend && npx jest src/components/ui/__tests__/skeleton-patterns.test.tsx --runInBand
```

Expected: Module not found error.

- [ ] **Step 3.3: Implement skeleton composition components**

Create `frontend/src/components/ui/skeleton-patterns.tsx`:

```tsx
/**
 * Composition patterns on top of the base <Skeleton> primitive.
 *
 * Each pattern represents a shape reused across UX-1 surfaces. Use these
 * inside <Suspense fallback={...}> for async RSC children, or inside
 * presentation components when envelope.status === 'unavailable'.
 *
 * Scope: UX-1 Phase 1a. Add more patterns as later phases need them.
 */

import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

export function SkeletonRow({ className }: { className?: string }) {
  return <Skeleton className={cn('h-4 w-full', className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={cn('h-32 w-full rounded-lg', className)} />;
}

interface SkeletonListProps {
  count: number;
  itemShape?: 'row' | 'card';
  className?: string;
}

export function SkeletonList({ count, itemShape = 'row', className }: SkeletonListProps) {
  const Item = itemShape === 'card' ? SkeletonCard : SkeletonRow;
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}

export function SkeletonHero({ className }: { className?: string }) {
  // Hero strip shape: large score number + delta badge + regime badge + button.
  return (
    <div className={cn('flex items-center justify-between gap-4 p-6', className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  );
}

export function SkeletonForm({ fieldCount = 3, className }: { fieldCount?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: fieldCount }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3.4: Run test and confirm it passes**

Run:

```bash
cd frontend && npx jest src/components/ui/__tests__/skeleton-patterns.test.tsx --runInBand
```

Expected: 5 passed.

---

## Task 4: DOMAIN_MAP.md v1

**Files:**
- Create: `docs/DOMAIN_MAP.md`

- [ ] **Step 4.1: Write DOMAIN_MAP.md v1**

Create `docs/DOMAIN_MAP.md`:

```markdown
# API Domain Map

**Scope:** UX-1 read-path endpoints (13 surfaces). See `docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md` for architectural contracts.

**Status:** v1 — minimal registry. Add terms and naming conventions incrementally as new surfaces land.

**Read trigger:** Consult this file when introducing a new API field, renaming an existing field, or resolving a perceived naming conflict. Update this file when a new domain term is introduced.

---

## Envelope rule (root invariant)

Every read-path endpoint response root contains:

- `status: 'ready' | 'partial' | 'unavailable'` — required.
- Optional coverage metadata (surface-specific name: `coverage_start`, `as_of`, `since`, `horizon`, `coverage`, etc.).
- Surface-specific domain data fields. Use `[]` or `{}` for empty, never drop the field.

Empty-state shape equals loaded-state shape — only `status` changes value.

Backend: use `app.api._envelope.wrap_response` to produce these responses.
Frontend: use `lib/envelope.ts` predicates to branch presentation.

---

## Term registry

### Portfolio / performance (cashflow split, shipped in closeout)

- `archive.series` — absolute wealth history, includes external cashflows. `AbsoluteHistoryPoint[]`.
- `performance.series` — cashflow-neutral performance history. `PerformanceHistoryPoint[]`.
- `coverage_start` — ISO date or null. Earliest date for which persisted performance snapshots exist.

### Friday ritual

- `since` — ISO date. Previous freeze date for briefing delta computation.
- `severity_groups` — grouped event list for Since Last Friday card.
- `sleeves` — 6 canonical sleeve identifiers (NDX, DBMF, BRAZIL, MSTR, GLDM, BONDS-CASH).
- `sleeve_history` — per-sleeve signal-firing counts over last N weeks.
- `snapshot` — a single frozen weekly snapshot.
- `snapshots` — list of frozen snapshots.
- `report` — the full weekly report object (portfolio + macro + signals + rules + score).
- `coverage` — per-section availability flags on a snapshot `{portfolio, macro, rules, decisions, slippage, comment}`.
- `deltas` — computed diff between two snapshots on `/friday/compare`.

### Intelligence (Phase 1b will extend this section)

- `attributions` — score decomposition over time.
- `rules` — rule accuracy table entries.
- `outcomes` — decision outcome evaluation.
- `scorecard` — portfolio vs SPY-KRW risk-adjusted metrics.

---

## Naming conventions (established)

- Plural field name = collection (`series`, `events`, `sleeves`, `snapshots`).
- `status` at root is reserved for the envelope contract.
- `coverage_*` / `as_of` / `since` / `horizon` are coverage metadata keywords.

---

## Change log

- 2026-04-23 — v1. UX-1 Phase 1a shared-infra commit introduced envelope rule + registry. Portfolio/performance entries already shipped in closeout `49f4c2b`.
```

---

## Task 5: Commit shared infra (Task 1+2+3+4)

**Files staged:**
- `backend/app/api/__init__.py`
- `backend/app/api/_envelope.py`
- `backend/tests/test_envelope_wrap_response.py`
- `frontend/src/lib/envelope.ts`
- `frontend/src/lib/__tests__/envelope.test.ts`
- `frontend/src/components/ui/skeleton-patterns.tsx`
- `frontend/src/components/ui/__tests__/skeleton-patterns.test.tsx`
- `docs/DOMAIN_MAP.md`

- [ ] **Step 5.1: Run full backend suite**

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

Expected: all pass (baseline ~130 tests + 7 new envelope tests = ~137).

- [ ] **Step 5.2: Run frontend jest + lint + tsc**

```bash
cd frontend && npx jest --runInBand && npm run lint && npx tsc --noEmit
```

Expected: all green.

- [ ] **Step 5.3: Stage the shared-infra files only**

```bash
git add backend/app/api/__init__.py backend/app/api/_envelope.py \
        backend/tests/test_envelope_wrap_response.py \
        frontend/src/lib/envelope.ts \
        frontend/src/lib/__tests__/envelope.test.ts \
        frontend/src/components/ui/skeleton-patterns.tsx \
        frontend/src/components/ui/__tests__/skeleton-patterns.test.tsx \
        docs/DOMAIN_MAP.md
```

Verify with `git status` that AGENTS.md and any other unrelated files are NOT staged.

- [ ] **Step 5.4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ux1): shared envelope infra

Introduces the status-aware envelope contract used by every UX-1
read-path endpoint and frontend surface:

- Backend: app/api/_envelope.py::wrap_response guarantees every response
  has root 'status' in {ready, partial, unavailable} and preserves
  empty-state shape. Rejects invalid status values to catch typos early.
- Frontend: lib/envelope.ts exposes EnvelopeStatus type, StatusEnvelope
  interface, and isReady/isPartial/isUnavailable predicates for status
  branching in presentation components.
- Frontend: components/ui/skeleton-patterns.tsx adds SkeletonRow,
  SkeletonCard, SkeletonList, SkeletonHero, SkeletonForm composed on
  top of the existing shadcn/ui <Skeleton> primitive.
- Docs: DOMAIN_MAP.md v1 captures the envelope rule and the current
  term registry. To be extended incrementally as Phase 1b/1c land.

No existing pages or endpoints changed. Subsequent tasks convert
endpoints to use wrap_response and pages to use the skeleton patterns.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5.5: Verify**

```bash
git log --oneline -1
git status --short
```

Expected: new commit at top, no staged files remaining, `AGENTS.md` still showing as modified (user-owned).

---

## Task 6: `/api/reports/weekly/latest` envelope + contract test

**Files:**
- Modify: `backend/app/main.py:466-477`
- Create: `backend/tests/test_ux1_envelope_contract.py` (grows across tasks)

- [ ] **Step 6.1: Write contract test for `/api/reports/weekly/latest`**

Create `backend/tests/test_ux1_envelope_contract.py`:

```python
"""Per-endpoint envelope contract tests.

Each endpoint wrapped in Phase UX-1 gets three tests here:

  1. Success path returns envelope with status=ready and all expected fields.
  2. Upstream failure returns HTTP 200 + status=unavailable + empty shape.
  3. Empty-state shape equals loaded-state shape at the field-key level.
"""

from __future__ import annotations

from unittest.mock import patch


# --------------------------------------------------------------------------- #
# /api/reports/weekly/latest                                                  #
# --------------------------------------------------------------------------- #


def test_weekly_latest_returns_envelope_with_status(client):
    response = client.get("/api/reports/weekly/latest")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "report" in payload


def test_weekly_latest_unavailable_when_no_report(client):
    """Empty DB means no persisted report; must return unavailable shape, not 404."""
    response = client.get("/api/reports/weekly/latest")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["report"] is None


def test_weekly_latest_absorbs_service_failure_as_unavailable(client):
    from app.services.report_service import ReportService

    with patch.object(
        ReportService,
        "get_latest_report",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/reports/weekly/latest")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["report"] is None
```

- [ ] **Step 6.2: Run test and confirm it fails**

```bash
cd backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v
```

Expected: all three tests fail — current endpoint raises 404 or 500 instead of returning envelope.

- [ ] **Step 6.3: Convert the endpoint to envelope**

Edit `backend/app/main.py`. Find the existing block at lines 466-477:

```python
@app.get("/api/reports/weekly/latest")
def get_latest_weekly_report(db: Session = Depends(get_db)):
    try:
        report = ReportService.get_latest_report(db)
        if not report:
            raise HTTPException(status_code=404, detail="Weekly report not found")
        return report
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in GET /api/reports/weekly/latest: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

Replace with:

```python
@app.get("/api/reports/weekly/latest")
def get_latest_weekly_report(db: Session = Depends(get_db)):
    """UX-1 envelope: always HTTP 200; failures absorb into status='unavailable'."""
    try:
        report = ReportService.get_latest_report(db)
        if not report:
            return wrap_response(status="unavailable", report=None)
        return wrap_response(status="ready", report=report)
    except Exception as e:
        logger.warning("weekly_latest_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", report=None)
```

At the top of `main.py`, add (if not present):

```python
import logging
from .api._envelope import wrap_response

logger = logging.getLogger(__name__)
```

Verify: after edit, the endpoint no longer raises `HTTPException` for the missing-report case; it returns `status='unavailable'` instead.

- [ ] **Step 6.4: Run the contract test; confirm pass**

```bash
cd backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v
```

Expected: 3 passed.

- [ ] **Step 6.5: Run full backend suite to confirm no regression**

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

Expected: all pass. The legacy 404 contract is gone — if any test depended on 404 from this endpoint, update it to check `status == 'unavailable'` instead. (Grep `get_latest_weekly_report` or `/reports/weekly/latest` in tests to find candidates.)

- [ ] **Step 6.6: Update frontend type + fetch for `/api/reports/weekly/latest`**

Edit `frontend/src/lib/api.ts`. Find `getLatestWeeklyReport` (grep for it). Update its signature and implementation to return the envelope.

Add type near the other envelope types (after `PortfolioHistoryData`):

```typescript
export interface WeeklyReportEnvelope {
  status: EnvelopeStatus;
  report: WeeklyReport | null;
}
```

Update `EnvelopeStatus` import at the top of `api.ts`:

```typescript
import type { EnvelopeStatus } from './envelope';
```

Update the fetch function:

```typescript
const emptyWeeklyReportEnvelope: WeeklyReportEnvelope = {
  status: 'unavailable',
  report: null,
};

export async function getLatestWeeklyReport(): Promise<WeeklyReportEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/reports/weekly/latest`, { cache: 'no-store' });
    if (!res.ok) return emptyWeeklyReportEnvelope;
    const data = await res.json();
    // Graceful parse: if shape is unexpected, treat as unavailable.
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyWeeklyReportEnvelope;
    }
    return data as WeeklyReportEnvelope;
  } catch {
    return emptyWeeklyReportEnvelope;
  }
}
```

- [ ] **Step 6.7: Convert `app/page.tsx` to RSC streaming**

Replace the entire contents of `frontend/src/app/page.tsx` with:

```tsx
import { Suspense } from 'react';

import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { SkeletonHero, SkeletonList } from '@/components/ui/skeleton-patterns';
import { getLatestWeeklyReport } from '@/lib/api';

export default function ThisWeekPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <Suspense fallback={<ThisWeekSkeleton />}>
        <ThisWeekReport />
      </Suspense>
    </main>
  );
}

function ThisWeekSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <SkeletonHero />
      <SkeletonList count={4} itemShape="card" />
    </div>
  );
}

async function ThisWeekReport() {
  const envelope = await getLatestWeeklyReport();

  if (envelope.status === 'unavailable' || !envelope.report) {
    return (
      <div className="p-8 text-muted-foreground text-sm">
        이번 주 리포트를 불러올 수 없어요. 나중에 다시 시도해주세요.
      </div>
    );
  }

  return (
    <WeeklyReportView
      report={envelope.report}
      eyebrow="This Week"
      title="Weekly Decision Surface"
      description={`Week Ending ${envelope.report.weekEnding} · Generated ${new Date(envelope.report.generatedAt).toLocaleString()}`}
    />
  );
}
```

- [ ] **Step 6.8: Run frontend lint + tsc + jest**

```bash
cd frontend && npm run lint && npx tsc --noEmit && npx jest --runInBand
```

Expected: all green. If tsc complains about `WeeklyReport` type usage, verify the type is imported (either alongside the envelope or from an existing location in `api.ts`).

- [ ] **Step 6.9: Commit**

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts frontend/src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(ux1): This Week async fill

Converts /api/reports/weekly/latest to the UX-1 envelope contract and
restructures app/page.tsx (This Week, the app entry point) to RSC
streaming with a single Suspense boundary.

Behavior changes:
- Endpoint always returns HTTP 200. Missing persisted report is now
  status='unavailable' with report=null instead of HTTP 404.
- Upstream exceptions absorb into status='unavailable' with a structured
  warning log; the page renders an explicit fallback message instead
  of crashing.
- Page component no longer blocks on the fetch. Server streams the
  skeleton shell immediately; the report section fills in as the fetch
  resolves.

Frontend WeeklyReportEnvelope type added next to existing envelope
types. Contract tests cover success, unavailable-on-empty, and
unavailable-on-service-failure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Friday page panel streaming

This task converts four endpoints + restructures `app/friday/page.tsx`. Larger surface area than Task 6 — keep the commit cohesive by batching all four endpoints + page restructure into a single commit at the end.

**Files:**
- Modify: `backend/app/main.py` — four endpoint handlers
- Modify: `frontend/src/lib/api.ts` — four fetch functions + types
- Create: `frontend/src/components/friday/FridayBriefingSection.tsx`
- Create: `frontend/src/components/friday/FridaySleeveSection.tsx`
- Create: `frontend/src/components/friday/FridayReportSection.tsx`
- Modify: `frontend/src/app/friday/page.tsx`
- Modify: `backend/tests/test_ux1_envelope_contract.py` — add three endpoint test suites

- [ ] **Step 7.1: Write contract tests for all four Friday endpoints**

Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/v1/friday/briefing                                                     #
# --------------------------------------------------------------------------- #


def test_friday_briefing_returns_envelope(client):
    response = client.get("/api/v1/friday/briefing")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "severity_groups" in payload
    assert "since" in payload


def test_friday_briefing_absorbs_service_failure(client):
    from app.services import briefing_service

    with patch.object(
        briefing_service.BriefingService,
        "get_briefing",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/briefing")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["severity_groups"] == []


def test_friday_briefing_rejects_invalid_date(client):
    response = client.get("/api/v1/friday/briefing?since=not-a-date")
    assert response.status_code == 400  # input validation still 4xx


# --------------------------------------------------------------------------- #
# /api/v1/friday/sleeve-history                                               #
# --------------------------------------------------------------------------- #


def test_friday_sleeve_history_returns_envelope(client):
    response = client.get("/api/v1/friday/sleeve-history?weeks=4")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "sleeves" in payload
    assert "as_of" in payload


def test_friday_sleeve_history_absorbs_service_failure(client):
    from app.services import briefing_service

    with patch.object(
        briefing_service.BriefingService,
        "get_sleeve_history",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/sleeve-history")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["sleeves"] == []


# --------------------------------------------------------------------------- #
# /api/v1/friday/current                                                      #
# --------------------------------------------------------------------------- #


def test_friday_current_returns_envelope(client):
    response = client.get("/api/v1/friday/current")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "report" in payload


def test_friday_current_absorbs_service_failure(client):
    from app.services.friday_service import FridayService

    with patch.object(
        FridayService,
        "get_current_report",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/current")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["report"] is None


# --------------------------------------------------------------------------- #
# /api/v1/friday/snapshots                                                    #
# --------------------------------------------------------------------------- #


def test_friday_snapshots_returns_envelope(client):
    response = client.get("/api/v1/friday/snapshots")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "snapshots" in payload
    assert "count" in payload


def test_friday_snapshots_absorbs_service_failure(client):
    from app.services.friday_service import FridayService

    with patch.object(
        FridayService,
        "list_snapshots",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/friday/snapshots")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["snapshots"] == []
```

Run to confirm all fail (endpoints not yet wrapped):

```bash
cd backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v
```

Expected: all the new Friday tests fail; the three `/api/reports/weekly/latest` tests still pass.

- [ ] **Step 7.2: Convert `/api/v1/friday/briefing` to envelope**

Edit `backend/app/main.py` around line 555. Replace the handler with:

```python
@app.get("/api/v1/friday/briefing")
def get_friday_briefing(since: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        since_date = datetime.strptime(since, "%Y-%m-%d").date() if since else None
    except ValueError:
        raise HTTPException(status_code=400, detail="since must be YYYY-MM-DD")

    try:
        from .services.briefing_service import BriefingService
        briefing = BriefingService.get_briefing(db, since=since_date)
        return wrap_response(
            status="ready",
            since=briefing.get("since"),
            severity_groups=briefing.get("severity_groups", []),
        )
    except Exception as e:
        logger.warning("friday_briefing_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            since=None,
            severity_groups=[],
        )
```

Note: the exact keys returned by `BriefingService.get_briefing` need verification. If the service returns `{"since": ..., "severity_groups": ...}` as expected, the code above works. If it returns different keys, match them in the `wrap_response` call. Grep the service for its return shape before adjusting.

- [ ] **Step 7.3: Convert `/api/v1/friday/sleeve-history` to envelope**

Edit `backend/app/main.py` around line 570. Replace with:

```python
@app.get("/api/v1/friday/sleeve-history")
def get_friday_sleeve_history(weeks: int = 4, db: Session = Depends(get_db)):
    try:
        from .services.briefing_service import BriefingService
        result = BriefingService.get_sleeve_history(db, weeks=weeks)
        return wrap_response(
            status="ready",
            as_of=result.get("as_of"),
            sleeves=result.get("sleeves", []),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as e:
        logger.warning("friday_sleeve_history_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            as_of=None,
            sleeves=[],
        )
```

- [ ] **Step 7.4: Convert `/api/v1/friday/current` to envelope**

Edit `backend/app/main.py` around line 659. Replace with:

```python
@app.get("/api/v1/friday/current")
def get_friday_current(db: Session = Depends(get_db)):
    try:
        report = FridayService.get_current_report(db)
        if not report:
            return wrap_response(status="unavailable", report=None)
        return wrap_response(status="ready", report=report)
    except Exception as e:
        logger.warning("friday_current_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", report=None)
```

- [ ] **Step 7.5: Convert `/api/v1/friday/snapshots` to envelope**

Find the handler (around line 546):

```python
@app.get("/api/v1/friday/snapshots")
def get_friday_snapshots(db: Session = Depends(get_db)):
    try:
        snapshots = FridayService.list_snapshots(db)
        return wrap_response(
            status="ready",
            count=len(snapshots),
            snapshots=snapshots,
        )
    except Exception as e:
        logger.warning("friday_snapshots_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", count=0, snapshots=[])
```

- [ ] **Step 7.6: Run contract tests; confirm all pass**

```bash
cd backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v
```

Expected: all tests pass (3 weekly + 9 Friday × tests = 12).

- [ ] **Step 7.7: Run full backend suite**

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

Expected: all pass. If any existing friday test depends on the old return shape, update it. Likely candidates: `test_friday_service.py`, `test_api.py`, `test_friday_plan_b.py`. Search for direct asserts on keys like `"severity_groups"` at root (without `status`).

- [ ] **Step 7.8: Update frontend types + fetch functions**

Edit `frontend/src/lib/api.ts`. Near other envelope types, add:

```typescript
export interface FridayBriefingEnvelope {
  status: EnvelopeStatus;
  since: string | null;
  severity_groups: Array<{ severity: string; events: unknown[] }>;
}

export interface FridaySleeveHistoryEnvelope {
  status: EnvelopeStatus;
  as_of: string | null;
  sleeves: Array<{
    label: string;
    current_weight: number;
    target_weight: number;
    signals_last_n: number[];
  }>;
}

export interface FridayCurrentEnvelope {
  status: EnvelopeStatus;
  report: WeeklyReport | null;
}

export interface FridaySnapshotsEnvelope {
  status: EnvelopeStatus;
  count: number;
  snapshots: FridaySnapshotSummary[];
}
```

(The `FridaySnapshotSummary` and `WeeklyReport` types should already exist. If shapes below `status` differ from what I've specified — this plan is inferring the `sleeves` items shape from DESIGN.md — keep the actual shape from the existing type and only wrap with `status`/`count`.)

Replace each fetch function to return the envelope:

```typescript
const emptyFridayBriefing: FridayBriefingEnvelope = {
  status: 'unavailable',
  since: null,
  severity_groups: [],
};

export async function getFridayBriefing(since?: string): Promise<FridayBriefingEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const qs = since ? `?since=${since}` : '';
    const res = await fetch(`${API_BASE}/api/v1/friday/briefing${qs}`, { cache: 'no-store' });
    if (!res.ok) return emptyFridayBriefing;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) return emptyFridayBriefing;
    return data as FridayBriefingEnvelope;
  } catch {
    return emptyFridayBriefing;
  }
}

// Apply the same shape (empty + try/catch + typeguard) for:
// - getFridaySleeveHistory(weeks?: number)
// - getFridayCurrent()
// - getFridaySnapshots()
```

Write empty constants for each: `emptyFridaySleeveHistory`, `emptyFridayCurrent`, `emptyFridaySnapshots`. Each follows the same pattern — `status: 'unavailable'` + domain fields set to empty.

- [ ] **Step 7.9: Create `FridayBriefingSection.tsx` (RSC async child)**

Create `frontend/src/components/friday/FridayBriefingSection.tsx`:

```tsx
/**
 * RSC async child for the Since Last Friday briefing panel on /friday.
 * Fetches its own endpoint; isolates the briefing fetch from other panels
 * so a slow briefing does not block hero/signals/sleeve renders.
 */

import { getFridayBriefing } from '@/lib/api';
import { SinceLastFridayBriefing } from './SinceLastFridayBriefing';

export async function FridayBriefingSection() {
  const envelope = await getFridayBriefing();

  if (envelope.status === 'unavailable') {
    return (
      <div className="rounded-lg border border-border/40 p-4 text-sm text-muted-foreground">
        지난 금요일 이후 이벤트를 불러올 수 없어요.
      </div>
    );
  }

  return (
    <SinceLastFridayBriefing
      since={envelope.since}
      severityGroups={envelope.severity_groups}
      partial={envelope.status === 'partial'}
    />
  );
}
```

Verify `SinceLastFridayBriefing`'s current props. If it accepts different prop names, match them here. If the component currently expects the raw briefing dict, either (a) pass the envelope through or (b) introduce a small prop-adapter. Do not silently rename its props.

- [ ] **Step 7.10: Create `FridaySleeveSection.tsx`**

Create `frontend/src/components/friday/FridaySleeveSection.tsx`:

```tsx
import { getFridaySleeveHistory } from '@/lib/api';
import { SleeveHealthPanel } from './SleeveHealthPanel';

export async function FridaySleeveSection() {
  const envelope = await getFridaySleeveHistory(4);

  if (envelope.status === 'unavailable') {
    return (
      <div className="rounded-lg border border-border/40 p-4 text-sm text-muted-foreground">
        Sleeve 데이터를 불러올 수 없어요.
      </div>
    );
  }

  return <SleeveHealthPanel sleeves={envelope.sleeves} asOf={envelope.as_of} />;
}
```

- [ ] **Step 7.11: Create `FridayReportSection.tsx`**

Create `frontend/src/components/friday/FridayReportSection.tsx`:

```tsx
import { getFridayCurrent } from '@/lib/api';
import { FridayDashboard } from './FridayDashboard';

export async function FridayReportSection() {
  const envelope = await getFridayCurrent();

  if (envelope.status === 'unavailable' || !envelope.report) {
    return (
      <div className="rounded-lg border border-border/40 p-8 text-sm text-muted-foreground">
        이번 주 리포트를 불러올 수 없어요.
      </div>
    );
  }

  return <FridayDashboard report={envelope.report} />;
}
```

- [ ] **Step 7.12: Restructure `app/friday/page.tsx`**

Replace the contents of `frontend/src/app/friday/page.tsx` with:

```tsx
import { Suspense } from 'react';

import { FridayBriefingSection } from '@/components/friday/FridayBriefingSection';
import { FridayReportSection } from '@/components/friday/FridayReportSection';
import { FridaySleeveSection } from '@/components/friday/FridaySleeveSection';
import { SkeletonCard, SkeletonHero, SkeletonList } from '@/components/ui/skeleton-patterns';

export default function FridayPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <Suspense fallback={<BriefingSkeleton />}>
        <FridayBriefingSection />
      </Suspense>

      <Suspense fallback={<HeroSkeleton />}>
        <FridayReportSection />
      </Suspense>

      <Suspense fallback={<SleeveSkeleton />}>
        <FridaySleeveSection />
      </Suspense>
    </main>
  );
}

function BriefingSkeleton() {
  return <SkeletonList count={3} itemShape="card" className="rounded-lg" />;
}

function HeroSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonHero />
      <SkeletonList count={4} itemShape="row" />
    </div>
  );
}

function SleeveSkeleton() {
  return <SkeletonList count={6} itemShape="row" />;
}
```

- [ ] **Step 7.13: Run frontend checks**

```bash
cd frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: green. If tsc complains about prop mismatches on `FridayDashboard`, `SleeveHealthPanel`, or `SinceLastFridayBriefing`, go back to Step 7.9/7.10/7.11 and reconcile prop names — do not silently cast.

- [ ] **Step 7.14: Commit**

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/app/friday/page.tsx \
        frontend/src/components/friday/FridayBriefingSection.tsx \
        frontend/src/components/friday/FridaySleeveSection.tsx \
        frontend/src/components/friday/FridayReportSection.tsx
git commit -m "$(cat <<'EOF'
feat(ux1): Friday page panel streaming

Converts four Friday endpoints to the UX-1 envelope and restructures
app/friday/page.tsx from Promise.all blocking to per-panel Suspense
streaming. Previously the page blocked on the slowest of four fetches
(warm measurement: 9.6s on /api/v1/friday/current). After this commit,
each panel streams its own HTML chunk as its fetch resolves.

Endpoints converted:
- /api/v1/friday/briefing
- /api/v1/friday/sleeve-history
- /api/v1/friday/current
- /api/v1/friday/snapshots

Each endpoint now returns HTTP 200 with status in {ready, unavailable}
for normal and upstream-failure paths. Upstream exceptions are absorbed
with a structured warning log; no 5xx surfaces to the client.

New RSC async children (FridayBriefingSection, FridaySleeveSection,
FridayReportSection) each fetch their own endpoint. The page renders
skeletons immediately; panels fill in independently.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Friday snapshot detail skeleton-first

**Files:**
- Modify: `backend/app/main.py:582-595` (roughly)
- Modify: `frontend/src/lib/api.ts` — `getFridaySnapshot`
- Create: `frontend/src/components/friday/FridaySnapshotSection.tsx`
- Modify: `frontend/src/app/friday/[snapshotDate]/page.tsx`
- Append tests to: `backend/tests/test_ux1_envelope_contract.py`

- [ ] **Step 8.1: Contract tests for `/api/v1/friday/snapshot/{date}`**

Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/v1/friday/snapshot/{date}                                              #
# --------------------------------------------------------------------------- #


def test_friday_snapshot_envelope_on_missing_date(client):
    response = client.get("/api/v1/friday/snapshot/2020-01-03")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["snapshot"] is None


def test_friday_snapshot_envelope_shape(client):
    response = client.get("/api/v1/friday/snapshot/2020-01-03")
    payload = response.json()
    for key in {"status", "date", "coverage", "snapshot"}:
        assert key in payload


def test_friday_snapshot_rejects_bad_date(client):
    response = client.get("/api/v1/friday/snapshot/not-a-date")
    assert response.status_code == 400  # input validation stays 4xx
```

- [ ] **Step 8.2: Run and confirm fails**

```bash
cd backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k snapshot
```

Expected: three new tests fail.

- [ ] **Step 8.3: Convert snapshot detail endpoint**

Edit `backend/app/main.py` around line 582. Replace with:

```python
@app.get("/api/v1/friday/snapshot/{snapshot_date}")
def get_friday_snapshot(snapshot_date: str, db: Session = Depends(get_db)):
    try:
        parsed = datetime.strptime(snapshot_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="snapshot_date must be YYYY-MM-DD")

    try:
        snapshot = FridayService.get_snapshot(db, parsed)
        coverage = _compute_snapshot_coverage(snapshot)
        status = "ready" if all(coverage.values()) else "partial"
        return wrap_response(
            status=status,
            date=snapshot_date,
            coverage=coverage,
            snapshot=snapshot,
        )
    except SnapshotNotFoundError:
        return wrap_response(
            status="unavailable",
            date=snapshot_date,
            coverage={
                "portfolio": False,
                "macro": False,
                "rules": False,
                "decisions": False,
                "slippage": False,
                "comment": False,
            },
            snapshot=None,
        )
    except Exception as e:
        logger.warning("friday_snapshot_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            date=snapshot_date,
            coverage={
                "portfolio": False,
                "macro": False,
                "rules": False,
                "decisions": False,
                "slippage": False,
                "comment": False,
            },
            snapshot=None,
        )
```

Add helper near `wrap_response` imports at top of `main.py`:

```python
def _compute_snapshot_coverage(snapshot: dict | None) -> dict[str, bool]:
    """Derive per-section coverage flags from a snapshot dict."""
    if not snapshot:
        return {
            "portfolio": False,
            "macro": False,
            "rules": False,
            "decisions": False,
            "slippage": False,
            "comment": False,
        }
    frozen = snapshot.get("frozenReport") or snapshot.get("frozen_report") or {}
    return {
        "portfolio": bool(frozen.get("portfolioSnapshot")),
        "macro": bool(frozen.get("macroSnapshot")),
        "rules": bool(frozen.get("rules")),
        "decisions": bool(snapshot.get("decisions")),
        "slippage": bool(snapshot.get("slippage_entries")),
        "comment": bool(snapshot.get("comment") or "").strip() != "",
    }
```

Adjust the field-name inspection in `_compute_snapshot_coverage` to match what `FridayService.get_snapshot` actually returns. Grep for `_serialize_snapshot` or equivalent in `friday_service.py` and mirror those field names.

- [ ] **Step 8.4: Run contract tests; confirm pass**

```bash
cd backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k snapshot
```

Expected: all pass.

- [ ] **Step 8.5: Run full backend suite**

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

Expected: pass. Legacy 404 on missing-snapshot is now absorbed to envelope — update any test asserting 404 from this endpoint.

- [ ] **Step 8.6: Frontend envelope type + fetch**

In `frontend/src/lib/api.ts`, add:

```typescript
export interface FridaySnapshotEnvelope {
  status: EnvelopeStatus;
  date: string;
  coverage: {
    portfolio: boolean;
    macro: boolean;
    rules: boolean;
    decisions: boolean;
    slippage: boolean;
    comment: boolean;
  };
  snapshot: FridaySnapshotDetail | null;
}

const emptyFridaySnapshot = (date: string): FridaySnapshotEnvelope => ({
  status: 'unavailable',
  date,
  coverage: {
    portfolio: false,
    macro: false,
    rules: false,
    decisions: false,
    slippage: false,
    comment: false,
  },
  snapshot: null,
});

export async function getFridaySnapshot(snapshotDate: string): Promise<FridaySnapshotEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/snapshot/${snapshotDate}`, {
      cache: 'no-store',
    });
    if (!res.ok) return emptyFridaySnapshot(snapshotDate);
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyFridaySnapshot(snapshotDate);
    }
    return data as FridaySnapshotEnvelope;
  } catch {
    return emptyFridaySnapshot(snapshotDate);
  }
}
```

(`FridaySnapshotDetail` should already exist in `api.ts`; verify and reuse.)

- [ ] **Step 8.7: Create `FridaySnapshotSection.tsx`**

```tsx
/** RSC async child for Friday snapshot detail page. */

import { getFridaySnapshot } from '@/lib/api';
import { FridaySnapshotPanel } from './FridaySnapshotPanel';

export async function FridaySnapshotSection({ date }: { date: string }) {
  const envelope = await getFridaySnapshot(date);

  if (envelope.status === 'unavailable' || !envelope.snapshot) {
    return (
      <div className="rounded-lg border border-border/40 p-8 text-sm text-muted-foreground">
        {envelope.date} 의 freeze 데이터를 불러올 수 없어요.
      </div>
    );
  }

  return (
    <FridaySnapshotPanel
      snapshot={envelope.snapshot}
      coverage={envelope.coverage}
      partial={envelope.status === 'partial'}
    />
  );
}
```

Adjust `FridaySnapshotPanel` props if it doesn't currently accept `coverage` / `partial`. If it doesn't, extend its type signature in the same commit — keep the extension minimal.

- [ ] **Step 8.8: Restructure `app/friday/[snapshotDate]/page.tsx`**

Replace contents with:

```tsx
import { Suspense } from 'react';

import { FridaySnapshotSection } from '@/components/friday/FridaySnapshotSection';
import { SkeletonHero, SkeletonList } from '@/components/ui/skeleton-patterns';

interface PageProps {
  params: Promise<{ snapshotDate: string }>;
}

export default async function FridaySnapshotDetailPage({ params }: PageProps) {
  const { snapshotDate } = await params;
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">{snapshotDate}</h1>
      <Suspense fallback={<DetailSkeleton />}>
        <FridaySnapshotSection date={snapshotDate} />
      </Suspense>
    </main>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <SkeletonHero />
      <SkeletonList count={3} itemShape="card" />
      <SkeletonList count={5} itemShape="row" />
    </div>
  );
}
```

- [ ] **Step 8.9: Checks + commit**

```bash
cd backend && .venv/bin/python -m pytest tests -q && cd ../frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: all green.

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/app/friday/\[snapshotDate\]/page.tsx \
        frontend/src/components/friday/FridaySnapshotSection.tsx
git commit -m "$(cat <<'EOF'
feat(ux1): Friday snapshot detail skeleton-first

Converts /api/v1/friday/snapshot/{date} to the UX-1 envelope and
restructures the detail page (/friday/[snapshotDate]) to RSC streaming.

Endpoint changes:
- Missing snapshot is status='unavailable' with a fully-populated
  coverage map of false flags (instead of HTTP 404).
- Partial snapshot (some sections present, others missing) surfaces as
  status='partial' + coverage booleans. Matches CLAUDE.md Current
  Contract Notes on partial-snapshot safety.
- Upstream exceptions absorb to status='unavailable' with a structured
  warning log.

Page changes:
- Skeleton renders immediately from URL-derived date param; no blank
  while fetch resolves.
- Render branches on envelope.status + coverage flags.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Friday archive — timeline streaming + compare client-triggered

**Files:**
- Modify: `backend/app/main.py` — `/api/v1/friday/snapshots` (already from Task 7) + `/api/v1/friday/compare`
- Modify: `frontend/src/lib/api.ts` — `compareFridaySnapshots`
- Create: `frontend/src/components/friday/CompareClient.tsx`
- Modify: `frontend/src/app/friday/archive/page.tsx`
- Append tests to: `backend/tests/test_ux1_envelope_contract.py`

- [ ] **Step 9.1: Contract tests for `/api/v1/friday/compare`**

Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/v1/friday/compare                                                      #
# --------------------------------------------------------------------------- #


def test_friday_compare_envelope_shape(client):
    response = client.get("/api/v1/friday/compare?a=2020-01-01&b=2020-01-08")
    assert response.status_code == 200
    payload = response.json()
    for key in {"status", "a", "b", "deltas"}:
        assert key in payload


def test_friday_compare_unavailable_when_snapshots_missing(client):
    response = client.get("/api/v1/friday/compare?a=2020-01-01&b=2020-01-08")
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["deltas"] is None
```

- [ ] **Step 9.2: Convert `/api/v1/friday/compare` to envelope**

Find the handler near line 644 in `main.py` and replace:

```python
@app.get("/api/v1/friday/compare")
def get_friday_compare(
    a: str, b: str, db: Session = Depends(get_db)
):
    try:
        parsed_a = datetime.strptime(a, "%Y-%m-%d").date()
        parsed_b = datetime.strptime(b, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="a and b must be YYYY-MM-DD")

    try:
        deltas = FridayService.compare_snapshots(db, parsed_a, parsed_b)
        return wrap_response(status="ready", a=a, b=b, deltas=deltas)
    except SnapshotNotFoundError:
        return wrap_response(status="unavailable", a=a, b=b, deltas=None)
    except Exception as e:
        logger.warning("friday_compare_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", a=a, b=b, deltas=None)
```

- [ ] **Step 9.3: Run contract tests + full suite**

```bash
cd backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v && .venv/bin/python -m pytest tests -q
```

Expected: all green.

- [ ] **Step 9.4: Update frontend `compareFridaySnapshots`**

In `frontend/src/lib/api.ts`, add type + fetch:

```typescript
export interface FridayCompareEnvelope {
  status: EnvelopeStatus;
  a: string;
  b: string;
  deltas: CompareDeltas | null;
}

const emptyFridayCompare = (a: string, b: string): FridayCompareEnvelope => ({
  status: 'unavailable',
  a,
  b,
  deltas: null,
});

export async function compareFridaySnapshots(a: string, b: string): Promise<FridayCompareEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/friday/compare?a=${a}&b=${b}`, {
      cache: 'no-store',
    });
    if (!res.ok) return emptyFridayCompare(a, b);
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyFridayCompare(a, b);
    }
    return data as FridayCompareEnvelope;
  } catch {
    return emptyFridayCompare(a, b);
  }
}
```

(`CompareDeltas` should exist from the earlier snapshot comparison spec; reuse it.)

- [ ] **Step 9.5: Create `CompareClient.tsx` — on-demand fetch**

Create `frontend/src/components/friday/CompareClient.tsx`:

```tsx
/**
 * Client component for Friday archive comparison.
 *
 * Renders snapshot-selector dropdowns and a Compare button. The compare
 * fetch fires only on user trigger — previously the archive page
 * overfetched comparison data on page load inside a Promise.all.
 */

'use client';

import { useState } from 'react';

import { compareFridaySnapshots, type FridayCompareEnvelope, type FridaySnapshotSummary } from '@/lib/api';

interface CompareClientProps {
  snapshots: FridaySnapshotSummary[];
}

export function CompareClient({ snapshots }: CompareClientProps) {
  const [a, setA] = useState<string>('');
  const [b, setB] = useState<string>('');
  const [result, setResult] = useState<FridayCompareEnvelope | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCompare() {
    if (!a || !b) return;
    setLoading(true);
    try {
      const envelope = await compareFridaySnapshots(a, b);
      setResult(envelope);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border/40 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
        Compare Two Fridays
      </h2>
      <div className="flex flex-wrap gap-4">
        <SnapshotSelect label="A" value={a} onChange={setA} snapshots={snapshots} />
        <SnapshotSelect label="B" value={b} onChange={setB} snapshots={snapshots} />
        <button
          onClick={handleCompare}
          disabled={!a || !b || loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </div>
      {result && <CompareResult envelope={result} />}
    </section>
  );
}

function SnapshotSelect({
  label,
  value,
  onChange,
  snapshots,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  snapshots: FridaySnapshotSummary[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        <option value="">Choose…</option>
        {snapshots.map((s) => (
          <option key={s.snapshotDate} value={s.snapshotDate}>
            {s.snapshotDate}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompareResult({ envelope }: { envelope: FridayCompareEnvelope }) {
  if (envelope.status === 'unavailable' || !envelope.deltas) {
    return (
      <div className="text-sm text-muted-foreground">
        선택한 두 스냅샷 중 하나 이상이 없거나 비교할 수 없어요.
      </div>
    );
  }
  return (
    <pre className="max-h-96 overflow-auto rounded-md bg-surface p-3 text-xs">
      {JSON.stringify(envelope.deltas, null, 2)}
    </pre>
  );
}
```

(The `CompareResult` rendering above is intentionally minimal. The original archive comparison UI, if richer, should be extracted into a presentation component and reused here. Keep this commit focused on the restructure; richer compare UX can ship separately.)

- [ ] **Step 9.6: Restructure `app/friday/archive/page.tsx`**

Replace contents:

```tsx
import { Suspense } from 'react';

import { CompareClient } from '@/components/friday/CompareClient';
import { getFridaySnapshots } from '@/lib/api';
import { SkeletonList } from '@/components/ui/skeleton-patterns';

export default function FridayArchivePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Friday Archive</h1>
      <Suspense fallback={<TimelineSkeleton />}>
        <ArchiveTimeline />
      </Suspense>
    </main>
  );
}

function TimelineSkeleton() {
  return <SkeletonList count={8} itemShape="card" />;
}

async function ArchiveTimeline() {
  const envelope = await getFridaySnapshots();

  if (envelope.status === 'unavailable') {
    return (
      <div className="rounded-lg border border-border/40 p-8 text-sm text-muted-foreground">
        Archive 데이터를 불러올 수 없어요.
      </div>
    );
  }

  return (
    <>
      <section className="space-y-3">
        {envelope.snapshots.map((s) => (
          <ArchiveCard key={s.snapshotDate} snapshot={s} />
        ))}
      </section>
      <CompareClient snapshots={envelope.snapshots} />
    </>
  );
}

// Lift the existing archive card presentation from the prior page
// implementation. Preserve the existing visual treatment; only the
// outer data-flow has changed.
function ArchiveCard({ snapshot }: { snapshot: import('@/lib/api').FridaySnapshotSummary }) {
  return (
    <a
      href={`/friday/${snapshot.snapshotDate}`}
      className="block rounded-lg border border-border/40 p-4 hover:bg-surface-alt transition-colors"
    >
      <div className="text-sm font-semibold">{snapshot.snapshotDate}</div>
    </a>
  );
}
```

If the existing archive page had richer card rendering, lift the markup from the pre-restructure version of `app/friday/archive/page.tsx` (read from git history: `git show HEAD~N:frontend/src/app/friday/archive/page.tsx`) into `ArchiveCard` above — do not regress visual treatment.

- [ ] **Step 9.7: Checks + commit**

```bash
cd backend && .venv/bin/python -m pytest tests -q && cd ../frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/app/friday/archive/page.tsx \
        frontend/src/components/friday/CompareClient.tsx
git commit -m "$(cat <<'EOF'
feat(ux1): Friday archive — timeline streaming + compare client-triggered

Restructures /friday/archive so the timeline renders via RSC streaming
with skeleton-first, and the snapshot comparison becomes a user-
triggered client component instead of an unconditional page-load fetch.

Previously the archive page ran Promise.all over getFridaySnapshots()
and compareFridaySnapshots() at page load — comparison data was fetched
for every visit even though the comparison UI is only meaningful when
the user selects two snapshots and clicks Compare.

After this commit:
- Timeline: RSC async child; skeleton renders immediately; fills as
  fetch resolves.
- Comparison: lifted to CompareClient (client component). Fetch fires
  only on button click. Removes the unconditional compare fetch.
- /api/v1/friday/compare wrapped in the UX-1 envelope; missing
  snapshots or service errors absorb into status='unavailable'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: SystemCache for Phase 1a hot paths

Measurement-driven caching. The scope lock defers endpoint selection to measure-then-decide at this point (decision doc §7 Q7.3).

**Files:**
- Modify: `backend/app/main.py` — at most 2 endpoints
- Modify: `backend/app/services/friday_service.py` or similar service — cache wrapper
- Append tests to: `backend/tests/test_ux1_envelope_contract.py` or create new test file

- [ ] **Step 10.1: Measure p50 latency for Phase 1a endpoints**

On a warm production or staging backend, measure p50 latency for each of these endpoints over 10 sequential requests:

```bash
# Run against warm backend. Replace BASE_URL with actual.
BASE_URL="${BACKEND_BASE_URL:-https://<render-backend>}"
for endpoint in \
  "/api/reports/weekly/latest" \
  "/api/v1/friday/briefing" \
  "/api/v1/friday/sleeve-history?weeks=4" \
  "/api/v1/friday/current" \
  "/api/v1/friday/snapshots"
do
  echo "=== $endpoint ==="
  for i in {1..10}; do
    curl -s -o /dev/null -w "%{time_total}\n" "$BASE_URL$endpoint"
  done | sort -n | awk 'NR==5 {print "p50 (approx): " $1 "s"}'
done
```

Record the results in a comment at the top of this step. Any endpoint whose p50 > 3 seconds is a caching candidate (per decision doc §7 Q7.3).

- [ ] **Step 10.2: Decide target(s)**

Based on Step 10.1 output, pick at most 2–3 endpoints. Priors from the scope lock and prior observations:

- `/api/v1/friday/current` — measured 9.6s warm previously; very likely a target.
- `/api/v1/friday/briefing` — touches multiple aggregations; likely a target.

If none exceed 3s after the async-fill restructure already landed in Tasks 7–9 (which may have changed latency profile), skip this task — cache layer not needed yet. Note that finding in the commit message and close this task.

- [ ] **Step 10.3: Implement cache wrapper in the service layer**

Pattern (for each selected endpoint): wrap the service call. Example for `FridayService.get_current_report`:

```python
# backend/app/services/friday_service.py (excerpt)

from .cache_service import CacheService

_CURRENT_REPORT_CACHE_KEY = "ux1_friday_current_v1"


@staticmethod
def get_current_report_cached(db: Session) -> dict | None:
    """Cached wrapper around get_current_report.

    Cache is invalidated by:
    - weekly freeze (write path that creates a new snapshot).
    - cashflow writes (inherited from cashflow closeout contract).
    """
    cached = CacheService.get_cache(db, _CURRENT_REPORT_CACHE_KEY)
    if cached is not None:
        return cached

    report = FridayService.get_current_report(db)
    if report is not None:
        CacheService.set_cache(db, _CURRENT_REPORT_CACHE_KEY, report)
    return report
```

And, in the freeze-write path (`FridayService.create_snapshot` or equivalent), add:

```python
CacheService.invalidate_cache(db, _CURRENT_REPORT_CACHE_KEY)
```

Also, verify the existing cashflow-write invalidation path already drops `portfolio_*` keys (from cashflow closeout); if `ux1_friday_current_v1` depends on portfolio data, add it to that invalidation set.

Then update `main.py` to call the cached variant:

```python
@app.get("/api/v1/friday/current")
def get_friday_current(db: Session = Depends(get_db)):
    try:
        report = FridayService.get_current_report_cached(db)
        if not report:
            return wrap_response(status="unavailable", report=None)
        return wrap_response(status="ready", report=report)
    except Exception as e:
        logger.warning("friday_current_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", report=None)
```

- [ ] **Step 10.4: Add cache-specific tests**

Append to `backend/tests/test_ux1_envelope_contract.py` (or new file):

```python
def test_friday_current_cached_hits_cache_on_second_call(client, db_session):
    from app.services.friday_service import FridayService
    from app.services.cache_service import CacheService

    # Populate snapshot that makes get_current_report return something non-None.
    # (Use existing snapshot seeding helpers from the fixtures; omit here.)

    # First call — cache miss.
    r1 = client.get("/api/v1/friday/current")
    assert r1.status_code == 200

    # Cache should now be populated.
    cached = CacheService.get_cache(db_session, "ux1_friday_current_v1")
    assert cached is not None

    # Second call — same payload.
    r2 = client.get("/api/v1/friday/current")
    assert r2.json() == r1.json()


def test_friday_current_cache_invalidates_on_snapshot_create(client, db_session):
    from app.services.friday_service import FridayService
    from app.services.cache_service import CacheService

    # Prime the cache manually.
    CacheService.set_cache(db_session, "ux1_friday_current_v1", {"report": "stale"})

    # Creating a new snapshot invalidates.
    FridayService.create_snapshot(db_session)

    assert CacheService.get_cache(db_session, "ux1_friday_current_v1") is None
```

- [ ] **Step 10.5: Run tests + full suite**

```bash
cd backend && .venv/bin/python -m pytest tests -q
```

Expected: all green.

- [ ] **Step 10.6: Commit**

```bash
git add backend/app/main.py backend/app/services/friday_service.py \
        backend/tests/test_ux1_envelope_contract.py
git commit -m "$(cat <<'EOF'
perf(ux1): SystemCache for Phase 1a hot paths

Adds SystemCache caching on the endpoints measured at p50 > 3s in the
Phase 1a post-restructure latency profile. Selection criteria and
invalidation contract from decision doc §4 (Layering) and §7 Q7.3.

Cached endpoints (adjust commit body to actual selection at
implementation time):
- /api/v1/friday/current — previously 9.6s warm; cache populated on
  first request, invalidated by snapshot creation.

Invalidation triggers inherit the cashflow closeout contract:
cashflow writes drop performance-dependent keys. New Phase 1a keys
are added to that same trigger set where applicable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- [ ] **Spec coverage:** Each section of the scope-lock decision doc maps to at least one task here:
  - §3 Scope — Tasks 6–10 cover all 4 Phase 1a pages + shared infra.
  - §4 Contracts — Tasks 1–4 (shared infra).
  - §5 Data flow — Tasks 6–9 (RSC streaming per surface).
  - §6 Error handling — contract tests per endpoint in Tasks 6–9 + envelope absorption everywhere.
  - §7 Testing strategy — contract tests (Tasks 6–9), TDD cycle inside each task.
  - §8 Commit sequence — Tasks 5, 6, 7, 8, 9, 10 map 1:1 to decision-doc Phase 1a commits 1–6.
  - §9 Q7.2 (keep-alive) — already shipped outside this plan (commit `b5261a6`).
  - §9 Q7.6 (skeleton design) — Tasks 3 (shared primitives) + per-surface skeleton components authored as hybrid.
- [ ] **Placeholder scan:** No "TBD" / "implement later". A few explicit references to verifying current prop names and service return shapes before wiring — these are real instructions to the implementer, not placeholders.
- [ ] **Type consistency:** `EnvelopeStatus`, `StatusEnvelope`, envelope type names (`*Envelope`) used consistently. Task 6 onwards all import `EnvelopeStatus` from `./envelope`. Task 7 adds `FridayBriefingEnvelope`, `FridaySleeveHistoryEnvelope`, etc. — consistent pluralization where applicable.
- [ ] **Scope note:** The `StatusAwareSuspense` helper mentioned in decision doc §8 is intentionally not created. Rationale captured in File Structure section.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-phase-ux-1a-friday.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task. Main session reviews between tasks. Fast iteration; each task gets a clean context.

2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`. Batch execution with checkpoints for review.

Which approach?
