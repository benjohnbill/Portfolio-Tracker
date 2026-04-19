# Phase D — Backend Hygiene (Plan C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Discord briefing echo (last-snapshot comment on weekly cron success) and remove the legacy `confidence` alias symmetrically across backend + frontend, leaving `confidence_vs_spy_riskadj` as the single primary scalar.

**Architecture:** Pure tightening — no new schema, no new features. Work proceeds in two orthogonal tracks that share this plan:
- **Track A (legacy-alias cleanup):** migrate the one remaining frontend read site (`OutcomesView.tsx:115`) onto the new field, then drop the mirror key from backend response serializers, then tighten the write path to make the new scalar required. Frontend read migrates first so response-side backend removal is safe.
- **Track B (Discord echo):** extend `notification_service.send_cron_success` to append `> 💬 Last week's comment: "{comment}"` when the latest `WeeklySnapshot.comment` is non-empty. Fetched in `main.py` (which already holds `db`) and passed in as a parameter to keep `NotificationService` stateless.

**Tech Stack:** Python 3.11 / FastAPI / SQLAlchemy 1.4 (backend); TypeScript / Next.js 15 / React 19 (frontend); pytest (backend tests).

**Pre-flight safety gate (already verified 2026-04-19, see decision log):**
- Plan B is shipped on `main` (commits `1b34f81..5af47de` + hotfix `8757e18`).
- `grep -rn "decision\.confidence\b" frontend/src --include="*.tsx" --include="*.ts"` returns exactly 1 site: `OutcomesView.tsx:115`. Task 1 handles it.
- Before starting, re-run the grep to confirm no new sites snuck in:
  ```bash
  grep -rn "decision\.confidence\b" frontend/src --include="*.tsx" --include="*.ts"
  ```
  Expected: single hit on `OutcomesView.tsx:115`. If anything else appears, STOP and add a matching migration step to Task 1 before continuing.

---

## File Structure

Files created / modified in this plan, by track:

### Track A — Legacy alias removal (symmetric 4-layer)

- Modify: `frontend/src/components/intelligence/OutcomesView.tsx` (line 115 — read site migration + denominator update)
- Modify: `frontend/src/lib/api.ts` (line 290–291 on `FridayDecision` + line 761 on `DecisionOutcomeData.decision`)
- Modify: `backend/app/services/friday_service.py` (line 52–69 `_serialize_decision`; line 298–352 `add_decision`)
- Modify: `backend/app/services/intelligence_service.py` (line 167–177 outcome payload)
- Modify: `backend/app/main.py` (line 74–88 `FridayDecisionCreateRequest`; line 473–488 `create_friday_decision` handler)
- Modify: `backend/tests/test_friday_service.py` (lines 226–249, 432–490 — prune legacy-alias tests, migrate surviving call sites, add response-shape negative assertion)
- Modify: `backend/tests/test_api.py` (lines 146–184 — remove backward-compat legacy test, add response-body negative assertion)

### Track B — Discord briefing echo

- Modify: `backend/app/services/notification_service.py` (`send_cron_success` signature + message body)
- Modify: `backend/app/main.py` (cron success handler around line 700–721 — fetch latest snapshot comment, forward to notifier)
- Modify: `backend/tests/test_discord_notifier.py` (add two tests covering echo present / absent)
- Create: `backend/tests/test_notification_service.py` (new file, two tests for `send_cron_success` message composition — comment present/absent)

### Execution order

Tasks run in this order so each commit leaves `main` in a shippable state:

1. Track A — frontend read migration (Task 1) ← safe because backend still emits the mirror key
2. Track A — frontend type removal (Task 2)
3. Track A — backend response mirror removal (Task 3)
4. Track A — backend write path tightening (Task 4)
5. Track B — Discord echo wiring (Task 5)

Track B is independent from Track A (touches different files + different code paths) but is sequenced last to keep each commit small and to ship the safer UI-visible change first.

---

## Task 1: Migrate `OutcomesView.tsx` read site to new scalar + correct denominator

**Why denominator changes:** the legacy `confidence` scalar was 1..5 (old schema). The new `confidenceVsSpyRiskadj` scalar is 1..10 (Phase D A3, enforced at request-model level with `ge=1, le=10`). Displaying `conf: 8/5` is misleading; it must read `conf: 8/10`.

**Files:**
- Modify: `frontend/src/components/intelligence/OutcomesView.tsx:115`
- Test: no dedicated test file for OutcomesView exists; visual regression is covered by QA checklist item 1 (post-plan Playwright run). No unit test is added in this task — adding one just for a denominator is out of scope per "simplicity first."

- [ ] **Step 1: Pre-flight grep**

