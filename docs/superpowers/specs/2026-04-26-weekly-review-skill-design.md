# Weekly Review Skill — Design Spec
_Portfolio Tracker · 2026-04-26_

## 1. Purpose

A custom Claude Code skill (`/weekly-review`) that guides the user through a structured weekly investment research ritual. Output is a professional-grade weekly operations report (asset manager standard), plus structured DB entries for the Friday Freeze form.

The process serves two purposes simultaneously:
- A learning ritual — the user studies the market while the skill orchestrates research
- An accumulation artifact — each week's judgment adds to a compounding record that improves future analysis

---

## 2. Architecture

### Stable Core vs. Pluggable Edge

| Layer | What it is | Why it's stable |
|---|---|---|
| **Core** | DB schema (Confidence 3 scalars, Invalidation fields, `snapshot.comment`) | Structured meaning survives tool changes |
| **Core** | Report format (Sections 1–6, see §5) | The structure is the contract |
| **Core** | Markdown files (`docs/weekly-reports/`) | Tool-agnostic, git-tracked, MCP-searchable |
| **Edge** | Research tools (Perplexity, Gemini, GPT, DeepResearch) | Swappable — skill treats them as pluggable variables |
| **Edge** | Calibration questions (§7) | Evolved over time as patterns accumulate |
| **Edge** | Claude model version | Skill is model-agnostic markdown |

Upgrading the skill (adding new tools, new calibration questions) never breaks accumulated data because the core schema is unchanged.

### Two-Phase Workflow

```
/weekly-review
       │
       ▼
┌──────────────────────────────────────────┐
│  PHASE 1: INTELLIGENCE BRIEFING          │
│                                          │
│  1. Pull portfolio signals (DB / API)    │
│  2. Run last30days in parallel           │
│  3. Run calibration check (§7)           │
│  4. Generate 5 research prompts (§4)     │
└──────────────────────────────────────────┘
       │
       │  ← User runs prompts in Perplexity / Gemini / DeepResearch
       │  ← Deep research executes (minutes to tens of minutes)
       │  ← User pastes results back into Claude
       │
       ▼
┌──────────────────────────────────────────┐
│  PHASE 2: SYNTHESIS + REPORT             │
│                                          │
│  5. Synthesize internal + external data  │
│  6. Generate weekly operations report    │
│  7. Extract DB-ready structured entries  │
│  8. Prompt user for User Moment comment  │
└──────────────────────────────────────────┘
       │
       ▼
  Friday Dashboard — manual form entry
  docs/weekly-reports/YYYY-MM-DD.md saved
```

---

## 3. Phase 1 — Portfolio Signal Pull

### 3a. Internal signals (always)

Pull via backend API / DB at skill start:
- `GET /api/friday/briefing` — since-last-Friday events (regime transitions, alert history, matured decision outcomes)
- Current composite score (0–100) and component breakdown
- Regime state across 5 macro buckets
- Triggered rules sorted by severity
- Sleeve weights vs. targets (drift detection)
- Trailing-1Y risk metrics: Calmar, Sharpe, MDD, SD, Sortino (portfolio vs. SPY-KRW)

> **Note on snapshot timing:** Do not use the Friday snapshot for current holdings. The snapshot captures last week's closing prices. Query the `daily_prices` table directly for the most recent available prices (from the daily ingest, which runs after US market close Mon–Fri).

### 3b. Parallel Claude research (always)

Run `last30days` in parallel while the user executes external deep research. This provides a baseline that supplements (does not replace) the user's own research.

**Weighting instruction applied to all research inputs:**
> "Treat events from the past 7 days as primary evidence. Events from days 8–30 are contextual background. When short-term and long-term signals conflict, weight short-term more heavily."

---

## 4. Phase 1 — Research Prompt Generation

Five research prompts generated dynamically, each reflecting current portfolio state (sleeve weights, active regime, any triggered rules).

