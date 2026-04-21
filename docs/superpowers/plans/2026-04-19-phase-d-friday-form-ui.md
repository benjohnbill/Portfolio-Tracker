# Phase D — Friday Decision-Journal Form UI (A3 + A4 + A7 + R1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the user-visible Phase D Tier 1 UI surface so that a user can record 3-scalar confidence (A3), structured invalidation (A4), and an optional weekly snapshot comment (A7) on `/friday`, and remove the vestigial Bell icon from the header (R1).

**Architecture:** Backend already has the schema and service layer from the prior plan (`bd8be17..bdb9eb0` on `main`). This plan extends the snapshot POST endpoint to accept an optional `comment`, updates the `/friday` decision-journal form to post the 3-scalar confidence + structured invalidation fields, surfaces them on the read-side panels (`FridayDashboard` + `FridaySnapshotPanel`), renders `weekly_snapshots.comment` prominently on archive cards, and deletes the Bell icon. The backend legacy `confidence` alias stays wired through this plan (it is removed in Plan 3 of the Ship Now set, after this lands and is validated).

**Tech Stack:** Next.js 14 (app router), React 18, TypeScript, Tailwind, lucide-react icons. Backend: FastAPI, Pydantic v2, SQLAlchemy, pytest. No new dependencies.

**Out of scope (deferred):**
- A1 Since Last Friday briefing card (separate Plan 2 per Ship Now roadmap).
- A2 Sleeve Health panel (same).
- Discord briefing echo + legacy `confidence` alias cleanup (Plan 3 — post-landing).
- Visual redesign beyond what A3/A4/A7 explicitly require (no restructuring of the hero strip, signals list, macro panel, etc.).

---

## File Structure

**Files modified:**

- `backend/app/main.py` — extend `FridaySnapshotCreateRequest` with `comment`; wire into endpoint.
- `backend/app/services/friday_service.py` — extend `FridayService.create_snapshot` signature with `comment`; persist it.
- `backend/app/services/friday_service.py` — extend `_serialize_snapshot` to include `comment` in response body.
- `backend/tests/test_friday_service.py` — 2 new tests for snapshot-comment persistence + response.
- `backend/tests/test_api.py` — 1 new test for POST `/api/v1/friday/snapshot` with `comment`.
- `frontend/src/lib/api.ts` — update `FridayDecision` interface; update `createFridayDecision` payload type; update `createFridaySnapshot` to accept `comment`; add `FridaySnapshotSummary.comment?` field.
- `frontend/src/components/friday/FridayDashboard.tsx` — state shape, form controls (3 sliders, failure_mode dropdown, trigger_threshold numeric, comment textarea), submit handler, decision-card rendering.
- `frontend/src/components/friday/FridaySnapshotPanel.tsx` — decision-card rendering (3-scalar display + invalidation structured fields) + archive comment quote at top of panel.
- `frontend/src/app/layout.tsx` — remove Bell icon + its wrapper div; drop unused `Bell` import.

**Files NOT modified in this plan:**

- `backend/app/models.py` — schema already landed.
- `backend/alembic/versions/a2b8f4d1c901_phase_d_tier1_schema.py` — already landed.
- Anything under `backend/app/services/intelligence_service.py`, `notification_service.py`, `discord_notifier.py`.

---

## Task 1: Backend — snapshot POST accepts optional `comment`

**Files:**

- Modify: `backend/app/main.py:68-70` (Pydantic request) and `:404-417` (endpoint).
- Modify: `backend/app/services/friday_service.py:231-267` (`create_snapshot`) and `:64-78` (`_serialize_snapshot`).
- Modify: `backend/tests/test_friday_service.py` (append tests).
- Modify: `backend/tests/test_api.py` (append test).

- [ ] **Step 1: Write failing service-level test (append to `backend/tests/test_friday_service.py`)**

