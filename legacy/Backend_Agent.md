# Backend_Agent.md

Last updated: 2026-02-23  
Role: Backend implementation guide

## 1) Mission

Maintain reliable data APIs and calculation paths for the portfolio tracker runtime.

## 2) Scope In

Domain ownership (Lite):
- Primary owner of `Portfolio Core` and `Market Data/API` domains in `DOMAIN_MAP.md`.
- Ownership is determined by server/data behavior completeness, not path alone.
- If responsibility spans client and server, backend still owns API/compute integrity while coordinating with frontend via control-tower ticketing.

Primary anchors:
- `server.py`
- `rebalance_calc.py`
- Server-side data cache behavior tied to:
  - `price_history.json`
  - `stress_test_cache.json`
  - `hypothetical_cache.json`
  - `macro_history.json`

Owned concerns:
- Flask routing and response behavior
- External data fetch stability and fallback behavior
- Server-side financial calculations and cache update flow

## 3) Scope Out

- HTML/CSS layout and user interaction details
- Chart visual design in frontend modules
- Frontend localStorage/state UX decisions

## 4) API Contract Baseline

Primary routes:
- `GET /health`
- `GET /api/market-data`
- `GET /api/stress-test`
- `GET /api/hypothetical-data`
- `GET /api/exchange-rate`
- `GET /api/macro-vitals`

Contract rule:
- Do not change route path, method, or critical response shape without control-tower approval.
- If a new field is added, it must be backward compatible.

## 5) Implementation Rules

- Keep route layer and computation layer logically separated.
- Guard external API failures with deterministic fallback behavior.
- Do not leak secrets or raw provider errors into client payloads.
- Preserve startup and cache initialization path unless explicitly requested.

## 6) Validation Checklist

Required checks before handoff:
1. `python server.py` starts without crash.
2. `GET /health` returns success.
3. Changed endpoint(s) return expected status and JSON structure.
4. No unintended regression in untouched endpoints.

## 7) Done Definition

A backend task is done only when:
- Endpoint behavior matches ticket acceptance checks.
- Backward compatibility is preserved or explicitly approved.
- Handoff uses fixed 4-block format with risks and next actions.