Run:
```bash
grep -rn "decision\.confidence\b" /home/lg/dev/Portfolio_Tracker/frontend/src --include="*.tsx" --include="*.ts"
```
Expected: exactly one line — `frontend/src/components/intelligence/OutcomesView.tsx:115: ... conf: {o.decision.confidence}/5 ...`. If anything else appears, STOP and extend this task with one edit per additional site (same pattern as Step 2).

- [ ] **Step 2: Edit the read site**

In `frontend/src/components/intelligence/OutcomesView.tsx` replace the exact line (around line 115):

```tsx
                <span className="text-xs text-muted-foreground">conf: {o.decision.confidence}/5</span>
```

with:

```tsx
                <span className="text-xs text-muted-foreground">conf: {o.decision.confidenceVsSpyRiskadj}/10</span>
```

- [ ] **Step 3: Type-check the frontend**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit
```
Expected: clean exit (0 errors). Track A types still carry `confidence: number` on `FridayDecision` + `DecisionOutcomeData.decision`, so the read of `confidenceVsSpyRiskadj` must also resolve. Spec check: `DecisionOutcomeData.decision` currently types as `{ type; assetTicker; note; confidence }` — it does NOT yet expose `confidenceVsSpyRiskadj`. So this step WILL fail with `Property 'confidenceVsSpyRiskadj' does not exist on type '{ type; assetTicker; note; confidence }'`.

- [ ] **Step 4: Add `confidenceVsSpyRiskadj` to `DecisionOutcomeData.decision` inline**

In `frontend/src/lib/api.ts` at line 761, replace:

```ts
  decision: { type: string; assetTicker: string | null; note: string; confidence: number };
```

with:

```ts
  decision: { type: string; assetTicker: string | null; note: string; confidenceVsSpyRiskadj: number; confidence: number };
```

Rationale: we add the new field alongside the legacy one. Task 2 removes the legacy one. This keeps the diff narrow and each task compilable on its own.

- [ ] **Step 5: Type-check again**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit
```
Expected: clean exit (0 errors).

- [ ] **Step 6: Re-run the post-flight grep**

Run:
```bash
grep -rn "decision\.confidence\b" /home/lg/dev/Portfolio_Tracker/frontend/src --include="*.tsx" --include="*.ts"
```
Expected: no output. If anything remains, fix it before commit.

- [ ] **Step 7: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/components/intelligence/OutcomesView.tsx frontend/src/lib/api.ts
git commit -m "$(cat <<'EOF'
refactor(intelligence): migrate OutcomesView off legacy decision.confidence alias

Uses confidenceVsSpyRiskadj as the display source of truth. Denominator
corrected 5 → 10 to match the new 1..10 scalar range. Extends
DecisionOutcomeData.decision with confidenceVsSpyRiskadj alongside the
legacy confidence field; the legacy field is pruned in the next commit.

Plan C, Task 1 of 5. Resolves the last frontend read of
decision.confidence (safety gate verified in decision log
2026-04-19-phase-d-ship-now-scope-lock.md).
EOF
)"
```

---

## Task 2: Remove legacy `confidence` field from frontend types

**Files:**
- Modify: `frontend/src/lib/api.ts` (lines 286–291 on `FridayDecision`; line 761 on `DecisionOutcomeData.decision` — drop `confidence` field + comment)
- Test: `npx tsc --noEmit` must stay clean.

- [ ] **Step 1: Drop `confidence` from `FridayDecision`**

In `frontend/src/lib/api.ts` lines 286–291, replace:

```ts
  // Phase D A3 — 3-scalar confidence. Primary required; the other two optional until A3 UI saturates.
  confidenceVsSpyRiskadj: number;
  confidenceVsCash: number | null;
  confidenceVsSpyPure: number | null;
  // Legacy mirror of confidenceVsSpyRiskadj — retained so old read sites keep rendering until Plan 3 cleanup.
  confidence: number;
```

with:

```ts
  // Phase D A3 — 3-scalar confidence. Primary required; the other two optional until A3 UI saturates.
  confidenceVsSpyRiskadj: number;
  confidenceVsCash: number | null;
  confidenceVsSpyPure: number | null;
```

- [ ] **Step 2: Drop `confidence` from `DecisionOutcomeData.decision`**

In `frontend/src/lib/api.ts` around line 761, replace:

```ts
  decision: { type: string; assetTicker: string | null; note: string; confidenceVsSpyRiskadj: number; confidence: number };
```

with:

```ts
  decision: { type: string; assetTicker: string | null; note: string; confidenceVsSpyRiskadj: number };
```

- [ ] **Step 3: Also drop the stale `createFridayDecision` comment referencing the transition**

In `frontend/src/lib/api.ts` around lines 716–718, replace:

```ts
  // Phase D A3 — primary required; siblings optional.
  // Stricter than backend, which still accepts legacy `confidence` alone during the Plan 3 transition.
  confidence_vs_spy_riskadj: number;