```python
def test_create_snapshot_persists_comment(monkeypatch):
    monkeypatch.setattr(ReportService, "build_weekly_report", lambda db, d: _report())
    db = _FakeDB()
    created = FridayService.create_snapshot(db, date(2026, 4, 3), comment="조용한 한 주, 판단 유지.")
    assert created["comment"] == "조용한 한 주, 판단 유지."
    assert db.snapshots[0].comment == "조용한 한 주, 판단 유지."


def test_create_snapshot_comment_defaults_to_none(monkeypatch):
    monkeypatch.setattr(ReportService, "build_weekly_report", lambda db, d: _report())
    db = _FakeDB()
    created = FridayService.create_snapshot(db, date(2026, 4, 3))
    assert created["comment"] is None
    assert db.snapshots[0].comment is None
```

- [ ] **Step 2: Run service tests to confirm they fail**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest tests/test_friday_service.py -k "create_snapshot_persists_comment or create_snapshot_comment_defaults" -v
```

Expected: 2 FAIL (`TypeError: unexpected kwarg 'comment'` and/or KeyError on `"comment"`).

- [ ] **Step 3: Update `FridayService.create_snapshot` signature and body**

In `backend/app/services/friday_service.py`, the method currently begins at line 231 with:

```python
    @staticmethod
    def create_snapshot(db: Session, snapshot_date: Optional[date] = None) -> Dict[str, Any]:
        target_date = snapshot_date or ReportService.get_week_ending()
