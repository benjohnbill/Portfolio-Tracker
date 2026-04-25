# Phase UX-1c — Historical Views + Portfolio Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close UX-1 by propagating the Phase 1a/1b status-aware envelope + RSC streaming pattern to the three remaining pages (`/archive`, `/archive/[weekEnding]`, `/portfolio`), converting their backing endpoints (`/api/reports/weekly`, `/api/reports/weekly/{week_ending}`, `/api/portfolio/summary`), and replacing `/portfolio`'s bespoke `<Suspense>` fallbacks with shared skeleton primitives.

**Architecture:** Same as Phase 1a/1b. Each read-path endpoint returns `{status: 'ready'|'partial'|'unavailable', ...domain fields}` at root via `wrap_response`. Frontend fetchers are shape-guarded and return typed envelope objects; RSC pages use `<Suspense>` boundaries with skeletons that mirror the loaded layout, and async server components consume envelopes via `isReady` predicates. `/portfolio`'s existing RSC+Suspense structure is preserved — only fallback shapes are normalized.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Next.js 14 App Router + TypeScript + React Server Components + Suspense (frontend), pytest (C-track sqlite) + Jest + React Testing Library. Reuses `backend/app/api/_envelope.py::wrap_response`, `frontend/src/lib/envelope.ts` predicates, `frontend/src/components/ui/skeleton.tsx` + `skeleton-patterns.tsx` primitives.

**Scope:** Phase 1c only — three pages + three endpoints. Phase 1a and Phase 1b are shipped. `/api/portfolio/history` nested-status exception is intentionally left as-is (DOMAIN_MAP already documents it; scope-lock §3 limits Task 3 to "Structural behavior unchanged" — flattening is deferred as a standalone follow-up).

**Prerequisite status (verified at plan-write time):**
- Phase 1a shipped. Commits `8982c9a..11474e4` on `main` and `origin/main`.
- Phase 1b shipped. Commits `65c29cf..d39c420` on `main` and `origin/main`.
- `backend/app/api/_envelope.py::wrap_response` in place.
- `frontend/src/lib/envelope.ts` exports `EnvelopeStatus`, `StatusEnvelope`, `isReady`/`isPartial`/`isUnavailable` type-guards.
- `frontend/src/components/ui/skeleton.tsx` (base) + `skeleton-patterns.tsx` (`SkeletonRow`, `SkeletonCard`, `SkeletonList`, `SkeletonHero`, `SkeletonForm`) available.
- `backend/tests/test_ux1_envelope_contract.py` holds all envelope contract tests (Phase 1a/1b). Append Phase 1c tests to this file.
- Phase 1a's `/api/reports/weekly/latest` envelope (`{status, report}`) is the template for Task 2.
- 193 backend tests + frontend tsc/jest/lint green at HEAD `d39c420`.

---

## Phase 1a/1b conventions applied across Phase 1c

Non-negotiable (derived from 12 review-round dispatches in Phases 1a/1b):

1. **Use `isReady`/`isPartial`/`isUnavailable` predicates** from `@/lib/envelope` — NOT string comparison (`envelope.status === 'ready'`). Type-guard narrowing depends on this.
2. **Skeleton shapes mirror loaded-state layouts** — read the presentation component first, then author a skeleton with matching dimensions.
3. **Contract tests include a real ready-path test** per endpoint — seed DB or `patch.object(Service, "method", return_value=fake)`. Envelope-shape-only assertions are insufficient.
4. **Structured log event keys** follow `{endpoint}_upstream_unavailable` pattern (snake_case, unique per endpoint).
5. **Shape guard on frontend fetchers**: `if (!data || typeof data !== 'object' || !('status' in data)) return emptyEnvelope;` after JSON parse, before `as Envelope` cast.
6. **Empty envelopes**: module-level empty constant (or factory if request-scoped param needed). Use `[]`/`{}` for empty domain fields — never drop the field.
7. **Legacy-caller compat when signature changes**: if a fetcher's return shape changes and a caller is outside the task's target page, apply a minimal 2-line envelope unwrap with `// TODO(ux1-phase1c)` comment. Do not restructure out-of-scope pages.
8. **Single commit per dispatch.** NEVER `--amend`, `--no-verify`, or `git push --force`.
9. **AGENTS.md is user-owned** — never stage, never touch.
10. **Push timing is human-gated** — commits land on `main`, but do NOT run `git push` without explicit user approval (even though `main` auto-deploys to Vercel+Render).
11. **`wrap_response` rejects invalid status via `ValueError`** — use the `Status = Literal["ready","partial","unavailable"]` alias as the single source of truth.
12. **TDD discipline** — RED → GREEN per step within a single commit.

---

## Caller map

| Fetcher being converted | Caller | Target page |
|---|---|---|
| `getWeeklyReports` | `frontend/src/app/archive/page.tsx:9` | `/archive` |
| `getWeeklyReport` | `frontend/src/app/archive/[weekEnding]/page.tsx:7` | `/archive/[weekEnding]` |
| `getPortfolioSummary` | `frontend/src/components/features/portfolio/PortfolioSummaryCard.tsx:5` | `/portfolio` (via `<Suspense>`) |

Each fetcher has exactly one live caller. No cross-task legacy-compat unwraps are needed.

Dead-code note: `frontend/src/lib/api.ts::getPortfolioPageData` (around line 751) defines an unused helper that internally calls `fetchJson<PortfolioSummary>('/api/portfolio/summary')` with a raw cast. It has zero callers in `frontend/src/app` or `frontend/src/components`. After Task 3's backend shape change, the helper's internal type will silently drift (casts an envelope-shaped JSON to `PortfolioSummary`) — harmless since nothing reads it. **Do not delete.** Flag as a follow-up cleanup when the service tree is next refactored (per `feedback_service_layer_role_partitioning` memory).

---

## File Structure

### New files (backend)

- None — `wrap_response` from Phase 1a is reused.

### New files (frontend)

- `frontend/src/components/archive/ArchiveTimelineSection.tsx` (Task 1) — RSC async child for the 52-card weekly-report timeline on `/archive`.
- `frontend/src/components/archive/ArchiveReportDetailSection.tsx` (Task 2) — RSC async child for the report-detail view on `/archive/[weekEnding]`.

