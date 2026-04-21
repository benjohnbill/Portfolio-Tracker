# Accumulation-as-Hero Documentation + Discord Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Record accumulation-as-hero design decisions from a multi-phase conversation into 4 project documentation files (α CLAUDE.md / β DESIGN.md / γ TODOS.md / δ PRODUCT.md), then git-commit the already-implemented Discord webhook integration in two separate commits.

**Architecture:** Two sequential tracks. Track A (Tasks 1–4): markdown doc edits. Track B (Task 5): docs commit, then Discord commit. No feature implementation in this plan — Phase D shipping happens per TODOS.md in later PRs.

**Tech Stack:** Markdown, git.

---

## File Structure

**Files modified in this plan:**
- `CLAUDE.md` — append Review Principles section
- `DESIGN.md` — 8 Decisions Log rows + Friday Page Hierarchy update + Intelligence Page Hierarchy extensions + Archive layout note
- `TODOS.md` — append Phase D — Accumulation-as-Hero section
- `PRODUCT.md` — update §3 Core Loop, §8 Non-Goals, add new §9

**Files committed (no edits here, commit only):**
- `backend/app/services/discord_notifier.py` (new, ~97 lines)
- `backend/tests/test_discord_notifier.py` (new, ~182 lines)
- `backend/app/services/notification_service.py` (modified)
- `backend/app/main.py` (modified)
- `backend/.env.example` (modified)

---

## Task 1: α — CLAUDE.md: Append Review Principles section

