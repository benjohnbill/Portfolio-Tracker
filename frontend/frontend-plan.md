# Frontend Implementation Plan (Vibe Coding)

This implementation plan is guided by the "Vibe Coding" methodology and strict Modern Web Design principles outlined in `INSTRUCTIONS.md`.

## 1. Project Setup Strategy

- **Next.js & Tailwind Initialization**:
  - `npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm` (Completed structure, dependency resolution in progress)
- **shadcn/ui Initialization**:
  - `npx shadcn-ui@latest init` to set up base configs.
- **Icons**:
  - `npm install lucide-react`
- **Color System Configuration (Strict Rule)**:
  - We exclusively rely on the defined minimal palette.
  - `tailwind.config.ts` (or `src/app/globals.css` CSS variables) will be updated to enforce:
    - Primary Color (Main): `#2563EB`
    - Secondary Color (Sub): `#F3F4F6`
    - Base Colors: `#FFFFFF` (White), `#000000` (Black), and Slate Gray scales.

## 2. Essential Components List

Based on the Portfolio Tracker requirement, we will initially copy/provision the following shadcn/ui source components:

- `Button` (Primary actions, form submitting)
- `Card` (Metric displays, layout sections, chart containers)
- `Input` & `Select` (Controls, date filters, drop-downs)
- `Table` (Asset allocation / holdings display)
- `Tabs` (Navigation between different data views or modes)
- `Sheet` (Slide-out panels for detail drill-downs without navigating away)
- `Skeleton` (Loading states while data is fetched from the Python Flask backend)

## 3. Page Structure

We will adopt an `app` directory structure focusing on feature modularity:

```
src/
├── app/
│   ├── layout.tsx         # Root layout with global nav/header and theme providers.
│   ├── page.tsx           # Main Dashboard View (Portfolio Summary, Risk Metrics).
│   ├── portfolio/
│   │   └── page.tsx       # Detailed Assets & Allocation View.
│   └── globals.css        # Centralized CSS variables (2-Color System).
├── components/
│   ├── ui/                # shadcn/ui components (copied source files).
│   └── features/          # Domain-specific compositions (e.g., PerformanceChart, MetricsCard).
└── lib/
    └── utils.ts           # ClassName merging utilities (`clsx`, `twMerge`).
```

## 4. Step-by-Step Execution

- **Phase 1: Environment Setup & Foundation**
  - Complete Next.js `npm install`.
  - Execute `shadcn-ui init` and overwrite `globals.css` with the strict 2-Color system.
- **Phase 2: Common Components Provisioning**
  - Run `npx shadcn-ui@latest add button card input table sheet tabs skeleton`.
  - Validate the components properly utilize the Primary (`#2563EB`) and Secondary (`#F3F4F6`) colors.
- **Phase 3: Core Page Implementation**
  - Build the Dashboard Shell (`src/app/layout.tsx` + `page.tsx`) using mocked data formats similar to the real backend payload.
  - Implement dynamic interaction logic (e.g., toggles) locally.
- **Phase 4: Backend Data Validation**
  - Wire up components via `fetch` or `SWR`/`React Query` against `http://localhost:8000/api/...` ensuring exact payload keys match standard response structure.
