<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# versions

## Purpose
Alembic migration scripts in chronological order. Each file represents a schema change applied to the database.

## Key Files

| File | Description |
|------|-------------|
| `ebdee97d2ac2_initial_pg_schema.py` | Initial migration — creates base tables: assets, transactions, prices, portfolios, account metadata |
| `a874b8e65364_elt_pipeline_schema.py` | ELT pipeline — adds RawDailyPrice, PortfolioSnapshot, price history tracking |
| `6b2d4c8f9a11_add_weekly_reports_and_annotations.py` | Weekly reporting — adds WeeklyReport, WeeklySnapshot, EventAnnotation tables |
| `c4a7c2c9bb21_add_asset_account_silo.py` | Account segmentation — adds AccountSilo enum (ISA_ETF, OVERSEAS_ETF, BRAZIL_BOND) |
| `d5b8e3f0ab12_add_cron_run_log.py` | Cron logging — adds CronRunLog for scheduled job tracking |
| `f1a9c3d8e210_add_friday_time_machine_tables.py` | Time Machine — adds WeeklyDecision, VXNHistory, MSTRCorporateAction tables |
| `8d1789f7c374_add_system_cache_table.py` | System cache — adds SystemCache table with JSON payloads and TTL |

## For AI Agents

### Working In This Directory
- Migrations are ordered by dependency chain, not filename
- New migrations: `cd backend && alembic revision --autogenerate -m "description"`
- Always verify new migrations against `backend/app/models.py`
- Each migration must have both `upgrade()` and `downgrade()` functions
- Never manually edit applied migrations in production

### Migration Chain
```
initial_pg_schema → elt_pipeline_schema → weekly_reports_and_annotations
→ asset_account_silo → cron_run_log → friday_time_machine → system_cache
```

<!-- MANUAL: -->
