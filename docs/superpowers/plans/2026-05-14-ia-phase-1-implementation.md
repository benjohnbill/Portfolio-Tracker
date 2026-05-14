# IA Phase 1 Implementation Plan — Atom Cards + DOMAIN_MAP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the atom-card layer of the IA Redesign. Write 39 `.meta.yaml` files (one per file-backed atom) using the schema in `docs/superpowers/specs/2026-05-05-ia-redesign-design.md` §3.2. Derive `DOMAIN_MAP.md` vocabulary bottom-up from observed atom keywords. Produce a new sitemap proposal from cluster analysis. **Phase 1 only** — Phases 2-4 (Navigation Grammar, Compact Redesign, Aesthetic Uplift) are separate plans.

**Architecture:** 4 batches matching IA spec §6.1, each ending with a Codex Checkpoint. Each batch is N atom-card files (no code changes) + incremental `DOMAIN_MAP.md` updates. Final cluster derivation + sitemap proposal happens after all 4 batches.

**Tech Stack:** None (documentation only). No tests, no migrations, no deploy.

**Acceptance criteria:**
- 39 `.meta.yaml` files committed alongside their `.tsx` counterparts (per IA spec §3.7 location decision)
- `DOMAIN_MAP.md` at repo root, 3-section structure per IA spec §3.4
- Codex Checkpoint 1 + 2 outputs documented as comments or notes
- New sitemap proposal in `docs/superpowers/specs/2026-05-14-ia-phase-1-sitemap.md`
- User review pass before any code/IA implementation work (Phases 2-4) begins
- All artifacts committed to `main` (project workflow rule: scope-lock docs always main)

**Pre-conditions:**
- ELT migration plan (`2026-05-14-elt-price-migration.md`) lands first per user sequence decision (1 → 3 → 2: ELT, warm-up, IA)
- Macro warmup plan (`2026-05-14-macro-warmup-cron.md`) lands second
- This plan runs third — when starting, verify both pre-conditions completed

---

## Decisions on the 3 open questions (from IA spec §6.2)