```

Replace the signature line and the `WeeklySnapshot(...)` constructor block. New signature:

```python
    @staticmethod
    def create_snapshot(
        db: Session,
        snapshot_date: Optional[date] = None,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
```

Inside the method, find the `WeeklySnapshot(...)` constructor (around line 262) and add `comment=comment` as a keyword arg, so it reads:

```python
        snapshot = WeeklySnapshot(
            snapshot_date=target_date,
            created_at=datetime.now(timezone.utc),
            frozen_report=report,
            snapshot_metadata=metadata,
            comment=comment,
        )
```

- [ ] **Step 4: Update `_serialize_snapshot` to surface `comment`**

In `backend/app/services/friday_service.py`, the `_serialize_snapshot` method at lines 64-78 currently builds its payload without `comment`. Extend the base `payload` dict (the one declared at line 66) to include:

```python
    @staticmethod
    def _serialize_snapshot(snapshot: WeeklySnapshot, decisions: Optional[List[WeeklyDecision]] = None, include_report: bool = True) -> Dict[str, Any]:
        payload = {
            "id": snapshot.id,
            "snapshotDate": snapshot.snapshot_date.isoformat() if snapshot.snapshot_date else None,
            "createdAt": snapshot.created_at.isoformat() if snapshot.created_at else None,
            "metadata": snapshot.snapshot_metadata or {},
            "comment": snapshot.comment,
            "decisions": [FridayService._serialize_decision(item) for item in (decisions or [])],
        }
        if include_report:
            payload["frozenReport"] = snapshot.frozen_report or {}
        else:
            payload["score"] = (snapshot.frozen_report or {}).get("score", {}).get("total")
            payload["status"] = (snapshot.frozen_report or {}).get("status")
        return payload
```

- [ ] **Step 5: Extend Pydantic request and endpoint in `backend/app/main.py`**

At line 68, `FridaySnapshotCreateRequest` currently reads:

```python
class FridaySnapshotCreateRequest(BaseModel):
    snapshot_date: Optional[str] = None
```

Replace with:

```python
class FridaySnapshotCreateRequest(BaseModel):
    snapshot_date: Optional[str] = None
    # Phase D A7 — optional per-freeze observation, 1-2 lines.
    comment: Optional[str] = None
```

At line 404, the endpoint currently reads:

```python
@app.post("/api/v1/friday/snapshot")
def create_friday_snapshot(payload: FridaySnapshotCreateRequest, db: Session = Depends(get_db)):
    try:
        snapshot_date = datetime.strptime(payload.snapshot_date, "%Y-%m-%d").date() if payload.snapshot_date else None
        return FridayService.create_snapshot(db, snapshot_date=snapshot_date)
```

Replace the `return` line:

```python
        return FridayService.create_snapshot(db, snapshot_date=snapshot_date, comment=payload.comment)
```

The rest of the endpoint (try/except mapping) is untouched.

- [ ] **Step 6: Run service tests — expect PASS**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest tests/test_friday_service.py -k "create_snapshot_persists_comment or create_snapshot_comment_defaults" -v
```

Expected: 2 passed.

- [ ] **Step 7: Write failing API-level test (append to `backend/tests/test_api.py`)**

```python
def test_post_friday_snapshot_accepts_comment(client, seeded_snapshot):
    # Different date to avoid colliding with the fixture's snapshot.
    response = client.post(
        "/api/v1/friday/snapshot",
        json={"snapshot_date": "2026-04-10", "comment": "지난 주와 비슷, 소폭 감소 지속 관찰."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["comment"] == "지난 주와 비슷, 소폭 감소 지속 관찰."
```

If the existing `seeded_snapshot` fixture does not short-circuit `ReportService.build_weekly_report`, and the test fails because of portfolio-data unavailability, inline a `monkeypatch` analogous to the service test: make `ReportService.build_weekly_report` return `_report()` within the test body. If the fixture already covers this, skip the monkeypatch.

- [ ] **Step 8: Run API test — expect PASS on first run**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest tests/test_api.py -k "post_friday_snapshot_accepts_comment" -v
```

Expected: 1 passed (Pydantic now accepts `comment`; service persists it; serializer returns it). If it fails with 422 or 500, re-check Steps 3/4/5.

- [ ] **Step 9: Run full backend suite**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest -v
```

Expected: all passed (baseline 52 + 3 new = 55).

- [ ] **Step 10: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add backend/app/main.py backend/app/services/friday_service.py backend/tests/test_friday_service.py backend/tests/test_api.py
git diff --cached --stat
```

Expected: 4 files.

```bash
git commit -m "$(cat <<'EOF'
feat(friday): accept optional weekly snapshot comment on POST /api/v1/friday/snapshot

Phase D A7 backend wiring. Schema column `weekly_snapshots.comment`
already landed (a2b8f4d1c901). This extends the Pydantic request
model, the FridayService.create_snapshot signature, and the
snapshot response serializer to carry the field end-to-end.

Tests: 2 service-level (persist, default-none), 1 API-level
(round-trip through POST endpoint).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Frontend API types

**Files:**

- Modify: `frontend/src/lib/api.ts:278-288` (FridayDecision interface), `:290-303` (FridaySnapshotSummary), `:622-638` (createFridaySnapshot), `:640-663` (createFridayDecision).

- [ ] **Step 1: Extend `FridayDecision` interface (lines 278-288)**

Replace the entire interface block:

```typescript
export interface FridayDecision {
  id: number;
  snapshotId: number;
  createdAt: string | null;
  decisionType: string;
  decision_type?: string;
  assetTicker: string | null;
  note: string;
  // Phase D A3 — 3-scalar confidence. Primary required; the other two optional until A3 UI saturates.
  confidenceVsSpyRiskadj: number;
  confidenceVsCash: number | null;
  confidenceVsSpyPure: number | null;
  // Legacy mirror of confidenceVsSpyRiskadj — retained so old read sites keep rendering until Plan 3 cleanup.
  confidence: number;
  // Phase D A4 — structured invalidation.
  invalidation: string | null;
  expectedFailureMode: string | null;
  triggerThreshold: number | null;
}
```

- [ ] **Step 2: Extend `FridaySnapshotSummary` interface (lines 290-303)**

Replace the entire interface block:

```typescript
export interface FridaySnapshotSummary {
  id: number;
  snapshotDate: string;
  createdAt: string | null;
  metadata: {
    coverage?: Record<string, boolean>;
    partial?: boolean;
    errors?: Record<string, string>;
    snapshotWeekEnding?: string;
  };
  // Phase D A7 — optional per-freeze observation; echoed on archive cards and Discord briefing.
  comment: string | null;
  decisions: FridayDecision[];
  score?: number | null;
  status?: string | null;
}
```

- [ ] **Step 3: Extend `createFridaySnapshot` to accept optional `comment` (lines 622-638)**

Replace the function:

```typescript
export async function createFridaySnapshot(snapshotDate?: string, comment?: string): Promise<FridaySnapshot> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/v1/friday/snapshot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snapshot_date: snapshotDate ?? null,
      comment: comment ?? null,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || 'Failed to create Friday snapshot');
  }

  return res.json();
}
```

- [ ] **Step 4: Extend `createFridayDecision` payload shape (lines 640-663)**

Replace the function:

```typescript
export async function createFridayDecision(payload: {
  snapshot_id: number;
  decision_type: string;
  asset_ticker?: string;
  note: string;
  // Phase D A3 — primary required; siblings optional.
  confidence_vs_spy_riskadj: number;
  confidence_vs_cash?: number;
  confidence_vs_spy_pure?: number;
  // Phase D A4 — all optional.
  invalidation?: string;
  expected_failure_mode?: string;
  trigger_threshold?: number;
}): Promise<FridayDecision> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const res = await fetch(`${API_BASE}/api/v1/friday/decisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorData.detail || 'Failed to create Friday decision');
  }

  return res.json();
}
```

- [ ] **Step 5: Verify TypeScript compiles (type-check only)**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run typecheck 2>&1 | tail -40
```

