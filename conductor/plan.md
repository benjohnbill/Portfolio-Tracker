# Execution Plan (Phase-based Scoping)

This document serves as the project's state machine. Tools (MCPs) are strictly bound to specific phases.

## Phase 1: Environment Setup & Microservices Transition
- [x] Task 1.1: Build operating system for collaboration.
- [x] Task 1.2: Transition from Monolithic Script to Micro-service Architecture (Next.js + FastAPI).

## Phase 2: Real-time Data & Dashboard (Current Focus)

### Phase 2.1: Real-time Data Integration (Backend)
- [x] Task 1: Integrate `yfinance` & `FinanceDataReader` for live prices.
- [x] Task 2: Implement SQLite schema migration for transaction history.
- **> [Allowed MCPs: database-toolbox, context7]**
- **> [Forbidden: chrome-devtools]**

### Phase 2.2: Interactive Dashboard (Frontend)
- [x] Task 1: Build `PortfolioSummary` cards using `shadcn/ui`.
- [x] Task 2: Implement `PerformanceChart` with Recharts.
- **> [Allowed MCPs: chrome-devtools, context7]**
- **> [Forbidden: database-toolbox]**

## Phase 3: Data Pipeline Optimization & Advanced Quant (Complete)

### Phase 3.1: Bulk Data Fetching (Backend)
- [x] Task 1: Refactor `PriceService` to use `yf.download(tickers_list)` for bulk historical data retrieval.
- [x] Task 2: Update `portfolio_service.py` to process the multi-index DataFrame instead of iterating single API calls.
- **> [Allowed MCPs: database-toolbox, context7]**
- **> [Forbidden: chrome-devtools]**

## Phase 4: Quant Engine & Serverless Migration (Current Focus)
**Detailed Plan:** See `conductor/phase4-quant-engine.md` for Maestro agent breakdown.

### Phase 4.1: PostgreSQL Migration & Schema Expansion
- [ ] Task 1: Migrate from SQLite to Supabase (PostgreSQL).
- [ ] Task 2: Add `account_type` to Silo assets.
- [ ] Task 3: Create `mstr_corporate_actions` and `vxn_daily_history` tables.

### Phase 4.2: Quant Pipeline Implementation
- [ ] Task 1: Module 1 (VXN Volatility Filter).
- [ ] Task 2: Module 2 (MSTR Dynamic Z-Score).
- [ ] Task 3: API & CRON Endpoints setup.

### Phase 4.3: The "Jin-geun" Algorithm Engine
- [ ] Task 1: Implement State Engine and Buy/Sell Priority Logic.

### Phase 4.4: Signal Dashboard Rebuild
- [ ] Task 1: Shift UI to "Friday Action Planner" with Signal Banners and Target Deviation Visualizations.
