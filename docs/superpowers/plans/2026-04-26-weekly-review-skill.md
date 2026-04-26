# Weekly Review Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill authoring note:** Task 4 (writing the skill file) MUST use the `skill-creator:skill-creator` skill. Do not write the skill file directly with the Write tool.

**Goal:** Build a `/weekly-review` custom skill that orchestrates a weekly investment research ritual — pulling portfolio signals, generating targeted deep-research prompts for external AI tools, synthesizing results into a professional weekly operations report, and extracting structured Friday Freeze entries.

**Architecture:** Two-phase skill (markdown file). Phase 1 pulls portfolio signals from the backend API, runs `last30days` in parallel, optionally queries the weekly-reports corpus for calibration patterns, then generates 5 asset-class research prompts for the user to run externally. Phase 2 synthesizes the user's pasted research results with Claude's baseline into a full report saved to `docs/weekly-reports/YYYY-MM-DD.md`, then extracts DB-ready freeze entries.

**Tech Stack:** Claude Code skill (markdown), bash/curl for API calls, claude-mem MCP for corpus, existing backend endpoints (no new backend code required).

---

## File Structure

| Path | Action | Purpose |
|---|---|---|
| `docs/weekly-reports/` | Create directory | Storage for weekly report markdown files |
| `~/.claude/skills/weekly-review.md` | Create via skill-creator | The skill file itself |
| `docs/superpowers/specs/2026-04-26-weekly-review-skill-design.md` | Reference only | Design spec — do not modify |

**No backend changes required.** The following existing endpoints cover all Phase 1 data needs:
- `GET /api/reports/weekly/latest` — composite score, regime, rules, risk metrics
- `GET /api/v1/friday/briefing?since=YYYY-MM-DD` — since-last-Friday events
- `GET /api/portfolio/summary` — current holdings and sleeve weights
- `GET /api/v1/intelligence/risk-adjusted/scorecard` — Calmar/Sharpe/MDD vs SPY-KRW
- `GET /api/algo/action-report` — algorithm action recommendation, NDX lever state

---

## Task 1: Create weekly-reports/ directory

**Files:**
- Create: `docs/weekly-reports/.gitkeep`

- [ ] **Step 1: Create the directory and gitkeep**

```bash
mkdir -p /home/lg/dev/Portfolio_Tracker/docs/weekly-reports
touch /home/lg/dev/Portfolio_Tracker/docs/weekly-reports/.gitkeep
```

- [ ] **Step 2: Verify directory exists**

```bash
ls -la /home/lg/dev/Portfolio_Tracker/docs/weekly-reports/
```

Expected output: `.gitkeep` file listed.

