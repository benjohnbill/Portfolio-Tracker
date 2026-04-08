<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# features

## Purpose
Business domain components — charts for portfolio analytics, signal visualization, and transaction management.

## Key Files

| File | Description |
|------|-------------|
| `AddAssetModal.tsx` | Client-side modal for adding transactions — asset dropdown, BUY/SELL toggle, quantity/price/date inputs |
| `NDXTrendChart.tsx` | NDX (QQQ) price vs 250MA trend chart with period selector (1y/3m/6m/1m) |
| `MSTRZScoreChart.tsx` | MSTR z-score visualization with rolling mean/std deviation context |
| `AlphaChart.tsx` | Alpha performance vs SPY benchmark chart |
| `HistoryChart.tsx` | Portfolio value history with date range selector |
| `TargetDeviationChart.tsx` | Asset allocation deviation from target weights with rebalance indicators |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `portfolio/` | Portfolio-specific section components for the analytics page (see `portfolio/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- All chart components use Recharts
- Components are client-side (`"use client"`) for interactivity
- Chart data comes from `lib/api.ts` — fetched at page level, passed as props
- Follow existing chart patterns: period selector → fetch → responsive container → composed chart

### Common Patterns
- Recharts `ResponsiveContainer` wraps all charts
- Period selectors use button groups with active state styling
- Loading states use Skeleton components from `ui/`
- Color palette follows `DESIGN.md` dark theme variables

## Dependencies

### Internal
- `../ui/` — Skeleton, Card, Sheet primitives
- `../../lib/api.ts` — data fetching types and functions

<!-- MANUAL: -->
