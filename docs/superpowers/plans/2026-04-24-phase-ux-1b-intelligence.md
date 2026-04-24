# Phase UX-1b — Intelligence Hierarchy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver first-paint instant HTML + per-panel async fill for the Intelligence hierarchy (`/intelligence` + 5 subroutes) by propagating Phase 1a's status-aware envelope contract and RSC streaming pattern to 6 more pages.

**Architecture:** Each read-path endpoint returns a response with `status: 'ready' | 'partial' | 'unavailable'` at root (Phase 1a contract). Next.js server components stream HTML shells with per-panel `<Suspense>` boundaries; each async child fetches its own endpoint independently. `/intelligence/risk-adjusted` preserves its existing client-side `useEffect` pattern and receives envelope normalization only (no structural change).

**Tech Stack:** Same as Phase 1a — FastAPI + SQLAlchemy + Alembic (backend), Next.js 14 App Router + TypeScript + React Server Components + Suspense (frontend), pytest (C-track sqlite) + Jest + React Testing Library, existing shadcn/ui `<Skeleton>` + Phase 1a's `skeleton-patterns.tsx`.

**Scope:** Phase 1b only. Phase 1c (`/archive*` + `/portfolio` alignment) is a separate plan. Scope lock: `docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md`.

**Prerequisite status (verified at plan-write time):**
- Phase 1a shipped. Commits `8982c9a..11474e4` on `main` and `origin/main`.
- `backend/app/api/_envelope.py::wrap_response` available.
- `frontend/src/lib/envelope.ts` with `EnvelopeStatus`, `StatusEnvelope`, `isReady/isPartial/isUnavailable` type-guards.
- `frontend/src/components/ui/skeleton-patterns.tsx` with `SkeletonRow/Card/List/Hero/Form`.
- `frontend/src/lib/friday-fetchers-rsc.ts` demonstrates the `server-only` + `cache()` dedup pattern (reuse for Intelligence if sharing fetchers across sections).
- `docs/DOMAIN_MAP.md` has Phase 1a entries; Phase 1b will add to the Intelligence section.
- Prod backend at `d2c4f6a8b901` alembic head; `portfolio_performance_snapshots` table exists (0 rows until backfill).

---

## Phase 1a conventions (applied across Phase 1b)

Per the D1–D6 reviews:

1. **Use `isReady`/`isPartial`/`isUnavailable` predicates** from `@/lib/envelope` — NOT string comparison (`envelope.status === 'ready'`). Type-guard narrowing depends on this.
2. **Skeleton shapes mirror loaded-state layouts** — read each presentation component first, then author a skeleton with matching dimensions.
3. **Contract tests include a real ready-path test** per endpoint — seed DB or mock service return; envelope-shape-only assertions are insufficient.
4. **Structured log event keys** follow `{endpoint}_upstream_unavailable` pattern.
5. **Legacy-caller compat when signature changes** — if a fetch function gains envelope shape and has callers outside the task's target page, apply a minimal 2-line unwrap at those callers with a `// TODO(ux1-phaseXxx)` comment.
6. **Single commit per dispatch.**
7. **`wrap_response` rejects invalid status** via `ValueError` — type-check via `Literal`.
8. **TDD discipline** — RED → GREEN per step.

---

## Cross-commit caller map (critical for ordering)

Three Intelligence fetchers are shared between the `/intelligence` root and its subroute pages:

| Fetcher | Root (`/intelligence`) | Subroute consumer |
|---|---|---|
| `getIntelligenceAttributions` | ✓ | `/intelligence/attributions` |
| `getIntelligenceRuleAccuracy` | ✓ | `/intelligence/rules` |
| `getIntelligenceOutcomes` | ✓ | `/intelligence/outcomes` |
| `getIntelligenceRegimeHistory` | — | `/intelligence/attributions` (only) |
| `getReviewSummary` | — | `/intelligence/reviews` (only) |
| `fetchRiskAdjustedScorecard` | — | `/intelligence/risk-adjusted` (only) |
| `fetchCalmarTrajectory` | mounted on `/intelligence` root as `CalmarTrajectoryPlaceholder` | — |

**Ordering implication:** Task 1 (`/intelligence` root) converts the 3 shared fetchers' signatures. After Task 1, the 3 subroute pages that still call those fetchers with the pre-envelope expectation will break unless given a minimal compat unwrap in the same commit. Task 1 MUST include the legacy-compat unwrap for all 3 subroute pages so the tree stays green between commits.

Tasks 2, 4, 5 then do the full restructure of their respective subroute pages (replacing the compat unwrap with real async children + Suspense).

---

## File Structure

### New files (backend)

- None — the `_envelope.py` helper from Phase 1a is reused.

### New files (frontend) — Intelligence sections

- `frontend/src/components/intelligence/IntelligenceAttributionsSection.tsx` (Task 1) — RSC async child; used by `/intelligence` root.
- `frontend/src/components/intelligence/IntelligenceRulesSection.tsx` (Task 1) — RSC async child; used by `/intelligence` root.
- `frontend/src/components/intelligence/IntelligenceOutcomesSection.tsx` (Task 1) — RSC async child; used by `/intelligence` root.
- `frontend/src/components/intelligence/IntelligenceRegimeHistorySection.tsx` (Task 3) — RSC async child; used by `/intelligence/attributions`.
- `frontend/src/components/intelligence/IntelligenceReviewsSection.tsx` (Task 5) — RSC async child; used by `/intelligence/reviews`.
- `frontend/src/lib/intelligence-fetchers-rsc.ts` (Task 1) — `server-only` wrapping React `cache()` around shared Intelligence fetchers (Attributions, RuleAccuracy, Outcomes). Mirrors Phase 1a's `friday-fetchers-rsc.ts`.

### Modified files (backend)

- `backend/app/main.py` — 6 endpoint handlers wrapped with `wrap_response`:
  - `/api/intelligence/attributions` (Task 1)
  - `/api/intelligence/rules/accuracy` (Task 1)
  - `/api/intelligence/outcomes` (Task 1)
  - `/api/intelligence/regime/history` (Task 3)
  - `/api/intelligence/reviews/summary` (Task 5)
  - `/api/v1/intelligence/risk-adjusted/scorecard` (Task 6)
  - `/api/v1/intelligence/risk-adjusted/calmar-trajectory` (Task 6)

- `backend/tests/test_ux1_envelope_contract.py` — appended with Intelligence contract tests per task.

### Modified files (frontend)

- `frontend/src/lib/api.ts` — 6 new envelope types + 6 updated fetchers.
- `frontend/src/app/intelligence/page.tsx` (Task 1) — RSC streaming with 3 Suspense boundaries.
- `frontend/src/app/intelligence/rules/page.tsx` (Task 2) — RSC streaming.
- `frontend/src/app/intelligence/attributions/page.tsx` (Task 3) — RSC streaming with 2 Suspense boundaries.
- `frontend/src/app/intelligence/outcomes/page.tsx` (Task 4) — RSC streaming. (Note: existing component is `OutcomesView` receiving `initialOutcomes` — hints at client-side filtering. Treat the page as RSC streaming the initial outcomes, with `OutcomesView` retaining its own client-side filter state via `'use client'` + `useState`.)
- `frontend/src/app/intelligence/reviews/page.tsx` (Task 5) — RSC streaming.
- `frontend/src/app/intelligence/risk-adjusted/page.tsx` (Task 6) — client-pattern preserved, envelope consumption normalized (`ready: boolean` → `status: 'ready'|'partial'|'unavailable'`).