```

with:

```ts
  // Phase D A3 — primary required; siblings optional.
  confidence_vs_spy_riskadj: number;
```

Rationale: the comment will be factually wrong after Task 4. Removing it now keeps the comment truthful at every commit boundary.

- [ ] **Step 4: Type-check**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/frontend && npx tsc --noEmit
```
Expected: clean exit (0 errors). If any read site still references `decision.confidence` or `FridayDecision.confidence`, the compiler will point at it. If that happens, migrate the site to `confidenceVsSpyRiskadj` and re-run.

- [ ] **Step 5: Grep for stragglers (defensive)**

Run:
```bash
grep -rn "\.confidence\b" /home/lg/dev/Portfolio_Tracker/frontend/src --include="*.tsx" --include="*.ts" | grep -v "confidenceVs" | grep -v "WeeklyBucketSummary" | grep -v "bucket\.confidence"
```
Expected: no output.

Note: `WeeklyBucketSummary.confidence: string` at `api.ts:160` is an UNRELATED signal-bucket field (values like "high"/"medium"/"low"). It is NOT the Phase D scalar. Do not touch it. The grep above filters it out.

- [ ] **Step 6: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add frontend/src/lib/api.ts
git commit -m "$(cat <<'EOF'
refactor(api-types): drop legacy confidence field from FridayDecision and DecisionOutcomeData

Plan C, Task 2 of 5. Backend still mirrors the key in responses; Task 3
removes it there. Narrowing the frontend type first so TS surfaces any
straggler read site at compile time.
EOF
)"
```

---

## Task 3: Drop `confidence` mirror from backend response serializers

**Files:**
- Modify: `backend/app/services/friday_service.py` (lines 52–69 `_serialize_decision`)
- Modify: `backend/app/services/intelligence_service.py` (lines 167–177 outcome payload)
- Modify: `backend/tests/test_friday_service.py` (assertions that expect `"confidence"` in payload)
- Modify: `backend/tests/test_api.py` (assertions that expect `"confidence"` in response body)

- [ ] **Step 1 (RED): Add negative assertion to `test_friday_service.py`**

Add this test at the end of `backend/tests/test_friday_service.py` (after `test_add_decision_rejects_both_legacy_and_new_confidence`, before `test_create_snapshot_persists_comment`):

```python
def test_serialize_decision_does_not_emit_legacy_confidence_key():
    """Plan C contract: response payload must not mirror the legacy `confidence` key."""
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
        note="x",
        confidence_vs_spy_riskadj=6,
    )

    assert "confidence" not in payload
    assert payload["confidenceVsSpyRiskadj"] == 6
```

- [ ] **Step 2: Run test to verify it fails (RED)**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && PYTHONPATH=. .venv/bin/pytest tests/test_friday_service.py::test_serialize_decision_does_not_emit_legacy_confidence_key -v
```
Expected: FAIL. `assert "confidence" not in payload` trips because `_serialize_decision` still emits the mirror key.

- [ ] **Step 3: Drop the mirror key in `_serialize_decision`**

In `backend/app/services/friday_service.py` lines 52–69, replace:

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

with:

```python
    @staticmethod
    def _serialize_decision(decision: WeeklyDecision) -> Dict[str, Any]:
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
        }
```

- [ ] **Step 4: Drop the mirror key in `intelligence_service.py`**

In `backend/app/services/intelligence_service.py` lines 167–177, replace:

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

with:

```python
                "decision": {
                    "type": decision.decision_type,
                    "assetTicker": decision.asset_ticker,
                    "note": decision.note,
                    "confidenceVsSpyRiskadj": decision.confidence_vs_spy_riskadj,
                    "confidenceVsCash": decision.confidence_vs_cash,
                    "confidenceVsSpyPure": decision.confidence_vs_spy_pure,
                    "expectedFailureMode": decision.expected_failure_mode,
                    "triggerThreshold": decision.trigger_threshold,
                },
```

- [ ] **Step 5: Update existing tests that assert on the mirror key**

In `backend/tests/test_friday_service.py`:

5a. Around line 433, remove the trailing mirror-check line inside `test_add_decision_accepts_three_confidence_scalars_and_structured_invalidation`. Replace the last three lines of that test:

```python
    assert payload["expectedFailureMode"] == "regime_shift"
    assert payload["triggerThreshold"] == 0.05
    # Backward-compat mirror during transition.
    assert payload["confidence"] == 8
```

with:

```python
    assert payload["expectedFailureMode"] == "regime_shift"
    assert payload["triggerThreshold"] == 0.05
```

