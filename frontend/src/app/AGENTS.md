<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# app

## Purpose
Next.js App Router pages and routes. Each subdirectory maps to a URL path. Server components by default; client components only where interactivity requires it.

## Key Files

| File | Description |
|------|-------------|
| `layout.tsx` | Root layout — Sidebar navigation, header with OrbitAI branding, dark theme shell |
| `page.tsx` | Home page ("This Week") — loads latest weekly report via `getLatestWeeklyReport()` |
| `globals.css` | Global styles — CSS variables for dark theme, Geist/Instrument Serif fonts, Tailwind layers |
| `loading.tsx` | Root loading skeleton with animated pulse placeholders |
| `favicon.ico` | Browser tab icon |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `portfolio/` | Portfolio analytics — equity curve, signal pulse grid, allocation |
| `friday/` | Friday ritual — current snapshot, frozen detail, archive/comparison |
| `archive/` | Historical weekly reports — grid view and individual report detail |
| `reports/weekly/` | Weekly report alias route |

## For AI Agents

### Working In This Directory
- Each route directory contains `page.tsx` (required) and optionally `loading.tsx` (Suspense skeleton)
- Dynamic routes use `[param]` directory naming (e.g., `archive/[weekEnding]/`)
- Data fetching happens at the page boundary; pass data down to presentational components
- `globals.css` defines the design system variables — check `DESIGN.md` before changing

### Route Map

| URL | Directory | Description |
|-----|-----------|-------------|
| `/` | `page.tsx` | This Week — latest weekly report |
| `/portfolio` | `portfolio/page.tsx` | Long-Horizon Analytics |
| `/friday` | `friday/page.tsx` | Friday ritual dashboard |
| `/friday/[date]` | `friday/[snapshotDate]/page.tsx` | Frozen Friday snapshot detail |
| `/friday/archive` | `friday/archive/page.tsx` | Friday archive with comparison |
| `/archive` | `archive/page.tsx` | Weekly report archive grid |
| `/archive/[date]` | `archive/[weekEnding]/page.tsx` | Individual archived report |
| `/reports/weekly` | `reports/weekly/page.tsx` | Weekly report alias |

## Dependencies

### Internal
- `../components/` — shared UI components
- `../lib/api.ts` — backend API client

<!-- MANUAL: -->