No `reports-fetchers-rsc.ts` / `portfolio-fetchers-rsc.ts` needed — each fetcher has one caller per render pass; React `cache()` dedup has no work to do.

### Modified files (backend)

- `backend/app/main.py`:
  - `/api/reports/weekly` (Task 1)
  - `/api/reports/weekly/{week_ending}` (Task 2)
  - `/api/portfolio/summary` (Task 3)
- `backend/tests/test_ux1_envelope_contract.py` — appended with per-task tests.

### Modified files (frontend)

- `frontend/src/lib/api.ts` — three envelope types + updated fetchers.
- `frontend/src/app/archive/page.tsx` (Task 1) — RSC streaming + skeleton fallback.
- `frontend/src/app/archive/[weekEnding]/page.tsx` (Task 2) — RSC streaming + skeleton fallback.
- `frontend/src/components/features/portfolio/PortfolioSummaryCard.tsx` (Task 3) — envelope consumption via `isReady`.
- `frontend/src/app/portfolio/page.tsx` (Task 3) — replace inline `<div>` fallback boxes with shared `<Skeleton>` primitives.

### Modified files (docs)

- `docs/DOMAIN_MAP.md` — extend "Portfolio / performance" section with `/api/portfolio/summary` entry (Task 3) and add a "Reports" section for the two weekly endpoints (Tasks 1 + 2). Leave the `/api/portfolio/history` exceptions note as-is (flatten deferred).

---

## Task 1: `/archive` timeline — endpoint + page

**Goal:** Convert `/api/reports/weekly` to the envelope pattern and restructure `/archive` to RSC streaming with a 52-card skeleton fallback.

**Files touched:**
- Modify: `backend/app/main.py` — `list_weekly_reports` handler (line 468).
- Modify: `backend/tests/test_ux1_envelope_contract.py` — append reports-weekly-list tests.
- Modify: `frontend/src/lib/api.ts` — new envelope type + updated fetcher.
- Create: `frontend/src/components/archive/ArchiveTimelineSection.tsx`.
- Modify: `frontend/src/app/archive/page.tsx` — `<Suspense>` boundary + skeleton.

### Step 1.1: Write contract tests (RED)

- [ ] Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/reports/weekly (list)                                                  #
# --------------------------------------------------------------------------- #


def test_weekly_list_returns_envelope(client):
    response = client.get("/api/reports/weekly")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "count" in payload
    assert "reports" in payload


def test_weekly_list_unavailable_when_no_rows(client):
    """Empty DB → status=unavailable with reports=[] (not 404, not raw [])."""
    response = client.get("/api/reports/weekly")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["reports"] == []
    assert payload["count"] == 0