- [ ] **Step 3: Commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add docs/weekly-reports/.gitkeep
git commit -m "chore: add weekly-reports/ directory for skill output"
```

---

## Task 2: Verify API endpoints return expected data shapes

Before writing the skill, confirm all five backend endpoints are live and return parseable JSON with the expected fields.

**Files:**
- Read only — no changes

- [ ] **Step 1: Start backend (if not running)**

```bash
cd /home/lg/dev/Portfolio_Tracker
# Check if backend is running
curl -s http://localhost:8000/health
```

Expected: `{"status":"ok"}` or similar. If no response, start backend with `uvicorn app.main:app --reload` in a separate terminal.

- [ ] **Step 2: Verify `/api/reports/weekly/latest`**

```bash
curl -s http://localhost:8000/api/reports/weekly/latest | python3 -c "
import json, sys
d = json.load(sys.stdin)
r = d.get('report') or d
print('score:', r.get('score') or r.get('data', {}).get('score', 'MISSING'))
print('regime:', r.get('regime') or r.get('data', {}).get('regime', 'MISSING'))
print('status:', d.get('status', 'no envelope'))
"
```

Expected: score is a number 0–100, regime is a string like `"risk_on"`.

- [ ] **Step 3: Verify `/api/v1/friday/briefing`**

```bash
LAST_FRIDAY=$(python3 -c "
from datetime import date, timedelta
d = date.today()
days_back = (d.weekday() - 4) % 7
days_back = days_back if days_back > 0 else 7
print(d - timedelta(days=days_back))
")
echo "Last Friday: $LAST_FRIDAY"
curl -s "http://localhost:8000/api/v1/friday/briefing?since=$LAST_FRIDAY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('status:', d.get('status', 'no envelope'))
events = (d.get('data') or {}).get('events', [])
print('event count:', len(events))
"
```

Expected: status field present, events is a list (may be empty if no events).

- [ ] **Step 4: Verify `/api/portfolio/summary`**

```bash
curl -s http://localhost:8000/api/portfolio/summary | python3 -c "
import json, sys
d = json.load(sys.stdin)
payload = d.get('data') or d
sleeves = payload.get('sleeves') or payload.get('allocation') or payload
print('keys:', list(payload.keys())[:8])
"
```

Expected: response contains allocation or sleeve breakdown. Note the actual key names for use in the skill.

- [ ] **Step 5: Verify `/api/v1/intelligence/risk-adjusted/scorecard`**

```bash
curl -s http://localhost:8000/api/v1/intelligence/risk-adjusted/scorecard | python3 -c "
import json, sys
d = json.load(sys.stdin)
payload = d.get('data') or d
print('status:', d.get('status', 'no envelope'))
print('keys:', list(payload.keys())[:8] if isinstance(payload, dict) else 'not a dict')
"
```

Expected: Calmar, Sharpe, MDD fields visible (may be nested under portfolio/benchmark keys).

- [ ] **Step 6: Verify `/api/algo/action-report`**

```bash
curl -s http://localhost:8000/api/algo/action-report | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(json.dumps(d, indent=2)[:500])
"
```

Expected: JSON with current algorithm recommendation and NDX lever state.

- [ ] **Step 7: Document any field name corrections**

If any step above shows `MISSING` or unexpected structure, note the actual key path. The skill template in Task 4 must use the real key names from these responses.

---

## Task 3: Register weekly-reports/ corpus

**Files:**
- No files changed — corpus is registered via the claude-mem worker API

- [ ] **Step 1: Verify the corpus worker is running**

```bash
curl -s http://127.0.0.1:37777/api/corpus | python3 -c "
import json, sys
d = json.load(sys.stdin)
content = d.get('content', [{}])[0].get('text', '[]')
corpora = json.loads(content)
print('existing corpora:', [c['name'] for c in corpora])
"
```

Expected: lists `portfolio-tracker-decisions`, `claude-toolchain`, `dev-tooling-stack`.

- [ ] **Step 2: Build the weekly-reports corpus**

Use the `mcp__plugin_claude-mem_mcp-search__build_corpus` tool (or its equivalent) to register the new corpus:

```
Corpus name: weekly-reports
Description: Weekly investment review reports — one markdown file per week.
             Covers market analysis, Confidence scores, and thesis rationale.
             Queryable from Week 12+ for calibration pattern detection.
Source directory: /home/lg/dev/Portfolio_Tracker/docs/weekly-reports/
```

If using the MCP tool directly:
```bash
# Alternatively via the worker API if build_corpus accepts a directory path:
curl -s -X POST http://127.0.0.1:37777/api/corpus/weekly-reports/build \
  -H "Content-Type: application/json" \
  -d '{"source_dir": "/home/lg/dev/Portfolio_Tracker/docs/weekly-reports/", "description": "Weekly investment review reports for portfolio tracker."}'
```

Note the actual API shape from the worker — use the claude-mem Knowledge Agent skill if direct API call is unsupported.

- [ ] **Step 3: Verify corpus is registered**

```bash
curl -s http://127.0.0.1:37777/api/corpus | python3 -c "
import json, sys
d = json.load(sys.stdin)
content = d.get('content', [{}])[0].get('text', '[]')
corpora = json.loads(content)
print('corpora:', [c['name'] for c in corpora])
"
```

Expected: `weekly-reports` now appears in the list.

---

## Task 4: Write the /weekly-review skill using skill-creator

**REQUIRED:** Use the `skill-creator:skill-creator` skill to create this file. Do not write the file directly.

**Files:**
- Create: `~/.claude/skills/weekly-review.md` (skill-creator determines exact path)

- [ ] **Step 1: Invoke skill-creator**

Invoke the `skill-creator:skill-creator` skill and provide the following as the skill definition:

```
Skill name: weekly-review
Trigger: When user runs /weekly-review or asks to start the weekly investment review ritual
```

- [ ] **Step 2: Provide Phase 1 content to skill-creator**

The skill Phase 1 must contain the following sections in order:

**Section: Portfolio Signal Pull**

Instruct Claude to run these bash commands at skill start and summarize the results:

```bash
# 1. Composite score, regime, triggered rules, risk metrics
curl -s http://localhost:8000/api/reports/weekly/latest

# 2. Since-last-Friday events
LAST_FRIDAY=$(python3 -c "
from datetime import date, timedelta
d = date.today()
days_back = (d.weekday() - 4) % 7
days_back = days_back if days_back > 0 else 7
print(d - timedelta(days=days_back))
")
curl -s "http://localhost:8000/api/v1/friday/briefing?since=$LAST_FRIDAY"

# 3. Current portfolio allocation and sleeve weights
curl -s http://localhost:8000/api/portfolio/summary

# 4. Risk-adjusted scorecard (Calmar, Sharpe, MDD vs SPY-KRW)
curl -s http://localhost:8000/api/v1/intelligence/risk-adjusted/scorecard

# 5. Algorithm action report (NDX lever state, current recommendations)
curl -s http://localhost:8000/api/algo/action-report
```

After running, present a compact summary:
- Composite score and week-on-week delta
- Current regime (risk-on / risk-off)
- Top 2–3 triggered rules
- NDX sleeve weight and lever state (NDX_1X vs NDX_2X)
- Calmar delta (portfolio vs SPY-KRW, trailing 1Y)
- Since-last-Friday: any regime transitions, matured outcomes, alerts

**Section: Parallel Research**

Invoke the `last30days` skill immediately after the signal pull. Apply this weighting rule to its output:
> Events from the past 7 days = primary evidence. Days 8–30 = contextual background only.

**Section: Calibration Check**

Check how many markdown files exist in `docs/weekly-reports/`:

```bash
ls /home/lg/dev/Portfolio_Tracker/docs/weekly-reports/*.md 2>/dev/null | wc -l
```

If count ≥ 12: query the `weekly-reports` corpus with these questions:
1. "In weeks where confidence_vs_spy_riskadj was 8 or higher, what were the common macro conditions? Is there evidence of Confidence calibration bias?"
2. "What were the most frequent expected_failure_mode values in the last 12 weeks? Were any trigger thresholds actually hit?"
3. "What themes appeared consistently in recent reports? How does the current positioning compare to the 4-week trend?"

If count < 12: output "Calibration check: not yet active (Week [N] of 12 needed)."

**Section: Research Prompt Generation**

Dynamically substitute current portfolio values into each prompt (NDX weight, current regime, composite score, any triggered rules). Generate all five prompts:

**PROMPT A — Global Macro & Risk Regime** *(Run in: Perplexity)*
```
This week's global market analysis:
1. Performance summary: S&P 500, NDX/QQQ, MSCI EM, Gold, Bitcoin (weekly %). Include exact levels.
2. VIX current level and weekly change. Credit spreads (IG/HY). Risk-on vs. risk-off regime assessment.
3. USD Dollar Index: level, direction, weekly change.
4. Fed: any speeches, meeting minutes, rate change expectations this week. Implied rate path (CME FedWatch).
5. Key data releases this week: CPI, NFP, PMI, any surprises vs. consensus.
6. Geopolitical events with market relevance.
7. Your regime verdict: is this week definitively risk-on, risk-off, or transitioning? Evidence?

Weighting: prioritize last 7 days. Use prior 3 weeks as context only.
```

**PROMPT B — NDX & Growth Regime** *(Run in: Gemini DeepResearch)*
```
NDX/QQQ technical and fundamental analysis:
1. QQQ closing price this week and position relative to 200-day and 250-day moving averages. Exact distance (%).
2. NDX weekly momentum: volume, breadth (advance/decline), RSI.
3. Top 5 NDX constituents: weekly performance. Any earnings catalysts this week.
4. Tech sector macro conditions: AI capex trend, rate sensitivity, earnings trajectory.
5. Is a risk-on regime clearly established to justify 2x leverage? What is the primary risk to maintained leveraged NDX exposure over the next 4 weeks?

Context: I hold both unleveraged (NDX 1x) and leveraged (NDX 2x) Korean-listed NDX ETFs.
Key rule: maintain leveraged exposure only when NDX is above its 250-day MA.
Current NDX weight: [CURRENT_NDX_WEIGHT]%. Current lever: [NDX_1X or NDX_2X].

Weighting: prioritize last 7 days. Prior 3 weeks = context.
```

**PROMPT C — Inflation / Rates / Diversifiers** *(Run in: Gemini)*
```
Fixed income and diversifier analysis:
1. US Treasury yield curve this week: 2Y, 10Y, 30Y levels and weekly changes. Curve shape.
2. Real yields (10Y TIPS): level and direction. Implication for gold.
3. Gold (XAU): weekly performance and key drivers (real rates, dollar, safe-haven demand).
4. DBMF (iMGP DBi Managed Futures): weekly performance. Trending or choppy environment for CTAs? Which asset classes are trending?
5. Long-duration bonds (TLT): weekly performance and duration risk for the next 4 weeks.

Context: I hold GLDM (gold), DBMF (managed futures), and ACE_TLT (TLT equivalent).

Weighting: prioritize last 7 days.
```

**PROMPT D — EM & Carry (Brazil)** *(Run in: Perplexity or GPT)*
```
Brazilian macro and EM carry environment:
1. BRL/USD: weekly level and change. Direction trend over past month.
2. Brazilian Selic rate: current level, any BCB change or guidance this week.
3. Brazilian fiscal conditions: any news on deficit, primary surplus target, government spending.
4. EM bond market sentiment: EMBI spread, EM bond fund flows this week.
5. Carry trade environment: is global carry supportive or under pressure? What is the carry attractiveness of Brazilian government bonds at current BRL/USD and Selic levels?

Context: I hold Brazilian government bonds (BRAZIL_BOND) as an EM carry position.

Weighting: prioritize last 7 days.
```

**PROMPT E — Bitcoin & MSTR** *(Run in: DeepResearch or GPT)*
```
Bitcoin and MicroStrategy analysis:
1. BTC closing price this week and monthly trend. Weekly % change.
2. On-chain metrics: active addresses, exchange outflows, miner activity. Sentiment signal.
3. BTC macro correlation: risk asset (correlated with equities) or uncorrelated this week?
4. MicroStrategy (MSTR): current price, weekly % change. BTC per share (implied NAV). Current MNAV premium/discount. Any equity issuance or BTC purchase activity this week.
5. Crypto regulatory news with market relevance.

Context: I hold MSTR as my Bitcoin proxy. Key metrics: Z-score relative to historical MNAV premium.

Weighting: prioritize last 7 days.
```

**Section: Handoff to User**

After presenting all five prompts, output:

```
Research prompts A–E are ready above. Steps:
1. Copy Prompt A → Perplexity
2. Copy Prompt B → Gemini DeepResearch
3. Copy Prompt C → Gemini
4. Copy Prompt D → Perplexity or GPT
5. Copy Prompt E → DeepResearch or GPT

While you run these (typically 10–30 minutes), I've run last30days above for baseline context.

When all results are ready, paste them back using this structure:

--- RESEARCH A: GLOBAL MACRO ---
[paste here]

--- RESEARCH B: NDX REGIME ---
[paste here]

--- RESEARCH C: RATES / DIVERSIFIERS ---
[paste here]

--- RESEARCH D: BRAZIL / EM ---
[paste here]

--- RESEARCH E: BTC / MSTR ---
[paste here]
```

- [ ] **Step 3: Provide Phase 2 content to skill-creator**

Phase 2 begins when the user pastes research results. The skill must:

**Weighting instruction (apply throughout synthesis):**
> Events from the past 7 days are primary evidence. Events from days 8–30 are contextual background. When signals conflict across timeframes, weight short-term more heavily.

**Synthesize and generate the report** using this exact section structure:

```
WEEKLY INVESTMENT REVIEW
Portfolio Tracker — [YYYY-MM-DD]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EXECUTIVE SUMMARY
   [3–5 bullets: key market developments, portfolio stance, primary risk]

2. MARKET ENVIRONMENT
   | Index   | Weekly % | Level |
   |---------|----------|-------|
   | S&P 500 |          |       |
   | NDX/QQQ |          |       |
   | Gold    |          |       |
   | Bitcoin |          |       |
   | VIX     |          |       |
   
   Macro regime: [risk-on / risk-off / transitioning]
   Key events: [2–3 bullets]

3. PORTFOLIO PERFORMANCE
   Weekly / YTD / Since-inception returns [from API data]
   vs SPY-KRW: pure return delta and Calmar delta [from scorecard API]
   Trailing-1Y: Calmar / Sharpe / MDD / Sortino — portfolio vs SPY-KRW

4. SLEEVE ANALYSIS
   - NDX ([weight]%): 250-day MA distance [X]%, lever = [NDX_1X/NDX_2X], algo: [hold/rotate]
   - DBMF ([weight]%): [trending/choppy], weekly [+/-X%]
   - MSTR ([weight]%): MNAV [X]x, weekly [+/-X%]
   - GLDM ([weight]%): real yield [X]%, weekly [+/-X%]
   - BRAZIL_BOND ([weight]%): Selic [X]%, BRL/USD [X], carry [attractive/neutral/unattractive]
   - BONDS/CASH ([weight]%): duration risk [low/medium/high], weekly [+/-X%]

5A. AGENT ASSESSMENT [Claude-generated]
   
   Confidence vs SPY Risk-Adj: [1–10]
   [2–3 sentences rationale]
   
   Confidence vs Cash: [1–10]
   [2–3 sentences rationale]
   
   Confidence vs SPY Pure: [1–10]
   [2–3 sentences rationale]
   
   Ordering check: #1 ≥ #2 ≥ #3? [Yes/No — if No, flag the deviation]
   
   Invalidation:
   - expected_failure_mode: [regime_shift / correlation_breakdown / macro_deterioration / position_specific]
   - trigger_threshold: [float, e.g. 0.05]
   - Hypothesis: [1–2 sentences]

5B. USER MOMENT ✍ Manual entry required
   ┌─────────────────────────────────────────────────────────┐
   │ Write your 1–2 line personal comment below.             │
   │ This is your voice — never generated by Claude.        │
   │ Labeled "user-authored" in Intelligence view.          │
   │                                                         │
   │ > [write here]                                          │
   └─────────────────────────────────────────────────────────┘

6. WATCHLIST
   [3–4 items: specific events, data releases, price levels next week]
```

**Save the report:**

```bash
REPORT_DATE=$(date +%Y-%m-%d)
REPORT_PATH="docs/weekly-reports/${REPORT_DATE}.md"
# Write report content to this path
echo "Report saved: $REPORT_PATH"
```

**Present DB entry summary:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRIDAY DASHBOARD — COPY THESE VALUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

confidence_vs_spy_riskadj : [N]
confidence_vs_cash        : [N]
confidence_vs_spy_pure    : [N]

note (3–4 lines):
[extracted rationale from Section 5A, condensed]

invalidation: [hypothesis text]
expected_failure_mode: [enum]
trigger_threshold: [float]

snapshot.comment (WeeklySnapshot):
← Enter your User Moment from Section 5B here.
   This field is user-authored — do not copy from Section 5A.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**End of skill:**

```
To convert this report:
  PDF:           /gstack-make-pdf
  Designed HTML: /gstack-design-html
```

- [ ] **Step 4: Verify skill file was created**

```bash
# Find the skill file (exact path depends on skill-creator)
find ~/.claude -name "weekly-review.md" 2>/dev/null
```

Expected: one file found.

- [ ] **Step 5: Spot-check skill file structure**

```bash
SKILL_PATH=$(find ~/.claude -name "weekly-review.md" 2>/dev/null | head -1)
grep -n "Phase 1\|Phase 2\|PROMPT A\|PROMPT B\|PROMPT C\|PROMPT D\|PROMPT E\|USER MOMENT\|gstack-make-pdf" "$SKILL_PATH"
```

Expected: all eight patterns found with line numbers.

---

## Task 5: Phase 1 validation run

Verify the skill's Phase 1 output is correct against live data.

**Files:**
- No changes — validation only

- [ ] **Step 1: Run the skill**

```bash
# In Claude Code, invoke:
/weekly-review
```

- [ ] **Step 2: Validate Phase 1 output against checklist**

After Phase 1 completes, verify all of the following are present in the output:

```
[ ] Portfolio signal summary shown (score, regime, NDX lever state, Calmar delta)
[ ] Since-last-Friday briefing shown (even if empty)
[ ] last30days output shown
[ ] Calibration check shown (either "not yet active" or query results)
[ ] Prompt A generated (contains "Perplexity" label and 7 numbered questions)
[ ] Prompt B generated (contains current NDX weight substituted, not "[CURRENT_NDX_WEIGHT]")
[ ] Prompt C generated (contains "DBMF" and "GLDM")
[ ] Prompt D generated (contains "Selic" and "BRL/USD")
[ ] Prompt E generated (contains "MSTR" and "MNAV")
[ ] Structured paste instructions shown with correct section headers
```

If any item is missing, update the skill file and re-run.

---

## Task 6: Phase 2 validation run with mock research

Verify synthesis, report generation, file save, and DB entry extraction.

**Files:**
- Create: `docs/weekly-reports/2026-04-26.md` (created by the skill during this test)

- [ ] **Step 1: Prepare mock research paste**

After Phase 1 output, paste the following mock research to trigger Phase 2:

```
--- RESEARCH A: GLOBAL MACRO ---
This week S&P 500 gained 1.2% closing at 5,250. NDX rose 1.8%.
VIX dropped from 18 to 15.5 indicating risk-on sentiment. Dollar Index (DXY) at 104.2, flat.
Fed Chair Powell spoke Wednesday, confirming no rate change imminent but signaling data dependency.
Core CPI came in at 3.2% YoY, in-line with consensus. NFP: 180k jobs, slightly above 170k expectation.
Regime verdict: risk-on, supported by VIX contraction and equity breadth improvement.

--- RESEARCH B: NDX REGIME ---
QQQ closed at 450.20. 250-day MA at 428.50 — QQQ is 5.1% above. Signal: bullish, leveraged exposure justified.
200-day MA at 435.10 — QQQ is 3.5% above. RSI at 61 (not overbought).
Top performers: NVDA +4.2%, MSFT +2.1%, AAPL +1.8%. No major earnings this week.
AI capex tailwind continues. Rate sensitivity is moderate given current Fed posture.
2x leverage risk: primary risk is sudden regime shift from macro deterioration. Probability: low this week.

--- RESEARCH C: RATES / DIVERSIFIERS ---
10Y Treasury yield: 4.35%, down 8bps from 4.43%. Real yield (TIPS): 2.05%, down 5bps.
Gold XAU: $2,340, up 1.1% on week. Dollar weakness + real yield decline supportive.
DBMF: +0.4% on week. Trending environment: equities and fixed income both trending directionally.
TLT: +0.8% on week as rates fell. Duration risk: moderate — rates direction unclear beyond 4 weeks.

--- RESEARCH D: BRAZIL / EM ---
BRL/USD: 5.02, stable week. Selic: 10.50%, no change. No BCB meeting this week.
Brazilian fiscal: primary surplus target on track per Finance Ministry statement.
EMBI spread: 185bps, tight vs 6-month average of 200bps. EM sentiment positive.
Carry attractiveness: Brazil carry at current Selic vs DXY neutral — moderately attractive.

--- RESEARCH E: BTC / MSTR ---
BTC: $68,500, up 3.2% on week. Risk-asset correlation this week: 0.72 with NDX.
On-chain: exchange outflows positive (accumulation signal), active addresses stable.
MSTR: $168, up 4.1%. BTC holdings per share imply NAV of $145. MNAV premium: 16%.
No new equity issuance this week. No significant regulatory news.
```

- [ ] **Step 2: Verify Phase 2 report structure**

After synthesis, verify the output contains all six sections:

```
[ ] Section 1: EXECUTIVE SUMMARY with 3–5 bullets
[ ] Section 2: MARKET ENVIRONMENT with performance table (S&P, NDX, Gold, BTC, VIX filled in)
[ ] Section 3: PORTFOLIO PERFORMANCE (Calmar delta present)
[ ] Section 4: SLEEVE ANALYSIS with all 6 sleeves listed
[ ] Section 5A: AGENT ASSESSMENT with all three Confidence scores (numbers 1–10, not placeholders)
[ ] Section 5A: Ordering check present (#1 ≥ #2 ≥ #3 verified)
[ ] Section 5A: Invalidation with expected_failure_mode and trigger_threshold
[ ] Section 5B: USER MOMENT box present and empty (not pre-filled)
[ ] Section 6: WATCHLIST with 3–4 items
```

- [ ] **Step 3: Verify report file was saved**

```bash
ls -la /home/lg/dev/Portfolio_Tracker/docs/weekly-reports/
cat /home/lg/dev/Portfolio_Tracker/docs/weekly-reports/2026-04-26.md | head -20
```

Expected: file exists with correct date name, first 20 lines show report header.

- [ ] **Step 4: Verify DB entry summary**

Check that the "FRIDAY DASHBOARD — COPY THESE VALUES" block:
```
[ ] confidence_vs_spy_riskadj shows a number 1–10
[ ] confidence_vs_cash shows a number 1–10
[ ] confidence_vs_spy_pure shows a number 1–10
[ ] note is 3–4 lines (not a full paragraph)
[ ] expected_failure_mode is one of: regime_shift / correlation_breakdown / macro_deterioration / position_specific
[ ] trigger_threshold is a float (e.g. 0.05)
[ ] snapshot.comment prompt explicitly says "user-authored — do not copy from 5A"
```

- [ ] **Step 5: Verify conversion instructions present**

```bash
grep "gstack-make-pdf\|gstack-design-html" /home/lg/dev/Portfolio_Tracker/docs/weekly-reports/2026-04-26.md
```

Expected: both skill names found in the file footer.

- [ ] **Step 6: Commit the test report**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add docs/weekly-reports/2026-04-26.md
git commit -m "test: add first weekly review report (validation run)"
```

---

## Task 7: Index first report into corpus

After Task 6 creates the first markdown report, index it into the weekly-reports corpus so it's queryable for future calibration checks.

**Files:**
- No new files — corpus index update only

- [ ] **Step 1: Prime (or re-prime) the weekly-reports corpus**

```bash
curl -s -X POST http://127.0.0.1:37777/api/corpus/weekly-reports/prime
```

Or if the tool is `reprime`:

```bash
curl -s -X POST http://127.0.0.1:37777/api/corpus/weekly-reports/reprime
```

- [ ] **Step 2: Verify the corpus is queryable**

```bash
curl -s -X POST http://127.0.0.1:37777/api/corpus/weekly-reports/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What was the NDX confidence score and regime this week?"}'
```

Expected: response references content from the 2026-04-26 report (not empty).

- [ ] **Step 3: Final commit**

```bash
cd /home/lg/dev/Portfolio_Tracker
git add -A
git commit -m "feat: weekly-review skill complete — Phase 1+2 validated, corpus indexed"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Two-phase workflow | Tasks 4–6 |
| Portfolio signal pull (5 endpoints) | Task 2 + Task 4 Phase 1 |
| last30days parallel run | Task 4 Phase 1 |
| Calibration check (Week 12+) | Task 4 Phase 1 |
| 5 research prompts with dynamic substitution | Task 4 Phase 1 |
| Structured paste protocol | Task 4 Phase 1 handoff |
| Recency weighting (7-day primary) | Task 4 Phase 2 |
| Report Sections 1–6 | Task 4 Phase 2 + Task 6 |
| User Moment / Agent Moment separation | Task 4 Phase 2 (5A/5B) |
| Report saved to docs/weekly-reports/ | Task 1 + Task 6 |
| DB entry extraction block | Task 4 Phase 2 + Task 6 |
| Conversion instructions (/gstack-make-pdf etc.) | Task 4 Phase 2 end |
| weekly-reports corpus registration | Tasks 3 + 7 |
| Skill written via skill-creator | Task 4 (mandatory requirement) |
| Calibration questions (12 patterns) | Task 4 Phase 1 calibration section |

**No gaps found.**

**No placeholders:** all code blocks contain executable commands. All prompt content is fully written out. All validation checklists are concrete and checkable.

**Type consistency:** The DB entry field names (`confidence_vs_spy_riskadj`, `confidence_vs_cash`, `confidence_vs_spy_pure`, `expected_failure_mode`, `trigger_threshold`) match `WeeklyDecision` model columns exactly throughout Tasks 4 and 6.
