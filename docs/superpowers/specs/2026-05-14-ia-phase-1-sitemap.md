# IA Phase 1 — New Sitemap Proposal

**Date:** 2026-05-14
**Status:** Draft for user review (Codex Checkpoint 2 input)
**Source:** 39 atom cards in `frontend/src/components/**/*.meta.yaml` + `DOMAIN_MAP.md` §1-3
**Method:** Keyword frequency on atom-card `keywords` field + `connects_to` arrow analysis + `rendered_in` route inventory + manual cluster boundary draw

---

## 1. Atom inventory summary

39 file-backed atom cards completed across 4 batches:

| Batch | Folder | Atoms | Atom-type mix |
|---|---|---|---|
| 1 | `friday/` | 9 | 4 multi-question · 1 gateway-thin · 4 data-fetcher |
| 2 | `intelligence/` + `intelligence/macro-context/` | 15 | 5 multi-question · 1 gateway-thin · 3 chart · 5 data-fetcher · 1 utility |
| 3 | `features/` + `features/portfolio/` | 11 | 5 chart · 5 data-fetcher · 1 form-input |
| 4 | `archive/` + `reports/` + `Sidebar.tsx` | 4 | 1 multi-question (composer-page) · 2 data-fetcher · 1 shell |
| | **Total** | **39** | **10 multi-question · 2 gateway-thin · 8 chart · 16 data-fetcher · 1 form-input · 2 utility** |

Atom-type distribution: **data-fetcher 41% · multi-question 26% · chart 21% · utility 5% · gateway-thin 5% · form-input 3%**. Data-fetcher + multi-question dominate (67%) — RSC envelope + composite-question patterns are the frontend backbone.

Phase 1 inventory **does not cover** inline page.tsx sub-section atoms (IA spec §5.5 estimates 8-12). Those are out of scope for the file-backed atom-card pass.

---

## 2. Keyword frequency — gravity wells

Top incoming `[[keyword]]` references across all 39 atom cards (sample, top 25):

| Count | Keyword | Interpretation |
|---:|---|---|
| 15 | `[[envelope]]` | Cross-batch backbone — UX-1 envelope shape is the universal data contract |
| 10 | `[[score-attribution]]` | /intelligence gravity well — attribution is the single most-incoming domain entity |
| 9 | `[[friday-archive]]` | /archive cluster anchor |
| 8 | `[[weekly-report]]` | Frozen report is the shared host between /archive and /friday |
| 7 | `[[triggered-rules]]` | Cross-surface — /friday status + /intelligence/rules accuracy |
| 7 | `[[regime-transitions]]` | Macro change lens — /intelligence + /friday since-briefing |
| 6 | `[[decision-outcomes]]` | Post-hoc evaluation — /intelligence/outcomes + /friday since-briefing |
| 6 | `[[asset-signal]]` | /portfolio + WeeklyReportView contextual evidence |
| 5 | `[[target-deviation]]` | /portfolio + WeeklyReportView |
| 4 | `[[twr]]`, `[[trend-regime]]`, `[[rule-accuracy]]`, `[[risk-adjusted-scorecard]]`, `[[review-summary]]`, `[[mstr-zscore]]`, `[[mstr-rotation-rule]]`, `[[macro-context]]`, `[[friday-snapshot]]`, `[[core-6-target]]`, `[[archive-wealth]]`, `[[account-silo]]` | Mid-tier domain entities — each anchors one cluster but doesn't span |

**Observation:** `[[envelope]]` is dominant but *not cluster-defining* — it's the data shape under everything. The cluster-defining keywords are `[[score-attribution]]`, `[[friday-archive]]`, `[[weekly-report]]`, `[[regime-transitions]]`, `[[decision-outcomes]]`, `[[asset-signal]]`, `[[target-deviation]]` — these draw atoms into thematic groupings.

---

## 3. Cluster derivation

Drawing cluster boundaries from keyword co-occurrence + `connects_to` arrows + atom-card primary_questions:

