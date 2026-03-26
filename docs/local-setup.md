# Local Setup Guide

Use this file for local runtime/bootstrap guidance.

## Frontend
Run from `frontend/`:

```bash
npm install
npm run dev
```

Optional verification:

```bash
npm run lint
npm run build
```

## Backend
Run from `backend/`:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Or from repo root:

```bash
uvicorn backend.app.main:app --reload
```

## Required Environment
- `DATABASE_URL`
- `CRON_SECRET` for protected cron endpoints
- External integrations may also require `KIS_APP_KEY` and `KIS_APP_SECRET`

## Template File
- Use `backend/.env.example` as the placeholder template for local setup.
- Copy it to `backend/.env` locally and fill in real values outside git tracking.
- Do not commit populated `.env` files.

## Current Env Gates
### Safe now
- Add or update placeholder-only example files
- Document required variables and where they are consumed

### Do not change without external coordination
- `DATABASE_URL` used by deployed runtime or migrations
- `CRON_SECRET` shared between deployed backend and GitHub Actions
- `BACKEND_BASE_URL` used by GitHub Actions
- Real `KIS_*` credentials

### Stop conditions
- Stop immediately if a change would require editing a live secret value from this repo
- Stop immediately if runtime verification depends on external consoles or unavailable secret values
- Stop immediately if a change would alter production database connectivity

### Failure signals to expect
- Missing `DATABASE_URL`: backend startup raises a `ValueError` from `backend/app/database.py`
- Wrong `CRON_SECRET`: `/api/cron/update-signals` returns `401 Invalid or missing cron secret`
- Wrong `BACKEND_BASE_URL`: GitHub workflow `curl` calls fail with connection or non-2xx errors
- Wrong `KIS_*`: KIS auth/API calls fail in integration scripts or service methods

## Important Notes
- `backend/.env` is the current local environment source used by the backend codepath, unless variables are supplied directly by the shell/runtime.
- `backend/.env.example` is safe to track; `backend/.env` is not.
- Do not treat committed virtual environments or generated artifacts as canonical runtime.
- `legacy/LOCAL_ENV_SETUP.md` is historical context only.
