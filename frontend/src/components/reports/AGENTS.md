<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# reports

## Purpose
Weekly decision report display components — the primary decision surface for the portfolio tracker.

## Key Files

| File | Description |
|------|-------------|
| `WeeklyReportView.tsx` | Comprehensive report viewer — data freshness badges, action summary with evidence charts, score breakdown (Total/Fit/Alignment/Posture), AI summary, portfolio snapshot metrics, macro bucket states, allocation, target drift, triggered rules with severity, event annotations |

## For AI Agents

### Working In This Directory
- `WeeklyReportView.tsx` is the main decision surface — used on home page and report routes
- This is a read-only display component; report generation happens in backend `report_service.py`
- `GET /api/reports/weekly/latest` is read-only — do not trigger regeneration from this component
- Score breakdown: Total, Fit, Alignment, Posture scores with visual indicators
- Severity mapping follows backend contract: critical (red), warning (amber), info (blue)

### Common Patterns
- Data freshness badges show staleness indicators
- Evidence charts embedded inline (NDX trend, MSTR z-score)
- Macro buckets rendered as categorized state cards
- Triggered rules sorted by severity with color-coded badges

## Dependencies

### Internal
- `../features/` — Chart components (NDXTrendChart, MSTRZScoreChart) embedded in reports
- `../ui/` — Card, Table, Tabs, Skeleton primitives
- `../../lib/api.ts` — WeeklyReport TypeScript types

<!-- MANUAL: -->