**Files:**
- Modify: `/home/lg/dev/Portfolio_Tracker/CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md**
  Use Read tool. Confirm file ends with the Current Contract Notes bullets.

- [ ] **Step 2: Append Review Principles via Edit tool**
  Use Edit with `old_string` = the last existing bullet of Current Contract Notes, `new_string` = that bullet + the block below.

  Block to append (after last existing line):

  ~~~
  ## Review Principles (for evaluating external design/product feedback)

  When external reviewers (Claude Design, Codex, human consults) propose UI or product changes, apply these 5 axes before accepting:

  1. **North-star fit (N1–N8)** — see PRODUCT.md §9 (Accumulation-as-Hero) for N8; see §8 (Non-Goals) for N3 boundary.
  2. **Data model support** — data exists / schema add required / data absent.
  3. **Maturity gate** — ship now / N weeks of data needed first.
  4. **Internal consistency** — does the proposal contradict its own stated thesis?
  5. **Accumulation leverage (N8)** — does each freeze add to this feature's value, or is it a static surface?

  ### Rejected / redirected patterns

  - **Streak / mood-ring / gamification** — daily-app reward loops incompatible with weekly ritual. Ritual-consistency strip (process-completion signal, green/amber/red per on-time freeze + fields filled) is permitted; outcome-streak is not.
  - **Action execution routing UI** — rejected by N3. PRODUCT.md §8: "The system does not execute trades." Slippage logs (post-facto recording) are records, not routing.
  - **Confidence as standalone stat** — forbidden. Always cross-tab with outcome; never display as a lone number.
  - **Peer-composition benchmark framing** — SPY-KRW is goal benchmark (what we want to exceed on risk-adjusted basis), not peer composition match. Lazy 60/40-style peer benchmarks rejected.
  - **Annual auto-generated synthesis** — hindsight laundering risk. Semi-auto only (raw stats automated, interpretation remains user-authored).

  ### Weekly-loop semantic contracts

  - **Freeze is an atomic contract, not a save.** Locks together: world state (frozen_report JSONB), 3-scalar confidence, structured invalidation, ritual-consistency stamp, 3M auto-review schedule, trailing-1Y risk metrics, optional weekly snapshot comment.
  - **3-scalar confidence** at freeze time: (1) `vs_spy_riskadj`, (2) `vs_cash`, (3) `vs_spy_pure`. Expected ordering per portfolio design intent: #1 ≥ #2 ≥ #3. Ordering deviation is itself a signal.
  - **Structured invalidation**: `expected_failure_mode` enum + `trigger_threshold` numeric + free text. System auto-checks threshold at 3M to prevent hindsight rewriting.
  ~~~

- [ ] **Step 3: Verify** — Read modified file, confirm section appended at end.
- [ ] **Step 4: No commit** — batched in Task 5.

---

## Task 2: β — DESIGN.md: Decisions Log + Friday + Intelligence + Archive

**Files:**
- Modify: `/home/lg/dev/Portfolio_Tracker/DESIGN.md`

- [ ] **Step 1: Read current DESIGN.md** — locate Decisions Log table end (~line 149), Friday Page Hierarchy (~line 87), Intelligence Page Hierarchy subsections (~line 94–135).

- [ ] **Step 2: Append 8 rows to Decisions Log**
  Edit: `old_string` = last existing row (2026-04-08 "4-tier data-density states..."), `new_string` = that row + 8 new rows.

  Rows to append:

  ~~~
  | 2026-04-19 | Bell icon removed → replaced by "Since Last Friday" briefing card on `/friday` top | Bell is notification-era daily-app UI. Briefing card is accumulated ledger with severity hierarchy. Matches weekly ritual cadence. |
  | 2026-04-19 | SPY-KRW retained as goal benchmark; peer-composition framing rejected | Benchmark = what we want to exceed (risk-adjusted), not composition match. Portfolio designed for Calmar/MDD dominance over SPY-KRW. |
  | 2026-04-19 | Single confidence slider → 3-scalar stack | (1) `vs_spy_riskadj` (primary), (2) `vs_cash` (baseline), (3) `vs_spy_pure` (stretch). Expected ordering #1 ≥ #2 ≥ #3. Ordering deviation is itself a signal. |
  | 2026-04-19 | Invalidation field extended with structured entry | Adds `expected_failure_mode` enum (price_drop / regime_shift / correlation_breakdown / liquidity_crunch / other) + `trigger_threshold` numeric. Enables 3M auto-detect vs retrofitting. |
  | 2026-04-19 | Weekly Snapshot Comment added (optional, per-freeze, 1–2 lines) | `weekly_snapshots.comment` TEXT NULL. Distinct from per-decision `note`. Indexes archive navigation and supplies narrative context on intelligence surfaces. |
  | 2026-04-19 | Ritual-Consistency Strip (8-dot header) permitted as process-completion signal | On-time freeze + fields-complete per week (green/amber/red). Measures discipline, not outcome. Outcome-streak gamification remains prohibited. |
  | 2026-04-19 | Sleeve Health panel consolidates 6 sleeves with 4-week drift/signal recency | NDX / DBMF / BRAZIL / MSTR / GLDM / BONDS-CASH. Replaces scattered Target Drift + Triggered Rules fragments for sleeve-level view on `/friday`. |
  | 2026-04-19 | `/intelligence/risk-adjusted` new Scorecard page added | Portfolio vs SPY-KRW: CAGR / MDD / SD / Sharpe / Calmar / Sortino. Calmar is headline metric — quantifies "덜 아프게 시장 능가" goal. |
  ~~~

- [ ] **Step 3: Replace Friday Page Hierarchy section**
  Edit: `old_string` = entire current `## Friday Page Hierarchy` block (5 numbered items), `new_string` = updated 9-item version:

  ~~~
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
  ~~~

- [ ] **Step 4: Insert Intelligence Page Hierarchy additions**
  Edit: `old_string` = the line `### Intelligence Component Patterns`, `new_string` = new subsections prepended + the existing `### Intelligence Component Patterns` line.

  Block to insert BEFORE `### Intelligence Component Patterns`:

  ~~~
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

  ~~~

- [ ] **Step 5: Verify** — Read modified file, confirm Decisions Log has 8 new 2026-04-19 rows, Friday Hierarchy has 9 items, Intelligence Hierarchy has new subsections.

- [ ] **Step 6: No commit** — batched in Task 5.

---

## Task 3: γ — TODOS.md: Append Phase D section

**Files:**
- Modify: `/home/lg/dev/Portfolio_Tracker/TODOS.md`

- [ ] **Step 1: Read current TODOS.md** — confirm it ends with "Real-World Lifecycle System Connection" deferred item.

