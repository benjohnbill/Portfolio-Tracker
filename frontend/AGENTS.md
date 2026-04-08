<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# frontend

## Purpose
Next.js 14 App Router dashboard for the Portfolio Tracker. Provides weekly decision reports, Friday ritual snapshots, portfolio analytics, and historical archives.

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Dependencies and scripts (Next.js 14.1, React 18, Recharts, Radix UI, Tailwind) |
| `next.config.ts` | Next.js configuration |
| `tailwind.config.ts` | Tailwind theme with custom dark-mode design system |
| `tsconfig.json` | TypeScript configuration |
| `components.json` | Shadcn/ui component library configuration |
| `.eslintrc.json` | ESLint rules (repo-local config, avoid `next lint` setup prompts) |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | Application source code (see `src/AGENTS.md`) |
| `public/` | Static SVG assets (Next.js, Vercel logos) |

## For AI Agents

### Working In This Directory
- Install: `cd frontend && npm install`
- Dev server: `cd frontend && npm run dev`
- `NEXT_PUBLIC_API_URL` drives backend calls (defaults to `http://localhost:8000`)
- Always read `DESIGN.md` (repo root) before making visual/UI changes

### Testing Requirements
- Lint: `cd frontend && npm run lint`
- Build: `cd frontend && npm run build`
- Distinguish expected local `ECONNREFUSED` from actual compile/type failures

### Common Patterns
- App Router with server components by default; `"use client"` only when needed
- Tailwind + shadcn/ui primitives; extend nearby patterns, don't introduce parallel UI systems
- `@/*` import alias rooted at `frontend/src/`

## Dependencies

### External
- Next.js 14.1 + React 18 (framework)
- Recharts (data visualization)
- Radix UI (accessible primitives)
- Tailwind CSS (styling)
- Lucide React (icons)

<!-- MANUAL: -->