If `typecheck` is not a script, use:

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit 2>&1 | tail -40
```

Expected: errors in `FridayDashboard.tsx` and `FridaySnapshotPanel.tsx` complaining that their state / render code still refers to the old shape (`confidence`, `decisionDraft.confidence`, etc.). These are expected — Tasks 3 and 4 repair them. No other file should fail type-check.

- [ ] **Step 6: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/lib/api.ts
git diff --cached --stat
```

Expected: 1 file.

```bash
git commit -m "$(cat <<'EOF'
refactor(api types): add Phase D 3-scalar + structured invalidation + snapshot comment fields

Frontend type shim for the Phase D Tier 1 API changes already on the
backend. Components that consume these types still reference the
legacy `confidence` field; they are updated in the follow-on commits
in this feature branch. The legacy `confidence` key is retained as a
mirror on FridayDecision until backend Plan 3 drops it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: FridayDashboard — 3-scalar confidence + structured invalidation + comment (form + submit)

**Files:**

- Modify: `frontend/src/components/friday/FridayDashboard.tsx`

- [ ] **Step 1: Update `decisionDraft` state shape (lines 40-46)**

Replace the `useState` initializer with:

```typescript
  const [decisionDraft, setDecisionDraft] = useState({
    decision_type: 'hold',
    asset_ticker: '',
    note: '',
    // Phase D A3 — primary required; siblings optional.
    confidence_vs_spy_riskadj: 5,
    confidence_vs_cash: 5,
    confidence_vs_spy_pure: 5,
    invalidation: '',
    // Phase D A4 — structured invalidation.
    expected_failure_mode: '',
    trigger_threshold: '',
  });

  // Phase D A7 — optional per-freeze observation. Separate from decision draft
  // because it is tied to the freeze action, not per-decision state.
  const [snapshotComment, setSnapshotComment] = useState('');
```

- [ ] **Step 2: Update `handleFreeze` to pass the snapshot comment (lines 55-76)**

Replace the body of `handleFreeze`. Note the only change is the `createFridaySnapshot` call:

```typescript
  async function handleFreeze() {
    setFreezeError(null);
    setFreezeState('working');
    setFreezeMessage('Fetching portfolio...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      setFreezeMessage('Building weekly snapshot...');
      await new Promise((resolve) => setTimeout(resolve, 150));
      setFreezeMessage('Saving snapshot...');
      await createFridaySnapshot(report.weekEnding, snapshotComment.trim() || undefined);
      setFreezeState('done');
      setFreezeMessage('Frozen successfully.');
      setTimeout(() => {
        router.refresh();
      }, 250);
    } catch (error) {
      setFreezeState('idle');
      setFreezeError(error instanceof Error ? error.message : 'Failed to freeze Friday snapshot');
      setFreezeMessage('Ready to freeze this Friday.');
    }
  }
