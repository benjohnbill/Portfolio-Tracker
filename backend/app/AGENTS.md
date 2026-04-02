# BACKEND APP GUIDE

## OVERVIEW
FastAPI application code. HTTP layer in `main.py`; domain logic lives in `services/`.

## STRUCTURE
```text
backend/app/
├── main.py            # FastAPI routes and request models
├── database.py        # engine/session bootstrap
├── env_loader.py      # backend/.env loading
├── models.py          # SQLAlchemy models + enums
└── services/          # business logic, integrations, report generation
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Add/change API endpoint | `main.py` | Keep route handlers thin |
| Portfolio calculations | `services/portfolio_service.py` | Equity curve, allocation, summary |
| Weekly decision reports | `services/report_service.py` | Latest report + archive payloads |
| Signal / action logic | `services/algo_service.py`, `services/quant_service.py`, `services/score_service.py` | Core decision path |
| Macro / annotations | `services/macro_service.py`, `services/annotation_service.py` | Weekly context inputs |
| Notifications / external summaries | `services/notification_service.py`, `services/llm_service.py` | External side effects |
| DB schema changes | `models.py` + `backend/alembic/versions/` | Migration path required |

## CONVENTIONS
- Import `get_db` from `database.py`; do not open ad hoc sessions in route handlers
- `env_loader.py` is part of runtime bootstrapping; `DATABASE_URL` must exist before imports settle
- Keep request/response shaping in `main.py`, calculations in `services/`
- If API payloads change, update `frontend/src/lib/api.ts` in the same task
- Weekly report endpoints are persisted/report-oriented; treat `report_service.py` as the contract owner

## ANTI-PATTERNS
- Do not move business logic into FastAPI route functions
- Do not change live env/secret behavior (`DATABASE_URL`, `CRON_SECRET`, `BACKEND_BASE_URL`, real `KIS_*`) without explicit coordination
- Do not add schema-affecting model changes without checking Alembic migration coverage
- Do not treat fallback/default values in services as proof of healthy upstream data

## VALIDATION
- Backend runtime: `uvicorn backend.app.main:app --reload` from repo root, or `cd backend && uvicorn app.main:app --reload`
- Backend deps: `cd backend && pip install -r requirements.txt`
- Use relevant script/test checks for touched services; formal test coverage is sparse and mixed with one-off scripts
- For schema changes, verify `backend/alembic/versions/` path and migration behavior