5b. Around line 455, remove the mirror assertion inside `test_add_decision_backward_compat_accepts_legacy_confidence_kwarg`. Replace:

```python
    assert payload["confidenceVsSpyRiskadj"] == 7
    assert payload["confidenceVsCash"] is None
    assert payload["confidenceVsSpyPure"] is None
    assert payload["confidence"] == 7
```

with:

```python
    assert payload["confidenceVsSpyRiskadj"] == 7
    assert payload["confidenceVsCash"] is None
    assert payload["confidenceVsSpyPure"] is None
    assert "confidence" not in payload
```

Rationale: this test still exercises the legacy `confidence=` kwarg — Task 4 will delete the whole test; keeping it accurate in the meantime keeps the build green between commits.

In `backend/tests/test_api.py`:

5c. Around line 183–184, inside `test_post_friday_decision_backward_compat_legacy_confidence`, replace:

```python
    assert body["confidenceVsSpyRiskadj"] == 7
    assert body["confidence"] == 7
```

with:

```python
    assert body["confidenceVsSpyRiskadj"] == 7
    assert "confidence" not in body
```

- [ ] **Step 6: Run all backend tests (GREEN)**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && PYTHONPATH=. .venv/bin/pytest -v
```
Expected: all tests pass, including the new negative assertion from Step 1.

- [ ] **Step 7: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add backend/app/services/friday_service.py backend/app/services/intelligence_service.py backend/tests/test_friday_service.py backend/tests/test_api.py
git commit -m "$(cat <<'EOF'
refactor(friday): drop legacy confidence mirror from decision response payloads

FridayService._serialize_decision and IntelligenceService outcome payload
no longer emit the confidence key. Frontend migrated off it in Tasks 1-2.
Adds a serializer-level negative assertion and flips existing tests to
assert the absence of the legacy key. Task 4 still has to tighten the
request-side write path.

Plan C, Task 3 of 5.
EOF
)"
```

---

## Task 4: Tighten backend write path — remove `confidence` request field + kwarg + branching

**Why this is a task on its own:** up through Task 3, the backend still accepts `confidence` on the way IN (request model + `add_decision(..., confidence=None)`). After Task 3 the response side is already clean. This task closes the loop on the write side, making `confidence_vs_spy_riskadj` the sole required primary scalar.

**Behavior contract after this task:**
- `FridayDecisionCreateRequest.confidence_vs_spy_riskadj` is required (no default).
- `FridayDecisionCreateRequest.confidence` field is gone.
- `FridayService.add_decision` signature has no `confidence=` kwarg.
- `add_decision` validation keeps the 1..10 range checks and the "required" check (though now the required check is also enforced at the Pydantic layer for API callers — the service-level check stays as a defense-in-depth for internal callers like tests).

**Files:**
- Modify: `backend/app/services/friday_service.py` (lines 298–352 `add_decision`)
- Modify: `backend/app/main.py` (lines 74–88 request model; lines 473–488 handler)
- Modify: `backend/tests/test_friday_service.py` (lines 226–249, 436–490 — migrate/delete legacy tests)
- Modify: `backend/tests/test_api.py` (lines 171–184 — delete legacy backward-compat test)

- [ ] **Step 1 (RED): Update `test_friday_service.py` for the new signature**

In `backend/tests/test_friday_service.py`, apply these edits:

1a. Line 230 — replace:

```python
    decision = FridayService.add_decision(db, snapshot_id=7, decision_type="rebalance", asset_ticker="QQQ", note="Trim exposure", confidence=8, invalidation="Macro improves")
```

with:

```python
    decision = FridayService.add_decision(db, snapshot_id=7, decision_type="rebalance", asset_ticker="QQQ", note="Trim exposure", confidence_vs_spy_riskadj=8, invalidation="Macro improves")
```

1b. Line 241 — replace:

```python
        FridayService.add_decision(db, snapshot_id=99, decision_type="hold", note="none", confidence=5)
```

with:

```python
        FridayService.add_decision(db, snapshot_id=99, decision_type="hold", note="none", confidence_vs_spy_riskadj=5)
```

1c. Line 249 — replace:

```python
        FridayService.add_decision(db, snapshot_id=7, decision_type="hold", note="none", confidence=11)
```

with:

```python
        FridayService.add_decision(db, snapshot_id=7, decision_type="hold", note="none", confidence_vs_spy_riskadj=11)
```

1d. Delete the entire `test_add_decision_backward_compat_accepts_legacy_confidence_kwarg` function (lines 436–455 inclusive, including the blank line separator). That behavior is no longer supported.

1e. Delete the entire `test_add_decision_rejects_both_legacy_and_new_confidence` function (lines 478–490 inclusive). The mutual-exclusion branch no longer exists — there is no "both" to reject.