```

- [ ] **Step 3: Update `handleDecisionSubmit` to post the new fields (lines 78-110)**

Replace the body of `handleDecisionSubmit`:

```typescript
  async function handleDecisionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentSnapshot) {
      setDecisionError('Freeze this Friday first to attach a decision.');
      return;
    }

    setDecisionState('saving');
    setDecisionError(null);

    try {
      const parsedThreshold = decisionDraft.trigger_threshold.trim();
      await createFridayDecision({
        snapshot_id: currentSnapshot.id,
        decision_type: decisionDraft.decision_type,
        asset_ticker: decisionDraft.asset_ticker || undefined,
        note: decisionDraft.note,
        confidence_vs_spy_riskadj: decisionDraft.confidence_vs_spy_riskadj,
        confidence_vs_cash: decisionDraft.confidence_vs_cash,
        confidence_vs_spy_pure: decisionDraft.confidence_vs_spy_pure,
        invalidation: decisionDraft.invalidation || undefined,
        expected_failure_mode: decisionDraft.expected_failure_mode || undefined,
        trigger_threshold: parsedThreshold ? Number(parsedThreshold) : undefined,
      });
      setDecisionDraft({
        decision_type: 'hold',
        asset_ticker: '',
        note: '',
        confidence_vs_spy_riskadj: 5,
        confidence_vs_cash: 5,
        confidence_vs_spy_pure: 5,
        invalidation: '',
        expected_failure_mode: '',
        trigger_threshold: '',
      });
      router.refresh();
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'Failed to save decision');
    } finally {
      setDecisionState('idle');
    }
  }
```

- [ ] **Step 4: Add ordering-deviation helper near the top of the file (just below the `humanizeLabel` helper at line 25)**

Insert:

```typescript
function orderingDeviationNote(
  riskadj: number,
  cash: number,
  pure: number,
): string | null {
  // Expected portfolio design intent: #1 >= #2 >= #3.
  // Deviation is an observation (logged for calibration), not a warning.
  if (riskadj < cash || cash < pure) {
    return 'Expected #1 ≥ #2 ≥ #3 — your ordering deviates. Logged for calibration.';
  }
  return null;
}
```

- [ ] **Step 5: Replace the form body (lines 286-344) — confidence slider block + invalidation textarea**

Locate the form (`<form className="space-y-4" onSubmit={handleDecisionSubmit}>`). Keep the decision-type / ticker / note fields unchanged. Replace the existing confidence + invalidation blocks (lines 317-337) with:

```tsx
                <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 px-3 py-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Confidence (1–10)</p>

                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      vs SPY Risk-adj <span className="text-primary">{decisionDraft.confidence_vs_spy_riskadj}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground/70">primary</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={decisionDraft.confidence_vs_spy_riskadj}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, confidence_vs_spy_riskadj: Number(event.target.value) }))}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      vs Cash <span className="text-primary">{decisionDraft.confidence_vs_cash}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground/70">baseline</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={decisionDraft.confidence_vs_cash}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, confidence_vs_cash: Number(event.target.value) }))}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">
                      vs SPY Pure <span className="text-primary">{decisionDraft.confidence_vs_spy_pure}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground/70">stretch</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={decisionDraft.confidence_vs_spy_pure}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, confidence_vs_spy_pure: Number(event.target.value) }))}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                  </div>

                  {(() => {
                    const note = orderingDeviationNote(
                      decisionDraft.confidence_vs_spy_riskadj,
                      decisionDraft.confidence_vs_cash,
                      decisionDraft.confidence_vs_spy_pure,
                    );
                    return note ? (
                      <p className="text-[11px] text-muted-foreground italic">{note}</p>
                    ) : null;
                  })()}
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Invalidation (what would change your mind?)</label>
                  <textarea
                    value={decisionDraft.invalidation}
                    onChange={(event) => setDecisionDraft((current) => ({ ...current, invalidation: event.target.value }))}
                    placeholder="Free-text: conditions that would invalidate this thesis."
                    className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white outline-none focus-visible:border-ring"
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-white"
                      value={decisionDraft.expected_failure_mode}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, expected_failure_mode: event.target.value }))}
                    >
                      <option value="" className="bg-card">Failure mode (optional)</option>
                      <option value="price_drop" className="bg-card">price drop</option>
                      <option value="regime_shift" className="bg-card">regime shift</option>
                      <option value="correlation_breakdown" className="bg-card">correlation breakdown</option>
                      <option value="liquidity_crunch" className="bg-card">liquidity crunch</option>
                      <option value="other" className="bg-card">other</option>
                    </select>
                    <Input
                      type="number"
                      step="any"
                      value={decisionDraft.trigger_threshold}
                      onChange={(event) => setDecisionDraft((current) => ({ ...current, trigger_threshold: event.target.value }))}
                      placeholder="Trigger threshold (numeric, optional)"
                    />
                  </div>
                </div>