- [ ] **Step 2: Append Phase D section**
  Edit: `old_string` = the final line of the file (`**Note:** User explicitly stated this is a someday-maybe item, not a near-term priority.`), `new_string` = that line + the block below.

  Block to append:

  ~~~
  ---

  ## Phase D — Accumulation-as-Hero

  **Priority:** High
  **Added:** 2026-04-19 (multi-phase design-evolution conversation: Phase 1 codebase verification → Phase 2 external reviewer 5-axis evaluation → Phase 2.5 N8 gap generation → Phase 3 integrated roadmap. Codex challenge consulted twice.)

  Full rationale: `CLAUDE.md#Review-Principles`, `DESIGN.md#Decisions-Log`, `PRODUCT.md#9-Accumulation-as-Hero`.

  ### Schema migrations required

  - `weekly_decisions`:
    - Rename existing `confidence` → `confidence_vs_spy_riskadj` (migrate values as-is; historical confidence values reinterpret as the primary risk-adjusted scalar per portfolio design intent).
    - Add `confidence_vs_cash` INT NULL.
    - Add `confidence_vs_spy_pure` INT NULL.
    - Add `expected_failure_mode` VARCHAR NULL (enum coerced in app layer: price_drop / regime_shift / correlation_breakdown / liquidity_crunch / other).
    - Add `trigger_threshold` NUMERIC NULL.
  - `weekly_snapshots`:
    - Add `comment` TEXT NULL.
    - Add `risk_metrics` JSONB NULL (trailing-1Y portfolio + SPY-KRW snapshot at freeze time).
    - Add `ritual_consistency_state` VARCHAR NULL (enum: on_time / late / missed, computed at freeze insert).
  - `decision_outcomes`:
    - Add `outcome_delta_vs_spy_pure` NUMERIC NULL (per-horizon).
    - Add `outcome_delta_calmar_vs_spy` NUMERIC NULL (per-horizon).
  - New table `execution_slippage` (C1 dependency):
    - `id` PK, `decision_id` FK → `weekly_decisions`, `executed_at` DATE NULL, `executed_price` NUMERIC NULL, `executed_qty` NUMERIC NULL, `notes` TEXT NULL.

  ### Tier 1 — ship next

  - [ ] **A1: Since Last Friday briefing card** — `/friday` top. Events since last freeze (regime transitions, matured outcomes, Discord/Telegram alert history, optional last-snapshot-comment snippet). Existing data. Maturity: 2 weeks+.
  - [ ] **A2: Sleeve Health panel** — 6 sleeves × (current vs target % / drift bar / signal status / 4-week recency strip). Existing data. Maturity: 4 weeks+.
  - [ ] **A3: 3-scalar Confidence** — UI + schema. 3 stacked sliders in freeze form with anchor labels. Schema migration per above. Subtle ordering-deviation hint (flag if `#1 < #2` or `#2 < #3`, not a warning — observation).
  - [ ] **A4: Structured Invalidation** — UI + schema. `failure_mode` dropdown + `trigger_threshold` numeric + existing free-text `invalidation`. Schema migration per above.
  - [ ] **A5: Prior Invalidation Retrieval card** — shown AFTER confidence + invalidation input (bias-avoidant per Codex). Retrieval key = `regime + asset_class`, not strict ticker. Existing data. Maturity: 4 weeks+.
  - [ ] **A7: Weekly Snapshot Comment** — optional 1–2 line textarea in freeze form, collapsed by default. Schema: `weekly_snapshots.comment` TEXT NULL. Discord briefing echoes the latest non-empty comment in next week's message. Maturity: immediate.
  - [ ] **R1: Remove Bell icon** — edit `frontend/src/app/layout.tsx:27-29`. No in-app notification system; alerts flow via Discord (primary) and Telegram (fallback) per env config.
  - [ ] **B2: Quadrant Calibration plots** — 3 faceted scatter (per confidence scalar × matching outcome delta) + 1 Ordering Deviation time series. Depends on A3 + new outcome_delta columns. Maturity: 12 weeks+.
  - [ ] **B3: Trust Calibration Audit** — grid on `/intelligence/rules`. Minimum-support `n ≥ 5` gating. Drift secondary tab (24+ weeks gated). Existing data + new compute logic. Maturity: 12 weeks+ per rule.
  - [ ] **B5: Risk-Adjusted Scorecard** — new page `/intelligence/risk-adjusted`. 6 metrics vs SPY-KRW; Calmar headline. Maturity: 26 weeks+.
  - [ ] **B6: Invalidation Auto-Review cards** — in `/intelligence/outcomes`. 3M post-freeze generation with system threshold auto-detection + user rating form. Data reuses existing tables. Maturity: 3M after first freeze.
  - [ ] **Discord briefing echo** — extend cron notification: when a snapshot has a non-empty comment, include it in the next week's "Since Last Friday" Discord message. Touches `notification_service.py` + `discord_notifier.py`.

  ### Tier 2 — ship after Tier 1 stabilizes

  - [ ] **A6: Ritual-Consistency Strip** — header 8-dot. Past week's on-time freeze + field-completion. Process signal, not outcome. Existing data + `ritual_consistency_state` computation. Maturity: 8 weeks+.
  - [ ] **B1: Regime Ribbon + embedded decisions** — `/intelligence` top. Primary historical index. Hover → weekly comment tooltip. Existing data. Maturity: 8 weeks+.
  - [ ] **B4: Calmar Trajectory + Decision Annotations** — trailing-1Y `Calmar(Portfolio) − Calmar(SPY-KRW)` line with decision markers. Depends on `risk_metrics` JSONB + `benchmark_service.py`. Maturity: 52 weeks+.
  - [ ] **B7: Error Signature Detector** — clusters past invalidations by `failure_mode`. Surfaces pattern card when N ≥ 3 same-mode. Data: A4 accumulation. Maturity: 12 weeks+.
  - [ ] **C1: Slippage Log** — optional post-freeze recording. New `execution_slippage` table. N3 preservation: records only, not routing. Maturity: 4 weeks+.

  ### Tier 3

  - [ ] **B8: Archetype Compression Layer** — compact widget on top of B1 ribbon. Initial grouping = `decision_type × regime` (no outcome-based clustering to avoid hindsight). Maturity: 12 weeks+.

  ### Deferred (prerequisite required)

  - [ ] **D1: Counterfactual Portfolio Path** — rule-follow-always parallel path with override-point divergence markers. Requires counterfactual simulation engine. Subsumes the originally-proposed "Rule Ghost line." Maturity: Phase D Late.

  ### Backlog

  - **E1: Annual Synthesis Contract** — semi-automated yearly review (raw stats auto, interpretation manual, immutable storage). Revisit after 12 months of Tier 1 + 2 data to verify underlying insights stick before committing to a synthesis format.

  ### New backend services / modules

  - `services/benchmark_service.py` — SPY daily KRW-converted price series (SPY × USD/KRW time series).
  - `services/risk_adjusted_service.py` — compute trailing-1Y CAGR / MDD / SD / Sharpe / Calmar / Sortino for portfolio + SPY-KRW.
  - `services/outcome_evaluator.py` — extend with SPY-KRW comparison horizons and Calmar delta at each horizon maturation.
  - `services/intelligence_service.py` — add endpoints: Trust Calibration (n-gated), Quadrant Calibration (incl. ordering deviation), Regime Ribbon, Calmar Trajectory, Error Signature, Risk-Adjusted Scorecard, Invalidation Auto-Review.

  ### New frontend routes / components

  - `/intelligence/risk-adjusted` — Scorecard (B5).
  - `/intelligence/outcomes` — extended with Invalidation Auto-Review cards (B6).
  - `/intelligence/rules` — extended with Trust Calibration Audit + drift tab (B3).
  - `/intelligence` (root) — Regime Ribbon (B1) + Quadrant Calibration (B2) + Calmar Trajectory (B4) + Error Signature Detector (B7) + Ritual-Consistency Strip (A6).
  - `/friday` — Since Last Friday card (A1), Sleeve Health panel (A2), 3-scalar sliders (A3), structured invalidation (A4), Prior Invalidation retrieval (A5), Weekly snapshot comment (A7).
  - `/archive` — card layout updated with prominent snapshot comment.
  - Header — remove Bell (R1), add Ritual-Consistency Strip (A6).

  **Design doc references:** `DESIGN.md#Friday-Page-Hierarchy`, `DESIGN.md#Intelligence-Page-Hierarchy`, `DESIGN.md#Decisions-Log`.
  ~~~

