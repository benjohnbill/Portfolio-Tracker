# Phase UX-1 — First-Paint UX Scope Lock

**Date:** 2026-04-23
**Status:** Active — brainstorming complete, awaiting writing-plans
**Owner:** lg (solo)
**Predecessor work:** Cashflow/benchmark closeout (`.omx/plans/verification-first-cashflow-benchmark-closeout-20260423.md`, shipped commits `88fdf7d..49f4c2b`)

## 1. Problem Statement

The application violates its stated first-paint UX directive: when a user enters any page, the UI should appear immediately and backend data should fill in asynchronously. Current implementation blocks the initial render on the slowest of multiple concurrent fetches (`Promise.all` pattern), producing multi-second blank screens. Measured: `/friday` warm first paint ≈ 9.6s; `/` (This Week) serves single-fetch blocking with no skeleton; `/archive` and `/friday/[snapshotDate]` block on single fetches without skeleton.

Phase UX-1 restructures the read-path across 13 user-facing pages to deliver instant HTML shell with per-panel streaming, graceful degradation, and consistent agent-readable response shapes.

## 2. Prerequisites

Cashflow/benchmark closeout must be shipped before UX-1 implementation starts. **Status: satisfied** as of commit `49f4c2b`.

Specifically required:
- `PortfolioPerformanceSnapshot` model + Alembic migration exist (✓ `88fdf7d`).
- `_performance_from_live_history` fallback removed from `main.py` (✓).
- Consumer rebinding: `PortfolioService.get_portfolio_summary`, `RiskAdjustedService`, `IntelligenceService.evaluate_decision_outcomes`, `friday_service` all read from `portfolio_performance_snapshots` or return unavailable (✓ `21c48ae`).
- Frontend normalizer treats legacy flat history as archive-only, not ready performance (✓).
- 130 backend tests + 6 integration + frontend lint/tsc/jest all green (✓).

Production Supabase migration/backfill for `portfolio_performance_snapshots` remains pending. This does not block UX-1 structural work but will affect what `status` values appear in production for portfolio-related endpoints (will skew `unavailable` until backfill completes).

## 3. Scope

### In scope (13 pages)

Organized by URL hierarchy cluster:

**Phase 1a — Weekly ritual + app entry (4 pages)**
- `/` — "This Week", main app entry point (sidebar position 1)
- `/friday` — weekly ritual page
- `/friday/[snapshotDate]` — individual freeze detail
- `/friday/archive` — freeze timeline with compare feature

**Phase 1b — Intelligence hierarchy (6 pages)**
- `/intelligence` — dashboard root
- `/intelligence/rules` — rule accuracy
- `/intelligence/attributions` — score decomposition
- `/intelligence/outcomes` — decision evaluation
- `/intelligence/reviews` — monthly/quarterly/annual reviews
- `/intelligence/risk-adjusted` — B5 scorecard (client-pattern preservation; envelope normalization only)

**Phase 1c — Historical views (3 pages)**
- `/archive` — weekly report timeline
- `/archive/[weekEnding]` — report detail
- `/portfolio` — alignment only (Suspense already in use; fallback shape normalization)

### Out of scope — verify only

- `/portfolio` data-correctness layer — closeout already delivered. Verify no regression.

### Out of scope — risk-flagged for follow-up

- `/reports/weekly` — page exists in filesystem but is not referenced from navigation. Two concrete risks:
  1. After UX-1 ships, `/archive` uses envelope pattern while `/reports/weekly` does not, creating divergent behavior for users who reach the page via direct URL or legacy bookmark.
  2. The page may be dead code. Inbound reference grep + decision (delete / redirect to `/archive` / migrate) should be handled as a separate legacy-cleanup task.
- Endpoint splitting for `getFridayCurrent` (single endpoint currently powers hero + signals + portfolio + macro panels). Future optimization; not UX-1.

## 4. Architecture Contracts

### Contract 1 — Status-Aware Envelope

Every read-path endpoint response root contains:

- `status: 'ready' | 'partial' | 'unavailable'` — required
- Optional coverage metadata with surface-specific naming (`coverage_start`, `as_of`, `since`, `horizon`, etc.)
- Domain data fields with surface-specific names (`events`, `sleeves`, `scorecard`, `archive`, `performance`, etc.), using empty values (`[]`, `{}`) rather than `null` when no data is available