### Modified files (presentation components, minimal prop adaptation)

- `frontend/src/components/intelligence/IntelligenceDashboard.tsx` (Task 1) — may need slimming if it currently renders all three panels internally (mirrors Phase 1a D3's FridayDashboard slim pattern). Verify first.
- `frontend/src/components/intelligence/RiskAdjustedScorecard.tsx` (Task 6) — if it reads `payload.ready`, switch to `payload.status === 'ready'` and update `RiskAdjustedScorecardPayload` type.

### Modified files (docs)

- `docs/DOMAIN_MAP.md` — add/extend the Intelligence section as envelope types are introduced.

---

## Task 1: `/intelligence` root — panel streaming (3 endpoints envelope + page restructure + legacy compat)

**Files touched:**
- Modify: `backend/app/main.py` — handlers for `attributions`, `rules/accuracy`, `outcomes`.
- Modify: `backend/tests/test_ux1_envelope_contract.py` — append tests.
- Modify: `frontend/src/lib/api.ts` — 3 envelope types + updated fetchers.
- Create: `frontend/src/lib/intelligence-fetchers-rsc.ts` — `cache()` wrappers.
- Create: `frontend/src/components/intelligence/IntelligenceAttributionsSection.tsx`.
- Create: `frontend/src/components/intelligence/IntelligenceRulesSection.tsx`.
- Create: `frontend/src/components/intelligence/IntelligenceOutcomesSection.tsx`.
- Modify: `frontend/src/app/intelligence/page.tsx` — 3 Suspense boundaries.
- Modify: `frontend/src/app/intelligence/rules/page.tsx` — minimal compat unwrap.
- Modify: `frontend/src/app/intelligence/attributions/page.tsx` — minimal compat unwrap.
- Modify: `frontend/src/app/intelligence/outcomes/page.tsx` — minimal compat unwrap.

### Step 1.1: Contract tests for 3 endpoints

Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/intelligence/attributions                                              #
# --------------------------------------------------------------------------- #


def test_intelligence_attributions_returns_envelope(client):
    response = client.get("/api/intelligence/attributions")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "attributions" in payload


def test_intelligence_attributions_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_attributions",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/attributions")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["attributions"] == []


def test_intelligence_attributions_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_data = [
        {"snapshotDate": "2026-04-18", "buckets": [], "scoreTotal": 72},
    ]
    with patch.object(IntelligenceService, "get_attributions", return_value=fake_data):
        response = client.get("/api/intelligence/attributions")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["attributions"] == fake_data


def test_intelligence_attributions_rejects_bad_date(client):
    response = client.get("/api/intelligence/attributions?date_from=not-a-date")
    assert response.status_code in {400, 422}  # FastAPI validates at param parse


# --------------------------------------------------------------------------- #
# /api/intelligence/rules/accuracy                                            #
# --------------------------------------------------------------------------- #


def test_intelligence_rules_accuracy_returns_envelope(client):
    response = client.get("/api/intelligence/rules/accuracy")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "rules" in payload


def test_intelligence_rules_accuracy_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_rule_accuracy",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/rules/accuracy")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["rules"] == []


def test_intelligence_rules_accuracy_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_rules = [
        {"ruleId": "R1", "fired": 5, "followed": 3, "accuracy": 0.6},
    ]
    with patch.object(IntelligenceService, "get_rule_accuracy", return_value=fake_rules):
        response = client.get("/api/intelligence/rules/accuracy")
        assert response.json()["status"] == "ready"
        assert response.json()["rules"] == fake_rules


# --------------------------------------------------------------------------- #
# /api/intelligence/outcomes                                                  #
# --------------------------------------------------------------------------- #


def test_intelligence_outcomes_returns_envelope(client):
    response = client.get("/api/intelligence/outcomes")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "outcomes" in payload
    assert "horizon" in payload


def test_intelligence_outcomes_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_outcomes",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/outcomes")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["outcomes"] == []


def test_intelligence_outcomes_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_outcomes = [
        {"decisionId": 1, "horizon": "3m", "outcomeDelta": 0.05},
    ]
    with patch.object(IntelligenceService, "get_outcomes", return_value=fake_outcomes):
        response = client.get("/api/intelligence/outcomes?horizon=3m")
        assert response.json()["status"] == "ready"
        assert response.json()["horizon"] == "3m"
        assert response.json()["outcomes"] == fake_outcomes


def test_intelligence_outcomes_rejects_bad_horizon(client):
    response = client.get("/api/intelligence/outcomes?horizon=not-a-horizon")
    assert response.status_code == 400
```

Run to confirm they fail:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k "intelligence_attributions or intelligence_rules or intelligence_outcomes"
```

Expected: ready/failure-absorb tests fail (endpoint returns raw data, not envelope); shape test fails (no `status` key); bad-date/bad-horizon tests may pass depending on whether FastAPI/handler validation runs before envelope code.

### Step 1.2: Convert backend endpoints

Edit `backend/app/main.py`. Replace each handler:

**`/api/intelligence/attributions`** (around line 729):

```python
@app.get("/api/intelligence/attributions")
def get_intelligence_attributions(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Time series of score decompositions across date range."""
    try:
        from_date = date.fromisoformat(date_from) if date_from else None
        to_date = date.fromisoformat(date_to) if date_to else None
    except ValueError:
        raise HTTPException(status_code=400, detail="date_from/date_to must be YYYY-MM-DD")

    try:
        attributions = IntelligenceService.get_attributions(db, date_from=from_date, date_to=to_date)
        return wrap_response(
            status="ready",
            date_from=date_from,
            date_to=date_to,
            attributions=attributions or [],
        )
    except Exception as e:
        logger.warning("intelligence_attributions_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            date_from=date_from,
            date_to=date_to,
            attributions=[],
        )
```

**`/api/intelligence/rules/accuracy`** (around line 762):

```python
@app.get("/api/intelligence/rules/accuracy")
def get_intelligence_rule_accuracy(db: Session = Depends(get_db)):
    """Per-rule accuracy: times fired, times followed, follow rate."""
    try:
        rules = IntelligenceService.get_rule_accuracy(db)
        return wrap_response(status="ready", rules=rules or [])
    except Exception as e:
        logger.warning("intelligence_rules_accuracy_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", rules=[])
```

**`/api/intelligence/outcomes`** (around line 751):

```python
@app.get("/api/intelligence/outcomes")
def get_intelligence_outcomes(
    horizon: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Decision outcomes evaluated at specified horizon."""
    if horizon and horizon not in ("1w", "1m", "3m", "6m", "1y"):
        raise HTTPException(status_code=400, detail="Invalid horizon. Use: 1w, 1m, 3m, 6m, 1y")

    try:
        outcomes = IntelligenceService.get_outcomes(db, horizon=horizon)
        return wrap_response(
            status="ready",
            horizon=horizon,
            outcomes=outcomes or [],
        )
    except Exception as e:
        logger.warning("intelligence_outcomes_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            horizon=horizon,
            outcomes=[],
        )
```

