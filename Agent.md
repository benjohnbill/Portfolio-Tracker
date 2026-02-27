# Agent.md — Portfolio Tracker 운영 SSOT

Last updated: 2026-02-24 (Phase 1 Completed)
Scope: `- 01_Coding` repository only

## 1) Purpose

This document is the single source of truth for multi-agent collaboration in this repository.

Core goals:
- Keep frontend/backend/control-tower ownership explicit.
- Prevent API and UI changes from colliding during parallel work.
- Standardize handoff and integration decisions.

Domain context:
- `DOMAIN_MAP.md` is the DDD-lite boundary reference for business-domain routing.

## 2) Current System Snapshot (Phase 2 - In Progress)

**Tech Stack:**
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS v3 + shadcn/ui
- **Backend:** Python FastAPI (Async) + SQLAlchemy (ORM) + Pydantic
- **Data Sources:** Yahoo Finance (US), FinanceDataReader (KR), FRED (Macro)
- **Database:** SQLite (Local Dev)
- **Package Manager:** `npm` (Frontend), `uv` (Backend)

**Runtime Shape:**
- **Frontend Entry:** `frontend/src/app/page.tsx`
- **Backend Entry:** `backend/app/main.py`
- **Key Services:**
  - `PriceService`: Real-time & Historical market data.
  - `ExchangeService`: USD/KRW currency conversion.
  - `PortfolioService`: Equity curve calculation & Quant metrics.
  - `MacroService`: Net Liquidity & Real Yield analysis.
  - `StressService`: Historical crisis simulation.

**API Documentation:** `http://localhost:8000/docs`

**Directory Structure:**
```
-01_Coding/
├── frontend/          # Next.js Application (Tailwind v3 stabilized)
├── backend/           # FastAPI Server
│   ├── app/
│   │   ├── services/  # Business Logic (Quant, Macro, Price)
│   │   ├── main.py    # API Entrypoint (Seeded on startup)
│   │   ├── models.py
│   │   └── database.py
```

## 3) Authority Model

System precedence:
- This project SSOT is local-first only within repository scope.
- If project policy conflicts with system constitution docs, system docs win:
  - `02_Core_Resources/01_Agent_Orchastration_System/SYSTEM_BLUEPRINT.md`
  - `02_Core_Resources/01_Agent_Orchastration_System/SYSTEM_AGENT_POLICY.md`

Authority order:
- `L0`: `Agent.md` (this document)
- `L1`: `Control_Tower_Agent.md`
- `L2`: `Frontend_Agent.md`, `Backend_Agent.md`
- `L3`: `integration_status.md`
- `L4`: `*.handoff.json` (canonical), `handoff.txt` (optional briefing summary)

## 4) Role Split

Domain-driven ownership (Lite):
- Ownership is decided by business-domain completion, not file location alone.

Domain ownership map:
- **Portfolio Core + Market Data (Backend Agent):**
  - Responsibilities: API Server, DB Schema, Data Migration, Quant Logic.
  - Primary Path: `backend/`
- **Visualization and Interaction (Frontend Agent):**
  - Responsibilities: Dashboard UI, Charts (Recharts), Client State.
  - Primary Path: `frontend/`
- **Orchestration and Governance (Control Tower):**
  - Responsibilities: Task decomposition, API Contract definition, Status Sync.
  - Primary Path: `orchestration/`, `Agent.md`

## 5) Phase 1 Guardrails (Completed)

Phase 1 Baseline (Achieved):
- Build operating system for collaboration.
- Transition from Monolithic Script to Micro-service Architecture (Next.js + FastAPI).

Hard rules (Phase 2):
- Do not modify `backend/app/models.py` without migration strategy.
- Frontend must use `shadcn/ui` components for consistency.
- API changes must be reflected in `backend/app/main.py` and communicated via Swagger.

## 6) Local Runtime Policy

- **Backend:** Must use `uv` virtual environment.
  - Activate: `backend/.venv/Scripts/activate`
  - Run: `uvicorn backend.app.main:app --reload`
- **Frontend:** Must use `npm`.
  - Run: `npm run dev` (in `frontend/` dir)

## 7) Standard Work Loop

1. Control Tower receives request and maps affected paths.
2. Control Tower issues split tickets by role.
3. Role agent executes and reports with fixed handoff format.
4. Control Tower validates, merges decisions, updates status docs.

## 8) Fixed Handoff Format

Every task report must use exactly these 4 blocks:
1. `What changed`
2. `Validation`
3. `Risks`
4. `Next 3 actions`

Canonical artifact rule:
- Primary machine-readable handoff: `orchestration/handoff/*.handoff.json`
- Optional human summary: `handoff.txt`

## 9) Phase 2 Acceptance Criteria

Phase 2 is considered active when:
- Real-time price updates are implemented (Backend).
- Transaction input form is working (Frontend).
- Quantitative metrics (MDD, Sharpe) are displayed on Dashboard.