- [ ] **Step 3: Verify** — Read modified TODOS.md, confirm Phase D appended cleanly with `---` separator.
- [ ] **Step 4: No commit** — batched in Task 5.

---

## Task 4: δ — PRODUCT.md: Update §3 + §8, add §9

**Files:**
- Modify: `/home/lg/dev/Portfolio_Tracker/PRODUCT.md`

- [ ] **Step 1: Read current PRODUCT.md** — confirm §3 (Core Loop), §8 (Non-Goals), no §9 yet.

- [ ] **Step 2: Replace §3 Core Loop with updated version**
  Edit: `old_string` = entire current §3 from `## 3. Core Loop` through the end of the Record paragraph. `new_string` = updated §3:

  ~~~
  ## 3. Core Loop

  **Daily (automated):**
  GitHub Actions cron (Mon–Fri at 21:00 UTC / 06:00 KST) triggers `POST /api/cron/update-signals`. The endpoint runs a six-step pipeline: ingest raw prices, generate portfolio snapshots, update VXN history, seed MSTR corporate actions, generate the weekly report (optionally with an LLM summary), and send Discord + Telegram notifications (see §9 for alert policy).

  **Weekly (human) — Friday ritual:**
  Open `/friday`. Review the Since Last Friday briefing card (events since the prior freeze: regime transitions, matured decision outcomes, alert history). Read the composite score (0–100). Review triggered rules sorted by severity, each annotated with a mini-indicator of your own past follow/override outcomes. Check the 6-sleeve Health panel (drift + signal + 4-week recency). Check the macro regime state across five buckets. Decide.

  **Decision journal at freeze time:**
  For each decision record type, ticker, free-text rationale (`note`), plus three confidence scalars:

  1. `confidence_vs_spy_riskadj` (1–10) — probability that over the 3M horizon the portfolio beats SPY-KRW on a risk-adjusted basis (primary goal per portfolio design intent).
  2. `confidence_vs_cash` (1–10) — probability that the portfolio posts a positive return over 3M (baseline).
  3. `confidence_vs_spy_pure` (1–10) — probability that the portfolio beats SPY-KRW on pure 3M return (stretch).

  Expected ordering per portfolio design intent: `#1 ≥ #2 ≥ #3`. Ordering deviation (e.g., `#3 > #1`) is itself a signal recorded for later calibration analysis.

  Also record a structured invalidation hypothesis: `expected_failure_mode` enum + `trigger_threshold` numeric + free-text reason. Optionally attach a weekly snapshot comment (1–2 lines, per-freeze observation, distinct from per-decision `note`).

  **Freeze (the weekly contract):**
  Freeze is not a save. It is an atomic self-contract — see §9 for the full list of items locked together at freeze time.

  **Action (outside the app):**
  Hold, rebalance, or execute a specific rotation based on the recommendation stance. The system does not execute trades (see §8).

  **Record (optional post-facto):**
  Log executed transactions through the AddAssetModal, which auto-fetches prices and classifies the asset into the correct account silo. Optionally log execution slippage (the gap between the frozen decision and actual execution in timing or price) to the per-decision slippage log — records only, not routing.
  ~~~