### Step 1.3: Run tests + full suite

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k "intelligence_attributions or intelligence_rules or intelligence_outcomes"
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 10 new tests pass. Full suite 171 + 10 = 181. Any legacy tests on these endpoints that assumed raw return shape must be updated to expect `{status, ...}`.

### Step 1.4: Update frontend types + fetchers

In `frontend/src/lib/api.ts`, near the existing Intelligence fetchers (around line 1075), define envelope types:

```typescript
export interface IntelligenceAttributionsEnvelope {
  status: EnvelopeStatus;
  date_from: string | null;
  date_to: string | null;
  attributions: AttributionData[];
}

export interface IntelligenceRulesAccuracyEnvelope {
  status: EnvelopeStatus;
  rules: RuleAccuracyData[];
}

export interface IntelligenceOutcomesEnvelope {
  status: EnvelopeStatus;
  horizon: string | null;
  outcomes: DecisionOutcomeData[];
}

const emptyIntelligenceAttributionsEnvelope: IntelligenceAttributionsEnvelope = {
  status: 'unavailable',
  date_from: null,
  date_to: null,
  attributions: [],
};

const emptyIntelligenceRulesAccuracyEnvelope: IntelligenceRulesAccuracyEnvelope = {
  status: 'unavailable',
  rules: [],
};

const emptyIntelligenceOutcomesEnvelope = (horizon?: string | null): IntelligenceOutcomesEnvelope => ({
  status: 'unavailable',
  horizon: horizon ?? null,
  outcomes: [],
});
```

Replace each fetcher to return the envelope. Example for attributions:

```typescript
export async function getIntelligenceAttributions(dateFrom?: string, dateTo?: string): Promise<IntelligenceAttributionsEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const params = new URLSearchParams();
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/api/intelligence/attributions${qs}`, { cache: 'no-store' });
    if (!res.ok) return emptyIntelligenceAttributionsEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyIntelligenceAttributionsEnvelope;
    }
    return data as IntelligenceAttributionsEnvelope;
  } catch {
    return emptyIntelligenceAttributionsEnvelope;
  }
}
```

Apply the same pattern for `getIntelligenceRuleAccuracy` (returning `IntelligenceRulesAccuracyEnvelope`) and `getIntelligenceOutcomes(horizon?)` (returning `IntelligenceOutcomesEnvelope`).

**CRITICAL — verify types exist**: `AttributionData`, `RuleAccuracyData`, `DecisionOutcomeData` types already exist in `api.ts` (pre-envelope). Grep and reuse; don't redefine.

### Step 1.5: Create RSC async children

Create `frontend/src/components/intelligence/IntelligenceAttributionsSection.tsx`:

```tsx
/**
 * RSC async child for the attributions panel on /intelligence root.
 * Renders the score-decomposition view via the existing component.
 * Phase UX-1b Task 1.
 */

import { getIntelligenceAttributionsCached } from '@/lib/intelligence-fetchers-rsc';
import { isReady } from '@/lib/envelope';
import { AttributionsView } from './AttributionsView';

export async function IntelligenceAttributionsSection() {
  const envelope = await getIntelligenceAttributionsCached();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Attribution data unavailable.
      </div>
    );
  }

  // AttributionsView takes `attributions` (and possibly `regimeHistory` — for the root page
  // where regime history is not shown, pass an empty array. Verify AttributionsView's current
  // prop signature before wiring. If it strictly requires regimeHistory, Task 3 introduces the
  // RegimeHistory section; for Task 1 the root view should not need regime overlay.
  return <AttributionsView attributions={envelope.attributions} regimeHistory={[]} />;
}
```

Create `frontend/src/components/intelligence/IntelligenceRulesSection.tsx`:

```tsx
import { getIntelligenceRuleAccuracyCached } from '@/lib/intelligence-fetchers-rsc';
import { isReady } from '@/lib/envelope';
import { RulesView } from './RulesView';

export async function IntelligenceRulesSection() {
  const envelope = await getIntelligenceRuleAccuracyCached();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Rule-accuracy data unavailable.
      </div>
    );
  }

  return <RulesView ruleAccuracy={envelope.rules} />;
}
```

Create `frontend/src/components/intelligence/IntelligenceOutcomesSection.tsx`:

```tsx
import { getIntelligenceOutcomesCached } from '@/lib/intelligence-fetchers-rsc';
import { isReady } from '@/lib/envelope';
import { OutcomesView } from './OutcomesView';

export async function IntelligenceOutcomesSection() {
  const envelope = await getIntelligenceOutcomesCached();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Decision outcomes unavailable.
      </div>
    );
  }

  return <OutcomesView initialOutcomes={envelope.outcomes} />;
}
```

**Before wiring, verify each presentation component's current prop signature** by reading their source files (`AttributionsView.tsx`, `RulesView.tsx`, `OutcomesView.tsx`). If a component expects a richer prop shape (e.g., `IntelligenceDashboard` may have prepared all three panels internally), STOP and report. If a component is currently a dumb presentation that just needs the data shape change, wire the envelope field directly.

### Step 1.6: Create `intelligence-fetchers-rsc.ts`

Create `frontend/src/lib/intelligence-fetchers-rsc.ts`:

```tsx
/**
 * Server-only RSC fetchers for the Intelligence surface.
 *
 * Wraps shared fetch functions from `./api` with React's `cache()` primitive
 * so multiple RSC children in the same render pass share one backend call.
 * Mirrors the Phase 1a `friday-fetchers-rsc.ts` pattern.
 *
 * Import these in RSC async children (server components) on `/intelligence`
 * and its subroutes where the same fetcher is called from multiple sections.
 * Do NOT import in client components — `cache()` is server-only.
 */

import 'server-only';
import { cache } from 'react';

import {
  getIntelligenceAttributions,
  getIntelligenceRuleAccuracy,
  getIntelligenceOutcomes,
  getIntelligenceRegimeHistory,
} from './api';

export const getIntelligenceAttributionsCached = cache(getIntelligenceAttributions);
export const getIntelligenceRuleAccuracyCached = cache(getIntelligenceRuleAccuracy);
export const getIntelligenceOutcomesCached = cache(getIntelligenceOutcomes);
export const getIntelligenceRegimeHistoryCached = cache(getIntelligenceRegimeHistory);
```

The `server-only` package was installed in Phase 1a D3 — already present in `package.json`.

### Step 1.7: Restructure `app/intelligence/page.tsx`

Replace contents of `frontend/src/app/intelligence/page.tsx` with:

```tsx
import { Suspense } from 'react';

import { IntelligenceAttributionsSection } from '@/components/intelligence/IntelligenceAttributionsSection';
import { IntelligenceOutcomesSection } from '@/components/intelligence/IntelligenceOutcomesSection';
import { IntelligenceRulesSection } from '@/components/intelligence/IntelligenceRulesSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton-patterns';

export default function IntelligencePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
      {/* Hero — renders immediately */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          Intelligence
        </div>
        <h1 className="text-3xl font-bold tracking-tight italic">Patterns across months</h1>
      </div>

      <Suspense fallback={<AttributionsSkeleton />}>
        <IntelligenceAttributionsSection />
      </Suspense>

      <Suspense fallback={<RulesSkeleton />}>
        <IntelligenceRulesSection />
      </Suspense>

      <Suspense fallback={<OutcomesSkeleton />}>
        <IntelligenceOutcomesSection />
      </Suspense>
    </main>
  );
}