1f. Add a new required-field test at the same location where 1e's test was deleted:

```python
def test_add_decision_requires_primary_scalar():
    snapshot = WeeklySnapshot(
        id=7, snapshot_date=date(2026, 4, 18),
        created_at=datetime.now(timezone.utc),
        frozen_report=_report(), snapshot_metadata={},
    )
    db = _FakeDB(snapshots=[snapshot])

    with pytest.raises(SnapshotValidationError):
        FridayService.add_decision(
            db, snapshot_id=7, decision_type="hold", note="x",
        )
```

- [ ] **Step 2: Update `test_api.py` for the new request model**

In `backend/tests/test_api.py` delete the entire `test_post_friday_decision_backward_compat_legacy_confidence` test (lines 171–184 inclusive, plus the blank line separator). API callers may no longer send `confidence` — Pydantic will reject it with `extra="ignore"` default (silent drop), but the handler will then fail the required-field check on `confidence_vs_spy_riskadj`.

- [ ] **Step 3: Run backend tests to verify failures (RED)**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && PYTHONPATH=. .venv/bin/pytest tests/test_friday_service.py tests/test_api.py -v
```
Expected: the new `test_add_decision_requires_primary_scalar` passes (the service already raises `SnapshotValidationError` when `primary is None`), but the edited test_api.py and test_friday_service.py suites may also pass trivially since service signature is still permissive. The true RED comes in Step 4 when we tighten the Pydantic model — a request missing `confidence_vs_spy_riskadj` must then 422.

Add one more test in `backend/tests/test_api.py` at the bottom of the Phase D section (before `test_post_friday_snapshot_accepts_comment`):

```python
def test_post_friday_decision_requires_confidence_vs_spy_riskadj(seeded_snapshot):
    response = client.post(
        "/api/v1/friday/decisions",
        json={
            "snapshot_id": seeded_snapshot["id"],
            "decision_type": "hold",
            "note": "Stay put",
        },
    )
    assert response.status_code == 422, response.text
```

Run the targeted test:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && PYTHONPATH=. .venv/bin/pytest tests/test_api.py::test_post_friday_decision_requires_confidence_vs_spy_riskadj -v
```
Expected: FAIL with 400 (not 422), because the current model has `confidence_vs_spy_riskadj: Optional[int] = Field(default=None, ...)` and the request is accepted at Pydantic level but rejected at the service level with `SnapshotValidationError` → 400.

- [ ] **Step 4 (GREEN): Tighten the Pydantic request model in `main.py`**

In `backend/app/main.py` lines 74–88, replace:

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

with:

```python
class FridayDecisionCreateRequest(BaseModel):
    snapshot_id: int
    decision_type: str
    asset_ticker: Optional[str] = None
    note: str
    # Phase D A3 — three confidence scalars. Primary (vs SPY risk-adj) required;
    # cash + SPY-pure are optional until the UI surfaces them consistently.
    confidence_vs_spy_riskadj: int = Field(ge=1, le=10)
    confidence_vs_cash: Optional[int] = Field(default=None, ge=1, le=10)
    confidence_vs_spy_pure: Optional[int] = Field(default=None, ge=1, le=10)
    # Phase D A4 — structured invalidation alongside the existing free-text field.
    invalidation: Optional[str] = None
    expected_failure_mode: Optional[str] = None
    trigger_threshold: Optional[float] = None
```

- [ ] **Step 5 (GREEN): Drop `confidence` from the handler in `main.py`**

In `backend/app/main.py` lines 475–488, replace the body of `create_friday_decision`:

```python
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
```

with:

```python
        return FridayService.add_decision(
            db,
            snapshot_id=payload.snapshot_id,
            decision_type=payload.decision_type,
            asset_ticker=payload.asset_ticker,
            note=payload.note,
            confidence_vs_spy_riskadj=payload.confidence_vs_spy_riskadj,
            confidence_vs_cash=payload.confidence_vs_cash,
            confidence_vs_spy_pure=payload.confidence_vs_spy_pure,
            invalidation=payload.invalidation,
            expected_failure_mode=payload.expected_failure_mode,
            trigger_threshold=payload.trigger_threshold,
        )
```

- [ ] **Step 6 (GREEN): Simplify `FridayService.add_decision`**

In `backend/app/services/friday_service.py` lines 298–352, replace:

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

