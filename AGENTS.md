# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-02 Asia/Seoul
**Commit:** a19f51f
**Branch:** main

## OVERVIEW
Full-stack portfolio review app. Active implementation lives in a Next.js dashboard (`frontend/`) and FastAPI backend (`backend/`).

## READ ORDER
1. `README.md`
2. `PRODUCT.md` (what this product is, who it's for, scoring model)
3. `ARCHITECTURE.md` (system design, data pipeline, decision engine, domain glossary)
4. `DESIGN.md` (design system: typography, color, spacing, layout, component patterns)
5. `TODOS.md` (implementation checklist with architecture spec for Friday Time Machine)
6. `PLAN.md`
7. `docs/local-setup.md` (runtime/env only)

## STRUCTURE
```text
.
├── backend/        # active API, services, migrations, operational scripts
├── frontend/       # active Next.js app, UI, API client
├── docs/           # active setup docs + archived conductor material
├── conductor/      # compatibility shims only
└── legacy/         # frozen historical material
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Backend endpoints | `backend/app/main.py` | Keep HTTP layer thin |
| Backend business logic | `backend/app/services/` | Primary complexity hotspot |
| DB/env bootstrap | `backend/app/database.py`, `backend/app/models.py`, `backend/app/env_loader.py` | `DATABASE_URL` required |
| Frontend routes | `frontend/src/app/` | App Router only |
| Frontend UI | `frontend/src/components/` | Prefer existing `ui/` primitives |
| Frontend API client | `frontend/src/lib/api.ts` | Update alongside API contract changes |
| Operational scripts | `backend/scripts/` | One-off helpers, not the primary runtime |
| Setup/runtime docs | `docs/local-setup.md` | Source of truth for local commands |

## CHILD GUIDES
- `backend/AGENTS.md` → `backend/app/AGENTS.md`, `backend/app/services/AGENTS.md`, `backend/alembic/AGENTS.md`, `backend/alembic/versions/AGENTS.md`, `backend/data/AGENTS.md`, `backend/tests/AGENTS.md`, `backend/scripts/AGENTS.md`
- `frontend/AGENTS.md` → `frontend/src/AGENTS.md`, `frontend/src/app/AGENTS.md`, `frontend/src/lib/AGENTS.md`, `frontend/src/components/AGENTS.md`, `frontend/src/components/features/AGENTS.md`, `frontend/src/components/features/portfolio/AGENTS.md`, `frontend/src/components/friday/AGENTS.md`, `frontend/src/components/reports/AGENTS.md`, `frontend/src/components/ui/AGENTS.md`
- `docs/AGENTS.md` → `docs/archive/AGENTS.md`, `docs/maestro/AGENTS.md`
- `legacy/AGENTS.md`
- `.github/AGENTS.md`

## CONVENTIONS
- Active code boundaries: `backend/app/`, `frontend/src/`, `backend/scripts/`
- Current scope and direction live in `PLAN.md`
- Root docs are authoritative over compatibility/archive files
- Frontend uses Next.js App Router + TypeScript + Tailwind + `shadcn/ui`
- Backend dependencies come from `backend/requirements.txt` (no repo-local `pyproject.toml`)
- Schema changes require Alembic path verification
- Treat `GET /api/reports/weekly/latest` as a read-only persisted-report endpoint; generation/upsert belongs to cron or explicit POST flows
- Friday snapshot reads must not rely on request-time table creation; missing schema should fail fast and point back to migrations/setup

## ANTI-PATTERNS
- Do not edit `legacy/` unless explicitly requested
- Do not treat `conductor/` as the primary control plane
- Do not commit secrets, tokens, populated `.env`, or credential files
- Do not treat generated artifacts as source of truth: `frontend/.next/`, `backend/.venv/`, `**/__pycache__/`, `*.pyc`, `*.tsbuildinfo`
- Do not modify unrelated files for style-only cleanup

## COMMANDS
```bash
# frontend
cd frontend && npm install
cd frontend && npm run dev
cd frontend && npm run lint
cd frontend && npm run build

# backend
cd backend && pip install -r requirements.txt
cd backend && uvicorn app.main:app --reload
# or from repo root
uvicorn backend.app.main:app --reload
```

## CI / DEPLOY NOTES
- `.github/workflows/daily-quant-update.yml` calls `${BACKEND_BASE_URL}/api/cron/update-signals`
- `.github/workflows/keep-alive.yml` pings `${BACKEND_BASE_URL}/api/assets`
- `render.yaml` is the deploy/runtime config; no repo-local Vercel config

## ENV / SECRET NOTES
- `backend/.env.example` is the tracked placeholder
- `backend/.env` is local-only and must stay uncommitted
- Stop if work would change live `DATABASE_URL`, `CRON_SECRET`, `BACKEND_BASE_URL`, or real `KIS_*` values

## VALIDATION EXPECTATIONS
- Frontend changes: `npm run lint` and `npm run build` in `frontend/`
- Backend changes: relevant tests or script checks in `backend/`
- Preferred backend test path: `cd backend && .venv/bin/python -m pytest tests -q`
- Friday-targeted backend verification: `cd backend && .venv/bin/python -m pytest tests/test_friday_service.py -q`
- Report pre-existing failures separately from issues introduced by edits
- Note: frontend lint uses the repo-local config in `frontend/.eslintrc.json`; keep `package.json` lint script non-interactive and avoid `next lint` setup prompts