function AttributionsSkeleton() {
  // Match the loaded AttributionsView hero + chart + bucket table.
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <SkeletonCard className="h-64" />
      <SkeletonList count={4} itemShape="row" />
    </div>
  );
}

function RulesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-32" />
      <SkeletonList count={8} itemShape="row" />
    </div>
  );
}

function OutcomesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonList count={5} itemShape="card" />
    </div>
  );
}
```

**Verify skeleton shape fidelity** — read `AttributionsView.tsx`, `RulesView.tsx`, `OutcomesView.tsx` briefly and adjust dimensions if the loaded state has different hero/content sizes. Keep skeletons approximate but shape-matching.

**Note on `IntelligenceDashboard`**: the current page imports `IntelligenceDashboard` and passes three props. If that component is a thin wrapper around the three sub-views, the new RSC sections replace it directly and `IntelligenceDashboard` becomes dead code. **Grep for `IntelligenceDashboard` usage elsewhere** — if nowhere else uses it, delete the file in this commit with a line in the commit body noting removal. If it's used by something outside Intelligence, leave it in place and mark as legacy (not this task's concern).

### Step 1.8: Legacy-compat unwrap on 3 subroute pages

These will be fully restructured in Tasks 2, 4. For now, minimal envelope unwrap to prevent breakage.

**`frontend/src/app/intelligence/rules/page.tsx`**:
```tsx
import { getIntelligenceRuleAccuracy } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { RulesView } from '@/components/intelligence/RulesView';

export default async function RulesPage() {
  // TODO(ux1-phase1b-task2): full Suspense restructure lands in Task 2.
  const envelope = await getIntelligenceRuleAccuracy();
  const ruleAccuracy = isReady(envelope) ? envelope.rules : [];
  return <RulesView ruleAccuracy={ruleAccuracy} />;
}
```

**`frontend/src/app/intelligence/attributions/page.tsx`**:
```tsx
import { getIntelligenceAttributions, getIntelligenceRegimeHistory } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { AttributionsView } from '@/components/intelligence/AttributionsView';

export default async function AttributionsPage() {
  // TODO(ux1-phase1b-task3): full Suspense restructure lands in Task 3 (with regime-history envelope).
  const [attributionsEnvelope, regimeHistory] = await Promise.all([
    getIntelligenceAttributions(),
    getIntelligenceRegimeHistory(),
  ]);
  const attributions = isReady(attributionsEnvelope) ? attributionsEnvelope.attributions : [];
  return <AttributionsView attributions={attributions} regimeHistory={regimeHistory} />;
}
```

**`frontend/src/app/intelligence/outcomes/page.tsx`**:
```tsx
import { getIntelligenceOutcomes } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { OutcomesView } from '@/components/intelligence/OutcomesView';

export default async function OutcomesPage() {
  // TODO(ux1-phase1b-task4): full Suspense restructure lands in Task 4.
  const envelope = await getIntelligenceOutcomes();
  const outcomes = isReady(envelope) ? envelope.outcomes : [];
  return <OutcomesView initialOutcomes={outcomes} />;
}
```

### Step 1.9: Run frontend checks + commit

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: backend 181 passes (171 + 10 new). Frontend green.

Stage + commit (exclude `AGENTS.md`):

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/lib/intelligence-fetchers-rsc.ts \
        frontend/src/app/intelligence/page.tsx \
        frontend/src/app/intelligence/rules/page.tsx \
        frontend/src/app/intelligence/attributions/page.tsx \
        frontend/src/app/intelligence/outcomes/page.tsx \
        frontend/src/components/intelligence/IntelligenceAttributionsSection.tsx \
        frontend/src/components/intelligence/IntelligenceRulesSection.tsx \
        frontend/src/components/intelligence/IntelligenceOutcomesSection.tsx
# If IntelligenceDashboard.tsx was deleted:
# git rm frontend/src/components/intelligence/IntelligenceDashboard.tsx

git commit -m "$(cat <<'EOF'
feat(ux1b): intelligence root panel streaming

Converts three Intelligence endpoints to the UX-1 envelope and
restructures /intelligence to per-panel Suspense streaming.

Endpoints:
- /api/intelligence/attributions → {status, date_from, date_to, attributions}
- /api/intelligence/rules/accuracy → {status, rules}
- /api/intelligence/outcomes → {status, horizon, outcomes}

Each returns HTTP 200 with status='unavailable' + empty shape on
upstream failure (structured warning log: intelligence_*_upstream_unavailable).
Input validation (bad horizon / bad date) still returns 400.

Frontend:
- 3 new RSC async children (IntelligenceAttributionsSection, *RulesSection,
  *OutcomesSection), each using isReady predicate.
- /intelligence page restructured: hero renders immediately, 3 Suspense
  boundaries stream each panel independently.
- frontend/src/lib/intelligence-fetchers-rsc.ts mirrors Phase 1a's
  friday-fetchers-rsc.ts — server-only cache() wrappers for
  Attributions/RuleAccuracy/Outcomes/RegimeHistory so RSC children that
  share a fetcher dedupe within one render pass.

Legacy compat:
- /intelligence/rules, /intelligence/attributions, /intelligence/outcomes
  subroute pages receive minimal envelope unwrap (isReady ? data : fallback).
  Tasks 2–4 will replace these with full Suspense restructures.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `/intelligence/rules` page restructure

**Files:**
- Modify: `frontend/src/app/intelligence/rules/page.tsx` — RSC streaming.
- (No backend change — endpoint already envelope'd in Task 1.)

### Step 2.1: Restructure page with Suspense

Replace contents of `frontend/src/app/intelligence/rules/page.tsx` with:

```tsx
import { Suspense } from 'react';

import { IntelligenceRulesSection } from '@/components/intelligence/IntelligenceRulesSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';

export default function RulesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          Intelligence · Rules
        </div>
        <h1 className="text-3xl font-bold tracking-tight italic">Rule Accuracy</h1>
      </div>

      <Suspense fallback={<RulesPageSkeleton />}>
        <IntelligenceRulesSection />
      </Suspense>
    </main>
  );
}

function RulesPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonList count={10} itemShape="row" />
    </div>
  );
}
```

**Verify skeleton fidelity** — check `RulesView.tsx` layout. The `count={10}` guess assumes ~10 rules; adjust based on the real loaded state.

### Step 2.2: Run checks + commit

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: all green. No new tests this task.

```bash
git add frontend/src/app/intelligence/rules/page.tsx
git commit -m "$(cat <<'EOF'
feat(ux1b): intelligence rules page skeleton-first streaming

Removes the legacy-compat envelope unwrap introduced in Task 1 and
replaces it with a proper <Suspense> boundary wrapping the existing
IntelligenceRulesSection async child. Page hero renders immediately;
rule-accuracy table streams in as the fetch resolves.

No backend change — endpoint envelope'd in Task 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `/intelligence/attributions` dual-panel streaming

**Files:**
- Modify: `backend/app/main.py` — `/api/intelligence/regime/history` handler.
- Modify: `backend/tests/test_ux1_envelope_contract.py` — append regime-history tests.
- Modify: `frontend/src/lib/api.ts` — new `IntelligenceRegimeHistoryEnvelope` type + updated `getIntelligenceRegimeHistory` fetcher.
- Create: `frontend/src/components/intelligence/IntelligenceRegimeHistorySection.tsx`.
- Modify: `frontend/src/app/intelligence/attributions/page.tsx` — full Suspense restructure (2 boundaries).

