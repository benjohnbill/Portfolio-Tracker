<!-- Parent: ../AGENTS.md -->

# FRONTEND SRC GUIDE

## OVERVIEW
Next.js App Router frontend. Routes live in `app/`, shared UI in `components/`, API contract in `lib/api.ts`.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Route/page changes | `app/` | App Router only |
| Global shell | `app/layout.tsx`, `components/Sidebar.tsx` | Navigation and shared chrome |
| Weekly report UI | `components/reports/WeeklyReportView.tsx` | Main decision surface |
| Portfolio analytics UI | `app/portfolio/page.tsx`, `components/features/` | Charts, summary, modal flows |
| API contract | `lib/api.ts` | Update alongside backend changes |
| UI primitives | `components/ui/` | Prefer existing primitives over custom wrappers |

## CONVENTIONS
- Use `@/*` imports rooted at `frontend/src/`
- Prefer server components by default; add `"use client"` only when interactivity requires it
- Keep route-level data fetching close to the page boundary; keep presentational logic in components
- This frontend uses Tailwind + `shadcn/ui` style primitives; extend nearby patterns instead of introducing a parallel UI system
- `NEXT_PUBLIC_API_URL` drives backend calls; missing/invalid backend connectivity should degrade explicitly, not via fake loading states

## ANTI-PATTERNS
- Do not reintroduce dead navigation links or fake interactive affordances
- Do not leave backend failures disguised as valid zero-state portfolio data
- Do not bypass `lib/api.ts` for backend contract changes unless there is a deliberate replacement
- Do not edit generated frontend artifacts such as `.next/` or `next-env.d.ts`

## VALIDATION
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- Frontend lint should run through the repo-local config in `frontend/.eslintrc.json`, not interactive `next lint` setup
- If pages fetch backend data at build/runtime, distinguish expected local `ECONNREFUSED` warnings from actual compile/type failures