**Invariant:** empty-state shape === loaded-state shape. Only `status` differs. Frontend components must render from the envelope shape regardless of `status`, and the render tree must not require any field other than `status` to determine which branch (skeleton, partial placeholder, full) to display.

The portfolio split payload shipped in the cashflow closeout is the reference instance:

```
GET /api/portfolio/history →
  {
    archive: { series: AbsoluteHistoryPoint[] },
    performance: {
      coverage_start: string | null,
      status: 'ready' | 'partial' | 'unavailable',
      series: PerformanceHistoryPoint[]
    }
  }
```

UX-1 propagates the `status`-rooted pattern to the remaining read-path endpoints while preserving each surface's own domain vocabulary.

### Contract 2 — Per-Panel Independent Fetch

Within a page that composes multiple panels, each panel must fetch independently. Blocking `Promise.all` patterns are prohibited for the initial render. Slow panels must not block fast panels.

Enforcement:
- Default: server component with `<Suspense>` boundary per panel; each Suspense child is an `async` server component fetching its own data.
- Exception: client component with `useEffect` + empty-payload-first initial state, acceptable when interaction is the primary driver or when the pattern is already in place and working.

### Layering — SystemCache

Heavy compositions (external API aggregations, long-horizon time series, freeze-time precomputations) land in `SystemCache`.

- Key structure: `{surface}_{computation}_{horizon}` style.
- Invalidation contract is inherited from the cashflow closeout: cashflow writes invalidate performance-dependent cache keys. UX-1 additions must not break this contract; new keys that depend on cashflow-neutral data inherit the same trigger.
- TTL policy: freeze-time precomputations hold until the next freeze; aggregations use cron-driven refresh plus manual invalidation.
- Target selection: measure-then-decide at writing-plans time. Threshold: endpoints with measured p50 latency > 3s are caching candidates. See §8, Q7.3.

### Graceful Degrade

Read-path endpoints never return 5xx for data-acquisition failures. All such failures resolve to HTTP 200 with `status: 'unavailable'` and a shaped empty payload, accompanied by a structured warning log. Upstream API failures (external market data providers, database row absence), partial coverage, and maturity-gate blocks are all absorbed by the `status` enum. The only 4xx/5xx responses remaining are input validation errors, authentication failures, and genuine server bugs.

### Agent Readability

The contracts above converge to a single cross-surface rule: "every read-path endpoint has `status` at root, and empty-state shape is preserved." Agents editing any surface only need to remember this one rule; domain-specific field names below root match their semantics locally (no cross-surface field-name collisions).

## 5. Data Flow & Component Boundaries

### Default — Server Component + Suspense Streaming

```tsx
export default function Page() {
  return (
    <main>
      <Suspense fallback={<PanelSkeleton shape="..." />}>
        <PanelA />
      </Suspense>
      <Suspense fallback={<PanelSkeleton shape="..." />}>
        <PanelB />
      </Suspense>
    </main>
  );
}

async function PanelA() {
  const data = await fetchPanelA();
  return <PanelAView envelope={data} />;
}
```

Effect: Next.js streams an HTML shell with skeleton fallbacks to the client immediately; each `<Suspense>` child streams its own HTML chunk as its data resolves. The client renders HTML without waiting for the JS bundle.

### Exception — Client Component

Client components remain or are introduced when:

1. The pattern is already in place and working (`/intelligence/risk-adjusted` with `useEffect` + empty-payload-first).
2. The data fetch is user-triggered rather than page-load-triggered (e.g., `/friday/archive` comparison controls — currently overfetched on page load; UX-1 restructures the compare subpath to fetch only on user action).

Client components are permitted inside RSC shells as nested islands. The shell is still RSC streaming for the page-load data; the client island owns its interaction state.

### Per-Surface Render Pattern