### Prompt A — Global Macro & Risk Regime
**Target tool:** Perplexity  
**Covers:** S&P 500, NDX, global indices, VIX, dollar index, credit spreads, Fed policy, key economic data releases, risk-on/risk-off regime assessment for the week.

### Prompt B — NDX & Growth Regime
**Target tool:** DeepResearch (Gemini or GPT)  
**Covers:** NDX/QQQ position relative to 250-day MA (the primary rule trigger), QQQ momentum and breadth, tech sector catalysts, NDX_1X vs. NDX_2X rotation signal state.

Dynamically adjusted: if NDX sleeve weight deviates >5% from 30% target, prompt B notes current over/underweight and asks for regime-fit assessment.

### Prompt C — Inflation / Rates / Diversifiers
**Target tool:** Gemini  
**Covers:** US Treasury yield curve, real yields, DBMF managed-futures environment (trending vs. choppy week), GLDM/gold drivers (real rates, dollar), ACE_TLT / TLT duration risk.

### Prompt D — EM & Carry (Brazil)
**Target tool:** Perplexity or GPT  
**Covers:** Selic rate, BRL/USD, Brazilian fiscal conditions, EM bond sentiment, carry trade environment for the week.

### Prompt E — Bitcoin & MSTR
**Target tool:** DeepResearch  
**Covers:** BTC price action, on-chain metrics, sentiment, MSTR MNAV premium/discount vs. prior week, crypto-macro correlation state.

---

## 5. Phase 2 — Synthesis

### Structured Paste Protocol

The skill instructs the user to paste results using labeled headers:

```
--- RESEARCH A: GLOBAL MACRO ---
[Perplexity output]

--- RESEARCH B: NDX REGIME ---
[DeepResearch output]

--- RESEARCH C: RATES / DIVERSIFIERS ---
[Gemini output]

--- RESEARCH D: BRAZIL / EM ---
[output]

--- RESEARCH E: BTC / MSTR ---
[output]
```

Section headers preserve per-source context. Claude's 200K context window is sufficient for 5 deep research reports at typical length. No vectorization or Python extraction required.

If the user saves research as files rather than pasting, the skill uses the `Read` tool directly — both paths are supported.

---

## 6. Weekly Operations Report Structure

Saved to `docs/weekly-reports/YYYY-MM-DD.md`. Professional asset manager standard.

```
WEEKLY INVESTMENT REVIEW
Portfolio Tracker — [YYYY-MM-DD]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EXECUTIVE SUMMARY
   3–5 bullet points: key market developments, portfolio stance, primary risk

2. MARKET ENVIRONMENT
   ┌─ Global indices performance table (SPY, NDX, EM, Gold, BTC — weekly %)
   ├─ Macro regime assessment (risk-on / risk-off / transitioning)
   └─ Key event review (Fed, CPI, earnings, geopolitics)

3. PORTFOLIO PERFORMANCE
   ┌─ Weekly / YTD / Since-inception return
   ├─ vs. SPY-KRW: pure return and risk-adjusted (Calmar delta)
   └─ Trailing-1Y: Calmar, Sharpe, MDD, Sortino — portfolio vs. SPY-KRW

4. SLEEVE ANALYSIS
   ┌─ NDX (leverage signal state, algo decision, 250-day MA distance)
   ├─ DBMF (trend-following environment — trending / choppy)
   ├─ MSTR (Z-score, MNAV premium/discount)
   ├─ GLDM (real-yield / dollar correlation this week)
   ├─ BRAZIL_BOND (EM carry environment, BRL impact)
   └─ BONDS/CASH (duration risk, ACE_TLT performance)

5A. AGENT ASSESSMENT  [Claude-generated]
   ┌─ Confidence vs. SPY Risk-Adj:  [1–10] — 2–3 line rationale
   ├─ Confidence vs. Cash:          [1–10] — 2–3 line rationale
   ├─ Confidence vs. SPY Pure:      [1–10] — 2–3 line rationale
   └─ Invalidation: [expected_failure_mode] @ [trigger_threshold] — hypothesis text

5B. USER MOMENT  ✍ Manual entry required
   ┌─────────────────────────────────────────────────────────────────┐
   │  1–2 lines written by the user. Records personal perspective,   │
   │  sentiment, and confidence level in the user's own voice.       │
   │  Labeled "user-authored" in the Intelligence view.              │
   │  This field is never generated by Claude.                       │
   └─────────────────────────────────────────────────────────────────┘

6. WATCHLIST
   Next week: key events, data releases, trigger levels to monitor
```