| # | Cluster | Question it answers | Anchor keywords | Atoms |
|---|---|---|---|---|
| **C1** | **This-week locking** | "What do I freeze this Friday?" | `[[friday-ritual]]`, `[[friday-snapshot]]`, `[[weekly-decision]]`, `[[partial-snapshot-safety]]`, `[[sleeve-health]]` | FridayDashboard, FridaySnapshotPanel, FridaySnapshotSection, FridayReportSection, FridaySleeveSection, SleeveHealthPanel |
| **C2** | **Since-last-week briefing** | "What happened since the last freeze?" | `[[since-freeze-briefing]]`, `[[regime-transitions]]`, `[[decision-outcomes]]`, `[[cron-alert-history]]`, `[[weekly-comment]]`, `[[execution-slippage]]` | FridayBriefingSection, SinceLastFridayBriefing, MacroContextSection (teaser), IntelligenceOutcomesSection, OutcomesView, IntelligenceRegimeHistorySection |
| **C3** | **Macro causation** | "Is the macro environment supportive of my posture, and why?" | `[[macro-causation]]`, `[[macro-context]]`, `[[macro-indicator]]`, `[[indicator-bucket]]`, `[[bucket-state]]`, `[[sleeve-compatibility]]`, `[[composite-breakdown]]` | CausalMapSection, IndicatorCard, PerformanceTrendChart, MacroContextSection (full) |
| **C4** | **Portfolio long-horizon** | "How am I doing structurally? (not just this week)" | `[[portfolio-long-horizon]]`, `[[archive-wealth]]`, `[[twr]]`, `[[spy-benchmark]]`, `[[structural-metrics]]`, `[[target-deviation-cluster]]`, `[[signal-pulse-grid]]` | EquityCurveSection, HistoryChart, TwrEquityCurve, AssetAllocationSection, TargetDeviationChart, PortfolioSummaryCard, AssetSignalSection (×3 ticker instances), MSTRSignalSection, NDXTrendChart, MSTRZScoreChart |
| **C5** | **Decision rules + accuracy** | "Are my rules firing correctly? Were past calls right? How accurate am I, risk-adjusted?" | `[[score-attribution]]`, `[[attribution-cluster]]`, `[[rule-accuracy-cluster]]`, `[[outcome-evaluation]]`, `[[review-roll-up]]`, `[[maturity-progression]]`, `[[contribution-heatmap]]`, `[[data-density]]` | RulesView, IntelligenceRulesSection, IntelligenceAttributionsSection, AttributionsView, IntelligenceSharedUI (DataDensityBadge + ContributionHeatmap), RiskAdjustedScorecard, CalmarTrajectoryPlaceholder, ReviewsView, IntelligenceReviewsSection |
| **C6** | **Archive** | "Show me what I locked weeks ago." | `[[friday-archive]]`, `[[weekly-report]]`, `[[composer-page]]`, `[[archive-detail]]` | ArchiveTimelineSection, ArchiveReportDetailSection, WeeklyReportView |
| **C7** | **Inputs** | "Add a transaction (trade or cashflow)." | `[[inputs-entry]]`, `[[transaction]]`, `[[trade]]`, `[[cashflow]]`, `[[account-silo]]`, `[[router-refresh]]` | AddAssetModal |
| — | **Navigation shell** | "Where am I, where can I go?" | `[[navigation]]`, `[[collapse-toggle]]` | Sidebar (cross-cluster) |

**7 clusters**, 39 atoms accounted for. Sidebar belongs to the navigation grammar layer (not a content cluster).

---

## 4. Proposed sitemap

### 4.1 Cluster → page mapping