- [ ] **Step 3: Append gamification exclusion to §8 Non-Goals**
  Edit: `old_string` = the last existing bullet of §8 (`- **Not ML-powered.** ...`), `new_string` = that bullet + the new bullet below:

  New bullet to append:

  ~~~
  - **Not a gamification app.** No outcome streaks, reward loops, or mood indicators based on decision performance. The ritual-consistency strip (process-completion signal: on-time freeze + fields-complete) is permitted because it measures discipline, not outcome.
  ~~~

- [ ] **Step 4: Append new §9 Accumulation-as-Hero**
  Edit: `old_string` = last line of file (after §8 update), `new_string` = that line + §9 block.

  Block to append:

  ~~~
  ## 9. Accumulation-as-Hero

  The product is a compounding self-knowledge artifact. Every Friday freeze is not only a record of the week's state but an input that increases the quality of all downstream analysis. Week 52 is not "week 1 buried under 51 entries"; week 52's archive, intelligence views, and decision retrieval are meaningfully richer than they were at week 1.

  ### Six accumulation axes

  1. **Archived history** — 52+ frozen weeks searchable via the regime ribbon, archive, and quadrant calibration surfaces.
  2. **Compression** — recurring patterns (decision archetypes, regime-specific batting averages, error signatures) automatically surface from raw history into compact tiles.
  3. **Trust calibration** — across rules and regimes, the user learns (with statistical backing) when to trust the system's recommendation and when to override.
  4. **Counterfactual accumulation** (Phase D Late) — "what would have happened if I had followed the rules consistently" traced as a parallel portfolio path, with each override annotated.
  5. **Error-memory accumulation** — recurring mistake signatures named and surfaced (e.g., "`correlation_breakdown` hit 4 times in BR-GLDM context during Inflation-Adverse regime").
  6. **Decision-latency accumulation** — process discipline measured via on-time freeze + field-completion; stacked weeks reveal whether the ritual is growing sharper or eroding.

  ### Freeze as weekly contract

  At freeze time the following are locked together atomically:

  1. **World state** (immutable `frozen_report` JSONB copy of the generated weekly report).
  2. **3-scalar confidence** (`vs_spy_riskadj` / `vs_cash` / `vs_spy_pure`, see §3).
  3. **Structured invalidation** (`expected_failure_mode` enum + `trigger_threshold` numeric + free-text hypothesis).
  4. **Optional weekly snapshot comment** (1–2 line per-freeze observation).
  5. **Ritual-consistency stamp** (green / amber / red per on-time freeze + field-completion).
  6. **3M auto-review schedule** — at T+3 months the system tests the invalidation threshold and prompts the user to rate the hypothesis realization (Yes/No/Partial/NA).
  7. **Trailing-1Y risk metrics snapshot** (portfolio + SPY-KRW: CAGR / MDD / SD / Sharpe / Calmar / Sortino).

  ### Benchmark framing

  SPY-KRW is the goal benchmark — the reference the portfolio is designed to exceed on a risk-adjusted basis (primarily Calmar, secondarily Sharpe / MDD). It is not a peer composition match; the portfolio's deliberate multi-sleeve allocation (NDX / DBMF / BRAZIL / MSTR / GLDM / BONDS-CASH) is the means to achieve risk-adjusted dominance over SPY-KRW, not to replicate its composition.

  The single-number expression of this goal is the Calmar delta: `Calmar(Portfolio) − Calmar(SPY-KRW)` on a trailing-1Y basis. Sustained positive Calmar delta confirms portfolio design intent; persistent negative delta indicates the sophistication is not earning its keep.

  ### Alert policy

  Daily cron alerts (success / failure / regime shifts) flow via **Discord** (primary, webhook-based) and **Telegram** (optional, retained for fallback). The weekly cron additionally echoes the latest non-empty `weekly_snapshots.comment` in the "Since Last Friday" Discord message, closing the user-to-self hand-off loop across weeks. In-app Bell-style notification icons are removed; the `/friday` Since Last Friday briefing card is the accumulated in-app ledger of between-freeze events.
  ~~~

