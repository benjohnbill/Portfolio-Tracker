<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# friday

## Purpose
Friday ritual UI components — the weekly snapshot/freeze workflow and decision journaling interface.

## Key Files

| File | Description |
|------|-------------|
| `FridayDashboard.tsx` | Main Friday ritual UI — freeze button with progressive status, portfolio delta list, signals with severity badges, macro regime buckets, decision journal form (type/ticker/confidence/invalidation), archive links |
| `FridaySnapshotPanel.tsx` | Detail view wrapper for a frozen Friday snapshot with back navigation and decision display |

## For AI Agents

### Working In This Directory
- Friday components must handle partial snapshots safely — missing score/value/regime/rules → explicit "unavailable" placeholders, not crashes
- The freeze workflow is stateful — `FridayDashboard` manages snapshot creation and conflict detection
- Decision journal form fields: type, ticker, confidence, invalidation criteria
- Do not add request-time DDL — missing tables should fail fast and point to migrations

### Common Patterns
- Progressive status messaging during freeze operation
- Severity badges on triggered rules (critical/warning/info)
- Expandable sections for portfolio delta and macro regime details

## Dependencies

### Internal
- `../ui/` — Card, Button, Input, Skeleton primitives
- `../../lib/api.ts` — Friday API functions (getFridayCurrent, createFridaySnapshot, etc.)

<!-- MANUAL: -->
