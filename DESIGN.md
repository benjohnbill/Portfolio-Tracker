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
- **Partial-data handling:** When frozen snapshots are incomplete, render explicit unavailable copy in muted text rather than blank space, zeros, or crashes

## Friday Page Hierarchy
1. **Since Last Friday briefing card** — topmost. Events since last freeze: regime transitions, matured outcomes (1W/1M/3M/6M/1Y horizon crossings), Discord/Telegram alert history, optional snippet of last week's snapshot comment. Severity-grouped, NOT a realtime toast.
2. **Hero strip** — score (large mono) + delta badge + regime badge + signal count + Freeze button (right-aligned)
3. **Sleeve Health panel** — 6 sleeves (NDX / DBMF / BRAZIL / MSTR / GLDM / BONDS-CASH). Each row: `sleeve label | current% / target% | drift bar | signal status | 4-week recency strip`. Drift + signal visible on one row per sleeve.
4. **Two-column explore zone** — Portfolio delta (left, primary) + Macro regime (right, context)
5. **Signals list** — expandable rows with severity badges. Each rule row includes a mini trust indicator ("followed N× / override M×; outcome Y%").
6. **Decision journal** — form section. Fields: type dropdown, ticker, note (existing required text), **3-scalar confidence** (3 sliders 1–10 with anchor labels — see Component Patterns), **structured invalidation** (failure_mode enum dropdown + trigger_threshold numeric + free text).
7. **Prior Invalidation retrieval card** — shown after the user fills invalidation (NOT before confidence — bias-avoidant per Codex challenge). Surfaces past invalidation hypotheses from adjacent setups (same regime + asset class, not strict ticker match) with realized outcomes.
8. **Weekly snapshot comment** — optional 1–2 line textarea, collapsed by default ("💬 이번 주 코멘트 (선택)"). Empty input stores NULL.
9. **Freeze button** — terminal atomic contract. Locks together: world state, 3-scalar confidence, structured invalidation, ritual-consistency stamp (green/amber/red per on-time), 3M auto-review schedule, trailing-1Y risk metrics JSON, weekly snapshot comment.

## Intelligence Page Hierarchy

The intelligence pages show patterns across months, not this week's decision. Visual language: research notebook, not real-time dashboard.

