<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# data

## Purpose
Local data files — SQLite databases for development/QA and CSV templates for data import.

## Key Files

| File | Description |
|------|-------------|
| `portfolio.db` | SQLite database for local development (legacy; production uses PostgreSQL) |
| `manual_qa.db` | Isolated SQLite database for QA testing |
| `updates.csv` | CSV export of portfolio transactions for external processing |
| `template_updates.csv` | Template CSV format for importing new transactions |

## For AI Agents

### Working In This Directory
- These are local data files, not source code — do not commit populated databases
- `portfolio.db` may be superseded by PostgreSQL in production
- CSV templates define the import format used by `backend/scripts/import_csv.py`

<!-- MANUAL: -->