def test_weekly_list_absorbs_service_failure_as_unavailable(client):
    from app.services.report_service import ReportService

    with patch.object(
        ReportService,
        "list_reports",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/reports/weekly")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["reports"] == []
        assert payload["count"] == 0


def test_weekly_list_returns_ready_envelope_when_rows_exist(client, db_session):
    from app.models import WeeklyReport

    db_session.add_all(
        [
            WeeklyReport(
                week_ending=date(2026, 4, 18),
                generated_at=datetime(2026, 4, 18, 12, 0, 0, tzinfo=timezone.utc),
                logic_version="weekly-report-v0",
                status="final",
                report_json={"score": {"total": 80}},
            ),
            WeeklyReport(
                week_ending=date(2026, 4, 11),
                generated_at=datetime(2026, 4, 11, 12, 0, 0, tzinfo=timezone.utc),
                logic_version="weekly-report-v0",
                status="final",
                report_json={"score": {"total": 72}},
            ),
        ]
    )
    db_session.commit()

    response = client.get("/api/reports/weekly")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["count"] == 2
    assert len(payload["reports"]) == 2
    # Ordered newest-first (matches ReportService.list_reports).
    assert payload["reports"][0]["weekEnding"] == "2026-04-18"
    assert payload["reports"][0]["score"] == 80


def test_weekly_list_respects_limit_query(client, db_session):
    from app.models import WeeklyReport

    for i in range(5):
        db_session.add(
            WeeklyReport(
                week_ending=date(2026, 3, 7) + timedelta(days=7 * i),
                generated_at=datetime(2026, 3, 7, 12, 0, 0, tzinfo=timezone.utc),
                logic_version="weekly-report-v0",
                status="final",
                report_json={"score": {"total": 70 + i}},
            )
        )
    db_session.commit()

    response = client.get("/api/reports/weekly?limit=3")
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["count"] == 3
    assert len(payload["reports"]) == 3
```

**Add `timedelta` import** near the top of `test_ux1_envelope_contract.py` if not already present. Currently: `from datetime import date, datetime, timezone` → change to `from datetime import date, datetime, timedelta, timezone`.

- [ ] Run to confirm they fail:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k "weekly_list"
```

Expected: 5 failures. Shape tests fail because the current endpoint returns a bare list (no `status`/`count` keys). Empty-DB test fails on `status=="unavailable"` because the current endpoint returns `[]` directly (no envelope). Failure-absorb test fails because the service exception propagates as 500. Ready-path tests fail for the same shape reason. Limit test fails on `status` and `count` assertions.

### Step 1.2: Convert backend endpoint (GREEN)

- [ ] Edit `backend/app/main.py`. Replace the handler at line 468:

```python
@app.get("/api/reports/weekly")
def list_weekly_reports(limit: int = 12, db: Session = Depends(get_db)):
    """UX-1 envelope: always HTTP 200; failures absorb into status='unavailable'."""
    try:
        reports = ReportService.list_reports(db, limit=limit)
        if not reports:
            return wrap_response(status="unavailable", count=0, reports=[])
        return wrap_response(status="ready", count=len(reports), reports=reports)
    except Exception as e:
        logger.warning("weekly_list_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", count=0, reports=[])
```

- [ ] Run the failing tests to confirm they now pass:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k "weekly_list"
```

Expected: 5 passes.

- [ ] Run the full backend suite to ensure no regression:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 193 + 5 = 198 passing. If any legacy tests asserted the bare-list shape of `/api/reports/weekly`, update them to expect the envelope.

### Step 1.3: Update frontend type + fetcher

- [ ] Edit `frontend/src/lib/api.ts`. Near the existing `WeeklyReportEnvelope` definition (around line 31), add:

```typescript
// Shape returned by ReportService.list_reports — a summary row, not the full
// WeeklyReport. Matches the keys the backend emits for each row in the list
// endpoint (see backend/app/services/report_service.py::list_reports).
export interface WeeklyReportSummary {
  weekEnding: string;
  generatedAt: string | null;
  logicVersion: string;
  status: string;
  score: number | null;
}

export interface WeeklyReportSummariesEnvelope {
  status: EnvelopeStatus;
  count: number;
  reports: WeeklyReportSummary[];
}
```

- [ ] Near the other empty-envelope constants (around line 537 where `emptyWeeklyReportEnvelope` lives), add:

```typescript
const emptyWeeklyReportSummariesEnvelope: WeeklyReportSummariesEnvelope = {
  status: 'unavailable',
  count: 0,
  reports: [],
};
```

- [ ] Replace the existing `getWeeklyReports` function (currently around line 832) with:

```typescript
export async function getWeeklyReports(limit: number = 24): Promise<WeeklyReportSummariesEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/reports/weekly?limit=${limit}`, { cache: 'no-store' });
    if (!res.ok) return emptyWeeklyReportSummariesEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyWeeklyReportSummariesEnvelope;
    }
    return data as WeeklyReportSummariesEnvelope;
  } catch {
    return emptyWeeklyReportSummariesEnvelope;
  }
}
```

Note: the return type changed from `Array<{...}>` to `WeeklyReportSummariesEnvelope`. The only caller (`/archive/page.tsx`) is updated in Step 1.5.

### Step 1.4: Create `ArchiveTimelineSection.tsx`

- [ ] Create `frontend/src/components/archive/ArchiveTimelineSection.tsx`:

```tsx
/**
 * RSC async child for the 52-card weekly-report timeline on /archive.
 * Phase UX-1c Task 1.
 */

import Link from 'next/link';
import { Archive, CalendarRange, ChevronRight } from 'lucide-react';

import { getWeeklyReports } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export async function ArchiveTimelineSection() {
  const envelope = await getWeeklyReports(52);

  if (!isReady(envelope) || envelope.reports.length === 0) {
    return (
      <Card className="bg-[#11161d] border-border/40 md:col-span-2 xl:col-span-3">
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Archive className="w-4 h-4" />
          <span>No archived weekly reports found yet.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {envelope.reports.map((report) => (
        <Link key={report.weekEnding} href={`/archive/${report.weekEnding}`}>
          <Card className="bg-[#11161d] border-border/40 h-full hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4" /> {report.weekEnding}
              </CardDescription>
              <CardTitle className="text-white flex items-center justify-between gap-3">
                <span>Score {report.score ?? '—'}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>Status: {report.status}</p>
              <p>Generated: {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'}</p>
              <p>Logic: {report.logicVersion}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </>
  );
}
```

Note: the section returns a fragment so the parent grid can flow the cards directly — matches the current page layout where `reports.map(...)` is a direct child of the `.grid` container.

### Step 1.5: Restructure `/archive/page.tsx`

- [ ] Replace the contents of `frontend/src/app/archive/page.tsx`:

```tsx
import { Suspense } from 'react';
import { Archive } from 'lucide-react';

import { ArchiveTimelineSection } from '@/components/archive/ArchiveTimelineSection';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ArchivePage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <div className="flex items-center gap-2 text-primary mb-1 text-xs font-bold uppercase tracking-wider">
          <Archive className="w-4 h-4" />
          <span>Archive</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white italic">Decision Memory</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse historical weekly reports, scores, and context.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Suspense fallback={<ArchiveTimelineSkeleton />}>
          <ArchiveTimelineSection />
        </Suspense>
      </div>
    </div>
  );
}

// Skeleton mirrors the Card shape used by ArchiveTimelineSection:
// header = date row + score row; content = 3 short text lines.
function ArchiveTimelineSkeleton() {
  // 12 cards is the initial above-the-fold tranche for a 52-card grid on desktop.
  // Fewer skeleton cards than real cards is intentional — the skeleton is
  // instant shell, not a perfect mirror of the final list length.
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i} className="bg-[#11161d] border-border/40 h-full">
          <CardHeader className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
```

The skeleton uses `<Card>` so the shell has the same borders, padding, and grid-cell geometry as the loaded cards. The inner content is reduced to `<Skeleton>` primitives.

Note: `frontend/src/app/archive/loading.tsx` remains untouched. That file serves the initial-route loading state (segment-level), which Next.js renders before the RSC streams — it is orthogonal to the Suspense fallback introduced above. Keeping both is correct and mirrors how Phase 1a treated `/friday` (both loading.tsx and page-level Suspense exist side-by-side).

### Step 1.6: Update DOMAIN_MAP

- [ ] Edit `docs/DOMAIN_MAP.md`. Under the `## Term registry` section, insert a new subsection after "Intelligence":

```markdown
### Reports / archive

- `reports` — collection of `WeeklyReportSummary` rows (keys: `weekEnding`, `generatedAt`, `logicVersion`, `status`, `score`). Envelope: `WeeklyReportSummariesEnvelope` (fields: `status`, `count`, `reports`).
- `count` — length of `reports` array, duplicated in metadata for cheap UI summaries (avoid recomputing on the client).
- `report` — full `WeeklyReport` object (distinct from the summary rows in `reports`). Envelope: `WeeklyReportEnvelope` (fields: `status`, `report`).
```

- [ ] Append to the `## Change log`:

```markdown
- 2026-04-24 — Phase 1c Task 1: Weekly-reports list endpoint envelope added (`reports` registry entry + `count` metadata).
```

### Step 1.7: Run all checks

- [ ] Backend:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 198 passing.

- [ ] Frontend:

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: green.

### Step 1.8: Commit

- [ ] Stage and commit (explicit paths only — never `-A` or `.`):

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/app/archive/page.tsx \
        frontend/src/components/archive/ArchiveTimelineSection.tsx \
        docs/DOMAIN_MAP.md
git commit -m "$(cat <<'EOF'
feat(ux1c): archive timeline skeleton-first

Converts /api/reports/weekly to the UX-1 status envelope and restructures
the /archive page to RSC streaming with a 12-card skeleton fallback.

Endpoint: {status, count, reports} where reports is WeeklyReportSummary[].
Empty DB absorbs to status='unavailable' with reports=[]/count=0, matching
the Phase 1a "empty-state shape equals loaded-state shape" contract.
Service exceptions log weekly_list_upstream_unavailable and fall through
the same unavailable branch — no 5xx at this read path.

Frontend:
- getWeeklyReports now returns WeeklyReportSummariesEnvelope (shape-guarded).
- /archive uses a single <Suspense> boundary around ArchiveTimelineSection.
  The existing grid layout and Card shape are preserved; the skeleton
  fallback reuses the same Card shell with Skeleton primitives inside.
- loading.tsx is retained for route-level segment load; Suspense fallback
  takes over once the RSC starts streaming.

DOMAIN_MAP.md gains a "Reports / archive" section registering `reports` /
`count` / `report` terms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] Run `git status` to confirm clean tree + correct HEAD:

```bash
git status && git log --oneline -1
```

Expected: working tree clean (except `M AGENTS.md`, which is user-owned and always left as-is); HEAD is the new commit.

---

## Task 2: `/archive/[weekEnding]` detail — endpoint + page

**Goal:** Convert `/api/reports/weekly/{week_ending}` to the envelope pattern and restructure `/archive/[weekEnding]` to RSC streaming with a detail-shaped skeleton.

**Files touched:**
- Modify: `backend/app/main.py` — `get_weekly_report` handler (line 486).
- Modify: `backend/tests/test_ux1_envelope_contract.py` — append reports-weekly-detail tests.
- Modify: `frontend/src/lib/api.ts` — new envelope type + updated fetcher.
- Create: `frontend/src/components/archive/ArchiveReportDetailSection.tsx`.
- Modify: `frontend/src/app/archive/[weekEnding]/page.tsx` — `<Suspense>` boundary + skeleton.

### Step 2.1: Write contract tests (RED)

- [ ] Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/reports/weekly/{week_ending} (detail)                                  #
# --------------------------------------------------------------------------- #


def test_weekly_detail_returns_envelope_shape(client, db_session):
    """Happy-path shape check: envelope root has status/week_ending/report."""
    from app.models import WeeklyReport

    db_session.add(
        WeeklyReport(
            week_ending=date(2026, 4, 18),
            generated_at=datetime(2026, 4, 18, 12, 0, 0, tzinfo=timezone.utc),
            logic_version="weekly-report-v0",
            status="final",
            report_json={"score": {"total": 80}},
        )
    )
    db_session.commit()

    response = client.get("/api/reports/weekly/2026-04-18")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert payload["week_ending"] == "2026-04-18"
    assert "report" in payload


def test_weekly_detail_unavailable_when_not_found(client):
    """Missing week_ending → status=unavailable with report=None, HTTP 200 (not 404)."""
    response = client.get("/api/reports/weekly/2026-04-18")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["week_ending"] == "2026-04-18"
    assert payload["report"] is None


def test_weekly_detail_rejects_bad_date(client):
    """Malformed week_ending stays 400 — input validation only."""
    response = client.get("/api/reports/weekly/not-a-date")
    assert response.status_code == 400