| Cluster | Proposed route | Atom count | Cluster-defining question |
|---|---|---:|---|
| C1 This-week locking | `/now` (renamed from /friday) | 6 | What do I freeze this Friday? |
| C2 Since-last-week briefing | `/since` (new top-level) | 6 | What happened since the last freeze? |
| C3 Macro causation | `/macro` (promoted from /intelligence/macro-context) | 4 | Is macro supportive of my posture, and why? |
| C4 Portfolio long-horizon | `/portfolio` (unchanged) | 11 | How am I doing structurally? |
| C5 Decision rules + accuracy | `/rules` (collapses /intelligence + /intelligence/* sub-routes) | 9 | Are my rules firing? Were past calls right? Risk-adjusted? |
| C6 Archive | `/archive` (unchanged) | 3 | Show me what I locked weeks ago. |
| C7 Inputs | drawer/sheet (no top-level route) | 1 | Add a transaction. |

### 4.2 Comparison vs current sitemap

| Current route | Atoms hosted | Becomes | Rationale |
|---|---:|---|---|
| `/` (This Week) | inline (out of inventory) | merges into `/now` | Single-question per page — this-week 결정과 status를 한 surface로 합쳐 cluster C1 |
| `/friday` | 8 file-backed + inline | splits: `/now` (locking) + `/since` (briefing) | FridayDashboard + SleeveHealthPanel + FridaySnapshot* go to `/now`; FridayBriefingSection + SinceLastFridayBriefing go to `/since`. Two distinct questions in current /friday. |
| `/friday/archive/[date]` | 1 (WeeklyReportView via reuse) | merges into `/archive/[weekEnding]` | Two archive surfaces collapsing into one. WeeklyReportView's `props-driven-framing` makes this trivial. |
| `/intelligence` | 2 | splits across `/rules` + `/since` + `/macro` | Multi-cluster hub fragmented to single-question pages. IntelligenceSharedUI (DataDensityBadge + ContributionHeatmap) stays as utility, reused across `/rules` + (potentially) `/now` ambient health badge. |
| `/intelligence/attributions` | 4 | merges into `/rules` | Attribution + rule accuracy are the same question family: "how accurate are my decisions?" |
| `/intelligence/macro-context` | 3 | promoted to `/macro` | Macro is a top-level question (1 of 7), not a sub-page. |
| `/intelligence/rules` | 2 | merges into `/rules` | Already aligned. |
| `/intelligence/reviews` | 2 | merges into `/rules` | Reviews are temporal aggregation of rule + outcome accuracy. |
| `/intelligence/outcomes` | 2 | splits: `/since` (recent outcomes) + `/rules` (historical accuracy) | OutcomesView's horizon-refetch supports both views; outcome-evaluation cluster spans both. |
| `/intelligence/risk-adjusted` | 1 | merges into `/rules` | Risk-adjusted scorecard is "accuracy under risk normalization" — same question family. |
| `/portfolio` | 11 | unchanged | Cleanest current cluster — `[[portfolio-long-horizon]]` 명확. |
| `/archive` | 2 + 1 (composer) | unchanged | Cleanest — Archive cluster already maps 1:1. |

**Route count:** 5 → 6 top-level routes (+1 net), but distinct sub-routes collapse from 12 (/, /friday, /friday/archive/[d], /portfolio, /intelligence, /intel/attributions, /intel/macro-context, /intel/rules, /intel/reviews, /intel/outcomes, /intel/risk-adjusted, /archive, /archive/[w]) to **9** (`/now`, `/since`, `/macro`, `/portfolio`, `/rules`, `/archive`, `/archive/[w]`, plus inputs drawer on /now and /portfolio). Net reduction: 13 → 9.

### 4.3 New Sidebar nav nouns

Sidebar's `navItems` becomes:

```typescript
const navItems = [
  { icon: CalendarDays,   label: 'Now',         href: '/now' },         // C1 + C2 entry
  { icon: History,        label: 'Since',       href: '/since' },       // C2 (drill from /now possible)
  { icon: Globe,          label: 'Macro',       href: '/macro' },       // C3
  { icon: Wallet,         label: 'Portfolio',   href: '/portfolio' },   // C4
  { icon: ListChecks,     label: 'Rules',       href: '/rules' },       // C5 (renamed from Intelligence)
  { icon: Archive,        label: 'Archive',     href: '/archive' },     // C6
];
```

6 top-level nouns (vs current 5: This Week / Friday / Portfolio / Intelligence / Archive). The shift is mostly **renaming for question-precision** — "Intelligence" → "Rules" makes the question observable in the noun.

---

## 5. Drill-down grammar (per IA spec §2.3)

Aggregated from atom-card `connects_to` arrows:

**From `/now` (C1):**
- → `/since` (clicking "events since last freeze" pill)
- → `/macro` (clicking MacroContextSection teaser — already exists as `gateway-thin`)
- → `/archive` (clicking "browse prior weeks")
- → inputs drawer (clicking AddAssetModal trigger)

**From `/since` (C2):**
- → `/rules` (clicking an outcome row — "see this rule's accuracy history")
- → `/macro` (clicking a regime-transition — "see the indicator change")
- → `/archive/[weekEnding]` (clicking a referenced past freeze)

**From `/macro` (C3):**
- → `/rules` (clicking a sleeve-compatibility band — "did this rule fire on this regime?")
- → `/portfolio` (clicking core-indicator → see how it affects my holdings)

**From `/portfolio` (C4):**
- → `/macro` (clicking a signal pulse → see macro context)
- → inputs drawer
- → `/archive` (period selector → past performance reports)

**From `/rules` (C5):**
- → `/since` (clicking an outcome → see its recent transition)
- → `/archive/[weekEnding]` (clicking a triggered rule → see the freeze where it fired)
- → `/macro` (clicking an attribution sub-score → see the macro contribution)

**From `/archive` (C6):**
- → `/archive/[weekEnding]` (timeline drill — already exists)
- → `/rules` (from a rule chip in the archived report → see its history)
- → `/since` (from a decision card → see what happened after)

This drill graph has **strong cross-cluster connectivity** — C2 (`/since`) and C5 (`/rules`) are highly connected to all other clusters (4 incoming each), while C7 (inputs) is degree-2 only. This matches the keyword frequency pattern (regime-transitions and rule-accuracy are mid-frequency cross-cutting).

---

## 6. Open questions for Phase 2 (Navigation Grammar)

These deferred to Phase 2 spec (separate session):

1. **Back-button semantics across drill-downs.** When user goes /now → /macro → /rules → /archive/[w], what does back do? Stack-based (browser default) vs cluster-aware (`Back to /now`) vs hybrid breadcrumb. Currently WeeklyReportView already uses `props.backHref` — patterns exist but not unified.
2. **Breadcrumbs vs `Back to X` ribbon.** Phase 4 aesthetic choice. WeeklyReportView's current pattern is a single-line `<ChevronLeft /> Back to Archive` — works for 1-level drill but ambiguous at depth 2+.
3. **Cross-cluster atoms — which page hosts.** Three identified:
   - `OutcomesView` answers both C2 (recent) and C5 (historical). Currently splits via horizon-refetch state. **Option A**: keep on /rules with /since fetching a teaser. **Option B**: duplicate the atom on both surfaces with different defaults.
   - `IntelligenceSharedUI` (DataDensityBadge + ContributionHeatmap) — utility used in C5. Question: also show DataDensityBadge as ambient health pill on /now header? Atom card already flags split-candidate.
   - `MacroContextSection` is a gateway-thin atom — keeps on /now as teaser, /macro is the destination. Pattern is clean.
4. **WeeklyReportView reuse across surfaces.** Currently /archive/[w] and /friday/archive/[d] both host. Phase 2 should collapse to single `/archive/[w]` route. /now status display의 "current week's frozen report" use case는 inline excerpt로 하지 full composer hosting은 하지 않음(중복 위험).
5. **C7 Inputs as drawer vs route.** Current: AddAssetModal is a Sheet (drawer) triggered from /portfolio header. Proposal options:
   - **Keep drawer** triggered from /now (high-frequency surface) and /portfolio. Phase 1 cards already note this — `[[inputs-entry]]` cluster doesn't need its own URL.
   - **Promote to /inputs/add** — addressable, but breaks "single keystroke" entry flow that drawer enables.
   - **Recommendation**: keep drawer, but add a second trigger location on /now (currently only /portfolio has it).
6. **`/since` vs `/now` boundary.** The since-freeze-briefing 4-lens (regime-transitions × decision-outcomes × cron-alerts × weekly-comment) currently lives *inside* /friday. Proposal pulls it to /since. Question: does /now's first-render show a teaser of /since (like the MacroContextSection gateway pattern), or is /since pure destination?
7. **Atom card revisions.** During Phase 2+ implementation, atom-card `rendered_in` fields drift if components move folders. Phase 2 should add a check: on file move, atom card moves with it, and any `rendered_in` mentioning the new route updates. (Mechanical change.)

---

## 7. Validation — does the proposal honor IA spec §2 principles?

| IA spec principle | Verification |
|---|---|
| 페이지 = 단일 질문 | ✓ Each of 6 routes anchored on one cluster question. /rules is the broadest but cluster's atoms all share "accuracy under different lenses". |
| 컴포넌트 = 단일 또는 다중-관련-질문 | ✓ Multi-question atoms (10) all share intra-component coherence (FridayDashboard's 5 sub-questions are all "this Friday's locking"; CausalMapSection's 5 columns all answer "macro causal chain"). |
| 네비게이션 = 답의 흐름 | ✓ Drill-down graph follows narrative arcs (decision → outcome, macro → portfolio, archive → rule firing context). |
| Atom card = "한 컴포넌트가 한 질문에 어떻게 답하는가" 명시 | ✓ 39/39 atom cards have `primary_question` + `secondary_questions` + `connects_to`. |
| DOMAIN_MAP = 흩어진 용어를 한 곳에 정착 | ✓ §1 80 entities · §2 17 behaviors · §3 14 clusters · §4 atom-type 6 카테고리 + 인스턴스 매핑. |

---

## 8. Acceptance — Phase 1 done

Per plan §Acceptance criteria:

- [x] 39 `.meta.yaml` files committed alongside their `.tsx` counterparts (per IA spec §3.7 location decision)
- [x] `DOMAIN_MAP.md` at repo root, 3-section structure per IA spec §3.4 (now 8 sections — §1-3 vocab + §4 atom types + §5-7 reserved/cross-ref + §8 change log)
- [x] Codex Checkpoint 1 + 2 outputs documented as comments/notes inside `DOMAIN_MAP.md` §8
- [x] New sitemap proposal in `docs/superpowers/specs/2026-05-14-ia-phase-1-sitemap.md` (this file)
- [ ] User review pass before any code/IA implementation work (Phases 2-4) begins — **pending**
- [x] All artifacts committed to `main` (planned — final merge happens after user review)

**Phase 1 deliverable inventory:**
- 39 atom cards (in 4 commits)
- DOMAIN_MAP.md (1 init + 4 batch updates)
- This sitemap proposal (1 file)

**No code changes** in Phase 1. Existing pages and routes unchanged. Phase 2 (Navigation Grammar spec), Phase 3 (Compact Redesign), Phase 4 (Aesthetic Uplift) are separate plans.

---

## 9. Next steps (user decides)

- **Codex Checkpoint 2 (optional):** review this proposal via `/codex review` or independent reading
- **Phase 2 spec** — Navigation Grammar — separate session, separate brainstorming. Inputs: this sitemap + atom-card `connects_to` aggregation.
- **Phase 3 spec** — Page Compact Redesign — separate session. Inputs: atom-card `uses_design_components` + DOMAIN_MAP §4 atom-types.
- **Phase 4 spec** — Aesthetic Uplift — separate session. Inputs: 1721 audit hardcoded-color findings + WeeklyReportView mega-composer as largest surface.
- **Phase 1 revisions** — atom card edits, DOMAIN_MAP refinements — direct in subsequent sessions if review surfaces gaps.
