# Design System — OrbitAI

## Product Context
- **What this is:** Personal portfolio tracker with weekly Friday decision ritual
- **Who it's for:** Single investor (the builder), Korean market focus
- **Space/industry:** Personal finance, quant-lite portfolio management
- **Project type:** Web app (dashboard/data-dense), Next.js + FastAPI

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian
- **Decoration level:** Minimal — typography and data do all the work
- **Mood:** Calm surface, depth on demand. A flight deck instrument panel, not a Bloomberg replica. Professional warmth without corporate sterility.
- **Reference sites:** Bloomberg Terminal (concealed complexity), Koyfin (institutional data for individuals), TradingView (interactive exploration)

## Typography
- **Display/Hero:** Instrument Serif — adds human warmth to headlines. The contrast between serif headlines and mono data creates visual tension that says "human judgment + quantitative backing."
- **Body:** Geist — modern utilitarian workhorse. Clean, readable, professional.
- **UI/Labels:** Geist (same as body, 600 weight for labels, 11px uppercase with 0.08em tracking)
- **Data/Tables:** Geist Mono — tabular-nums, perfect alignment in financial data columns
- **Code:** Geist Mono
- **Loading:** Geist via CDN (cdn.jsdelivr.net/npm/geist), Instrument Serif + Geist Mono via Google Fonts
- **Scale:**
  - Hero: 48px / 1.1 line-height / -0.02em tracking
  - H2: 32px / 1.2
  - H3/Section: 13px / uppercase / 0.08em tracking / 600 weight
  - Body: 14px / 1.5
  - Small: 12px / 1.4
  - Data large: 24px mono
  - Data body: 14px mono
  - Badge: 11px mono / uppercase / 0.05em tracking

## Color
- **Approach:** Restrained — color is SIGNAL, not decoration
- **Primary (accent):** #D4A574 (amber/gold) — interactive elements, focus states, active nav. Signals "attention, warmth, craft."
- **Accent hover:** #E0B88A
- **Neutrals:**
  - Background: #0a0e14 (deep navy-black)
  - Surface: #11161d (elevated cards, panels)
  - Surface-alt: #1a2030 (hover, active states)
  - Border: #2a3040 (subtle separation only)
  - Text primary: #e8eaed (high contrast body)
  - Text secondary: #8b95a5 (muted, labels, descriptions)
  - Text tertiary: #5a6577 (disabled, hints, timestamps)
- **Semantic:**
  - Profit/Success: #4ADE80 (green-400)
  - Loss/Error: #F87171 (red-400)
  - Warning: #FBBF24 (amber-400)
  - Info: #60A5FA (blue-400)
- **Dark mode:** This IS dark mode. No light mode planned.
- **Regime badges:**
  - Risk On: #4ADE80 text on #0a2010 bg
  - Risk Off: #FBBF24 text on #2a1a00 bg
  - Neutral: #8b95a5 text on #11161d bg

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — breathable data, not cramped like Bloomberg
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Card padding:** 24px
- **Card gap:** 8px (tight, spacing-based containment)
- **Section gap:** 64px

## Layout
- **Approach:** Hybrid — grid-disciplined for the Friday ritual page, creative for archive comparison
- **Grid:** 2-column for desktop explore zone, single column for mobile
- **Max content width:** 1200px
- **Border radius:** sm:4px (badges), md:6px (inputs, buttons), lg:8px (cards)
- **Cards:** No borders, no shadows. Containment via background color shift (#0a0e14 → #11161d). Hover state: #1a2030.

## Motion
- **Approach:** Minimal-functional — speed = trust
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms)
- **Allowed:** Accordion expansion (drill-down), state transitions (badge changes), fade-in on page load (500ms)
- **Not allowed:** Scroll-driven effects, entrance animations on cards, parallax, decorative motion

## Component Patterns
- **Section titles:** 11px uppercase, 0.1em tracking, accent color, with optional icon
- **Data tables:** Minimal chrome, border-bottom only (1px var(--border)), hover row highlight
- **Expandable rows:** Chevron indicator, accordion expand with 250ms ease-out
- **Badges:** Compact (2px 8px padding), uppercase mono, semantic background tints
- **Buttons:** Primary (amber bg, dark text), Secondary (transparent, border), Ghost (no border)
- **Form inputs:** Dark bg (#0a0e14), subtle border (#2a3040), accent border on focus
- **Confidence slider:** Horizontal track (4px height), accent fill + thumb with glow ring

## Friday Page Hierarchy
1. **Hero strip** — score (large mono) + delta badge + regime badge + signal count + Freeze button (right-aligned)
2. **Two-column explore zone** — Portfolio delta (left, primary) + Macro regime (right, context)
3. **Signals list** — expandable rows with severity badges, not cards
4. **Decision journal** — form section at bottom (type, ticker, note, confidence, invalidation)
5. **Freeze button** — terminal action, after everything

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-03 | Industrial/Utilitarian aesthetic | Matches "cockpit for exploration" identity, function-first |
| 2026-04-03 | Amber/gold accent over neon green | Signals personal craft over tech/crypto/gaming aesthetic |
| 2026-04-03 | Instrument Serif for headlines | Serif + mono contrast = "human judgment + quant backing" |
| 2026-04-03 | No card borders/shadows | Spacing-based containment is calmer, data breathes |
| 2026-04-03 | Geist + Geist Mono | Modern utilitarian stack with native tabular-nums |
| 2026-04-03 | Color = signal only | Green/red for P&L, amber for warnings, blue for info. Never decorative |