def test_weekly_detail_absorbs_service_failure_as_unavailable(client):
    from app.services.report_service import ReportService

    with patch.object(
        ReportService,
        "get_report_by_week",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/reports/weekly/2026-04-18")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["report"] is None
        assert payload["week_ending"] == "2026-04-18"


def test_weekly_detail_returns_ready_when_persisted(client, db_session):
    from app.models import WeeklyReport

    db_session.add(
        WeeklyReport(
            week_ending=date(2026, 4, 18),
            generated_at=datetime(2026, 4, 18, 12, 0, 0, tzinfo=timezone.utc),
            logic_version="weekly-report-v0",
            status="final",
            report_json={"score": {"total": 82}, "portfolioSnapshot": {}, "macroSnapshot": {}},
        )
    )
    db_session.commit()

    response = client.get("/api/reports/weekly/2026-04-18")
    payload = response.json()
    assert payload["status"] == "ready"
    assert payload["report"] is not None
    assert payload["report"]["score"]["total"] == 82
```

- [ ] Run to confirm failures:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k "weekly_detail"
```

Expected: 5 failures. Not-found test fails because the current endpoint raises `HTTPException(404)`. Shape/ready/failure-absorb tests fail because the current endpoint returns the bare report dict. The bad-date test may already pass (current code raises 400 on bad parse), but the assertion still runs.

### Step 2.2: Convert backend endpoint (GREEN)

- [ ] Edit `backend/app/main.py`. Replace the handler at line 486:

```python
@app.get("/api/reports/weekly/{week_ending}")
def get_weekly_report(week_ending: str, db: Session = Depends(get_db)):
    """UX-1 envelope: always HTTP 200 for known-shape responses;
    malformed date stays 4xx (input validation)."""
    try:
        parsed = datetime.strptime(week_ending, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="week_ending must be YYYY-MM-DD")

    try:
        report = ReportService.get_report_by_week(db, parsed)
        if not report:
            return wrap_response(status="unavailable", week_ending=week_ending, report=None)
        return wrap_response(status="ready", week_ending=week_ending, report=report)
    except Exception as e:
        logger.warning("weekly_detail_upstream_unavailable", exc_info=e)
        return wrap_response(status="unavailable", week_ending=week_ending, report=None)
```

The `datetime.strptime` call is moved out of the inner `try` so that malformed dates still raise 400 before the envelope branch is reached. Only service-layer exceptions (DB failure, service bug) get absorbed into `status='unavailable'`.

- [ ] Run the new tests:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k "weekly_detail"
```

Expected: 5 passes.

- [ ] Full suite:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 198 + 5 = 203 passing. If any legacy test hits `/api/reports/weekly/{date}` expecting a 404 on miss, update it to expect 200 + `status='unavailable'` instead.

### Step 2.3: Update frontend type + fetcher

- [ ] Edit `frontend/src/lib/api.ts`. Near the `WeeklyReportEnvelope` definition (line 31), add:

```typescript
// Envelope for the per-week detail endpoint. Structurally similar to
// WeeklyReportEnvelope but carries the URL path parameter as coverage
// metadata so consumers don't need to re-parse the request path.
export interface WeeklyReportDetailEnvelope {
  status: EnvelopeStatus;
  week_ending: string;
  report: WeeklyReport | null;
}
```

- [ ] Near the existing `emptyWeeklyReportEnvelope` (line 537), add a factory:

```typescript
const emptyWeeklyReportDetailEnvelope = (weekEnding: string): WeeklyReportDetailEnvelope => ({
  status: 'unavailable',
  week_ending: weekEnding,
  report: null,
});
```

- [ ] Replace `getWeeklyReport` (currently around line 846):

```typescript
export async function getWeeklyReport(weekEnding: string): Promise<WeeklyReportDetailEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/reports/weekly/${weekEnding}`, { cache: 'no-store' });
    if (!res.ok) return emptyWeeklyReportDetailEnvelope(weekEnding);
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyWeeklyReportDetailEnvelope(weekEnding);
    }
    return data as WeeklyReportDetailEnvelope;
  } catch {
    return emptyWeeklyReportDetailEnvelope(weekEnding);
  }
}
```

### Step 2.4: Create `ArchiveReportDetailSection.tsx`

- [ ] Create `frontend/src/components/archive/ArchiveReportDetailSection.tsx`:

```tsx
/**
 * RSC async child for the report detail view on /archive/[weekEnding].
 * Phase UX-1c Task 2.
 */

import { WeeklyReportView } from '@/components/reports/WeeklyReportView';
import { getWeeklyReport } from '@/lib/api';
import { isReady } from '@/lib/envelope';

export async function ArchiveReportDetailSection({ weekEnding }: { weekEnding: string }) {
  const envelope = await getWeeklyReport(weekEnding);

  if (!isReady(envelope) || envelope.report === null) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border/40 bg-[#11161d] p-6 text-sm text-muted-foreground text-center">
        Archived report for <span className="font-mono text-white">{envelope.week_ending}</span> is unavailable.
      </div>
    );
  }

  const report = envelope.report;
  return (
    <WeeklyReportView
      report={report}
      eyebrow="Archive"
      title={`Week Ending ${report.weekEnding}`}
      description={`Archived report · Generated ${new Date(report.generatedAt).toLocaleString()}`}
      backHref="/archive"
      backLabel="Back to Archive"
    />
  );
}
```

The `isReady(envelope) && envelope.report !== null` guard is belt-and-suspenders — the backend guarantees `report !== null` when `status='ready'`, but the TS narrowing still expects the nullability check because `report: WeeklyReport | null` at the type level.

### Step 2.5: Restructure `/archive/[weekEnding]/page.tsx`

- [ ] Replace the contents of `frontend/src/app/archive/[weekEnding]/page.tsx`:

```tsx
import { Suspense } from 'react';

import { ArchiveReportDetailSection } from '@/components/archive/ArchiveReportDetailSection';
import { Skeleton } from '@/components/ui/skeleton';

export default async function ArchiveReportDetailPage({
  params,
}: {
  params: Promise<{ weekEnding: string }>;
}) {
  const { weekEnding } = await params;

  return (
    <Suspense fallback={<ArchiveReportDetailSkeleton />}>
      <ArchiveReportDetailSection weekEnding={weekEnding} />
    </Suspense>
  );
}

// Skeleton matches WeeklyReportView's top-level layout: hero + freshness strip
// + pinned action pill + 3 large content cards. Dimensions approximate the
// real component's heights so the shell doesn't reflow when the data lands.
function ArchiveReportDetailSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>

      <Skeleton className="h-40 w-full rounded-lg" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>

      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
```

The `params` promise is awaited in the outer server component so that the section receives a plain `weekEnding` string — no promise unwrapping inside the Suspense child.

### Step 2.6: Update DOMAIN_MAP

- [ ] Edit `docs/DOMAIN_MAP.md`. Extend the `## Term registry` "Reports / archive" subsection added in Task 1:

```markdown
- `week_ending` — ISO date; coverage metadata for per-week detail responses. Echoes the URL path parameter.
```

- [ ] Append to the change log:

```markdown
- 2026-04-24 — Phase 1c Task 2: Weekly-reports detail endpoint envelope added (`week_ending` coverage metadata + reuses `report` domain key).
```

### Step 2.7: Run all checks

- [ ] Backend:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 203 passing.

- [ ] Frontend:

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: green.

### Step 2.8: Commit

- [ ] Stage and commit:

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/app/archive/[weekEnding]/page.tsx \
        frontend/src/components/archive/ArchiveReportDetailSection.tsx \
        docs/DOMAIN_MAP.md
git commit -m "$(cat <<'EOF'
feat(ux1c): archive detail skeleton-first

Converts /api/reports/weekly/{week_ending} to the UX-1 status envelope
and restructures /archive/[weekEnding] to RSC streaming with a
detail-shaped skeleton fallback.

Endpoint: {status, week_ending, report}. Missing weeks absorb to
status='unavailable' with report=None at HTTP 200 (previously 404);
malformed YYYY-MM-DD stays 4xx as input validation. Service exceptions
log weekly_detail_upstream_unavailable and fall into the same
unavailable branch.

Frontend:
- getWeeklyReport now returns WeeklyReportDetailEnvelope (shape-guarded).
- /archive/[weekEnding] uses a single <Suspense> around
  ArchiveReportDetailSection. The skeleton approximates WeeklyReportView's
  top-level structure (hero + freshness strip + action pill + 3 content
  cards) so the shell doesn't reflow when the data lands.
- ArchiveReportDetailSection delegates to the existing WeeklyReportView
  presentation component when status='ready'; renders an explicit
  unavailable placeholder otherwise.

Per CLAUDE.md "partial-snapshot handling" note: no new status='partial'
branch is introduced here. Missing subsections of a persisted report
remain the presentation layer's responsibility via WeeklyReportView's
existing field checks. Revisit if a concrete partial-data case surfaces.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] Confirm:

```bash
git status && git log --oneline -2
```

---

## Task 3: `/portfolio` alignment — summary endpoint envelope + fallback shape normalization

**Goal:** Convert `/api/portfolio/summary` to the envelope pattern, align `PortfolioSummaryCard` to the `isReady` predicate, and replace the `/portfolio` page's inline `<div>` Suspense fallbacks with shared `<Skeleton>` primitives. Structural behavior is unchanged — this is alignment and normalization only, not a rewrite.