| # | Question | Decision |
|---|---|---|
| (a) | 39개 모두 atom card 작성 vs 일부 제외 | **All 39.** Even shell/utility atoms get cards — uniformity matters more than minor card-creation cost. Sidebar gets a thin card (only 4 fields filled). |
| (b) | Data-fetcher 9개 통합/분리 | **Case-by-case during batch writing.** Default: keep separate (they exist as separate files; merging changes code structure, out of Phase 1 scope). Note merge candidates in atom card `pattern_notes`. |
| (c) | Batch 시작 폴더 | **friday/** first per Lotte recommendation in IA spec. Friday is the highest-cognition surface, so finalising vocabulary there derives the cleanest cross-batch terms. |

---

## File Structure

### New files (39 atom cards + DOMAIN_MAP + sitemap spec)

Locations per IA spec §3.7 (alongside `.tsx`):

**Batch 1 — friday/ (9):**
- `frontend/src/components/friday/FridayBriefingSection.meta.yaml`
- `frontend/src/components/friday/FridayDashboard.meta.yaml`
- `frontend/src/components/friday/FridayReportSection.meta.yaml`
- `frontend/src/components/friday/FridaySleeveSection.meta.yaml`
- `frontend/src/components/friday/FridaySnapshotPanel.meta.yaml`
- `frontend/src/components/friday/FridaySnapshotSection.meta.yaml`
- `frontend/src/components/friday/MacroContextSection.meta.yaml`
- `frontend/src/components/friday/SinceLastFridayBriefing.meta.yaml`
- `frontend/src/components/friday/SleeveHealthPanel.meta.yaml`

**Batch 2 — intelligence/ (12) + macro-context/ (3) = 15:**
- `frontend/src/components/intelligence/AttributionsView.meta.yaml`
- `frontend/src/components/intelligence/CalmarTrajectoryPlaceholder.meta.yaml`
- `frontend/src/components/intelligence/IntelligenceAttributionsSection.meta.yaml`
- `frontend/src/components/intelligence/IntelligenceOutcomesSection.meta.yaml`
- `frontend/src/components/intelligence/IntelligenceRegimeHistorySection.meta.yaml`
- `frontend/src/components/intelligence/IntelligenceReviewsSection.meta.yaml`
- `frontend/src/components/intelligence/IntelligenceRulesSection.meta.yaml`
- `frontend/src/components/intelligence/IntelligenceSharedUI.meta.yaml`
- `frontend/src/components/intelligence/OutcomesView.meta.yaml`
- `frontend/src/components/intelligence/ReviewsView.meta.yaml`
- `frontend/src/components/intelligence/RiskAdjustedScorecard.meta.yaml`
- `frontend/src/components/intelligence/RulesView.meta.yaml`
- `frontend/src/components/intelligence/macro-context/CausalMapSection.meta.yaml`
- `frontend/src/components/intelligence/macro-context/IndicatorCard.meta.yaml`
- `frontend/src/components/intelligence/macro-context/PerformanceTrendChart.meta.yaml`

**Batch 3 — features/ + features/portfolio/ (10):**
- `frontend/src/components/features/AddAssetModal.meta.yaml`
- `frontend/src/components/features/HistoryChart.meta.yaml`
- `frontend/src/components/features/MSTRZScoreChart.meta.yaml`
- `frontend/src/components/features/NDXTrendChart.meta.yaml`
- `frontend/src/components/features/TargetDeviationChart.meta.yaml`
- `frontend/src/components/features/TwrEquityCurve.meta.yaml`
- `frontend/src/components/features/portfolio/AssetAllocationSection.meta.yaml`
- `frontend/src/components/features/portfolio/AssetSignalSection.meta.yaml`
- `frontend/src/components/features/portfolio/EquityCurveSection.meta.yaml`
- `frontend/src/components/features/portfolio/MSTRSignalSection.meta.yaml`
- `frontend/src/components/features/portfolio/PortfolioSummaryCard.meta.yaml`

**Batch 4 — archive/ (2) + reports/ (1) + shell/utility (2) = 5:**
- `frontend/src/components/archive/ArchiveReportDetailSection.meta.yaml`
- `frontend/src/components/archive/ArchiveTimelineSection.meta.yaml`
- `frontend/src/components/reports/WeeklyReportView.meta.yaml`
- `frontend/src/components/Sidebar.meta.yaml`
- (IntelligenceSharedUI already in Batch 2; if split into mini-atoms during writing, those go here)

**Final artifacts:**
- `DOMAIN_MAP.md` (repo root, new) — 3-section + atom-types + API registry
- `docs/superpowers/specs/2026-05-14-ia-phase-1-sitemap.md` — cluster-derived new sitemap

### Modified files
- None during Phase 1 (this is purely additive documentation)

### Files explicitly NOT changing
- All `.tsx` source — Phase 1 is *parallel documentation*. Phase 2-4 (separate plans) may refactor.
- `docs/AGENTS.md` family — AGENTS.md compatibility is deferred per IA spec §4 "추가 결정사항"

---

## Atom card schema reminder

Per IA spec §3.2, schema is (write in this order — keywords last):

```yaml
name: <ComponentName>
file: frontend/src/components/.../<ComponentName>.tsx

primary_question: "<single-line question this atom answers>"

secondary_questions:
  - "<sub-question 1>"
  - "<sub-question 2>"

connects_to:
  - target: "[[concept-keyword]]"
    trigger: "<UI event → destination route>"

data_contract:
  - <backend response path or endpoint or DB view>

uses_design_components:
  - <DESIGN.md component name>

rendered_in:
  - location: <route path>
    via: <wrapping component name>

pattern_notes:
  type: "<atom-type from DOMAIN_MAP §4>"

keywords:                       # FILL LAST — derive from the natural language above
  - "[[keyword-1]]"
  - "[[keyword-2]]"
```

Writing order (IA spec §3.3): 1. Read `.tsx`. 2. primary_question. 3. secondary. 4. connects_to. 5. data_contract. 6. uses_design_components. 7. rendered_in. 8. pattern_notes. 9. ✨ keywords (the words you naturally used above become the keywords).

---

## Phase 0 — Pre-conditions + setup

### Task 0.1: Verify pre-conditions

- [ ] **Step 1: Confirm prior plans landed**

```bash
cd /home/lg/dev/Portfolio_Tracker && \
  git log --oneline main | grep -E "elt|warmup" | head -5
```

Expected: commits from `2026-05-14-elt-price-migration.md` (e.g. "feat(elt): PriceService...") and `2026-05-14-macro-warmup-cron.md` (e.g. "perf(macro): warm macro snapshot...") visible.

If absent: this plan cannot start. Stop and surface to user.

- [ ] **Step 2: Initialize `DOMAIN_MAP.md` skeleton at repo root**

```bash
test -f DOMAIN_MAP.md || cat > DOMAIN_MAP.md <<'EOF'
# DOMAIN_MAP.md

> **자가 기록 mandate.** 작업 중 새 어휘 / 정의 / cross-reference가 발견되면
> 즉시 이 파일에 반영. 시점 명기 (YYYY-MM-DD).

## §1 Domain Entities (측정 가능한 양 / 현실 객체)

_(populated bottom-up during Phase 1 batch writing)_

## §2 Behaviors (동작 / 시간 변화)

_(populated bottom-up)_

## §3 Cluster-Level Concepts (여러 entity의 종합 / 묶음)

_(populated bottom-up)_

## §4 Atom Types (컴포넌트 역할 분류 vocabulary)

### multi-question atom
한 컴포넌트가 여러 sub-question을 *함께* 답함. 분리하면 cross-lens 통찰 손실.

### gateway-thin atom
짧은 요약 + 다른 surface로의 다리. 깊이는 destination에.

### chart atom
recharts-based; one quantitative time-series view.

### data-fetcher atom
RSC wrapper — fetch + error/empty handling, then renders a display atom.

### form-input atom
사용자 입력 받음.

### shell / utility atom
navigation / shared primitives. atom 정의 약화 (질문에 답 X), 그러나 inventory 일관성 위해 포함.

## §5 Interaction Patterns

_(deferred — vocabulary 5+ 모이면 분리)_

## §6 API Field Registry

_(흡수 from docs/DOMAIN_MAP — Batch 4 마무리 시 통합)_

## §7 Cross-reference

- 컴포넌트 메타: frontend/src/components/**/*.meta.yaml
- 디자인 토큰: DESIGN.md frontmatter
- 제품 결정: PRODUCT.md
- 아키텍처: ARCHITECTURE.md

