# Phase 5: ELT Data Pipeline & Zero-Latency UI

## 1. Architectural Overview (The "ELT" Model)
To achieve a <0.1s load time on Vercel while supporting complex quantitative analysis, we are migrating from a "Calculate-on-Request" model to an **Extract, Load, Transform (ELT)** model.
- **Extract & Load**: A daily background job fetches raw asset prices from external APIs (`yfinance`, etc.) and stores them directly into Supabase.
- **Transform**: A separate background job reads these raw prices, combines them with transaction history, and computes the final portfolio value and quantitative signals (Z-Score, RSI). The results are saved as Snapshots.
- **Serve (Zero-Latency)**: Vercel frontend simply requests the pre-calculated snapshots from Supabase via FastAPI. No external API calls or complex math happen during user requests.

## 2. Execution Phases & Maestro Agent Assignments

### Phase 5.1: Database Schema for ELT (Data Engineer)
*Target: Create the foundational tables for raw data and processed snapshots.*
1.  **`raw_daily_prices` table**:
    -   `date` (Date)
    -   `ticker` (String)
    -   `close_price` (Float)
    -   Composite Primary Key (date, ticker) for Upserts.
2.  **`portfolio_snapshots` table**:
    -   `date` (Date, PK)
    -   `total_value` (Float)
    -   `invested_capital` (Float)
    -   `cash_balance` (Float)
3.  **Alembic Migration**: Generate and apply.

### Phase 5.2: The 'Extract & Load' Worker (Backend Coder)
*Target: Automate the ingestion of raw market data.*
1.  **`PriceIngestionService`**:
    -   Identify all distinct tickers in the `assets` table.
    -   Find the latest date we have data for in `raw_daily_prices`.
    -   Fetch missing data up to today using `yfinance` / `FinanceDataReader`.
    -   Bulk Upsert into `raw_daily_prices`.

### Phase 5.3: The 'Transform' Engine (Backend Coder)
*Target: Compute the equity curve strictly from the local database, not external APIs.*
1.  **Refactor `PortfolioService.get_equity_curve`**:
    -   Instead of calling `PriceService.get_historical_prices` (which hits the web), it must `SELECT` from `raw_daily_prices`.
    -   Calculate daily values based on transactions and local raw prices.
2.  **Snapshot Generator**:
    -   A new function that runs the equity curve calculation and saves the final result to `portfolio_snapshots`.

### Phase 5.4: 0.1s API Refactor (Backend Coder)
*Target: Make the dashboard API endpoints lightning fast.*
1.  **Refactor `/api/portfolio/history`**:
    -   Change the logic to simply `SELECT * FROM portfolio_snapshots ORDER BY date`.
2.  **Cron Endpoint Update**:
    -   Update `/api/cron/update-signals` to trigger the Extract, Load, and Transform pipeline sequentially.

## 3. Tooling & Constraints
- **Allowed MCPs**: `database-toolbox`, `chrome-devtools`.
- **Python Libraries**: `pandas` for data manipulation, `sqlalchemy` for fast bulk inserts.
- **Rule**: During Phase 5.4, the API must NOT make any network calls to `yfinance`.