### Step 3.1: Contract tests for `/api/intelligence/regime/history`

Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/intelligence/regime/history                                            #
# --------------------------------------------------------------------------- #


def test_intelligence_regime_history_returns_envelope(client):
    response = client.get("/api/intelligence/regime/history")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "transitions" in payload


def test_intelligence_regime_history_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_regime_history",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/regime/history")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["transitions"] == []


def test_intelligence_regime_history_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_transitions = [
        {"date": "2026-04-01", "from": "Risk On", "to": "Neutral"},
    ]
    with patch.object(IntelligenceService, "get_regime_history", return_value=fake_transitions):
        response = client.get("/api/intelligence/regime/history")
        assert response.json()["status"] == "ready"
        assert response.json()["transitions"] == fake_transitions
```

Run + confirm they fail:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k regime_history
```

### Step 3.2: Convert `/api/intelligence/regime/history` endpoint

Edit `backend/app/main.py` around line 768:

```python
@app.get("/api/intelligence/regime/history")
def get_intelligence_regime_history(db: Session = Depends(get_db)):
    """Regime transitions timeline with before/after portfolio state."""
    try:
        transitions = IntelligenceService.get_regime_history(db)
        return wrap_response(status="ready", transitions=transitions or [])
    except Exception as e:
        logger.warning("intelligence_regime_history_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", transitions=[])
```

### Step 3.3: Frontend envelope type + fetcher

In `frontend/src/lib/api.ts`, near other envelope types:

```typescript
export interface IntelligenceRegimeHistoryEnvelope {
  status: EnvelopeStatus;
  transitions: RegimeTransitionData[];
}

const emptyIntelligenceRegimeHistoryEnvelope: IntelligenceRegimeHistoryEnvelope = {
  status: 'unavailable',
  transitions: [],
};
```

Replace `getIntelligenceRegimeHistory`:

```typescript
export async function getIntelligenceRegimeHistory(): Promise<IntelligenceRegimeHistoryEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/regime/history`, { cache: 'no-store' });
    if (!res.ok) return emptyIntelligenceRegimeHistoryEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyIntelligenceRegimeHistoryEnvelope;
    }
    return data as IntelligenceRegimeHistoryEnvelope;
  } catch {
    return emptyIntelligenceRegimeHistoryEnvelope;
  }
}
```

### Step 3.4: Create `IntelligenceRegimeHistorySection.tsx`

Create `frontend/src/components/intelligence/IntelligenceRegimeHistorySection.tsx`:

```tsx
/**
 * RSC async child for regime-history overlay on /intelligence/attributions.
 * Phase UX-1b Task 3.
 */

import { getIntelligenceRegimeHistoryCached } from '@/lib/intelligence-fetchers-rsc';
import { isReady } from '@/lib/envelope';
// Note: presentation for regime history may be embedded inside AttributionsView,
// or may be a sibling component. Verify by reading AttributionsView.tsx first.
// If regime history has no dedicated component, this section produces a simple
// list/table of transitions.