| Page | Pattern | Notes |
|---|---|---|
| `/` | RSC streaming | Single fetch → one Suspense boundary |
| `/friday` | RSC streaming (panel-level) | 4–5 Suspense boundaries, one per endpoint |
| `/friday/[snapshotDate]` | RSC streaming | Single fetch, skeleton-first gain |
| `/friday/archive` | RSC shell + nested client | Timeline RSC; compare is client-triggered |
| `/intelligence` | RSC streaming | 3 Suspense boundaries |
| `/intelligence/rules` | RSC streaming | Single fetch |
| `/intelligence/attributions` | RSC streaming | 2 Suspense boundaries |
| `/intelligence/outcomes` | RSC streaming | Single fetch; `<4 weeks` empty maps to `unavailable` |
| `/intelligence/reviews` | RSC streaming | Single fetch; DESIGN.md hierarchy gap noted |
| `/intelligence/risk-adjusted` | Client (preserved) | Envelope normalize + skeleton alignment only |
| `/archive` | RSC streaming | 52 card skeleton |
| `/archive/[weekEnding]` | RSC streaming | Partial-report contract absorbed by `status: 'partial'` |
| `/portfolio` | RSC streaming (existing) | Fallback shape alignment + shared `<Skeleton>` |

### Panel Boundary Rule

A Suspense boundary corresponds to one independent endpoint + independent render order. If a single endpoint fans out to multiple visual panels (e.g., `getFridayCurrent` feeds hero + signals + portfolio + macro), the default is to wrap the whole group in one Suspense boundary; splitting the endpoint is future work.

## 6. Error Handling & Graceful Degrade

### Failure Mapping

| Failure Type | HTTP | Envelope status | Extra |
|---|---|---|---|
| Upstream API timeout / exception (yfinance, fdr, KIS) | 200 | `'unavailable'` | Empty series, structured warning log |
| Persisted row absent | 200 | `'unavailable'` | `coverage_start: null` |
| Partial coverage (some fields available) | 200 | `'partial'` | Available fields filled, rest empty, metadata flags which sources are missing |
| Maturity gate not met (e.g., < 26 weeks) | 200 | `'unavailable'` | `maturity_gate: { required_weeks, current_weeks }` preserved |
| Normal | 200 | `'ready'` | Full data |
| Invalid request | 4xx | — | Input validation only |
| Auth failure | 401/403 | — | As-is |
| Genuine server bug | 5xx | — | Next.js `error.tsx` handles |

### Backend Pattern

```python
@app.get("/api/v1/friday/briefing")
async def get_briefing(since: date | None = None):
    try:
        since_date = since or resolve_last_snapshot_date()
        events = briefing_service.get_briefing(since_date)
        return wrap_response(
            status="ready",
            since=since_date.isoformat(),
            severity_groups=events,
        )
    except UpstreamUnavailableError as e:
        logger.warning("briefing_upstream_unavailable", exc_info=e)
        return wrap_response(
            status="unavailable",
            since=None,
            severity_groups=[],
        )
```

`wrap_response` is the shared helper introduced in Phase 1a commit 1. It guarantees the envelope shape and always returns HTTP 200.

### Frontend Pattern

```tsx
function BriefingView({ envelope }: { envelope: FridayBriefingEnvelope }) {
  if (envelope.status === 'unavailable') {
    return <UnavailableCard copy="지난 금요일 이후 이벤트 데이터를 불러올 수 없어요" />;
  }
  if (envelope.status === 'partial') {
    return (
      <>
        <PartialBanner missing={envelope.missing_sources} />
        <BriefingList groups={envelope.severity_groups} />
      </>
    );
  }
  return <BriefingList groups={envelope.severity_groups} />;
}
```

Only `envelope.status` gates the render branch. No defensive checks on individual fields.

### Observability

Each read-path endpoint emits structured events for:
- `{endpoint}_upstream_unavailable` (warning)
- `{endpoint}_partial_coverage` (info, with missing-field metadata)
- `{endpoint}_maturity_gate_blocked` (info, with current/required weeks)
- `{endpoint}_parse_error` (error — envelope serialization bug)

Alert threshold for latency regressions: p50 latency > 3s on any endpoint fires a structured warning. See §8, Q7.1 and Q7.3.

### DESIGN.md Alignment

DESIGN.md 4-tier data-density states map to envelope `status`:

| DESIGN.md state | Envelope status | Visual |
|---|---|---|
| Loading | (Suspense pending) | Skeleton pulse |
| < 4 weeks / "데이터 수집 중" | `'unavailable'` + maturity metadata | Muted text + progress indicator |
| 4–12 weeks | `'partial'` | Banner + available data + "(early data)" badge |
| 12+ weeks | `'ready'` | Normal render |
| Per-section error | `'unavailable'` (that panel only) | Small error badge; page does not crash |

## 7. Testing Strategy

Four-axis coverage across all 13 surfaces.

### Contract Tests (backend)

