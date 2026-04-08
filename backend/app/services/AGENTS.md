<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# services

## Purpose
Domain business logic layer — the primary complexity hotspot. Each service owns a specific domain: pricing, portfolio valuation, scoring, signals, reporting, and external integrations.

## Key Files

| File | Description |
|------|-------------|
| `portfolio_service.py` | Core portfolio valuation — equity curves, NAV, weighted positions, KRW→USD conversion |
| `algo_service.py` | Rule-based trading signals (MSTR Z-score exits, RSI defensive floors, centralized thresholds) |
| `score_service.py` | Portfolio scoring — alignment, fit, posture/diversification vs category targets (NDX 30%, DBMF 30%, BRAZIL 10%, MSTR 10%, GLDM 10%, BONDS/CASH 10%) |
| `report_service.py` | Weekly report generation — algo signals, macro context, severity mapping |
| `friday_service.py` | Friday "Time Machine" — WeeklySnapshot/WeeklyDecision creation, conflict detection, scoring pipeline |
| `quant_service.py` | Quantitative analytics — VXN volatility history, MSTR corporate actions |
| `macro_service.py` | Macro indicators — liquidity, rates, inflation, growth/labor, stress/sentiment |
| `stress_service.py` | Scenario analysis — historical crisis modeling (2020 COVID, 2022 Bear) |
| `price_service.py` | Price aggregator — yfinance (US), FinanceDataReader (KR), with fallback logic |
| `ingestion_service.py` | ELT pipeline — updates RawDailyPrice from multiple sources, upserts to avoid duplicates |
| `exchange_service.py` | FX rates — USD/KRW via FinanceDataReader with 1-hour cache |
| `kis_auth.py` | KIS authentication singleton — bearer token acquisition and caching |
| `kis_service.py` | KIS API wrapper — Brazil Bond values, account balances, positions |
| `llm_service.py` | LLM integration — weekly summary generation via OpenAI or Google GenAI |
| `notification_service.py` | Telegram alert dispatcher for portfolio events/signals |
| `annotation_service.py` | Event annotations — creates EventAnnotation records for market events |
| `cache_service.py` | Persistent SystemCache — JSON payloads with TTL via get_cache/set_cache |

## For AI Agents

### Working In This Directory
- This is the primary complexity hotspot — most feature work happens here
- Keep services focused on their domain; don't let cross-cutting concerns leak
- If API payloads change, update `frontend/src/lib/api.ts` in the same task
- `report_service.py` owns the weekly report contract — treat `GET /api/reports/weekly/latest` as read-only
- Friday services must handle partial snapshots safely; missing data → explicit placeholders, not crashes
- Never add request-time DDL in service code; missing tables → point to migrations

### Testing Requirements
- Tests live in `backend/tests/`; mocks required for external APIs (KIS, yfinance, LLM)
- Friday-specific: `cd backend && .venv/bin/python -m pytest tests/test_friday_service.py -q`
- FX regression: `tests/test_portfolio_service_fx_regression.py`, `tests/test_report_service_fx.py`

### Common Patterns
- Import `get_db` from `database.py` for DB sessions
- Exchange rates cached with 1-hour TTL to minimize API calls
- Severity mapping: `MSTR_HARD_EXIT` → critical, other signals → warning/info
- Score targets: NDX 30%, DBMF 30%, BRAZIL 10%, MSTR 10%, GLDM 10%, BONDS/CASH 10%

## Dependencies

### Internal
- `../models.py` — SQLAlchemy models (Asset, Transaction, WeeklyReport, WeeklySnapshot, etc.)
- `../database.py` — DB session management
- `../env_loader.py` — Environment variable loading

### External
- yfinance, FinanceDataReader (market data)
- pandas (data processing)
- OpenAI, Google GenAI (LLM summaries)
- requests (KIS API calls)

<!-- MANUAL: -->