with:

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
    ) -> Dict[str, Any]:
        snapshot = FridayService._find_snapshot_by_id(db, snapshot_id)
        if not snapshot:
            raise SnapshotNotFoundError(f"Snapshot {snapshot_id} not found")

        if confidence_vs_spy_riskadj is None:
            raise SnapshotValidationError("confidence_vs_spy_riskadj is required")

        for label, value in (
            ("confidence_vs_spy_riskadj", confidence_vs_spy_riskadj),
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
            confidence_vs_spy_riskadj=confidence_vs_spy_riskadj,
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

Note: `confidence_vs_spy_riskadj` stays `Optional[int] = None` at the signature level (rather than required) because internal callers (tests) previously relied on keyword-only style. The service still raises `SnapshotValidationError` when it is `None`, matching the Pydantic-layer enforcement for API callers. This is defense-in-depth, not redundancy — `test_add_decision_requires_primary_scalar` pins the service-level behavior.

- [ ] **Step 7: Run full backend test suite (GREEN)**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && PYTHONPATH=. .venv/bin/pytest -v
```
Expected: every test passes. Specifically verify:
- `test_add_decision_persists_record` — now uses `confidence_vs_spy_riskadj=8`
- `test_add_decision_rejects_missing_snapshot` — now uses `confidence_vs_spy_riskadj=5`
- `test_add_decision_rejects_invalid_confidence` — now uses `confidence_vs_spy_riskadj=11`
- `test_add_decision_accepts_three_confidence_scalars_and_structured_invalidation` — passes
- `test_add_decision_rejects_invalid_confidence_scalar_range` — passes
- `test_add_decision_requires_primary_scalar` — new, passes
- `test_post_friday_decision_accepts_three_confidence_scalars` — passes
- `test_post_friday_decision_requires_confidence_vs_spy_riskadj` — new, passes with 422

- [ ] **Step 8: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add backend/app/services/friday_service.py backend/app/main.py backend/tests/test_friday_service.py backend/tests/test_api.py
git commit -m "$(cat <<'EOF'
refactor(friday): make confidence_vs_spy_riskadj required, drop legacy confidence write path

FridayDecisionCreateRequest no longer accepts the legacy `confidence`
alias; confidence_vs_spy_riskadj is a required field. FridayService
.add_decision drops the confidence= kwarg and the mutual-exclusion
branch. Adds a Pydantic-layer 422 regression test.

Symmetric with Tasks 1-3 on the response side. Plan C, Task 4 of 5.
EOF
)"
```

---

## Task 5: Discord briefing echo — append last-snapshot comment to weekly cron success

**Why a parameter, not a DB lookup inside NotificationService:** `NotificationService` is currently a thin, stateless, env-driven module. Giving it a DB session to fetch the latest snapshot would add a dependency for a single string. The caller (`main.py`'s cron success handler) already holds `db` and is the natural place to do the one-line query. This matches the module's existing style.

**Where the echo appears:** at the bottom of the existing success message block, on its own line, formatted as `> 💬 Last week's comment: "{comment}"`. The `>` is Telegram blockquote HTML; on the Discord side the existing `_html_to_discord_markdown` strips unknown characters safely (`>` passes through untouched, which renders as a Discord blockquote — both platforms render it correctly).

**Files:**
- Modify: `backend/app/services/notification_service.py` (`send_cron_success`)
- Modify: `backend/app/main.py` (cron success handler around lines 700–721)
- Modify: `backend/tests/test_discord_notifier.py` (no changes needed — the message-composition tests move to the notification_service test file below since `send_discord_message` is message-agnostic)
- Create: `backend/tests/test_notification_service.py` (new)

- [ ] **Step 1 (RED): Create `backend/tests/test_notification_service.py`**

Create the file with content:

```python
"""
Tests for NotificationService message composition.

Covers the Phase D Plan C Discord echo: when the latest WeeklySnapshot has a
non-empty comment, the cron success message appends a blockquote line with it.
"""
from __future__ import annotations

from unittest.mock import patch

from app.services.notification_service import NotificationService


def test_send_cron_success_appends_comment_when_present(monkeypatch):
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_BOT_TOKEN", "t")
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_CHAT_ID", "c")

    sent = {}

    def _fake_telegram(message, parse_mode="HTML"):
        sent["telegram"] = message
        return True

    def _fake_discord(message):
        sent["discord"] = message
        return True

    with patch.object(NotificationService, "send_telegram_message", side_effect=_fake_telegram), \
         patch("app.services.notification_service.discord_notifier.send_discord_message", side_effect=_fake_discord):
        NotificationService.send_cron_success(
            duration_seconds=12.3,
            vxn_updated=True,
            mstr_seeded=False,
            weekly_score=72,
            latest_comment="Trimmed NDX; watching DXY",
        )

    assert "> 💬 Last week's comment:" in sent["telegram"]
    assert '"Trimmed NDX; watching DXY"' in sent["telegram"]
    assert sent["telegram"] == sent["discord"]  # identical source text; discord_notifier does its own markdown pass


def test_send_cron_success_omits_comment_line_when_absent(monkeypatch):
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_BOT_TOKEN", "t")
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_CHAT_ID", "c")

    sent = {}

    def _fake_telegram(message, parse_mode="HTML"):
        sent["telegram"] = message
        return True

    with patch.object(NotificationService, "send_telegram_message", side_effect=_fake_telegram), \
         patch("app.services.notification_service.discord_notifier.send_discord_message", return_value=True):
        NotificationService.send_cron_success(
            duration_seconds=12.3,
            vxn_updated=True,
            mstr_seeded=False,
            weekly_score=72,
            latest_comment=None,
        )

    assert "Last week's comment" not in sent["telegram"]


def test_send_cron_success_omits_comment_line_when_empty_string(monkeypatch):
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_BOT_TOKEN", "t")
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_CHAT_ID", "c")

    sent = {}

    def _fake_telegram(message, parse_mode="HTML"):
        sent["telegram"] = message
        return True

    with patch.object(NotificationService, "send_telegram_message", side_effect=_fake_telegram), \
         patch("app.services.notification_service.discord_notifier.send_discord_message", return_value=True):
        NotificationService.send_cron_success(
            duration_seconds=12.3,
            vxn_updated=True,
            mstr_seeded=False,
            weekly_score=72,
            latest_comment="   ",
        )

    assert "Last week's comment" not in sent["telegram"]
```

- [ ] **Step 2: Run the new tests to verify they fail (RED)**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && PYTHONPATH=. .venv/bin/pytest tests/test_notification_service.py -v
```
Expected: all three tests FAIL — `send_cron_success` currently has no `latest_comment` parameter, so passing the kwarg raises `TypeError: send_cron_success() got an unexpected keyword argument 'latest_comment'`.

- [ ] **Step 3 (GREEN): Extend `send_cron_success` to accept + render the comment**

In `backend/app/services/notification_service.py` lines 65–89, replace:

```python
    @staticmethod
    def send_cron_success(
        duration_seconds: float,
        vxn_updated: bool,
        mstr_seeded: bool,
        weekly_score: Optional[int],
        records_processed: int = 0,
    ) -> bool:
        """Send a success notification for cron job completion."""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        
        message = (
            f"✅ <b>Portfolio Update Success</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"⏱ Duration: {duration_seconds:.1f}s\n"
            f"📊 Weekly Score: {weekly_score or 'N/A'}\n"
            f"📈 VXN Updated: {'Yes' if vxn_updated else 'No'}\n"
            f"🏢 MSTR Seeded: {'Yes' if mstr_seeded else 'No'}\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🕐 {timestamp}"
        )

        result = NotificationService.send_telegram_message(message)
        discord_notifier.send_discord_message(message)
        return result
```

with:

```python
    @staticmethod
    def send_cron_success(
        duration_seconds: float,
        vxn_updated: bool,
        mstr_seeded: bool,
        weekly_score: Optional[int],
        records_processed: int = 0,
        latest_comment: Optional[str] = None,
    ) -> bool:
        """Send a success notification for cron job completion."""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        message = (
            f"✅ <b>Portfolio Update Success</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"⏱ Duration: {duration_seconds:.1f}s\n"
            f"📊 Weekly Score: {weekly_score or 'N/A'}\n"
            f"📈 VXN Updated: {'Yes' if vxn_updated else 'No'}\n"
            f"🏢 MSTR Seeded: {'Yes' if mstr_seeded else 'No'}\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🕐 {timestamp}"
        )

        if latest_comment and latest_comment.strip():
            message += f"\n> 💬 Last week's comment: \"{latest_comment.strip()}\""

        result = NotificationService.send_telegram_message(message)
        discord_notifier.send_discord_message(message)
        return result
```

- [ ] **Step 4: Run the new tests (GREEN)**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && PYTHONPATH=. .venv/bin/pytest tests/test_notification_service.py -v
```
Expected: all three tests PASS.

- [ ] **Step 5: Wire the latest-snapshot lookup into `main.py`'s cron success handler**

In `backend/app/main.py`, locate the cron success block around lines 713–721. Replace:

```python
        db.commit()
        
        # Send success notification
        NotificationService.send_cron_success(
            duration_seconds=duration,
            vxn_updated=vxn_updated,
            mstr_seeded=mstr_seeded,
            weekly_score=weekly_score,
        )
```

with:

```python
        db.commit()

        # Fetch the most recent snapshot comment for the Discord/Telegram echo.
        # Stateless query; keeps NotificationService DB-agnostic.
        latest_snapshot = (
            db.query(WeeklySnapshot)
            .order_by(WeeklySnapshot.snapshot_date.desc())
            .first()
        )
        latest_comment = latest_snapshot.comment if latest_snapshot else None

        # Send success notification
        NotificationService.send_cron_success(
            duration_seconds=duration,
            vxn_updated=vxn_updated,
            mstr_seeded=mstr_seeded,
            weekly_score=weekly_score,
            latest_comment=latest_comment,
        )
```

- [ ] **Step 6: Verify `WeeklySnapshot` is already imported in `main.py`**

Run:
```bash
grep -n "WeeklySnapshot" /home/lg/dev/Portfolio_Tracker/backend/app/main.py | head -5
```
Expected: at least one import-style line (e.g. `from .models import WeeklySnapshot`) appears near the top of the file. `main.py` already uses `WeeklySnapshot` elsewhere (the Friday snapshot endpoints), so the import should already be present. If the import is NOT present, add it with the existing model imports near the top.

- [ ] **Step 7: Run the full backend test suite**

Run:
```bash
cd /home/lg/dev/Portfolio_Tracker/backend && PYTHONPATH=. .venv/bin/pytest -v
```
Expected: all tests pass. `send_cron_success` is only invoked by the cron handler in `main.py`, which is not unit-tested directly, so no existing caller-side assertions need updating.

- [ ] **Step 8: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add backend/app/services/notification_service.py backend/app/main.py backend/tests/test_notification_service.py
git commit -m "$(cat <<'EOF'
feat(notify): echo last week's snapshot comment on cron success

send_cron_success now accepts an optional latest_comment kwarg and
appends a blockquote line to the success message when non-empty.
main.py fetches the latest WeeklySnapshot and forwards its comment.
Discord gets the same source text (discord_notifier already handles
the HTML→Markdown pass).

Plan C, Task 5 of 5.
EOF
)"
```

---

## Post-plan: push + QA handoff

- [ ] **Step A: Push the Plan C series**

```bash
cd /home/lg/dev/Portfolio_Tracker
git push origin main
```

- [ ] **Step B: Trigger the Playwright MCP QA run**

Follow `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` §Playwright MCP QA. Local dev server first; prod smoke after. Pay particular attention to QA checklist items 12–13 (network tab must show `confidence_vs_spy_riskadj` in the POST body and NO `confidence` key in either request or response — that's the Plan C verification surface).

- [ ] **Step C: Update the decision log's Progress log**

After a successful QA pass, append a new bullet under `## Progress log` in `docs/superpowers/decisions/2026-04-19-phase-d-ship-now-scope-lock.md` recording:
- Plan C commit range
- QA result (PASS / FAIL per checklist)
- Any follow-up hotfixes

---

## Self-review notes

- **Spec coverage (all 7 bullets from decision doc §Plan C in-scope):**
  - Bullet 1 (`friday_service.py::_serialize_decision` drop `confidence`) → Task 3
  - Bullet 2 (`intelligence_service.py` outcome payload drop `confidence`) → Task 3
  - Bullet 3 (`api.ts::FridayDecision.confidence` drop field + comment) → Task 2
  - Bullet 4 (`api.ts::DecisionOutcomeData.decision.confidence` drop field) → Task 2
  - Bullet 5 (`main.py::FridayDecisionCreateRequest.confidence` drop Optional legacy field) → Task 4
  - Bullet 6 (`friday_service.py::add_decision` drop `confidence=None` kwarg + mutual-exclusion + dual-resolution) → Task 4
  - Bullet 7 (Frontend `decision.confidence\b` migration → `decision.confidenceVsSpyRiskadj`) → Task 1
  - Discord echo — notification_service + 14 existing Discord tests — only notification_service changes; the 14 Discord tests in `test_discord_notifier.py` all exercise `send_discord_message` directly with a message they supply themselves, so they are NOT affected by the `send_cron_success` signature change. No edits needed there; message-composition tests live in the new `test_notification_service.py` → Task 5.

- **Out-of-scope respected:**
  - `confidence_vs_cash` / `confidence_vs_spy_pure` nullability unchanged (still `Optional[int]`).
  - `decision_type?` legacy TS alias on `FridayDecision` (api.ts line 283) — NOT touched.
  - `WeeklyBucketSummary.confidence: string` (api.ts line 160) — UNRELATED field, NOT touched.
  - No schema migration.
  - No new features beyond the Discord echo.

- **Type consistency across tasks:**
  - `confidenceVsSpyRiskadj` spelling verified identical in Tasks 1–4 (frontend + backend + tests).
  - `send_cron_success` signature change (adds `latest_comment` parameter) only has one external call site (`main.py`), which is updated in the same commit as the signature change. The parameter is keyword-only in practice (all existing callers use kwargs).

- **No placeholders:** every code step includes actual code; every command includes expected output; every file path is exact.