```

- [ ] **Step 6: Add the snapshot comment textarea above the Freeze button**

Find the Freeze card at lines 161-176 (`<Card>` with `<CardTitle className="text-white text-lg">Freeze</CardTitle>`). Inside its `CardContent`, ABOVE the `<Button onClick={handleFreeze}...>` line, insert:

```tsx
            <details className="rounded-md border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none text-white/80">💬 이번 주 코멘트 (선택)</summary>
              <textarea
                value={snapshotComment}
                onChange={(event) => setSnapshotComment(event.target.value)}
                placeholder="1–2 줄 관찰 (비워두면 저장되지 않음)."
                className="mt-2 min-h-16 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-white outline-none focus-visible:border-ring"
                disabled={freezeState === 'working' || isFrozen}
              />
            </details>
```

- [ ] **Step 7: Update the inline rendered decision cards (lines 352-360)**

Replace the per-decision card:

```tsx
                ) : (currentSnapshot?.decisions ?? []).map((decision) => (
                  <div key={decision.id} className="rounded-lg bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{decision.decisionType || decision.decision_type}</p>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                        Conf {decision.confidenceVsSpyRiskadj}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{decision.note}</p>
                    {(decision.confidenceVsCash != null || decision.confidenceVsSpyPure != null) && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        vs Cash {decision.confidenceVsCash ?? '—'} · vs SPY Pure {decision.confidenceVsSpyPure ?? '—'}
                      </p>
                    )}
                    {decision.invalidation && (
                      <p className="text-[11px] text-white/70 mt-2">Invalidation: {decision.invalidation}</p>
                    )}
                    {(decision.expectedFailureMode || decision.triggerThreshold != null) && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        {decision.expectedFailureMode && <>Mode: <span className="text-white/80">{decision.expectedFailureMode}</span></>}
                        {decision.expectedFailureMode && decision.triggerThreshold != null && ' · '}
                        {decision.triggerThreshold != null && <>Threshold: <span className="text-white/80">{decision.triggerThreshold}</span></>}
                      </p>
                    )}
                  </div>
                ))}
```

- [ ] **Step 8: Type-check**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit 2>&1 | tail -30
```

Expected: errors only in `FridaySnapshotPanel.tsx` (repaired in Task 4).

- [ ] **Step 9: Lint**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run lint 2>&1 | tail -20
```

Expected: clean (or pre-existing warnings only — nothing introduced by this commit).

- [ ] **Step 10: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/components/friday/FridayDashboard.tsx
git diff --cached --stat
```

Expected: 1 file.