## §8 Change Log

- 2026-05-14 — [vocab] DOMAIN_MAP initialized (IA Phase 1 implementation start)
EOF
```

- [ ] **Step 3: Commit DOMAIN_MAP skeleton**

```bash
git add DOMAIN_MAP.md
git commit -m "docs(domain-map): initialise IA Phase 1 vocabulary skeleton"
```

---

## Phase 1 — Batch 1: friday/ (9 atoms)

### Task 1.1 — Write 9 atom cards for friday/

Each atom is one step. For each, do this micro-loop:

1. `Read frontend/src/components/friday/<Atom>.tsx` (full file, ≤200 lines typically)
2. Apply the schema in order (primary_question → secondary → connects_to → data_contract → uses_design_components → rendered_in → pattern_notes → keywords)
3. `Write` the `.meta.yaml` alongside the `.tsx`
4. Append any new vocabulary terms found into `DOMAIN_MAP.md` §1/§2/§3

> **For each atom: aim for 8-15 lines of meta.yaml content. Don't pad.**

- [ ] **Step 1.1.1: FridayBriefingSection.meta.yaml** — read source, write card, update DOMAIN_MAP if new terms
- [ ] **Step 1.1.2: FridayDashboard.meta.yaml** — same pattern
- [ ] **Step 1.1.3: FridayReportSection.meta.yaml**
- [ ] **Step 1.1.4: FridaySleeveSection.meta.yaml**
- [ ] **Step 1.1.5: FridaySnapshotPanel.meta.yaml**
- [ ] **Step 1.1.6: FridaySnapshotSection.meta.yaml**
- [ ] **Step 1.1.7: MacroContextSection.meta.yaml** (`gateway-thin atom` — IA spec example)
- [ ] **Step 1.1.8: SinceLastFridayBriefing.meta.yaml** (`multi-question atom` — IA spec example)
- [ ] **Step 1.1.9: SleeveHealthPanel.meta.yaml** (`multi-question atom` — IA spec includes a full sample)

### Task 1.2 — Codex Checkpoint 1 (framework sanity)

After all 9 atom cards in friday/, sanity-check the framework before extending to other folders.

- [ ] **Step 1: Compile a brief framework reflection**

Write a short note (max 200 words) covering:
- Did the 9-field schema feel right? Any field that was always empty / always uncomfortable?
- New vocabulary terms accumulated in DOMAIN_MAP? List them.
- Any atom that resisted single-question framing? (Multi-question atoms expected — but were any others?)
- Are `connects_to` arrows starting to form clusters? Note any.

Save inline as a comment block at the bottom of `DOMAIN_MAP.md` §8:

```markdown
## §8 Change Log