For each envelope-wrapped endpoint, a test asserts:
- HTTP 200 on success and simulated failure.
- `status` value in `{'ready', 'partial', 'unavailable'}`.
- Empty-state shape equals loaded-state shape (all keys present even when data is empty).

### Graceful-Degrade Tests (backend)

For each endpoint, a test uses `monkeypatch` to simulate upstream failure and asserts the endpoint returns HTTP 200 with `status: 'unavailable'` and an empty shape.

### Skeleton Render Tests (frontend)

For each page, Jest + Testing Library renders the page component before fetch resolves and asserts the skeleton components are present. A second test asserts that a mocked `'unavailable'` envelope renders the placeholder copy.

### Regression Coverage

The existing backend suite (~130 tests) and frontend suite (lint + tsc + jest) stay green. Phase 1a commit 1 establishes the `wrap_response` helper and types with its own tests; subsequent commits add envelope + skeleton tests per surface.

### Test Infrastructure

C+D hybrid (per `project_test_infrastructure.md` memory):
- **C-track (sqlite)** — default for UX-1 contract and graceful-degrade tests. `pytest -q`.
- **D-track (Docker postgres)** — only for tests requiring JSONB semantics. UX-1 envelope contract is not JSONB-dependent, so D-track runs continue covering the closeout migration regression rather than UX-1 proper.

### TDD Protocol

Per `.claude/rules/testing.md`: RED → GREEN → REFACTOR within a single commit. No commits that leave failing tests.

## 8. Commit Sequence

Every commit must:
- Leave the full test suite green.
- Be individually revertable.
- Auto-deploy to production (main-only workflow; Vercel/Render auto-deploy on push).

### Phase 1a — Weekly ritual + entry

| # | Commit | Scope |
|---|---|---|
| 1 | `feat(ux1): shared envelope infra` | `backend/app/api/_envelope.py` (`wrap_response`), `frontend/src/lib/envelope.ts` (types, `isReady` / `isPartial` / `isUnavailable` predicates), `frontend/src/components/ui/Skeleton.tsx` base components, `<StatusAwareSuspense>` boundary helper, `docs/DOMAIN_MAP.md` v1 (envelope rule + current surface term list). Existing pages unchanged. |
| 2 | `feat(ux1): This Week async fill` | `/api/reports/weekly/latest` envelope wrap + `app/page.tsx` → RSC streaming + skeleton. |
| 3 | `feat(ux1): Friday page panel streaming` | `/api/v1/friday/{current,briefing,sleeve-history,snapshots}` envelope + `app/friday/page.tsx` → 4 Suspense boundaries + per-panel skeleton. The 9.6s blocking fetch becomes per-panel streaming. |
| 4 | `feat(ux1): Friday snapshot detail skeleton-first` | `/api/v1/friday/snapshot/{date}` envelope + `app/friday/[snapshotDate]/page.tsx` → RSC streaming + partial-coverage skeleton. |
| 5 | `feat(ux1): Friday archive timeline streaming + compare client-triggered` | `app/friday/archive/page.tsx` → RSC timeline + nested client compare island. Removes overfetch of `compareFridaySnapshots` on page load. |
| 6 | `perf(ux1): SystemCache for phase 1a hot paths` | Measure-then-decide: endpoints with measured p50 > 3s added to SystemCache. Invalidation inherits closeout contract. |

### Phase 1b — Intelligence

| # | Commit | Scope |
|---|---|---|
| 1 | `feat(ux1b): intelligence root panel streaming` | 3-endpoint envelope + 3 Suspense boundaries. |
| 2 | `feat(ux1b): intelligence rules page` | `/intelligence/rules` RSC + skeleton. |
| 3 | `feat(ux1b): intelligence attributions dual-panel streaming` | 2 Suspense boundaries (attributions + regime history). |
| 4 | `feat(ux1b): intelligence outcomes page` | `< 4 weeks` empty maps to `'unavailable'` + `weeks_until_ready` metadata. |
| 5 | `feat(ux1b): intelligence reviews page` | Light touch: envelope + skeleton only (DESIGN.md hierarchy gap is separate). |
| 6 | `refactor(ux1b): risk-adjusted envelope normalize` | `ready: boolean` → `status: union` one-shot cut. Client pattern preserved. See §9, Q7.8. |

### Phase 1c — Historical views