### /intelligence (Dashboard)
1. **Hero strip** — Instrument Serif "Intelligence" + data coverage badge ("32 weeks analyzed")
2. **3-stat row** — Rule accuracy %, avg score trend, regime stability (Geist Mono, 24px)
3. **Contribution heatmap** — Full-width, 52-week calendar grid. Cell: 12x12px, gap: 2px. Color: opacity-scaled amber (#D4A574 at 20%-100%). Empty weeks: subtle border, no fill. Partial: diagonal stripe.
4. **Recent decisions timeline** — Vertical list, most recent first. Each card: type + ticker + confidence + outcome badge.
5. **Navigation links** — to /friday (ritual) + /archive (history)

### /intelligence/attributions (Score Decomposition)
1. **Hero** — "Score Attribution" + period selector (3M / 6M / 1Y / All)
2. **Stacked area chart** — Full-width Recharts AreaChart. Fit: #60A5FA (blue-400, opacity 0.3), Alignment: #D4A574 (amber, opacity 0.3), Posture: #4ADE80 (green-400, opacity 0.3). Y-axis: 0-100.
3. **Bucket breakdown table** — Columns: Bucket | This week | 4-week avg | Best | Worst. Geist Mono. Sort by variance.
4. **Regime overlay toggle** — Vertical markers on chart at regime transitions.

### /intelligence/outcomes (Decision Evaluation)
1. **Hero** — "Decision Outcomes" + horizon toggle (1M / 3M / 6M / 1Y)
2. **Decision cards** — Vertical list. Expandable: portfolio delta %, score delta, regime change, asset price change.
3. **Summary stats** — Decisions followed %, avg outcome followed vs ignored.
4. **Empty state** (< 4 weeks) — "Decisions need time. Your first outcomes will appear in [X] weeks."

### /intelligence/rules (Rule Performance)
1. **Hero** — "Rule Accuracy" + all-time stats
2. **Rule table** — Full-width. Columns: Rule | Fired | Followed | Ignored | Outcome (F) | Outcome (I) | Accuracy. Rules with < 3 data points: "(limited data)" badge.
3. **Expandable detail** — Last 5 instances per rule with decision + outcome.

### /intelligence (root additions — 2026-04-19)

- **Regime Ribbon + Decisions (B1)** — horizontal 52-week ribbon: 5 buckets × Supportive/Neutral/Adverse coloring with frozen decisions as dots. Click a segment → filter to decisions in that regime. Hover on a week → weekly snapshot comment tooltip if present. The primary historical-material index surface for Friday workflow.
- **Quadrant Calibration (B2)** — 3 faceted scatter plots (one per confidence scalar × corresponding outcome delta) + 1 Ordering Deviation time series showing how often/where `#1 ≥ #2 ≥ #3` holds vs reverses. Point color = realized outcome (green/red/pending).
- **Calmar Trajectory + Decision Annotations (B4)** — trailing-1Y line of `Calmar(Portfolio) − Calmar(SPY-KRW)`. Y=0 line is the sophistication threshold. Each frozen decision rendered as a marker; marker click surfaces the decision's contribution estimate + its weekly comment at variance inflection points.
- **Error Signature Detector (B7)** — clusters past invalidations by `expected_failure_mode`. When N ≥ 3 same-mode invalidations exist, surfaces a pattern card with common context (regime / asset class / sleeve). Draws on weekly snapshot comments for narrative context.
- **Ritual-Consistency Strip (A6)** — 8-dot header strip. Each dot = past 8 weeks' on-time freeze + field-completion status (green = on-time + complete, amber = late or partial, red = skipped). Process-completion signal, not outcome.

### /intelligence/risk-adjusted (new page — B5)

1. **Hero** — "Risk-Adjusted Performance" + horizon toggle (trailing 3M / 6M / 1Y / All)
2. **Scorecard table** — columns: Metric | My Portfolio | SPY (KRW) | Delta. Rows: CAGR, MDD, SD (annualized), Sharpe, **Calmar (headline)**, Sortino. Geist Mono alignment. Positive deltas in green, negative in red.
3. **Calmar mini-sparkline** — small trailing-52-week line of Calmar delta. Anchor to goal metric.
4. **Notes** — for each metric below 26 weeks of data: "(insufficient history)" badge.

### /intelligence/rules extensions (B3)

Add below the existing Rule table:

1. **Trust Calibration Audit grid** — per-rule × per-regime cells. Each cell shows `n` (sample count) and `outcome delta (followed) − outcome delta (override)`. Cells with `n < 5` render "insufficient data" badge, no color. Cells with sufficient support: green if following adds alpha, red if overrides add alpha.
2. **Drift secondary tab** — calibration slope early-12-week window vs recent-12-week window. Flag if slope has flattened (overconfidence drift) or steepened (caution drift). 24+ weeks gated.

### /intelligence/outcomes extensions (B6)

Add to existing outcome cards:

1. **Invalidation Auto-Review card** — auto-generated at 3M post-freeze. Contains: the frozen invalidation text + `expected_failure_mode` + `trigger_threshold`; system-detected verdict (threshold HIT / MISSED / UNCOMPUTABLE); realized outcome delta and SPY-KRW comparison; user rating form [Yes / No / Partial / N/A]. After rating, the result flows into a lifetime "invalidation accuracy" stat on `/intelligence`.

### Archive card layout (extended — 2026-04-19)

When `weekly_snapshots.comment` is non-empty, render it prominently at the top of each archive card (above score / regime / decisions) as a short italic quote. Makes 52-week scrolling human-navigable by observation, not only by numbers.

### Intelligence Component Patterns
- **Contribution heatmap:** CSS Grid, 52 cols. Amber opacity scale (20%-100% based on score). Hover tooltip with score breakdown.
- **Outcome badge:** 11px mono uppercase. Positive: #4ADE80 on #0a2010. Negative: #F87171 on #200a0a. Pending: #8b95a5 on #11161d.
- **Horizon toggle:** Button group matching existing period selectors on /portfolio page.
- **"Insufficient data" state:** Muted text (#5a6577) + progress indicator showing weeks until threshold (12 weeks for importance, 4 weeks for basic outcomes).

### Intelligence Data-Density States
| State | Treatment |
|-------|-----------|
| Loading | Skeleton pulse: 52x1 grid of skeleton cells for heatmap, skeleton rows for tables |
| < 4 weeks | "Getting started" card with progress bar toward first threshold |
| 4-12 weeks | Show data with "(early data)" badge on statistical claims |
| 12+ weeks | Full intelligence view, no caveats |
| Error | Per-section error badge: "Attribution data unavailable" (matching Friday pattern) |

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-03 | Industrial/Utilitarian aesthetic | Matches "cockpit for exploration" identity, function-first |
| 2026-04-03 | Amber/gold accent over neon green | Signals personal craft over tech/crypto/gaming aesthetic |
| 2026-04-03 | Instrument Serif for headlines | Serif + mono contrast = "human judgment + quant backing" |
| 2026-04-03 | No card borders/shadows | Spacing-based containment is calmer, data breathes |
| 2026-04-03 | Geist + Geist Mono | Modern utilitarian stack with native tabular-nums |
| 2026-04-03 | Color = signal only | Green/red for P&L, amber for warnings, blue for info. Never decorative |
| 2026-04-04 | Partial snapshot compare uses explicit unavailable placeholders | Preserve archive stability and honesty when frozen snapshot coverage is incomplete |
| 2026-04-08 | Intelligence pages use full-width layouts for time-series charts | Wider than Friday's 2-column. 52+ week data needs room to breathe |
| 2026-04-08 | Attribution uses muted color palette (opacity-scaled amber, desaturated blues) | Prevents visual noise on data-dense pages. Green/red reserved for outcome deltas only |
| 2026-04-08 | 4-tier data-density states for intelligence pages | < 4 weeks → getting started, 4-12 → early data badges, 12+ → full view. Honest about data maturity |
| 2026-04-19 | Bell icon removed → replaced by "Since Last Friday" briefing card on `/friday` top | Bell is notification-era daily-app UI. Briefing card is accumulated ledger with severity hierarchy. Matches weekly ritual cadence. |
| 2026-04-19 | SPY-KRW retained as goal benchmark; peer-composition framing rejected | Benchmark = what we want to exceed (risk-adjusted), not composition match. Portfolio designed for Calmar/MDD dominance over SPY-KRW. |
| 2026-04-19 | Single confidence slider → 3-scalar stack | (1) `vs_spy_riskadj` (primary), (2) `vs_cash` (baseline), (3) `vs_spy_pure` (stretch). Expected ordering #1 ≥ #2 ≥ #3. Ordering deviation is itself a signal. |
| 2026-04-19 | Invalidation field extended with structured entry | Adds `expected_failure_mode` enum (price_drop / regime_shift / correlation_breakdown / liquidity_crunch / other) + `trigger_threshold` numeric. Enables 3M auto-detect vs retrofitting. |
| 2026-04-19 | Weekly Snapshot Comment added (optional, per-freeze, 1–2 lines) | `weekly_snapshots.comment` TEXT NULL. Distinct from per-decision `note`. Indexes archive navigation and supplies narrative context on intelligence surfaces. |
| 2026-04-19 | Ritual-Consistency Strip (8-dot header) permitted as process-completion signal | On-time freeze + fields-complete per week (green/amber/red). Measures discipline, not outcome. Outcome-streak gamification remains prohibited. |
| 2026-04-19 | Sleeve Health panel consolidates 6 sleeves with 4-week drift/signal recency | NDX / DBMF / BRAZIL / MSTR / GLDM / BONDS-CASH. Replaces scattered Target Drift + Triggered Rules fragments for sleeve-level view on `/friday`. |
| 2026-04-19 | `/intelligence/risk-adjusted` new Scorecard page added | Portfolio vs SPY-KRW: CAGR / MDD / SD / Sharpe / Calmar / Sortino. Calmar is headline metric — quantifies "덜 아프게 시장 능가" goal. |
