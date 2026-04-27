# Coding Style Rules (Portfolio_Tracker)

Project-specific conventions. Generic best practices are not repeated here.

## API envelope pattern (CRITICAL)

All FastAPI responses and frontend API client types use a uniform envelope:

```python
# backend
{"status": "ok", "data": {...}}              # success
{"status": "error", "data": None, "error": {"code": "...", "message": "..."}}
```

```typescript
// frontend (frontend/src/lib/api.ts)
type Envelope<T> = { status: "ok" | "error"; data: T | null; error?: ApiError }
```

**Rules:**
- Empty/loading state must have the **same envelope shape** as loaded state — never `null` vs `{...}` shape divergence
- Frontend components consume `data` after envelope unwrap, never raw response
- New endpoints MUST extend the envelope, not return bare arrays/objects
- Reference: 13 pages converted in UX-1 phases — match that pattern

## Service-layer role partitioning

`backend/app/services/` is the primary complexity hotspot. Each service file owns **one role**.

- One concept per service file (e.g. `score_service.py`, `macro_service.py`, `friday_service.py`)
- Do NOT extend large existing services with unrelated concerns — create a new sibling service
- When a service exceeds ~600 LOC and owns 5+ concerns, raise it as a standalone refactor task before adding more
- HTTP layer (`backend/app/main.py`) stays thin — no business logic, just service dispatch

## Frontend: first-paint UX priority

UI must render **instantly** on entry. Heavy compositions must not block first paint.

- Cache expensive backend responses in `SystemCache` (date-keyed; no TTL mechanism, key by date)
- Empty-state envelope shape == loaded-state envelope shape (so RSC can stream without layout shift)
- If a route requires heavy data, present a populated skeleton from cache, not a spinner
- Raise standalone UX-latency task when a page introduces noticeable first-paint delay

## Immutability

ALWAYS create new objects, NEVER mutate. Both backend (Pydantic) and frontend (TypeScript).

```typescript
// WRONG: { ...obj, items: obj.items.push(x) }
// RIGHT: { ...obj, items: [...obj.items, x] }
```

## File organization

- 200-400 LOC typical, 800 max
- Many small files > few large files
- Organize by feature/domain (`components/friday/`, `services/score_service.py`), not by type
- Frontend: `frontend/src/components/ui/` for primitives; prefer composing existing primitives over new ad-hoc components

## Tech stack constraints

- **Frontend**: Next.js App Router only (no Pages Router), TypeScript, Tailwind, `shadcn/ui`
- **Backend**: FastAPI + SQLAlchemy + Alembic, dependencies from `backend/requirements.txt` (no `pyproject.toml`)
- **Schema changes**: require Alembic migration, never request-time DDL
- **Frontend lint**: repo-local `frontend/.eslintrc.json` config; keep `package.json` lint script non-interactive

## Quality checklist (before commit)

- [ ] No mutations of existing objects
- [ ] New API responses use envelope shape
- [ ] No business logic added to `main.py`
- [ ] No request-time DDL added to read paths
- [ ] No `console.log` left in frontend code
- [ ] No hardcoded secrets or live URLs
