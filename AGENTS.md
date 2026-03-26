# AGENTS.md

Repo-wide guidance for coding agents working in `Portfolio_Tracker`.

## Read Order
1. `README.md`
2. `PLAN.md`
3. `docs/local-setup.md` (if setup or env context is needed)

## Active Edit Boundaries
- Active backend code: `backend/app/`
- Active frontend code: `frontend/src/`
- Operational backend scripts: `backend/scripts/`
- Historical material: `legacy/` — frozen, non-authoritative, do not edit unless explicitly requested
- Compatibility/archive shims: `conductor/` — do not treat as the primary control plane

## Source-of-Truth Rules
- Current scope and active direction live in `PLAN.md`.
- Runtime/bootstrap instructions live in `docs/local-setup.md`.
- This file holds durable repo rules only.
- If a temporary compatibility file disagrees with `README.md`, `PLAN.md`, or this file, follow these root docs.

## Architecture Rules
- Keep HTTP endpoints thin in `backend/app/main.py`.
- Put business/data logic in `backend/app/services/`.
- Keep schema and DB lifecycle in `backend/app/models.py` and `backend/app/database.py`.
- Keep frontend UI/domain code in `frontend/src/`.
- If an API contract changes, update frontend callers in the same task.
- If persisted schema changes, include a migration strategy.

## Workflow Rules
- Prefer small, focused changes over broad refactors.
- Validate changes after edits with the relevant local checks.
- Do not modify unrelated files to satisfy style-only preferences.
- When uncertain, follow nearby code conventions in the touched area.

## Validation Expectations
- Frontend changes: run `npm run lint` and `npm run build` in `frontend/` when applicable.
- Backend changes: run relevant tests or script checks in `backend/`.
- Schema changes: verify Alembic migration path.
- Report pre-existing failures separately from issues introduced by your changes.

## Environment and Secrets
- Backend expects `DATABASE_URL` via `backend/.env` or environment variables.
- Never commit secrets, tokens, or new credential files.
- Treat committed local environments and generated artifacts as non-authoritative.

## Generated / Non-Authoritative Paths
- `frontend/.next/`
- `backend/.venv/`
- `**/__pycache__/`
- `*.pyc`
- `*.tsbuildinfo`

## Frontend Notes
- Follow Next.js App Router patterns.
- Prefer existing `shadcn/ui` primitives and project styling patterns.
- Add `"use client"` only when needed.
- `frontend/INSTRUCTIONS.md` is optional reference material, not the primary bootstrap doc.