| # | Commit | Scope |
|---|---|---|
| 1 | `feat(ux1c): archive timeline skeleton-first` | `/api/reports/weekly` envelope + `/app/archive/page.tsx` → 52 card skeleton. |
| 2 | `feat(ux1c): archive detail skeleton-first` | `/api/reports/weekly/{week_ending}` envelope + `/app/archive/[weekEnding]/page.tsx`. Partial-report contract absorbed by `status: 'partial'`. |
| 3 | `refactor(ux1c): portfolio fallback alignment` | Replace `<Suspense>` fallbacks with shared `<Skeleton>` + `/api/portfolio/summary` envelope normalize. Structural behavior unchanged. |

### Phase Dependencies

- Phase 1a commit 1 is a hard prerequisite for Phase 1b and 1c.
- Phase 1b and 1c are independent and can be sequenced flexibly; 1b → 1c is the recommended default for continuity.
- Each phase concludes with a progress-log update to this decision doc and any new term entries to `docs/DOMAIN_MAP.md`.

## 9. Resolved Open Questions

### Q7.1 — Skeleton Time Budget

**Decision:** Skeleton persists indefinitely until data arrives or the fetch fails into `'unavailable'`. No user-facing timeout UI. Observability: latency > 3s triggers a structured warning log, aligned with the 3s principle stated in Q7.3.

**Rationale:** User directive prioritizes perceived speed. Showing a "taking longer than usual" message is noise. The backend must either serve data or resolve to `'unavailable'` — any third state is UX complexity without gain.

### Q7.2 — Render Cold Start

**Decision:** Keep GitHub Actions cron, tighten `keep-alive.yml` schedule from `*/30 * * * *` to `*/10 * * * *`. Writing-plans must also audit the endpoint the cron currently hits to confirm it reaches far enough into the app to prevent the backend from idling (i.e., the pinged endpoint exercises the SQLAlchemy session, not just a static health check).

**Rationale:** Render free tier sleeps after 15 minutes idle. A 30-minute cron cannot prevent cold start — backend wakes, sleeps, and the next ping hits a cold backend. 10 minutes keeps the backend continuously warm. The user confirmed this approach is preferred over paid-tier migration.

### Q7.3 — Caching Target Threshold

**Decision:** Endpoints with measured p50 latency > 3s are caching candidates. Specific endpoint selection happens in writing-plans using live measurement.

**Rationale:** Aligns with the user's standing principle that all clicks should complete within 3 seconds. 3s is the observability alert threshold (Q7.1) and the caching inclusion threshold — same number, consistent meaning across the system.

### Q7.4 — Partial vs Unavailable Boundary

**Decision:** Surface-by-surface rule-setting in writing-plans. No global rule.

**Rationale:** The meaningful-minimum-unit depends on each surface's semantic (e.g., "at least 1 completed freeze" vs "at least 50% of signal rows" vs "at least one regime transition"). A global rule overfits to whichever surface was considered first.

### Q7.5 — DOMAIN_MAP.md v1 Scope

**Decision:** v1 is minimal — envelope rule + current 13 surface term list, one line per term. Additions to per-term semantic descriptions and naming conventions happen incrementally during writing-plans as actual patterns emerge.

**Rationale:** Pre-locking unproven conventions before implementation produces documents that get ignored or require retroactive revision. Start with what is already true (envelope rule) and the term inventory (flat list); let convention evolve as writing-plans surfaces concrete decisions.

### Q7.6 — Skeleton Design Approach