```bash
git commit -m "$(cat <<'EOF'
feat(friday): 3-scalar confidence + structured invalidation + snapshot comment form

Phase D A3 / A4 / A7 UI on /friday. Decision journal form now captures:

A3 — three stacked confidence sliders (vs SPY Risk-adj, vs Cash,
vs SPY Pure), each 1..10. Ordering-deviation note surfaces as a
muted italic observation when the user's ordering violates the
expected #1 >= #2 >= #3 -- not a warning, just a signal logged for
later calibration.

A4 — failure_mode dropdown (price_drop / regime_shift /
correlation_breakdown / liquidity_crunch / other) + trigger_threshold
numeric input alongside the existing free-text invalidation field.
All three are optional.

A7 — collapsed "이번 주 코멘트" textarea inside the Freeze card.
Empty input is dropped before the POST body is sent (stored as NULL).

Submitted-decision list renders the primary scalar prominently and
surfaces the siblings + structured invalidation fields when present.

Legacy single-slider behavior removed at the UI layer; backend
keeps the `confidence` alias until Plan 3 cleanup lands.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: FridaySnapshotPanel — decision card + archive comment

**Files:**

- Modify: `frontend/src/components/friday/FridaySnapshotPanel.tsx`

- [ ] **Step 1: Add optional `comment` prop passthrough**

The existing `FridaySnapshotPanelProps` (lines 16-24) already takes `decisions` optionally. Extend to take an optional `comment`:

```tsx
interface FridaySnapshotPanelProps {
  report: WeeklyReport;
  eyebrow: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  decisions?: FridaySnapshot['decisions'];
  // Phase D A7 — surfaced at the top of the panel as an italic quote when non-empty.
  comment?: string | null;
}
```

Then update the destructuring at lines 26-34:

```tsx
export function FridaySnapshotPanel({
  report,
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  decisions = [],
  comment = null,
}: FridaySnapshotPanelProps) {
```

- [ ] **Step 2: Render the comment at the top of the panel body**

Currently the `return` starts with a `<div className="space-y-8 ...">` wrapper, and the first child is a header `<div className="flex items-center justify-between gap-4">`. AFTER that header block (after its closing `</div>` — around line 53), INSERT a new block:

```tsx
      {comment && (
        <div className="rounded-lg border-l-2 border-primary/60 bg-background/40 px-4 py-3">
          <p className="text-sm text-white/90 italic">"{comment}"</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Weekly comment</p>
        </div>
      )}
```

- [ ] **Step 3: Replace the decision card render block (lines 193-205)**

Replace with:

```tsx
              ) : decisions.map((decision) => (
                <div key={decision.id} className="rounded-lg bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{decision.decisionType}</p>
                    <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase bg-white/5 text-muted-foreground">
                      Conf {decision.confidenceVsSpyRiskadj}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{decision.note}</p>
                  {(decision.confidenceVsCash != null || decision.confidenceVsSpyPure != null) && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      vs Cash {decision.confidenceVsCash ?? '—'} · vs SPY Pure {decision.confidenceVsSpyPure ?? '—'}
                    </p>
                  )}
                  {decision.invalidation && <p className="text-xs text-white/70 mt-2">Invalidation: {decision.invalidation}</p>}
                  {(decision.expectedFailureMode || decision.triggerThreshold != null) && (
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      {decision.expectedFailureMode && <>Mode: <span className="text-white/80">{decision.expectedFailureMode}</span></>}
                      {decision.expectedFailureMode && decision.triggerThreshold != null && ' · '}
                      {decision.triggerThreshold != null && <>Threshold: <span className="text-white/80">{decision.triggerThreshold}</span></>}
                    </p>
                  )}
                </div>
              ))}
```

- [ ] **Step 4: Find the callers of `FridaySnapshotPanel` and pass `comment`**

Run:

```bash
cd /home/lg/dev/Portfolio_Tracker && grep -rn "FridaySnapshotPanel" frontend/src --include="*.tsx" --include="*.ts"
```

For each call site that passes `decisions={snapshot.decisions}` (or similar), also pass `comment={snapshot.comment}`. There is likely one in `frontend/src/app/friday/[date]/page.tsx` and one in an archive comparison route. Update the prop only — do NOT refactor the surrounding code.

- [ ] **Step 5: Type-check + lint**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit 2>&1 | tail -30
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run lint 2>&1 | tail -20
```

Expected: both clean. No remaining `confidence` references at the old position except where they are explicitly the legacy-mirror key (which should still exist because Task 2 retained it in the `FridayDecision` interface).

- [ ] **Step 6: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/components/friday/FridaySnapshotPanel.tsx frontend/src/app/friday
git diff --cached --stat
```

Expected: 2 or 3 files depending on how many snapshot-panel callers needed updates.

```bash
git commit -m "$(cat <<'EOF'
feat(friday): render 3-scalar confidence + structured invalidation + snapshot comment on archive panel

Phase D A3 / A4 / A7 read-side. FridaySnapshotPanel surfaces:

- Snapshot-level `comment` as an italic left-accent quote at the top
  of the archive page (when non-empty).
- Decision-level primary confidence scalar prominently; vs Cash and
  vs SPY Pure in a muted secondary line when present.
- Structured invalidation fields (expectedFailureMode, triggerThreshold)
  rendered below the free-text invalidation when present.

Call sites updated to forward `comment={snapshot.comment}` into the
panel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: R1 — remove Bell icon from layout header

**Files:**

- Modify: `frontend/src/app/layout.tsx:4` (import) and `:26-29` (icon + wrapper div).

- [ ] **Step 1: Drop the `Bell` import**

Replace line 4:

```tsx
import { Bell, Sparkles, User } from 'lucide-react';
```

with:

```tsx
import { Sparkles, User } from 'lucide-react';
```

- [ ] **Step 2: Remove the Bell icon wrapper div**