- 2026-05-14 — [vocab] DOMAIN_MAP initialized (IA Phase 1 implementation start)
- 2026-05-14 — [batch-1] friday/ 9 atoms done. Vocab additions: [list]. Notes: [framework reflections]
```

- [ ] **Step 2: Optional codex review (deferred to user)**

Codex Checkpoint 1 may consist of:
- The user reviewing the 9 cards + DOMAIN_MAP updates
- Or invoking `/codex review` on the batch commit (if gstack codex is set up)

This plan does not block on codex; user decides whether to run it before Batch 2.

### Task 1.3 — Commit batch 1

- [ ] **Step 1: Commit**

```bash
git add frontend/src/components/friday/*.meta.yaml DOMAIN_MAP.md
git commit -m "docs(atom-cards): batch 1 — friday/ (9 atoms)

Per IA spec 2026-05-05. Each atom: primary_question + secondary +
connects_to + data_contract + design components + rendered_in +
pattern_notes + keywords. DOMAIN_MAP §1-3 populated bottom-up from
friday vocabulary."
```

---

## Phase 2 — Batch 2: intelligence/ (12) + macro-context/ (3)

### Task 2.1 — Write 15 atom cards

Same micro-loop as Phase 1. Notes on tricky cases:

- **IntelligenceSharedUI** is a single file holding 2 mini-atoms (DataDensityBadge + ContributionHeatmap). IA spec §5.4 flagged it for "분리 권장 in batch". Decide during writing:
  - Option A: One `IntelligenceSharedUI.meta.yaml` with `pattern_notes: type: "utility — 2 mini-atom 묶음"` and both questions in `secondary_questions`.
  - Option B: Split into `DataDensityBadge.meta.yaml` + `ContributionHeatmap.meta.yaml` (still alongside same `.tsx` — meta filenames just differ from component filename).
  - **Default**: Option A (preserve 1:1 file:meta mapping for tooling simplicity). Note split-candidate in pattern_notes.

- **CausalMapSection** is a flow diagram of multiple sub-elements. Stay at composer level: primary_question = "Indicators → Buckets → Sleeves → Composite의 인과 흐름?". Don't fragment.

- [ ] **Step 2.1.1: AttributionsView.meta.yaml**
- [ ] **Step 2.1.2: CalmarTrajectoryPlaceholder.meta.yaml**
- [ ] **Step 2.1.3: IntelligenceAttributionsSection.meta.yaml**
- [ ] **Step 2.1.4: IntelligenceOutcomesSection.meta.yaml**
- [ ] **Step 2.1.5: IntelligenceRegimeHistorySection.meta.yaml**
- [ ] **Step 2.1.6: IntelligenceReviewsSection.meta.yaml**
- [ ] **Step 2.1.7: IntelligenceRulesSection.meta.yaml**
- [ ] **Step 2.1.8: IntelligenceSharedUI.meta.yaml** (decide A/B above)
- [ ] **Step 2.1.9: OutcomesView.meta.yaml**
- [ ] **Step 2.1.10: ReviewsView.meta.yaml**
- [ ] **Step 2.1.11: RiskAdjustedScorecard.meta.yaml**
- [ ] **Step 2.1.12: RulesView.meta.yaml**
- [ ] **Step 2.1.13: macro-context/CausalMapSection.meta.yaml**
- [ ] **Step 2.1.14: macro-context/IndicatorCard.meta.yaml** (IA spec flags as `multi-question`)
- [ ] **Step 2.1.15: macro-context/PerformanceTrendChart.meta.yaml**

### Task 2.2 — Commit batch 2

- [ ] **Step 1: Append DOMAIN_MAP §8 with batch 2 reflection note**
- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/intelligence/**/*.meta.yaml DOMAIN_MAP.md
git commit -m "docs(atom-cards): batch 2 — intelligence/ + macro-context/ (15 atoms)