- [ ] **Step 5: Verify** — Read modified PRODUCT.md, confirm §3 rewritten, §8 has new bullet, §9 appended.
- [ ] **Step 6: No commit** — batched in Task 5.

---

## Task 5: Git commits — docs first, Discord second

**Files (commit 1 — docs):**
- `CLAUDE.md`, `DESIGN.md`, `TODOS.md`, `PRODUCT.md`

**Files (commit 2 — Discord):**
- `backend/app/services/discord_notifier.py` (new)
- `backend/tests/test_discord_notifier.py` (new)
- `backend/app/services/notification_service.py` (modified)
- `backend/app/main.py` (modified)
- `backend/.env.example` (modified)

- [ ] **Step 1: Verify working tree**
  Run: `git status --short`
  Expected: `M CLAUDE.md`, `M DESIGN.md`, `M TODOS.md`, `M PRODUCT.md`, plus Discord files (3 modified + 2 new under `backend/`). Untracked files from initial session state (e.g., `.agent/`, `.codex`, `backend/data/manual_qa.db`, root-level screenshots) should NOT be staged by this task.

- [ ] **Step 2: Stage only the 4 docs**
  Run: `git add CLAUDE.md DESIGN.md TODOS.md PRODUCT.md`

- [ ] **Step 3: Verify staged diff**
  Run: `git diff --cached --stat` — expect 4 files listed.

