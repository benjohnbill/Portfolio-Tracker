<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# lib

## Purpose
Shared utilities and the centralized backend API client. `api.ts` is the single point of contact between the frontend and backend.

## Key Files

| File | Description |
|------|-------------|
| `api.ts` | Core API client — 70+ functions and TypeScript interfaces for all backend endpoints (portfolio, assets, signals, reports, Friday snapshots). Uses `NEXT_PUBLIC_API_URL` env var. |
| `utils.ts` | Utility function `cn()` for conditional Tailwind class merging via clsx + tailwind-merge |

## For AI Agents

### Working In This Directory
- `api.ts` is the **highest-traffic file** in the frontend (28+ touches) — changes here affect every page
- When backend API contracts change, update `api.ts` types and functions in the same task
- All fetch calls go through this module; do not bypass it with direct `fetch()` elsewhere
- `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000` if unset

### Key API Domains in api.ts

| Domain | Functions | Description |
|--------|-----------|-------------|
| Portfolio | `getPortfolioHistory()`, `getPortfolioAllocation()`, `getPortfolioSummary()`, `getPortfolioPageData()` | Equity curve, allocation, summary metrics |
| Assets | `getAssets()`, `createTransaction()` | Asset listing and transaction creation |
| Signals | `getAssetHistory()`, `getNDXHistory()`, `getMSTRHistory()` | Ticker trend and signal data |
| Reports | `getLatestWeeklyReport()`, `getWeeklyReports()`, `getWeeklyReport()` | Weekly decision reports |
| Friday | `getFridayCurrent()`, `getFridaySnapshots()`, `getFridaySnapshot()`, `compareFridaySnapshots()`, `createFridaySnapshot()`, `createFridayDecision()` | Snapshot lifecycle |

<!-- MANUAL: -->