**Files touched:**
- Modify: `backend/app/main.py` — `get_portfolio_summary` handler (line 390).
- Modify: `backend/tests/test_ux1_envelope_contract.py` — append portfolio-summary tests.
- Modify: `frontend/src/lib/api.ts` — new envelope type + updated `getPortfolioSummary` fetcher.
- Modify: `frontend/src/components/features/portfolio/PortfolioSummaryCard.tsx` — use envelope + `isReady`.
- Modify: `frontend/src/app/portfolio/page.tsx` — replace inline fallback `<div>`s with shared `<Skeleton>`s.
- Modify: `docs/DOMAIN_MAP.md` — add `/api/portfolio/summary` entry.

### Step 3.1: Write contract tests (RED)

- [ ] Append to `backend/tests/test_ux1_envelope_contract.py`:

```python
# --------------------------------------------------------------------------- #
# /api/portfolio/summary                                                      #
# --------------------------------------------------------------------------- #


def test_portfolio_summary_returns_envelope(client):
    response = client.get("/api/portfolio/summary")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] in {"ready", "partial", "unavailable"}
    assert "total_value" in payload
    assert "invested_capital" in payload
    assert "metrics" in payload


def test_portfolio_summary_absorbs_service_failure(client):
    from app.services.portfolio_service import PortfolioService

    with patch.object(
        PortfolioService,
        "get_portfolio_summary",
        side_effect=RuntimeError("simulated upstream failure"),
    ):
        response = client.get("/api/portfolio/summary")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "unavailable"
        assert payload["total_value"] == 0
        assert payload["invested_capital"] == 0
        assert payload["metrics"] == {
            "total_return": 0,
            "cagr": 0,
            "mdd": 0,
            "volatility": 0,
            "sharpe_ratio": 0,
        }


def test_portfolio_summary_returns_ready_when_service_succeeds(client):
    from app.services.portfolio_service import PortfolioService

    fake_summary = {
        "total_value": 100_000_000,
        "invested_capital": 80_000_000,
        "metrics": {
            "total_return": 0.25,
            "cagr": 0.12,
            "mdd": -0.08,
            "volatility": 0.18,
            "sharpe_ratio": 0.67,
        },
    }
    with patch.object(PortfolioService, "get_portfolio_summary", return_value=fake_summary):
        response = client.get("/api/portfolio/summary")
        payload = response.json()
        assert payload["status"] == "ready"
        assert payload["total_value"] == 100_000_000
        assert payload["metrics"]["cagr"] == 0.12
```

