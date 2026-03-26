# Portfolio Tracker

Portfolio Tracker is a full-stack financial review application for weekly portfolio monitoring, macro context, and algorithmic decision support.

## Active Apps
- `frontend/` — Next.js dashboard UI
- `backend/` — FastAPI API, services, and database layer

## Read First
1. `AGENTS.md` — repo-wide rules and edit boundaries
2. `PLAN.md` — current scope and task direction
3. `docs/local-setup.md` — local runtime and environment setup

## Project Layout
- `frontend/` — active frontend code
- `backend/` — active backend code
- `docs/` — supporting documentation and archive material
- `conductor/` — compatibility shims pointing to root docs and archived planning material
- `legacy/` — frozen historical artifacts; do not edit unless explicitly requested

## Notes
- Active source code lives in `backend/app/` and `frontend/src/`.
- Generated artifacts such as `.next/`, `.venv/`, `__pycache__/`, and `*.pyc` are not source-of-truth.