**Decision:** Per-surface hybrid. Complex or fixed-structure panels (e.g., Sleeve Health's 6 fixed rows, Decision Journal form) are hand-authored. Simple list/card patterns (e.g., `/archive` 52 cards) use programmatic generation from envelope shape. Each surface's skeleton approach is decided in that surface's writing-plans entry.

**Rationale:** Skeleton fidelity to loaded-state shape is the goal, not a uniform implementation. Hand-author where the shape is irregular or semantically loaded; generate where shape is simple repetition.

### Q7.7 — Deploy Unit

**Decision:** Commit-by-commit auto-deploy. Every main push ships to Vercel (frontend) and Render (backend) automatically.

**Rationale:** Each commit in the sequence maintains green tests and is revertable. Single-commit revert is faster than batch rollback. Solo-dev main-only workflow already relies on this. Agents editing the codebase in the future should continue to treat every merged commit as production-bound; this is documented explicitly so future agents can reason about blast radius per commit without re-deriving the deploy model.

### Q7.8 — Risk-Adjusted Breaking Change

**Decision:** One-shot atomic cut in Phase 1b commit 6. `ready: boolean` → `status: 'ready' | 'partial' | 'unavailable'`. Backend response and frontend consumer change in the same commit. No transitional dual-field period.

**Rationale:** Single consumer (the `/intelligence/risk-adjusted` page itself, no external API clients). Transitional dual-field would create temporary code that requires a second cleanup commit. Solo-dev + single-consumer lets us change both sides atomically without coordination risk. Documented explicitly so future agents do not re-introduce `ready: boolean` reading for backward compatibility.

### Q7.9 — Failure Observability Level

**Decision:** Structured logs only for v1. No admin dashboard, no external monitoring integration. Log categories listed in §6 (Observability). Dashboard consideration deferred until observed friction (i.e., "I notice endpoints falling into `'unavailable'` and can't easily tell how often" becomes a real complaint).

**Rationale:** Solo-dev low-volume environment. Sentry / Grafana add operational complexity and cost without proportional value at current scale. Logs are sufficient ground truth for post-hoc investigation. Documented explicitly so future agents do not silently introduce a monitoring dependency.

### Q7.10 — Legacy `/reports/weekly`

**Decision:** Leave out of UX-1 scope. Flag as follow-up legacy-cleanup task.

**Risk analysis:**

1. **User confusion (Low severity):** Page is not linked from Sidebar.tsx. Users cannot reach it through navigation. Only direct URL entry (e.g., legacy bookmarks) exposes users to it.
2. **Behavior divergence (Medium severity):** After UX-1 ships, `/archive` uses the envelope pattern and shared skeletons; `/reports/weekly` does not. A user who reaches `/reports/weekly` via direct URL sees older, blocking behavior inconsistent with the rest of the app.
3. **Dead code (High severity for maintenance):** Page may have no inbound references at all. Every future agent that reads the filesystem has to reason about whether this page is a current surface or a leftover.

**Mitigation:** Decision doc records the risk. Follow-up task: grep for inbound references to `/reports/weekly`; if dead, delete the page file; if referenced (e.g., older README, test, external link), decide between migrating to envelope pattern or redirecting to `/archive`. This should not block UX-1 shipment.

## 10. Out of Scope + Follow-Up Flags

| Item | Why out | Follow-up trigger |
|---|---|---|
| `/reports/weekly` disposition | Risk-flagged above | After UX-1 Phase 1c ships; grep inbound refs then decide |
| Endpoint splitting for `getFridayCurrent` | Current panel-level Suspense uses single boundary for this endpoint | Writing-plans re-evaluation per surface if measurable latency remains > 3s after Phase 1a.6 |
| Service-layer role partitioning (`backend/app/services/*` decomposition) | Standing memory feedback, separate concern from UX | Raise as standalone task when next touching the service tree heavily |
| Supabase `portfolio_performance_snapshots` backfill (production) | Closeout left this open for the user's 2026-03-20 cashflow decision | Separate data-hygiene task, does not block UX-1 structural work |
| Admin dashboard for envelope `'unavailable'` rate | §9 Q7.9 defers to observed friction | Real complaint of "I can't tell which endpoints are failing" |
| Paid-tier Render migration | §9 Q7.2 chose keep-alive cron | If 10-minute cron still shows cold-start symptoms after shipping, reconsider |

## 11. Cross-References

- Cashflow/benchmark closeout plan (prerequisite): `.omx/plans/verification-first-cashflow-benchmark-closeout-20260423.md`
- Cashflow closeout semantic validation: `.omx/reports/portfolio-cashflow-semantic-validation-20260423.md`
- TODOS.md archival decision: `docs/superpowers/decisions/2026-04-23-todos-md-archived.md`
- First-paint UX priority memory: `~/.claude/projects/-home-lg-dev-Portfolio-Tracker/memory/feedback_first_paint_ux_priority.md`
- Test infrastructure memory: `~/.claude/projects/-home-lg-dev-Portfolio-Tracker/memory/project_test_infrastructure.md`
- DESIGN.md data-density states and hierarchy (referenced throughout)
- CLAUDE.md Current Contract Notes (read-only weekly endpoint, partial-snapshot handling)

## 12. Progress Log

- 2026-04-23 — Decision doc written and committed. Writing-plans next.
- _(Subsequent entries added per commit shipped.)_
