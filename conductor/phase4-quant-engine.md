# Phase 4: Quant Engine & Serverless Migration Plan

## 1. Architectural Overview (The "Lazy Perfectionism" Stack)
- **Frontend**: Next.js (Deployed on Vercel for zero-spin-down performance).
- **Backend**: FastAPI (Deployed on Render).
- **Database**: Supabase (PostgreSQL) - Replaces SQLite for persistence.
- **Automation**: GitHub Actions (Cron Jobs) - Triggers backend calculations every Friday.

## 2. Execution Phases & Maestro Agent Assignments

### Phase 4.1: Database Migration & Schema Expansion (Data Engineer)
*Target: Supabase setup and strict schema enforcement for Silos and Time-Series data.*
1. **Migration**: Swap SQLite `DATABASE_URL` to Supabase connection string.
2. **Account Silos**: Update `Transaction` and `Asset` models to include `account_type` (Enum: `ISA`, `OVERSEAS`, `PENSION`).
3. **MSTR Step-Data Table**: Create `mstr_corporate_actions` table:
   - Columns: `date` (PK), `btc_holdings` (Float), `outstanding_shares` (Float).
4. **VXN History Table**: Create `vxn_daily_history` table:
   - Columns: `date` (PK), `close` (Float). Enable UPSERT logic.

### Phase 4.2: Quant Pipeline Implementation (Backend Coder & Data Engineer)
*Target: Build the independent quantitative engines (Modules 1 & 2).*
1. **Module 1 (VXN Volatility Filter)**:
   - Fetch 3-year `^VXN` via `yfinance`.
   - Store/Upsert to `vxn_daily_history`.
   - Calculate 50MA and 90th percentile threshold using `pandas`.
   - Evaluate `is_vix_spike` (Current > Threshold).
2. **Module 2 (MSTR Dynamic Z-Score)**:
   - Fetch 1.5-year `MSTR` & `BTC-USD` via `yfinance`.
   - Fetch MSTR step-data from DB. Merge using `pandas.merge_asof` or `ffill()`.
   - Calculate `MNAV` = `(BTC_Close * btc_holdings) / outstanding_shares`.
   - Calculate 252-day Rolling Mean, Std, and Current `Z_score`.
3. **Module 3 (API & CRON Endpoint)**:
   - GET `/api/signals/vxn`
   - GET `/api/signals/mstr`
   - POST `/api/cron/update-signals` (Protected by secret token; triggered by GitHub Actions).

### Phase 4.3: The "Jin-geun" Algorithm Engine (Architect & Backend Coder)
*Target: Implement the specific Buy/Sell Priority logic.*
1. **State Engine**: Create a service that evaluates the "Core 6" Base State against the computed signals.
2. **Sell Priority (Part 1)**:
   - Evaluate MSTR Volatility Harvesting (e.g., IF Z_score > 3.5 -> Signal: "Sell 100% MSTR, Buy DBMF").
   - Evaluate NDX 250MA Defense.
3. **Buy Priority (Part 2)**:
   - Evaluate MSTR Opportunity (e.g., IF Z_score < 0 -> Signal: "Sell 100% DBMF, Buy MSTR").
   - Evaluate NDX Recovery.
4. **Output**: Combine into a structured JSON `ActionReport` containing clear directives.

### Phase 4.4: Signal Dashboard Rebuild (Frontend Agent & UX Designer)
*Target: Shift UI from "Net Worth Viewer" to "Friday Action Planner".*
1. **Action Center**: Replace the top stats with an urgent "System Signals" banner. Display the algorithm's Buy/Sell directives clearly.
2. **Siloed Topology View**: Break the single pie chart into Account Blocks (ISA vs. Overseas).
3. **Target Deviation Visualization**: Show bar charts comparing Current Weight vs. Target Weight (±30% trigger zones) for the Core 6 assets.

## 3. Tooling & Constraints
- **Allowed MCPs**: `database-toolbox`, `chrome-devtools` (for Phase 4.4).
- **Python Libraries**: Strictly adhere to vectorized `pandas` operations for time-series math. Avoid loops where `ffill` and `rolling` can be used.