---

## 7. Self-Development Layer — Calibration Questions

Executed at the end of Phase 1, before prompt generation. Queries past weekly reports and DB to surface patterns for self-critique. These questions are part of the **pluggable edge** — they evolve as data accumulates.

**Week 1–11 (insufficient history):** Questions are skipped or noted as "not yet applicable."

**Week 12+ (active):**

```
CALIBRATION CHECK — run before generating research prompts

1. Pattern consistency
   "In weeks where Confidence vs. SPY Risk-Adj was ≥ 8, what was
   the actual following-month outcome? Is there a calibration bias?"

2. Regime alignment
   "Did last week's regime call (risk-on/off) match the actual
   market outcome? Has there been regime drift recently?"

3. Thesis staleness
   "Is the current invalidation hypothesis still the same one
   from 4+ weeks ago? Has it been stress-tested by market events?"

4. Asset-specific bias
   "Are there assets where Confidence scores are consistently
   high or low regardless of market conditions? (Anchoring risk)"

5. Invalidation tracking
   "Were any trigger thresholds from prior weeks hit this week?
   Were they acted on, or silently passed?"
```

As patterns accumulate, new questions are added to this section. The weekly-reports corpus (§8) provides the data source for these queries.

---

## 8. Data Persistence

### DB entries (per freeze)

| Field | Source | Table |
|---|---|---|
| `confidence_vs_spy_riskadj` | Section 5A | `weekly_decisions` |
| `confidence_vs_cash` | Section 5A | `weekly_decisions` |
| `confidence_vs_spy_pure` | Section 5A | `weekly_decisions` |
| `note` | Section 5A rationale summary (3–4 lines) | `weekly_decisions` |
| `invalidation` | Section 5A | `weekly_decisions` |
| `expected_failure_mode` | Section 5A | `weekly_decisions` |
| `trigger_threshold` | Section 5A | `weekly_decisions` |
| `comment` | Section 5B — **user-authored only** | `weekly_snapshots` |

### File artifacts

- Full report: `docs/weekly-reports/YYYY-MM-DD.md` (one per week, git-tracked)
- Cumulative corpus: `weekly-reports/` directory indexed as a searchable MCP corpus

### weekly-reports/ corpus

Add as a new claude-mem corpus (alongside existing `portfolio-tracker-decisions`). Once active, Phase 1 can query: "What were the dominant themes and Confidence patterns in the last N weeks?" — making each week's research prompts progressively more personalized.

### Conversion (optional, end-of-skill prompt)

```
To convert this report:
  PDF:          /gstack-make-pdf
  Designed HTML: /gstack-design-html
```

---

## 9. Evolution Roadmap

| Stage | Capability | Trigger |
|---|---|---|
| **Baseline** (Week 1) | Phase 1 + Phase 2, no historical context | Skill launched |
| **Pattern detection** (Week 12+) | Calibration questions active, MCP corpus searchable | 12 reports accumulated |
| **Prompt personalization** (Week 26+) | Phase 1 prompts reference prior themes and past Confidence patterns | Corpus sufficiently rich |
| **Intelligence integration** (future) | Intelligence tab surfaces Confidence calibration stats; deviation from historical pattern flagged automatically | New backend endpoint |

The skill file is versioned in git. New capability is added by updating the skill markdown — accumulated DB data and report files remain intact across all versions.