DOMAIN_MAP vocabulary expanded with intelligence-side terms
(attribution, outcome, accuracy, regime-transition, review-aggregation,
indicator-bucket-composite causal chain). [paste batch 2 reflection]"
```

---

## Phase 3 — Batch 3: features/ + features/portfolio/ (11)

### Task 3.1 — Write 11 atom cards

- [ ] **Step 3.1.1: AddAssetModal.meta.yaml** (`form-input` — only one in inventory)
- [ ] **Step 3.1.2: HistoryChart.meta.yaml** (`chart`)
- [ ] **Step 3.1.3: MSTRZScoreChart.meta.yaml** (`chart`)
- [ ] **Step 3.1.4: NDXTrendChart.meta.yaml** (`chart`)
- [ ] **Step 3.1.5: TargetDeviationChart.meta.yaml** (`chart`)
- [ ] **Step 3.1.6: TwrEquityCurve.meta.yaml** (`chart`)
- [ ] **Step 3.1.7: portfolio/AssetAllocationSection.meta.yaml**
- [ ] **Step 3.1.8: portfolio/AssetSignalSection.meta.yaml**
- [ ] **Step 3.1.9: portfolio/EquityCurveSection.meta.yaml**
- [ ] **Step 3.1.10: portfolio/MSTRSignalSection.meta.yaml**
- [ ] **Step 3.1.11: portfolio/PortfolioSummaryCard.meta.yaml**

### Task 3.2 — Commit batch 3

- [ ] **Step 1: DOMAIN_MAP §8 batch-3 reflection**
- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/features/**/*.meta.yaml DOMAIN_MAP.md
git commit -m "docs(atom-cards): batch 3 — features/ + features/portfolio/ (11 atoms)

Chart-heavy batch. Portfolio data-fetchers documented as separate
atoms from their underlying chart atoms (case-by-case decision per
plan §Decisions: separate keeps file boundary). [paste batch 3 reflection]"
```

---

## Phase 4 — Batch 4: archive/ + reports/ + shells (5)

### Task 4.1 — Write 5 atom cards

