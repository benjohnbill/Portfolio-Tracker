<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# portfolio

## Purpose
Portfolio-specific section components used on the `/portfolio` analytics page. Each component renders a distinct section of the portfolio dashboard.

## Key Files

| File | Description |
|------|-------------|
| `PortfolioSummaryCard.tsx` | Summary metrics card — total value, invested capital, CAGR, MDD, volatility, Sharpe ratio |
| `EquityCurveSection.tsx` | Large equity curve chart with period selector and benchmark comparison |
| `AssetAllocationSection.tsx` | Pie/donut chart and table of holdings by weight with account silo breakdown |
| `AssetSignalSection.tsx` | Reusable ticker trend chart (QQQ/GLDM/TLT) showing price vs 250MA |
| `MSTRSignalSection.tsx` | Specialized MSTR z-score signal section (used in portfolio and weekly reports) |

## For AI Agents

### Working In This Directory
- These are the building blocks of the `/portfolio` page — imported there as sections
- `AssetSignalSection` is reusable across tickers; `MSTRSignalSection` is MSTR-specific
- Components receive data as props from the page-level fetch
- Layout follows the portfolio page grid pattern defined in `DESIGN.md`

## Dependencies

### Internal
- `../../ui/` — Card, Skeleton primitives
- `../../../lib/api.ts` — TypeScript types for portfolio data

<!-- MANUAL: -->