- [ ] Run to confirm failures:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k "portfolio_summary"
```

Expected: 3 failures. Shape test fails on missing `status` key. Ready test fails on missing `status`. Failure-absorb fails on 500 propagation.

### Step 3.2: Convert backend endpoint (GREEN)

- [ ] Edit `backend/app/main.py`. Replace the handler at line 390:

```python
@app.get("/api/portfolio/summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    """UX-1 envelope: always HTTP 200. Summary fields spread at the envelope
    root (no nesting under `summary`) so existing consumers can read
    total_value / invested_capital / metrics directly."""
    try:
        summary = PortfolioService.get_portfolio_summary(db)
        return wrap_response(status="ready", **summary)
    except Exception as e:
        logger.warning("portfolio_summary_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            total_value=0,
            invested_capital=0,
            metrics={
                "total_return": 0,
                "cagr": 0,
                "mdd": 0,
                "volatility": 0,
                "sharpe_ratio": 0,
            },
        )
```

The summary fields spread at root (not nested under `summary`) because the frontend type `PortfolioSummary` already expects flat fields and changing that shape would force a breaking rename of downstream consumers (`summary.total_value` → `summary.summary.total_value`). The envelope adds `status` at root without renaming anything.

This matches the risk-adjusted scorecard pattern from Phase 1b Task 6, where `scorecard` fields spread at root alongside `status`.

- [ ] Run the new tests:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests/test_ux1_envelope_contract.py -v -k "portfolio_summary"
```

Expected: 3 passes.

- [ ] Full suite:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 203 + 3 = 206 passing. If any legacy portfolio-summary test asserts the bare-dict shape, update to expect the envelope.

### Step 3.3: Update frontend type + fetcher

- [ ] Edit `frontend/src/lib/api.ts`. The `PortfolioSummary` interface currently lives around line 180. Extend it — do NOT rename — by adding an envelope type that intersects the existing shape:

```typescript
// Phase 1c: backend spreads summary fields at the envelope root so
// callers keep reading `total_value` / `invested_capital` / `metrics`
// unchanged. The envelope only adds `status` alongside.
export interface PortfolioSummaryEnvelope extends PortfolioSummary {
  status: EnvelopeStatus;
}
```

- [ ] Near the other empty-envelope constants (around line 537), add:

```typescript
const emptyPortfolioSummaryEnvelope: PortfolioSummaryEnvelope = {
  status: 'unavailable',
  total_value: 0,
  invested_capital: 0,
  metrics: {
    total_return: 0,
    cagr: 0,
    mdd: 0,
    volatility: 0,
    sharpe_ratio: 0,
  },
};
```

- [ ] Replace the existing `getPortfolioSummary` (around line 697):

```typescript
export async function getPortfolioSummary(): Promise<PortfolioSummaryEnvelope> {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const res = await fetch(`${API_BASE}/api/portfolio/summary`, { cache: 'no-store' });
    if (!res.ok) return emptyPortfolioSummaryEnvelope;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !('status' in data)) {
      return emptyPortfolioSummaryEnvelope;
    }
    return data as PortfolioSummaryEnvelope;
  } catch {
    return emptyPortfolioSummaryEnvelope;
  }
}
```

The previous implementation logged errors to console and returned a hardcoded empty `PortfolioSummary`. The new implementation returns the typed envelope directly.

- [ ] `getPortfolioPageData` (around line 751) is unused dead code (see caller map). The inner `fetchJson<PortfolioSummary>('/api/portfolio/summary')` cast silently drifts — the JSON now has an extra `status` field. This is harmless (extra property doesn't break type compat), and no caller reads it. **Do not delete** per Karpathy discipline; flag in Step 3.7 DOMAIN_MAP addendum if desired, or leave as a standing follow-up.

### Step 3.4: Update `PortfolioSummaryCard.tsx`

- [ ] Replace `frontend/src/components/features/portfolio/PortfolioSummaryCard.tsx`:

```tsx
import { getPortfolioSummary } from '@/lib/api';
import { isReady } from '@/lib/envelope';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export async function PortfolioSummaryCard() {
  const envelope = await getPortfolioSummary();

  if (!isReady(envelope)) {
    return (
      <Card className="bg-[#11161d] border-border/40">
        <CardHeader>
          <CardTitle className="text-white">Performance Summary</CardTitle>
          <CardDescription>Structural portfolio metrics, not just this week</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Summary unavailable. Live valuation may be refreshing — try again in a moment.
        </CardContent>
      </Card>
    );
  }

  const { total_value, invested_capital, metrics } = envelope;

  return (
    <Card className="bg-[#11161d] border-border/40">
      <CardHeader>
        <CardTitle className="text-white">Performance Summary</CardTitle>
        <CardDescription>Structural portfolio metrics, not just this week</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">Total Value</p>
          <p className="text-white font-semibold">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(total_value)}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">Invested Capital</p>
          <p className="text-white font-semibold">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(invested_capital)}</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">CAGR</p>
          <p className="text-white font-semibold">{(metrics.cagr * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">MDD</p>
          <p className="text-white font-semibold">{(metrics.mdd * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">Volatility</p>
          <p className="text-white font-semibold">{(metrics.volatility * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border/40 p-3">
          <p className="text-xs text-muted-foreground uppercase">Sharpe Ratio</p>
          <p className="text-white font-semibold">{metrics.sharpe_ratio.toFixed(2)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

The defensive `metrics = summary.metrics || {...}` from the old implementation is removed because the envelope guarantees the field shape regardless of `status`.

### Step 3.5: Replace inline fallback `<div>`s with shared `<Skeleton>`

- [ ] Edit `frontend/src/app/portfolio/page.tsx`. Replace each inline `<div className="h-[Xpx] bg-accent/10 rounded-xl animate-pulse border border-border/20" />` with a `<Skeleton className="h-[Xpx] w-full rounded-xl" />`. The six Suspense fallbacks and their target heights are:

| Line (current) | Target height | Replacement |
|---|---|---|
| EquityCurveSection fallback | `h-[600px]` | `<Skeleton className="h-[600px] w-full rounded-xl" />` |
| AssetSignalSection (QQQ) fallback | `h-[300px]` | `<Skeleton className="h-[300px] w-full rounded-xl" />` |
| MSTRZScoreSectionWrapper fallback | `h-[300px]` | `<Skeleton className="h-[300px] w-full rounded-xl" />` |
| AssetSignalSection (GLDM) fallback | `h-[300px]` | `<Skeleton className="h-[300px] w-full rounded-xl" />` |
| AssetSignalSection (TLT) fallback | `h-[300px]` | `<Skeleton className="h-[300px] w-full rounded-xl" />` |
| PortfolioSummaryCard fallback | `h-[400px]` | `<Skeleton className="h-[400px] w-full rounded-xl" />` |
| AssetAllocationSection fallback | `h-[600px]` | `<Skeleton className="h-[600px] w-full rounded-xl" />` |

- [ ] Add the `Skeleton` import at the top of the file:

```tsx
import { Skeleton } from '@/components/ui/skeleton';
```

- [ ] Remove any now-unused imports if the existing inline `<div>` removal orphans them (none expected from this specific change, but run tsc after to confirm).

- [ ] The resulting page preserves the existing six `<Suspense>` boundary structure exactly — only the fallback implementation changes. The semantic behavior (per-panel streaming, no `Promise.all` blocking) is unchanged.

### Step 3.6: Update DOMAIN_MAP

- [ ] Edit `docs/DOMAIN_MAP.md`. Under the `## Term registry` "Portfolio / performance" subsection, append:

```markdown
- `total_value` — structural KRW value across all accounts (envelope root field on `/api/portfolio/summary`).
- `invested_capital` — lifetime deposits minus withdrawals (envelope root field on `/api/portfolio/summary`).
- `metrics` — nested object with `total_return`, `cagr`, `mdd`, `volatility`, `sharpe_ratio`. Envelope: `PortfolioSummaryEnvelope` (status at root + summary fields spread alongside).
```

- [ ] Append to the change log:

```markdown
- 2026-04-24 — Phase 1c Task 3: Portfolio summary endpoint envelope added. `/api/portfolio/history` nested-status exception remains unchanged (flatten deferred, see Exceptions section).
```

- [ ] The "Exceptions / migration debt" section currently says `/api/portfolio/history`'s nested-status "is scheduled for alignment in Phase 1c." Update that sentence to reflect the deferral:

Replace:
```markdown
This exception is scheduled for alignment in Phase 1c (`/portfolio` alignment in the scope-lock plan). Do not introduce new endpoints with this nesting pattern; new surfaces follow the root-status rule in §"Envelope rule (root invariant)".
```

with:
```markdown
Phase 1c's `/portfolio` alignment Task 3 limited itself to the `/api/portfolio/summary` envelope + fallback-skeleton normalization (per scope-lock §3 "Structural behavior unchanged"); flattening `/api/portfolio/history`'s nested performance status is deferred as a standalone follow-up. Do not introduce new endpoints with this nesting pattern; new surfaces follow the root-status rule in §"Envelope rule (root invariant)".
```

### Step 3.7: Run all checks

- [ ] Backend:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && .venv/bin/python -m pytest tests -q
```

Expected: 206 passing.

- [ ] Frontend:

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npx jest --runInBand
```

Expected: green. The `PortfolioSummaryCard` change + the `getPortfolioSummary` return type change force tsc to validate all reads of the summary envelope — this catches any drift at compile time.

### Step 3.8: Commit

- [ ] Stage and commit:

```bash
git add backend/app/main.py backend/tests/test_ux1_envelope_contract.py \
        frontend/src/lib/api.ts \
        frontend/src/components/features/portfolio/PortfolioSummaryCard.tsx \
        frontend/src/app/portfolio/page.tsx \
        docs/DOMAIN_MAP.md
git commit -m "$(cat <<'EOF'
refactor(ux1c): portfolio fallback alignment

Completes Phase UX-1. Converts /api/portfolio/summary to the UX-1 status
envelope and replaces /portfolio's inline Suspense fallback <div>s with
shared <Skeleton> primitives. Structural behavior unchanged.

Endpoint: summary fields spread at the envelope root (total_value,
invested_capital, metrics) alongside status — mirrors the Phase 1b
risk-adjusted scorecard precedent and avoids a breaking rename of
downstream consumers. Service exceptions log
portfolio_summary_upstream_unavailable and fall into status='unavailable'
with zero-valued summary fields, matching the empty-state-shape contract.

Frontend:
- getPortfolioSummary now returns PortfolioSummaryEnvelope (shape-guarded).
- PortfolioSummaryCard branches on isReady(envelope) and renders an
  explicit placeholder when unavailable.
- /portfolio page retains its six <Suspense> boundaries (from cashflow
  closeout D12 era) — only fallback <div>s are swapped for <Skeleton>.
  Heights match the original inline fallbacks exactly so the shell
  geometry is preserved.

/api/portfolio/history's nested performance.status exception is left
as-is. DOMAIN_MAP.md documents the flatten as a deferred follow-up
(scope-lock §3 limits this task to "Structural behavior unchanged").

getPortfolioPageData helper in api.ts is unreferenced dead code; its
internal fetchJson<PortfolioSummary> cast silently drifts under the new
envelope shape but has no callers. Flagged as a future cleanup when the
service tree is next refactored.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] Confirm:

```bash
git status && git log --oneline -3
```

Expected: three new commits on top of `d39c420`, each corresponding to one task. Working tree clean except `M AGENTS.md`.

---

## Self-Review

**1. Spec coverage** — mapping scope-lock decision doc requirements to tasks:
- §3 Scope (Phase 1c: `/archive`, `/archive/[weekEnding]`, `/portfolio` alignment) — Tasks 1, 2, 3 cover all three.
- §4 Contracts (status-aware envelope, per-panel fetch, graceful degrade) — envelope: every task. Per-panel fetch: `/portfolio` six-boundary structure preserved; `/archive` + detail are single-fetch pages, one boundary each by design. Graceful degrade: every converted endpoint has a structured `logger.warning` + envelope fallback.
- §5 Data flow (RSC streaming default) — all three tasks are RSC. No client components introduced.
- §6 Error handling (envelope absorption, `{endpoint}_upstream_unavailable` event keys) — `weekly_list_upstream_unavailable`, `weekly_detail_upstream_unavailable`, `portfolio_summary_upstream_unavailable`. All unique.
- §7 Testing strategy — every envelope conversion has shape + failure-absorb + ready-path tests (Task 1 also has limit-query test; Task 2 also has malformed-date 4xx test). Tests are appended to the single `test_ux1_envelope_contract.py` file per Phase 1a/1b convention.
- §8 Commit sequence — 3 tasks map 1:1 to scope-lock Phase 1c commits 1–3 with matching commit titles (`feat(ux1c): archive timeline skeleton-first`, `feat(ux1c): archive detail skeleton-first`, `refactor(ux1c): portfolio fallback alignment`).
- §9 Q7.10 (legacy `/reports/weekly` page) — out of scope per scope lock; handoff doc notes "flag as follow-up legacy-cleanup task."
- §10 Out-of-scope flags — `/api/portfolio/history` flatten explicitly deferred in DOMAIN_MAP update (Task 3 Step 3.6). `portfolio_performance_snapshots` backfill is a data-hygiene task unaffected by Phase 1c structural work.

**2. Placeholder scan** — no "TBD" / "fill in later". All code blocks are complete. References to "verify callers" / "replace each inline `<div>`" are concrete instructions with exact file paths and dimensions, not placeholders.

**3. Type consistency** —
- Envelope naming consistent: `WeeklyReportSummariesEnvelope` / `WeeklyReportDetailEnvelope` / `PortfolioSummaryEnvelope` / existing `WeeklyReportEnvelope` (Phase 1a) — all follow `{Surface}{Shape?}Envelope` suffix.
- Predicate use (`isReady`) consistent across tasks.
- `wrap_response` signature consistent (all three endpoints use keyword-only `status=` + `**fields`).
- Empty-envelope pattern consistent (module-level constant for Tasks 1 + 3; factory for Task 2 because `week_ending` is request-scoped).
- Summary-spread-at-root pattern intentional and documented (Task 3 commit body + DOMAIN_MAP), matching the Phase 1b risk-adjusted scorecard precedent.

**4. Skeleton-shape discipline** —
- Task 1 skeleton reuses the real `<Card>` shell so grid geometry matches.
- Task 2 skeleton approximates `WeeklyReportView`'s top-level sections (hero + freshness + action + 3 content cards).
- Task 3 skeletons preserve the exact `h-[Xpx]` dimensions from the inline `<div>` fallbacks; only the primitive changes (bespoke animate-pulse → shared `<Skeleton>`).

**5. Scope-boundary notes** —
- `/api/portfolio/history` flatten intentionally deferred (scope-lock §3 "Structural behavior unchanged"). DOMAIN_MAP updated to reflect the deferral (Task 3 Step 3.6).
- `getPortfolioPageData` dead-code helper flagged in commit body; not deleted, per Karpathy surgical-changes rule.
- `/reports/weekly` legacy page untouched (per scope-lock §9 Q7.10).
- `loading.tsx` files for `/archive` and `/portfolio` untouched — they serve segment-level loading which is orthogonal to Suspense fallbacks.
- `AGENTS.md` never staged.
- No `git push` in the plan — commits land locally only, user gates push timing.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-phase-ux-1c-archive.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task. Main session reviews between tasks with the two-stage spec-review + code-review pattern. Same cadence as Phase 1a + Phase 1b — has a track record of catching envelope-shape drift and test-coverage gaps early. Best for this phase because all three tasks are touch-many-files commits where a fresh context window helps prevent cross-task contamination.

2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`. Batch execution with checkpoints for review. Acceptable for Phase 1c because the three tasks are semantically independent (no shared state beyond the envelope helpers, which are already frozen from Phase 1a) — but the main session's context fills up faster.

Which approach?
