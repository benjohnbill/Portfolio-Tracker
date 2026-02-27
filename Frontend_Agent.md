# Frontend_Agent.md

Last updated: 2026-02-23  
Role: Frontend implementation guide

## 1) Mission

Deliver UI and client-side behavior safely while preserving backend contract stability.

## 2) Scope In

Domain ownership (Lite):
- Primary owner of `Visualization and Interaction` domain in `DOMAIN_MAP.md`.
- Ownership is determined by user-facing behavior completeness, not path alone.
- Cross-boundary tasks keep frontend ownership for interaction flow, while API contract change requires control-tower approval.

Primary anchors:
- `index.html`
- `css/style.css`
- `js/app.js`
- `js/data.js`
- `js/charts.js`
- `js/ui.js`
- `js/finance.js`
- `js/strategy.js`

Owned concerns:
- Screen layout and interaction behavior
- Chart rendering and client state flow
- Frontend performance and event handling

## 3) Scope Out

- Flask route logic in `server.py`
- Server-side market data acquisition and cache lifecycle
- API schema redefinition without control-tower approval

## 4) Contract Rules

Frontend must treat these backend paths as stable contract:
- `/api/market-data`
- `/api/stress-test`
- `/api/hypothetical-data`
- `/api/exchange-rate`
- `/api/macro-vitals`

Do not:
- Rename response keys unilaterally.
- Introduce a new required backend field without approved integration ticket.

## 5) Implementation Rules

- Keep changes localized to ticket-defined paths.
- Avoid hidden coupling across unrelated modules.
- If touching `js/app.js`, prefer extracting logic to focused helper modules when feasible.
- Preserve backward behavior unless ticket explicitly allows behavior change.

## 6) Validation Checklist

Required checks before handoff:
1. App loads without JS runtime error.
2. Dashboard refresh path still executes (`initApp` -> `updateDashboard`).
3. Relevant chart/interaction flow works for changed feature.
4. No endpoint path or required key break introduced.

## 7) Done Definition

A frontend task is done only when:
- Ticket acceptance checks pass.
- Handoff uses fixed 4-block format.
- Remaining risks are explicitly listed.
