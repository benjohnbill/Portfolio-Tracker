<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# ui

## Purpose
Reusable UI primitives based on shadcn/ui. These are the building blocks used by all feature components.

## Key Files

| File | Description |
|------|-------------|
| `button.tsx` | Button with variants: default, destructive, outline, secondary, ghost, link |
| `card.tsx` | Card container with CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `input.tsx` | Text input with accessibility and consistent styling |
| `sheet.tsx` | Side sheet/drawer modal (used by AddAssetModal) |
| `tabs.tsx` | Tab navigation from Radix UI Tabs primitive |
| `skeleton.tsx` | Loading skeleton placeholder with pulse animation |
| `table.tsx` | Table with Header, Body, Footer, Row, Cell subcomponents |

## For AI Agents

### Working In This Directory
- These are shadcn/ui components — follow their conventions when adding new ones
- Add new primitives via `npx shadcn-ui@latest add <component>` when possible
- Do not modify existing component APIs without checking all consumers
- Prefer using existing primitives over creating custom wrappers elsewhere

### Common Patterns
- All components use `cn()` from `lib/utils.ts` for conditional class merging
- Variants defined via `cva` (class-variance-authority)
- Components use `React.forwardRef` for DOM-exposing elements
- Styling is Tailwind-only — no CSS modules or styled-components

## Dependencies

### External
- Radix UI (underlying accessible primitives)
- class-variance-authority (variant management)
- clsx + tailwind-merge (class utilities via `cn()`)

<!-- MANUAL: -->