- [ ] **Step 4.1.1: archive/ArchiveReportDetailSection.meta.yaml**
- [ ] **Step 4.1.2: archive/ArchiveTimelineSection.meta.yaml**
- [ ] **Step 4.1.3: reports/WeeklyReportView.meta.yaml** (mega-composer)
- [ ] **Step 4.1.4: Sidebar.meta.yaml** (shell — fill ~4 fields, skip what doesn't apply)
- [ ] **Step 4.1.5: (only if split during Batch 2) DataDensityBadge.meta.yaml + ContributionHeatmap.meta.yaml**

### Task 4.2 — DOMAIN_MAP §6 API Field Registry absorption

- [ ] **Step 1: Read `docs/DOMAIN_MAP.md` (if it exists)**

```bash
test -f docs/DOMAIN_MAP.md && cat docs/DOMAIN_MAP.md
```

- [ ] **Step 2: Copy any API field registry content into root `DOMAIN_MAP.md` §6**

If `docs/DOMAIN_MAP.md` exists, absorb its content into §6 (envelope rule, term registry, exceptions, naming conventions). Delete `docs/DOMAIN_MAP.md` after absorption.

- [ ] **Step 3: Commit batch 4 + DOMAIN_MAP consolidation**

```bash
git add frontend/src/components/archive/*.meta.yaml \
        frontend/src/components/reports/*.meta.yaml \
        frontend/src/components/Sidebar.meta.yaml \
        DOMAIN_MAP.md
git rm docs/DOMAIN_MAP.md  # if absorbed
git commit -m "docs(atom-cards): batch 4 — archive + reports + shells (5)

Also absorbed docs/DOMAIN_MAP.md API field registry into root
DOMAIN_MAP §6. 39-atom inventory complete. [paste batch 4 reflection]"
```

---

## Phase 5 — Cluster derivation + new sitemap

### Task 5.1 — Cluster analysis

- [ ] **Step 1: Compile keyword-frequency map**

For each `[[keyword]]` in any atom card's `keywords` field, list which atoms reference it. This is the cluster-membership matrix.

```bash
grep -rE '\[\[.*?\]\]' frontend/src/components/**/*.meta.yaml | sort | uniq -c | sort -rn | head -30
```

- [ ] **Step 2: Manual cluster boundary draw**

Group atoms by shared-keyword density. Aim for 4-7 clusters, each centered on a coherent user question. Initial hypotheses (refine during writing):

| Tentative cluster | Question | Atoms (preliminary) |
|---|---|---|
| **This-week locking** | What do I freeze this Friday? | FridayDashboard, FridayReportSection, SleeveHealthPanel, ... |
| **Since-last-week** | What happened since the last freeze? | SinceLastFridayBriefing, IntelligenceOutcomesSection, ... |
| **Macro stance** | Is the macro environment supportive of my posture? | MacroContextSection (gateway), IndicatorCard, CausalMapSection |
| **Portfolio long-horizon** | How am I doing structurally? | EquityCurveSection, TwrEquityCurve, PortfolioSummaryCard, ... |
| **Decision rules + accuracy** | Are my rules firing correctly? Were past calls right? | RulesView, OutcomesView, IntelligenceAttributionsSection, ... |
| **Archive** | Show me what I locked weeks ago | ArchiveTimelineSection, ArchiveReportDetailSection, WeeklyReportView |
| **Inputs** | Add a transaction / new asset | AddAssetModal |

Refine clusters from actual keyword-frequency data, don't blindly follow the hypothesis.

- [ ] **Step 3: Draft `2026-05-14-ia-phase-1-sitemap.md`**

Create `docs/superpowers/specs/2026-05-14-ia-phase-1-sitemap.md` with:

```markdown
# IA Phase 1 — New Sitemap Proposal

**Date:** 2026-05-14
**Status:** Draft for user review (Codex Checkpoint 2 input)

## Cluster → page mapping

| Cluster | Page route | Hosted atoms |
|---|---|---|
| This-week locking | /now | FridayDashboard, FridayReportSection, ... |
| Since-last-week | /since | SinceLastFridayBriefing, ... |
| Macro stance | /macro | MacroContextSection (full, not teaser), IndicatorCard, ... |
| Portfolio long-horizon | /portfolio | (existing portfolio atoms) |
| Decision rules + accuracy | /rules | RulesView, OutcomesView, ... |
| Archive | /archive | (existing archive atoms) |
| Inputs | /inputs/add | AddAssetModal |

## Comparison vs current sitemap

| Current route | Becomes | Why |
|---|---|---|
| /friday | /now (mostly) + /since (briefing) | Single question per page |
| /intelligence | Split: /rules + /macro + /archive subsets | Multi-cluster surface fragmented |
| ... | ... | ... |

## Drill-down grammar

(per IA spec §2.3 — atom's `connects_to` field aggregates into navigation graph)
- /now → /since (clicking "events since last freeze")
- /now → /macro (clicking MacroContextSection teaser)
- /rules → /since (clicking an outcome card to see context)
- ...

## Open questions for Phase 2 (Navigation Grammar)

- back-button semantics across drill-downs
- breadcrumbs vs `Back to X`
- cross-cluster atoms (e.g. an atom that answers two clusters' questions): which page hosts it?
```

Fill from the actual keyword-frequency + atom inventory data.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-14-ia-phase-1-sitemap.md
git commit -m "docs(ia): Phase 1 sitemap proposal from cluster analysis

39 atoms grouped by keyword-density into N clusters. Each cluster
maps to a single-question page. Drill-down grammar derived from
atom connects_to fields. Input for Phase 2 Navigation Grammar spec."
```

---

### Task 5.2 — Codex Checkpoint 2 + user review

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: User-action handoff**

Surface to user:

> Phase 1 complete:
> - 39 atom cards
> - DOMAIN_MAP.md (root, 3-section structure, batch-by-batch vocabulary)
> - New sitemap proposal at `docs/superpowers/specs/2026-05-14-ia-phase-1-sitemap.md`
>
> Next steps (user decides):
> - Codex Checkpoint 2 (optional — review sitemap proposal via `/codex review` or independent reading)
> - Phase 2 spec (Navigation Grammar) — separate session, separate brainstorming
> - Phase 3 spec (Page Compact Redesign) — separate session
> - Phase 4 spec (Aesthetic Uplift) — separate session
> - Any Phase 1 revisions (atom card edits, DOMAIN_MAP refinements) — direct in subsequent sessions
>
> **No code changes** in Phase 1. Existing pages and routes unchanged.

---

## Self-Review

1. **Spec coverage**
   - 39 file-backed atom inventory (IA spec §5.3): Phases 1-4 each cover one batch ✓
   - 9-field atom card schema (IA spec §3.2): used per atom ✓
   - DOMAIN_MAP 3-section structure (IA spec §3.4): initialized + populated bottom-up ✓
   - 6 cross-reference directions (IA spec §3.6): atom→domain, atom→design captured in card fields; reverse directions deferred (not blocking) ✓
   - keywords-last writing order (IA spec §3.3): explicit in schema reminder ✓
   - 3 open questions resolved in plan §Decisions ✓
   - Batch sequencing (IA spec §6.1): friday → intel+macro-context → features+portfolio → archive+reports+shells ✓
   - Codex Checkpoint 1 (after Batch 1) + Codex Checkpoint 2 (after sitemap proposal) ✓

2. **Placeholders** — none.

3. **Type / signature consistency** — N/A (documentation only).

4. **Out of scope (intentional)**
   - Phase 2-4 (Navigation Grammar, Compact Redesign, Aesthetic Uplift) — separate plans
   - `.tsx` source refactoring — Phase 1 is parallel documentation only
   - AGENTS.md compatibility (per IA spec §4 추가 결정사항)
   - inline page.tsx sub-section atoms (8-12 estimated by IA spec §5.5) — discover during writing, add ad-hoc if found