Delete lines 27-29 (inclusive):

```tsx
                <div className="p-2 bg-accent rounded-md transition-colors" aria-hidden="true">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                </div>
```

The adjacent `Sparkles` wrapper div (immediately below) stays untouched.

- [ ] **Step 3: Type-check + lint + build**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit 2>&1 | tail -10
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run lint 2>&1 | tail -10
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run build 2>&1 | tail -20
```

Expected: all three clean. The build verifies there are no remaining unresolved imports or unused references introduced by Tasks 3-5.

- [ ] **Step 4: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/app/layout.tsx
git diff --cached --stat
```

Expected: 1 file.

```bash
git commit -m "$(cat <<'EOF'
refactor(layout): remove vestigial Bell icon from header

Phase D R1. No in-app notification system exists; alerts flow via
Discord (primary) and Telegram (fallback) per env configuration.
The Bell icon was decorative and would mislead new users about
available functionality.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full backend suite — green**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m pytest 2>&1 | tail -5
```

Expected: 55 passed (52 baseline + 3 from Task 1).

- [ ] **Step 2: Frontend type-check, lint, build — all clean**

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit && npm run lint && npm run build
```

Expected: exit code 0 on all three.

- [ ] **Step 3: Manual QA in a browser**

Start both servers:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend && ./.venv/bin/python -m uvicorn app.main:app --reload --port 8000 &
cd /home/lg/dev/Portfolio_Tracker/frontend && npm run dev &
```

Open `http://localhost:3000/friday`. Verify:

- Header no longer shows the Bell icon (Sparkles + user badge still present).
- The "Freeze" card has a `💬 이번 주 코멘트 (선택)` collapsed details block above the button. Opening it reveals a textarea that disables during freeze.
- The decision journal form now shows three labeled sliders (vs SPY Risk-adj / vs Cash / vs SPY Pure), each with its own number readout.
- Setting risk-adj to 3 and cash to 8 triggers the muted italic ordering-deviation note below the third slider.
- Invalidation section shows the free-text textarea plus a failure-mode dropdown and a trigger-threshold numeric input side-by-side (or stacked on mobile).
- Freezing with a non-empty comment persists it: open `/friday/archive` (or the specific snapshot page) and verify the italic left-accent comment quote appears at the top of the panel.
- Saving a decision with non-default sliders and a failure_mode + threshold persists and renders the new fields under the decision card on reload.
- In-browser DevTools Network tab: POST `/api/v1/friday/snapshot` body includes `comment`, and POST `/api/v1/friday/decisions` body includes `confidence_vs_spy_riskadj` / `confidence_vs_cash` / `confidence_vs_spy_pure` / `expected_failure_mode` / `trigger_threshold`.

Kill servers when done:

```bash
pkill -f "uvicorn app.main:app" ; pkill -f "next dev"
```

- [ ] **Step 4: Confirm branch is ready — do NOT push in this task**

```bash
cd /home/lg/dev/Portfolio_Tracker && git log --oneline main..HEAD
```

Expected: 5 commits (Task 1 backend, Task 2 api types, Task 3 form, Task 4 panel, Task 5 layout). The `finishing-a-development-branch` skill handles the push / merge decision.

---

## Self-Review Checklist

- [x] Every task has exact file paths and line numbers.
- [x] Every content block is complete (no TBD).
- [x] Commit messages tell the why, not just the what.
- [x] TDD: Tasks 1 writes tests first; Tasks 2-5 rely on type-check + lint + build + manual QA as the verification gate (no frontend test infrastructure in this repo beyond Pytest-for-backend).
- [x] Scope strictly matches user ask: A3 UI + A4 UI + A7 UI + R1 on `/friday` and layout only. No A1, A2, Discord echo, or backend alias cleanup.
- [x] Backward-compat: backend legacy `confidence` alias kept wired through this entire plan — its removal belongs to Plan 3.
- [x] No secrets, no .env changes, no prod DB operations.
- [x] Types consistent across tasks: `confidenceVsSpyRiskadj` / `confidenceVsCash` / `confidenceVsSpyPure` / `expectedFailureMode` / `triggerThreshold` spelled identically in api.ts, FridayDashboard, and FridaySnapshotPanel.
