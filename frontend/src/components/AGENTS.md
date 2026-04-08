<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# components

## Purpose
Shared React components organized by domain. Feature components handle business logic visualization; UI components provide reusable primitives.

## Key Files

| File | Description |
|------|-------------|
| `Sidebar.tsx` | Collapsible navigation sidebar — OrbitAI logo, menu items, active state, responsive icon-only mode |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `features/` | Business domain components — charts, modals, portfolio sections (see `features/AGENTS.md`) |
| `friday/` | Friday ritual components — dashboard, snapshot panel (see `friday/AGENTS.md`) |
| `reports/` | Report display components — WeeklyReportView (see `reports/AGENTS.md`) |
| `ui/` | Shadcn/ui primitives — button, card, input, table, etc. (see `ui/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Prefer existing `ui/` primitives over creating custom wrappers
- Feature components are client-side (`"use client"`) when they need interactivity
- Keep presentational logic in components; data fetching belongs in `app/` pages
- Follow Tailwind + shadcn/ui patterns; don't introduce parallel UI systems

### Common Patterns
- Props interfaces defined above component exports
- CSS via Tailwind utility classes (no CSS modules)
- Recharts for all data visualization
- Lucide React for icons

## Dependencies

### Internal
- `../lib/api.ts` — backend API client (used by client components)
- `../lib/utils.ts` — `cn()` utility for conditional class merging

### External
- Recharts (charts)
- Radix UI (accessible primitives)
- Lucide React (icons)

<!-- MANUAL: -->
