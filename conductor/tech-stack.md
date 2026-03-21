# Tech Stack

## 1. Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS v3
- **Components:** shadcn/ui
- **Charts:** Recharts
- **Package Manager:** `npm` (run `npm run dev` in `frontend/`)
- **Primary Path:** `frontend/` (Visualization and Interaction)

## 2. Backend
- **Framework:** Python FastAPI (Async)
- **Database:** SQLite (Local Dev) via SQLAlchemy (ORM)
- **Data Validation:** Pydantic
- **Package Manager:** `uv` (Virtual Env)
- **Primary Path:** `backend/` (Portfolio Core, Market Data, API Server)
- **Local Run:** `uvicorn backend.app.main:app --reload` (after activating `backend/.venv/Scripts/activate`)

## 3. Key Services
- `PriceService`: Real-time & Historical market data.
- `ExchangeService`: USD/KRW currency conversion.
- `PortfolioService`: Equity curve calculation & Quant metrics.
- `MacroService`: Net Liquidity & Real Yield analysis.
- `StressService`: Historical crisis simulation.