export async function IntelligenceRegimeHistorySection() {
  const envelope = await getIntelligenceRegimeHistoryCached();

  if (!isReady(envelope) || envelope.transitions.length === 0) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Regime transitions unavailable.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
        Regime Transitions
      </h2>
      <ul className="space-y-1 text-sm">
        {envelope.transitions.map((t, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="text-muted-foreground">{t.date}</span>
            <span>{t.from} → {t.to}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**Verify prop/field shapes** — read `AttributionsView.tsx` to see how `regimeHistory` was being rendered before. If the rendering is embedded in AttributionsView, move it into this new section (this section's markup above is the right replacement). The goal is: AttributionsView no longer takes `regimeHistory` prop; this section renders the transitions independently.

If AttributionsView currently embeds regime history deeply into its chart overlay, the extraction may be non-trivial. In that case: STOP and report NEEDS_CONTEXT — don't do deep presentation surgery in this task.

### Step 3.5: Restructure `app/intelligence/attributions/page.tsx`

Replace with:

```tsx
import { Suspense } from 'react';

import { IntelligenceAttributionsSection } from '@/components/intelligence/IntelligenceAttributionsSection';
import { IntelligenceRegimeHistorySection } from '@/components/intelligence/IntelligenceRegimeHistorySection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonCard, SkeletonList } from '@/components/ui/skeleton-patterns';

export default function AttributionsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          Intelligence · Attributions
        </div>
        <h1 className="text-3xl font-bold tracking-tight italic">Score Attribution</h1>
      </div>

      <Suspense fallback={<AttributionsPageSkeleton />}>
        <IntelligenceAttributionsSection />
      </Suspense>

      <Suspense fallback={<RegimeHistorySkeleton />}>
        <IntelligenceRegimeHistorySection />
      </Suspense>
    </main>
  );
}

function AttributionsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonCard className="h-72" />
      <SkeletonList count={4} itemShape="row" />
    </div>
  );
}

function RegimeHistorySkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-40" />
      <SkeletonList count={6} itemShape="row" />
    </div>
  );
}
```

### Step 3.6: Run checks + commit

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: backend 181 + 3 new = 184. Frontend green.

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/app/intelligence/attributions/page.tsx \
        frontend/src/components/intelligence/IntelligenceRegimeHistorySection.tsx
git commit -m "$(cat <<'EOF'
feat(ux1b): intelligence attributions dual-panel streaming

Converts /api/intelligence/regime/history to the UX-1 envelope and
restructures /intelligence/attributions to two independent Suspense
boundaries (attributions chart + regime-transition timeline).

The attributions panel reuses IntelligenceAttributionsSection (created
in Task 1). New IntelligenceRegimeHistorySection fetches regime/history
independently, so a slow regime lookup doesn't block the attributions
chart from streaming (and vice versa).

Endpoint: /api/intelligence/regime/history → {status, transitions}.
Failure absorbs to status='unavailable' with structured warning log
intelligence_regime_history_upstream_unavailable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `/intelligence/outcomes` page restructure

**Files:**
- Modify: `frontend/src/app/intelligence/outcomes/page.tsx` — RSC streaming.

### Step 4.1: Restructure page

Replace contents of `frontend/src/app/intelligence/outcomes/page.tsx` with:

```tsx
import { Suspense } from 'react';

import { IntelligenceOutcomesSection } from '@/components/intelligence/IntelligenceOutcomesSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';

export default function OutcomesPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          Intelligence · Outcomes
        </div>
        <h1 className="text-3xl font-bold tracking-tight italic">Decision Outcomes</h1>
      </div>

      <Suspense fallback={<OutcomesPageSkeleton />}>
        <IntelligenceOutcomesSection />
      </Suspense>
    </main>
  );
}

function OutcomesPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <SkeletonList count={6} itemShape="card" />
    </div>
  );
}
```

Note: `OutcomesView` takes `initialOutcomes` prop (implying client-side filtering via `useState` inside). Keep that contract — the RSC section streams the initial outcomes in and `OutcomesView` handles subsequent filtering entirely client-side. No change to `OutcomesView` component.

### Step 4.2: Check `<4 weeks` empty state

Per scope-lock §9 Q7.4, the `<4 weeks` empty state is a "data maturity gate" case. If `OutcomesView` currently renders "Decisions need time. Your first outcomes will appear in [X] weeks." on empty, preserve that — `IntelligenceOutcomesSection` passes `envelope.outcomes` which can be `[]`, and `OutcomesView` handles the empty render.

If the service should return `status='unavailable'` + weeks-until-ready metadata in the empty case, that's a future refinement. For this task, empty list is fine; `OutcomesView` existing empty-copy applies.

### Step 4.3: Run checks + commit

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: all green.

```bash
git add frontend/src/app/intelligence/outcomes/page.tsx
git commit -m "$(cat <<'EOF'
feat(ux1b): intelligence outcomes page skeleton-first streaming

Removes the legacy-compat envelope unwrap introduced in Task 1 and
replaces it with a <Suspense> boundary around the existing
IntelligenceOutcomesSection async child. Page hero renders immediately;
outcome cards stream in as the fetch resolves.

OutcomesView's client-side filtering via initialOutcomes prop is
preserved — the RSC section streams the initial data; client-side
interaction (horizon toggle, filter) is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/intelligence/reviews` page + endpoint

**Files:**
- Modify: `backend/app/main.py` — `/api/intelligence/reviews/summary` handler.
- Modify: `backend/tests/test_ux1_envelope_contract.py` — append reviews tests.
- Modify: `frontend/src/lib/api.ts` — new envelope type + updated fetcher.
- Create: `frontend/src/components/intelligence/IntelligenceReviewsSection.tsx`.
- Modify: `frontend/src/app/intelligence/reviews/page.tsx` — RSC streaming.

### Step 5.1: Contract tests

Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/intelligence/reviews/summary                                           #
# --------------------------------------------------------------------------- #


def test_intelligence_reviews_summary_returns_envelope(client):
    response = client.get("/api/intelligence/reviews/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "summary" in payload


def test_intelligence_reviews_summary_absorbs_service_failure(client):
    from app.services.intelligence_service import IntelligenceService

    with patch.object(
        IntelligenceService,
        "get_review_summary",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/intelligence/reviews/summary")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["summary"] == {
            "totalWeeks": 0,
            "months": [],
            "quarters": [],
            "years": [],
        }


def test_intelligence_reviews_summary_returns_ready_when_data_exists(client):
    from app.services.intelligence_service import IntelligenceService

    fake_summary = {
        "totalWeeks": 24,
        "months": ["2026-04"],
        "quarters": ["2026-Q1"],
        "years": ["2026"],
    }
    with patch.object(IntelligenceService, "get_review_summary", return_value=fake_summary):
        response = client.get("/api/intelligence/reviews/summary")
        assert response.json()["status"] == "ready"
        assert response.json()["summary"] == fake_summary
```

### Step 5.2: Convert `/api/intelligence/reviews/summary` endpoint

Edit `backend/app/main.py` around line 774:

```python
@app.get("/api/intelligence/reviews/summary")
def get_intelligence_review_summary(db: Session = Depends(get_db)):
    """Available review periods with data counts."""
    try:
        summary = IntelligenceService.get_review_summary(db)
        return wrap_response(status="ready", summary=summary)
    except Exception as e:
        logger.warning("intelligence_reviews_summary_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            summary={
                "totalWeeks": 0,
                "months": [],
                "quarters": [],
                "years": [],
            },
        )
```

### Step 5.3: Frontend envelope + fetcher

In `frontend/src/lib/api.ts`:

```typescript
export interface IntelligenceReviewSummaryEnvelope {
  status: EnvelopeStatus;
  summary: ReviewSummaryData;
}

const emptyIntelligenceReviewSummaryEnvelope: IntelligenceReviewSummaryEnvelope = {
  status: 'unavailable',
  summary: { totalWeeks: 0, months: [], quarters: [], years: [] },
};

export async function getReviewSummary(): Promise<IntelligenceReviewSummaryEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/intelligence/reviews/summary`, { cache: 'no-store' });
    if (!res.ok) return emptyIntelligenceReviewSummaryEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyIntelligenceReviewSummaryEnvelope;
    }
    return data as IntelligenceReviewSummaryEnvelope;
  } catch {
    return emptyIntelligenceReviewSummaryEnvelope;
  }
}
```

### Step 5.4: Create `IntelligenceReviewsSection.tsx`

```tsx
/**
 * RSC async child for reviews summary on /intelligence/reviews.
 * Phase UX-1b Task 5.
 */

import { getReviewSummary } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { ReviewsView } from './ReviewsView';

export async function IntelligenceReviewsSection() {
  const envelope = await getReviewSummary();

  if (!isReady(envelope)) {
    return (
      <div className="rounded-lg border border-border/40 p-6 text-sm text-muted-foreground">
        Reviews data unavailable.
      </div>
    );
  }

  return <ReviewsView summary={envelope.summary} />;
}
```

### Step 5.5: Restructure `app/intelligence/reviews/page.tsx`

```tsx
import { Suspense } from 'react';

import { IntelligenceReviewsSection } from '@/components/intelligence/IntelligenceReviewsSection';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonList } from '@/components/ui/skeleton-patterns';

export default function ReviewsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
          Intelligence · Reviews
        </div>
        <h1 className="text-3xl font-bold tracking-tight italic">Periodic Reviews</h1>
      </div>

      <Suspense fallback={<ReviewsPageSkeleton />}>
        <IntelligenceReviewsSection />
      </Suspense>
    </main>
  );
}

function ReviewsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonList count={4} itemShape="card" />
    </div>
  );
}
```

### Step 5.6: Run checks + commit

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: backend 184 + 3 new = 187. Frontend green.

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/app/intelligence/reviews/page.tsx \
        frontend/src/components/intelligence/IntelligenceReviewsSection.tsx
git commit -m "$(cat <<'EOF'
feat(ux1b): intelligence reviews page + endpoint envelope

Converts /api/intelligence/reviews/summary to the UX-1 envelope and
restructures /intelligence/reviews to RSC streaming.

Endpoint: {status, summary} where summary preserves the existing
{totalWeeks, months, quarters, years} shape. Empty/failure fallback
populates the same shape with zeros/empty arrays, matching the
Phase 1a "empty-state shape equals loaded-state shape" contract.

Per-period endpoints (monthly, quarterly, annual) are NOT converted
in this task — they're already interactive detail fetches driven by
user selection; envelope conversion there is a follow-up decision.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/intelligence/risk-adjusted` envelope normalization

**Files:**
- Modify: `backend/app/main.py` — scorecard + calmar-trajectory handlers.
- Modify: `backend/tests/test_ux1_envelope_contract.py` — append risk-adjusted tests.
- Modify: `frontend/src/lib/api.ts` — `RiskAdjustedScorecardPayload` type update + fetcher shape-guard.
- Modify: `frontend/src/app/intelligence/risk-adjusted/page.tsx` — client pattern preserved, `ready: boolean` → `status: union` conversion at consumer.
- Possibly modify: `frontend/src/components/intelligence/RiskAdjustedScorecard.tsx` — if it reads `payload.ready`.

### Step 6.1: Contract tests for scorecard + calmar-trajectory

Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/v1/intelligence/risk-adjusted/scorecard                                #
# --------------------------------------------------------------------------- #


def test_risk_adjusted_scorecard_returns_envelope(client):
    response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
    assert response.status_code == 200
    payload = response.json()
    # Scorecard retains its existing deep structure; the envelope just wraps status at root.
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "based_on_freezes" in payload
    assert "horizons" in payload
    assert "maturity_gate" in payload


def test_risk_adjusted_scorecard_absorbs_service_failure(client):
    from app.services.risk_adjusted_service import RiskAdjustedService

    with patch.object(
        RiskAdjustedService,
        "scorecard",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["based_on_freezes"] == 0


def test_risk_adjusted_scorecard_returns_ready_when_gate_passed(client):
    from app.services.risk_adjusted_service import RiskAdjustedService

    fake_scorecard = {
        "ready": True,  # pre-envelope field, retained for now — will be bridged in Step 6.2
        "based_on_freezes": 26,
        "based_on_weeks": 26,
        "first_freeze_date": "2025-10-31",
        "maturity_gate": {"required_weeks": 26, "current_weeks": 26, "ready": True},
        "horizons": {"6M": {}, "1Y": {}, "ITD": {}},
    }
    with patch.object(RiskAdjustedService, "scorecard", return_value=fake_scorecard):
        response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
        payload = response.json()
        assert payload["status"] == "ready"  # envelope-level ready
        assert payload["based_on_freezes"] == 26


def test_risk_adjusted_scorecard_unavailable_when_gate_not_passed(client):
    from app.services.risk_adjusted_service import RiskAdjustedService

    # Service returns a scorecard where maturity_gate.ready is false.
    fake_scorecard = {
        "ready": False,
        "based_on_freezes": 10,
        "based_on_weeks": 10,
        "first_freeze_date": "2026-02-21",
        "maturity_gate": {"required_weeks": 26, "current_weeks": 10, "ready": False},
        "horizons": {"6M": {}, "1Y": {}, "ITD": {}},
    }
    with patch.object(RiskAdjustedService, "scorecard", return_value=fake_scorecard):
        response = client.get("/api/v1/intelligence/risk-adjusted/scorecard")
        payload = response.json()
        # Envelope-level status derived from maturity gate.
        assert payload["status"] == "unavailable"
        assert payload["maturity_gate"]["current_weeks"] == 10


# --------------------------------------------------------------------------- #
# /api/v1/intelligence/risk-adjusted/calmar-trajectory                        #
# --------------------------------------------------------------------------- #


def test_calmar_trajectory_returns_envelope(client):
    response = client.get("/api/v1/intelligence/risk-adjusted/calmar-trajectory")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "points" in payload


def test_calmar_trajectory_absorbs_service_failure(client):
    from app.services.risk_adjusted_service import RiskAdjustedService

    with patch.object(
        RiskAdjustedService,
        "calmar_trajectory",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/v1/intelligence/risk-adjusted/calmar-trajectory")
        assert response.status_code == 200
        assert response.json()["status"] == "unavailable"
        assert response.json()["points"] == []
```

### Step 6.2: Convert scorecard + calmar-trajectory endpoints

Edit `backend/app/main.py` around line 807:

```python
@app.get("/api/v1/intelligence/risk-adjusted/scorecard")
def get_risk_adjusted_scorecard(db: Session = Depends(get_db)):
    """B5 — multi-horizon risk-adjusted scorecard.

    Envelope status derivation:
    - 'ready' when maturity_gate.ready is True.
    - 'unavailable' otherwise (including service error and not-enough-freezes).
    """
    from .services.risk_adjusted_service import RiskAdjustedService

    try:
        scorecard = RiskAdjustedService.scorecard(db)
        gate_ready = bool(scorecard.get("maturity_gate", {}).get("ready"))
        status = "ready" if gate_ready else "unavailable"
        return wrap_response(status=status, **scorecard)
    except Exception as e:
        logger.warning("risk_adjusted_scorecard_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            ready=False,
            based_on_freezes=0,
            based_on_weeks=0,
            first_freeze_date=None,
            maturity_gate={"required_weeks": 26, "current_weeks": 0, "ready": False},
            horizons={
                "6M": {"portfolio": {}, "spy_krw": {}},
                "1Y": {"portfolio": {}, "spy_krw": {}},
                "ITD": {"portfolio": {}, "spy_krw": {}},
            },
        )


@app.get("/api/v1/intelligence/risk-adjusted/calmar-trajectory")
def get_calmar_trajectory(db: Session = Depends(get_db)):
    """B4 — Calmar ratio trajectory over accumulated freezes."""
    from .services.risk_adjusted_service import RiskAdjustedService

    try:
        trajectory = RiskAdjustedService.calmar_trajectory(db)
        # trajectory may be either {"points": [...]} or a list — inspect service.
        if isinstance(trajectory, dict) and "points" in trajectory:
            points = trajectory.get("points") or []
        elif isinstance(trajectory, list):
            points = trajectory
        else:
            points = []
        return wrap_response(status="ready", points=points)
    except Exception as e:
        logger.warning("calmar_trajectory_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", points=[])
```

**Important**: verify `RiskAdjustedService.calmar_trajectory` return shape before running tests. If it returns a dict with additional metadata (start/end dates, etc.), preserve those in the envelope. If it returns a bare list, wrap as `points=list`.

### Step 6.3: Frontend type update — `RiskAdjustedScorecardPayload`

Edit `frontend/src/lib/api.ts`. Find `RiskAdjustedScorecardPayload` (around line 1212) and update:

```typescript
export type RiskAdjustedScorecardPayload = {
  status: EnvelopeStatus;
  // Preserve the existing `ready` field for backward compat with the service's
  // internal meaning ("gate passed"), but the envelope `status` is authoritative
  // for UI branching. Consumers should prefer isReady(payload) over payload.ready.
  ready: boolean;
  based_on_freezes: number;
  based_on_weeks: number;
  first_freeze_date: string | null;
  maturity_gate: { required_weeks: number; current_weeks: number; ready: boolean };
  horizons: { "6M": HorizonMetrics; "1Y": HorizonMetrics; ITD: HorizonMetrics };
};
```

Update `fetchRiskAdjustedScorecard` to be shape-guarded like the Phase 1a pattern:

```typescript
export async function fetchRiskAdjustedScorecard(): Promise<RiskAdjustedScorecardPayload> {
  const empty: RiskAdjustedScorecardPayload = {
    status: 'unavailable',
    ready: false,
    based_on_freezes: 0,
    based_on_weeks: 0,
    first_freeze_date: null,
    maturity_gate: { required_weeks: 26, current_weeks: 0, ready: false },
    horizons: {
      "6M": { portfolio: {} as HorizonMetrics["portfolio"], spy_krw: {} as HorizonMetrics["spy_krw"] } as HorizonMetrics,
      "1Y": { portfolio: {} as HorizonMetrics["portfolio"], spy_krw: {} as HorizonMetrics["spy_krw"] } as HorizonMetrics,
      ITD: { portfolio: {} as HorizonMetrics["portfolio"], spy_krw: {} as HorizonMetrics["spy_krw"] } as HorizonMetrics,
    },
  };
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/intelligence/risk-adjusted/scorecard`, { cache: 'no-store' });
    if (!res.ok) return empty;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) return empty;
    return data as RiskAdjustedScorecardPayload;
  } catch {
    return empty;
  }
}
```

If the `HorizonMetrics` type can be instantiated cleanly (without `as` coercion), prefer that. Inspect the type first.

Update `CalmarTrajectoryPayload` type + `fetchCalmarTrajectory` similarly:

```typescript
export type CalmarTrajectoryPayload = {
  status: EnvelopeStatus;
  points: CalmarTrajectoryPoint[];
};

export async function fetchCalmarTrajectory(): Promise<CalmarTrajectoryPayload> {
  const empty: CalmarTrajectoryPayload = { status: 'unavailable', points: [] };
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/v1/intelligence/risk-adjusted/calmar-trajectory`, { cache: 'no-store' });
    if (!res.ok) return empty;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) return empty;
    return data as CalmarTrajectoryPayload;
  } catch {
    return empty;
  }
}
```

**Caller of fetchCalmarTrajectory**: there's a `CalmarTrajectoryPlaceholder` mounted on `/intelligence` root. Grep for it — if it reads the old `CalmarTrajectoryPayload` shape, adjust consumption to the new envelope.

### Step 6.4: Update client page consumer

Edit `frontend/src/app/intelligence/risk-adjusted/page.tsx`. The existing file uses `useEffect` + `useState` — KEEP this pattern (Phase 1a preserved client pattern for this surface). Update only the `emptyPayload` + fetch consumption:

```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchRiskAdjustedScorecard, type RiskAdjustedScorecardPayload } from "@/lib/api";
import { isReady } from "@/lib/envelope";
import { RiskAdjustedScorecard } from "@/components/intelligence/RiskAdjustedScorecard";

function emptyPayload(): RiskAdjustedScorecardPayload {
  const nullMetric = { cagr: null, mdd: null, sd: null, sharpe: null, calmar: null, sortino: null };
  return {
    status: 'unavailable',
    ready: false,
    based_on_freezes: 0,
    based_on_weeks: 0,
    first_freeze_date: null,
    maturity_gate: { required_weeks: 26, current_weeks: 0, ready: false },
    horizons: {
      "6M": { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
      "1Y": { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
      ITD: { portfolio: { ...nullMetric }, spy_krw: { ...nullMetric } },
    },
  };
}

export default function RiskAdjustedPage() {
  const [payload, setPayload] = useState<RiskAdjustedScorecardPayload>(emptyPayload());

  useEffect(() => {
    let cancelled = false;
    fetchRiskAdjustedScorecard()
      .then((p) => { if (!cancelled) setPayload(p); })
      .catch(() => { /* keep empty-state fallback */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <RiskAdjustedScorecard payload={payload} />
    </main>
  );
}
```

### Step 6.5: Update `RiskAdjustedScorecard.tsx` if it reads `payload.ready`

**Grep first**: `grep -n "payload.ready\|\.ready" frontend/src/components/intelligence/RiskAdjustedScorecard.tsx` and any place where the UI branches on `payload.ready`.

If the component currently does something like:
```tsx
if (!payload.ready) {
  return <LockedScorecard ... />;
}
```

Add `isReady` import and update to:
```tsx
import { isReady } from "@/lib/envelope";
// ...
if (!isReady(payload)) {
  return <LockedScorecard ... />;
}
```

**Goal**: presentation branches on envelope `status`, not on the domain-internal `ready` boolean. The `ready` field stays in the type for backward compat, but new code uses `isReady(payload)`. Document this in a code comment if clarity helps.

### Step 6.6: Run checks + commit

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: backend 187 + 6 new = 193. Frontend green.

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/app/intelligence/risk-adjusted/page.tsx \
        frontend/src/components/intelligence/RiskAdjustedScorecard.tsx
git commit -m "$(cat <<'EOF'
refactor(ux1b): risk-adjusted envelope normalize

Converts the risk-adjusted scorecard + calmar-trajectory endpoints to
the UX-1 envelope and aligns the frontend client-pattern page with the
isReady predicate.

Envelope status derivation:
- scorecard: 'ready' when maturity_gate.ready is true (26+ weeks of
  freeze history). 'unavailable' otherwise. The pre-existing
  `ready: boolean` field is retained in the payload for backward-compat
  with the service's internal meaning, but consumers should prefer
  isReady(payload) over payload.ready for branching.
- calmar-trajectory: {status, points} — straightforward list wrap.

Frontend:
- RiskAdjustedScorecardPayload type extended with status: EnvelopeStatus.
- fetchRiskAdjustedScorecard + fetchCalmarTrajectory now shape-guarded
  (Phase 1a pattern: !res.ok / missing status → empty envelope).
- /intelligence/risk-adjusted page's useEffect client pattern preserved
  (Phase 1a explicitly kept this as the "already working as client"
  exception). Only the empty-state payload shape updated to include
  status: 'unavailable'.
- RiskAdjustedScorecard presentation component migrated from
  payload.ready to isReady(payload) for envelope-level branching.

Completes Phase 1b. All 6 Intelligence pages now follow the UX-1
envelope + RSC streaming pattern (risk-adjusted retains its client
pattern per scope lock §5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage** — mapping scope-lock decision doc requirements to tasks:
- §3 Scope (Phase 1b: 6 Intelligence pages) — Tasks 1, 2, 3, 4, 5, 6 cover all 6.
- §4 Contracts (status-aware envelope, per-panel fetch, SystemCache layering) — envelope: Tasks 1, 3, 5, 6. Per-panel fetch: Tasks 1, 3 (multiple Suspense boundaries). SystemCache: NOT in Phase 1b scope — no new hot paths identified from Phase 1a measurements (only `/friday/current` needed caching, and that's already in Phase 1a D6). If post-1b measurement surfaces a new >3s endpoint, add a D6-equivalent commit then.
- §5 Data flow (RSC streaming default + client exception) — Tasks 1-5 are RSC. Task 6 preserves client per explicit scope-lock call-out.
- §6 Error handling (envelope absorption, structured logs) — every converted endpoint has `logger.warning("{endpoint}_upstream_unavailable")` + envelope fallback.
- §7 Testing strategy (contract + ready-path tests) — every envelope conversion has shape + failure + ready-path tests.
- §8 Commit sequence — 6 tasks map 1:1 to decision-doc Phase 1b commits 1–6.
- §9 Q7.4 (partial vs unavailable) — per scope lock, surface-by-surface. Task 4 specifically notes the `<4 weeks` outcome empty state.

**2. Placeholder scan** — no "TBD" / "fill in later". References to "verify presentation component prop signature" and "check for existing types" are real instructions, not placeholders.

**3. Type consistency** — envelope naming consistent (`*Envelope` suffix). Predicate use (`isReady`) consistent across tasks. `wrap_response` signature consistent. Empty-constant pattern consistent.

**4. Scope notes** —
- `IntelligenceDashboard.tsx` slim/removal is conditional on its current usage (flagged in Task 1 Step 1.7). Same approach as Phase 1a D3's FridayDashboard slim.
- Risk-adjusted keeps `ready: boolean` field for backward-compat instead of removing; rationale in Task 6 commit body.
- `/api/intelligence/reviews/monthly|quarterly|annual` endpoints NOT converted — they're interactive detail fetches, deferrable to a follow-up.
- `/api/intelligence/attributions/{snapshot_date}` (detail endpoint) NOT converted — not currently called from any of the 6 scope pages.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-phase-ux-1b-intelligence.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task. Main session reviews between tasks. Same pattern as Phase 1a — has a track record of catching and fixing issues early.

2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`. Batch execution with checkpoints for review.

Which approach?
