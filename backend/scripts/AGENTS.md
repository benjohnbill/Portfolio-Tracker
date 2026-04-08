<!-- Parent: ../AGENTS.md -->

# BACKEND SCRIPTS GUIDE

## OVERVIEW
One-off operational helpers for local setup, imports, seeding, and migrations. Not the primary app runtime.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| DB bootstrap | `init_db.py` | Local initialization helper |
| Portfolio seed/import | `seed_my_portfolio.py`, `import_csv.py`, `import_legacy_json.py` | Data-loading scripts |
| DB migration helper | `migrate_sqlite_to_pg.py` | Operational migration aid, not Alembic replacement |

## CONVENTIONS
- Treat these as operator scripts, not reusable application modules
- Prefer `backend/app/` service logic as the source of truth; scripts should call into app models/services rather than fork business rules
- Keep script changes narrowly scoped to the operational task at hand

## ANTI-PATTERNS
- Do not treat scripts here as the primary runtime or API entrypoint
- Do not update live secrets or production database connectivity from these scripts without explicit coordination
- Do not let script-only fixes drift away from logic in `backend/app/`

## VALIDATION
- Run only the script(s) you changed, with explicit env awareness
- If a script touches schema/data shape, verify compatibility with `backend/app/models.py` and Alembic history