- [ ] **Step 4: Commit docs**
  Run (single command via HEREDOC to preserve newlines):

  ~~~
  git commit -m "$(cat <<'EOF'
  docs: record accumulation-as-hero roadmap across CLAUDE.md / DESIGN.md / TODOS.md / PRODUCT.md

  Encodes decisions from a multi-phase design-evolution conversation:
  Phase 1 (codebase verification) -> Phase 2 (external reviewer
  evaluation on 5 axes) -> Phase 2.5 (gap generation targeting N8
  Accumulation-as-Hero) -> Phase 3 (integrated roadmap). Codex
  challenge consulted twice for independent review.

  CLAUDE.md: adds Review Principles section with 5-axis evaluation
  frame + list of rejected patterns (streak gamification, action
  execution UI, peer-composition benchmark framing, standalone
  confidence display, fully-automated annual synthesis).

  DESIGN.md: adds 8 new Decisions Log entries for 2026-04-19.
  Updates Friday Page Hierarchy with Since Last Friday briefing,
  Sleeve Health panel, 3-scalar confidence, structured invalidation,
  prior invalidation retrieval, weekly snapshot comment. Extends
  Intelligence Page Hierarchy with Risk-Adjusted Scorecard,
  Regime Ribbon, Quadrant Calibration, Trust Calibration Audit,
  Calmar Trajectory, Invalidation Auto-Review, Error Signature
  Detector. Updates archive card layout.

  TODOS.md: adds Phase D -- Accumulation-as-Hero section with
  Tier 1 (A1-A5, A7, R1, B2, B3, B5, B6, Discord echo), Tier 2
  (A6, B1, B4, B7, C1), Tier 3 (B8), Deferred (D1), Backlog (E1).
  Includes schema migrations, new backend services, new frontend
  routes.

  PRODUCT.md: updates section 3 Core Loop with freeze-as-contract
  semantics and 3-scalar confidence anchoring. Adds to section 8
  Non-Goals (no gamification). New section 9 Accumulation-as-Hero
  documents six accumulation axes, the freeze-as-contract locking,
  the goal-benchmark framing (SPY-KRW as goal, not peer), and
  alert policy.

  No code changes in this commit. Feature shipping per TODOS.md
  Phase D in separate PRs.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ~~~

- [ ] **Step 5: Verify docs commit**
  Run: `git log -1 --oneline` — confirm the docs commit is at HEAD.
  Run: `git status --short` — expect only Discord files still uncommitted.

- [ ] **Step 6: Stage Discord files**
  Run: `git add backend/app/services/discord_notifier.py backend/tests/test_discord_notifier.py backend/app/services/notification_service.py backend/app/main.py backend/.env.example`

- [ ] **Step 7: Verify staged diff**
  Run: `git diff --cached --stat` — expect 5 files (3 modified + 2 new).

- [ ] **Step 8: Commit Discord**
  Run:

  ~~~
  git commit -m "$(cat <<'EOF'
  feat: add Discord webhook notifier alongside Telegram

  Adds backend/app/services/discord_notifier.py (97 lines)
  with static-method module mirroring notification_service.py
  style: _get_discord_webhook_url, _html_to_discord_markdown,
  send_discord_message.

  Converts Telegram HTML tags (<b>, <code>, <i>) to Discord
  Markdown, preserves emoji and unicode dividers, truncates to
  1800 chars (Discord hard limit 2000, safety buffer), POSTs JSON,
  treats status 204 as success (not 200).

  Wires Discord alongside Telegram in:
  - notification_service.send_cron_success / send_cron_failure / send_test_message
  - main.py:648 regime shift alert

  Silent-skip when DISCORD_WEBHOOK_URL env var missing, matching
  existing Telegram pattern. Telegram behavior unchanged. Discord
  failure does not affect Telegram return value.

  Test coverage: backend/tests/test_discord_notifier.py (182
  lines, 14 tests covering env-missing, HTML-to-Markdown variants,
  truncation, 204/non-204 responses, timeout and exception paths,
  payload shape). Full backend suite: 43 passed (was 29).

  Env template added to backend/.env.example.

  Deploy step (user action, not included in this commit): add
  DISCORD_WEBHOOK_URL to Render environment, deploy, verify next
  daily cron reaches both channels; optionally clear TELEGRAM_*
  env vars to move to Discord-only.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  EOF
  )"
  ~~~

- [ ] **Step 9: Final verification**
  Run: `git log --oneline -3` — confirm two new commits at HEAD (Discord, docs), with `f40538e` as third.
  Run: `git status --short` — expect working tree clean for the files this plan touched.

- [ ] **Step 10: Do NOT push**
  User will push at their discretion.

---

## Self-Review Checklist

- [x] Every task has exact file paths
- [x] Every content block is complete (no "TBD" / "implement later")
- [x] Git commit messages are full and match scope
- [x] Task 5 depends on Tasks 1-4 (sequential)
- [x] No secrets (webhook URL) in any committed file or in this plan
- [x] Scope matches user ask: 4 doc edits + 2 commits; no Phase D code implementation
- [x] Webhook URL and session IDs are ephemeral — never written to files
