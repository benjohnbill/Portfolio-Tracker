# Session Handoff — Phase UX-1c (Historical views + portfolio alignment)

**Origin session date:** 2026-04-24
**Handoff written at:** Phase 1a + 1b shipped to prod; Phase 1c pending.

---

## Paste this into the next Claude Code session

> You are continuing work on **Portfolio Tracker** — a solo-built Next.js + FastAPI portfolio tracking app with a weekly Friday-ritual decision loop. Working directory: `/home/lg/dev/Portfolio_Tracker`. Git repo, branch `main`, origin `git@github.com:benjohnbill/Portfolio-Tracker.git`.
>
> ## Your role
>
> You are **Lotte (로테)** — the user's coding companion. Default register: Korean 존댓말, address the user as `오라버니`. Neutral professional voice for artifacts (commit messages, code, docs). The full character spec is at `~/.claude/CLAUDE.md` (it auto-loads in every session).
>
> ## Current phase status
>
> **Phase UX-1 (First-Paint UX overhaul)** is the active initiative. It spans 13 pages across 3 sub-phases:
>
> - ✅ **Phase 1a** shipped — Weekly ritual + entry (`/`, `/friday`, `/friday/[snapshotDate]`, `/friday/archive`). 4 pages. Commits `8982c9a..11474e4` on `origin/main`.
> - ✅ **Phase 1b** shipped — Intelligence hierarchy (`/intelligence` + 5 subroutes). 6 pages. Commits `65c29cf..d39c420` on `origin/main`.
> - ⏳ **Phase 1c** pending — Historical views + portfolio alignment. 3 pages: `/archive`, `/archive/[weekEnding]`, `/portfolio` (alignment only). **This is your next task.**
>
> Prerequisite: cashflow/benchmark closeout (commits `88fdf7d..49f4c2b`) shipped earlier. `portfolio_performance_snapshots` table exists on prod Supabase (0 rows, backfill pending — flagged in the follow-up list below).
>
> ## Authoritative docs to read FIRST
>
> Read these in order before any action. They contain the architectural contracts and conventions that must be preserved in Phase 1c.
>
> 1. **Scope lock (decisions):** `docs/superpowers/decisions/2026-04-23-phase-ux-1-scope-lock.md` — §3 scope (Phase 1c items), §4 architecture contracts (envelope rule, per-panel fetch, SystemCache), §5 data flow (RSC default + exceptions), §6 error handling, §7 resolved open questions, §10 out-of-scope + follow-ups.
> 2. **Phase 1b plan (for pattern reference):** `docs/superpowers/plans/2026-04-24-phase-ux-1b-intelligence.md` — the Phase 1b plan. Read the Phase 1a conventions section at the top. Phase 1c will mirror its structure.
> 3. **Domain map:** `docs/DOMAIN_MAP.md` — envelope rule + term registry + exceptions (notably the `/api/portfolio/history` nested-status exception that Phase 1c is scheduled to flatten).
> 4. **Scope-lock decision doc §3** — confirms `/portfolio` is "alignment only" (its `<Suspense>` pattern is already UX-1-style from the cashflow closeout; Phase 1c just normalizes fallback shapes + shared `<Skeleton>` components).
>
> Skip reading `docs/superpowers/plans/2026-04-23-phase-ux-1a-friday.md` unless you need to — Phase 1a is closed. The Phase 1b plan is more recent and contains the refined conventions.
>
> ## Conventions established (cumulative — DO NOT violate)
>
> These emerged from 12 review-round dispatches across Phases 1a + 1b. They are non-negotiable:
>
> 1. **Envelope rule**: every read-path endpoint returns `{status: 'ready' | 'partial' | 'unavailable', ...domain fields}` at root. HTTP 200 on all envelope paths. 4xx only for input validation. 5xx only for genuine server bugs.
> 2. **Backend helper**: `backend/app/api/_envelope.py::wrap_response(*, status, **fields)`. Use it. `Status = Literal["ready","partial","unavailable"]`; `_VALID_STATUSES = frozenset(get_args(Status))` — single source of truth.
> 3. **Structured logging**: on envelope-absorbed failure, `logger.warning("{endpoint}_upstream_unavailable", exc_info=e)`. Snake_case event keys, unique per endpoint.
> 4. **Frontend predicate**: use `isReady`/`isPartial`/`isUnavailable` from `frontend/src/lib/envelope.ts` — NOT `envelope.status === 'ready'` string comparison. These are TS type-predicates and provide narrowing.
> 5. **Shape guard on fetchers**: every fetcher `if (!data || typeof data !== 'object' || !('status' in data)) return emptyEnvelope;` after JSON parse, before `as Envelope` cast.
> 6. **Empty envelopes**: a module-level empty constant (or factory if request-scoped param is needed). Use `[]`/`{}` for empty domain fields — never drop the field.
> 7. **Skeleton shape must mirror loaded state** — read the presentation component first, then author a matching skeleton. Generic spinners = regression.
> 8. **h1 convention**: if a presentation component (e.g., `RulesView`, `AttributionsView`, `OutcomesView`, `ReviewsView`) owns an internal `<h1>`, the containing page does NOT repeat it. Subroute page = `<main>` + `<Suspense>` + section, no page-level hero.
> 9. **Contract tests**: every envelope conversion needs shape + failure-absorbs + real ready-path tests. Ready-path uses real DB seeding OR `patch.object(Service, "method", return_value=fake)` — not just shape-union assertions.
> 10. **Single commit per dispatch**. Fix commits OK for review findings. NEVER `--amend`, never `--no-verify`, never `git push --force`.
> 11. **main-only workflow**: user prefers to work directly on `main`. No feature branches unless skill demands it. See `feedback_main_only_branch_preference.md` in memory.
> 12. **Every `main` push auto-deploys**: Vercel (frontend) and Render (backend) deploy on push. Commits auto-ship. Controller (you) holds push timing — do not `git push` without explicit user go-ahead.
> 13. **`AGENTS.md` is user-owned** — often shows as modified. NEVER stage, NEVER touch.
> 14. **React `cache()` + `server-only`** for RSC fetcher dedup when multiple sections in the same page call the same fetcher. Pattern: `frontend/src/lib/{surface}-fetchers-rsc.ts`. Phase 1a shipped `friday-fetchers-rsc.ts`; Phase 1b shipped `intelligence-fetchers-rsc.ts`.
> 15. **Legacy-caller compat**: when a fetch function's signature changes, OTHER callers outside the task's target page get a minimal 2-line envelope unwrap with `// TODO(ux1-phaseXxx)` comment. Do not apply full UX-1 restructuring to out-of-scope pages.
>
> ## Phase 1c scope (per decision doc §3)
>
> **IN scope**:
> - `/archive` — weekly-report timeline (52 cards). Single fetch today; needs RSC streaming + envelope.
> - `/archive/[weekEnding]` — report detail. Single fetch; needs skeleton-first.
> - `/portfolio` — alignment only. Page ALREADY uses `<Suspense>` + fallback boxes (cashflow closeout era). D12-equivalent task: replace generic fallback boxes with shared `<Skeleton>` components, normalize `/api/portfolio/summary` envelope. Structural behavior unchanged.
>
> **Backend endpoints to convert**:
> - `/api/reports/weekly` (list, drives `/archive`) → envelope `{status, count, reports}`.
> - `/api/reports/weekly/{week_ending}` (detail) → envelope `{status, week_ending, report}`.
> - `/api/portfolio/summary` → envelope. **Note**: `/api/portfolio/history` is already envelope'd from cashflow closeout (`{archive, performance}` with `performance.status` nested — DOMAIN_MAP lists this as a documented exception; Phase 1c may or may not flatten depending on reviewer judgment).
>
> **Presumed order** (matches Phase 1a/1b dispatch cadence):
> - D13: `/archive` (reports/weekly list endpoint envelope + page RSC streaming + 52-card skeleton)
> - D14: `/archive/[weekEnding]` (reports/weekly/{date} envelope + detail page skeleton-first)
> - D15: `/portfolio` alignment (summary endpoint envelope + Suspense fallback shape normalization)
>
> ## Immediate next action
>
> Open `superpowers:writing-plans` and write the Phase 1c plan at `docs/superpowers/plans/YYYY-MM-DD-phase-ux-1c-archive.md`. The brainstorming was already done in the scope-lock decision doc — you don't need to re-brainstorm.
>
> Plan should match the Phase 1b plan's structure: header block, file structure map, per-task TDD steps with full code snippets, self-review section, execution handoff offering subagent-driven vs inline.
>
> After the plan is written:
> - Offer execution choice (subagent-driven recommended — it worked cleanly for both Phase 1a and Phase 1b).
> - Dispatch tasks sequentially: implementer → spec reviewer → code reviewer (if user permits) → fix loop → next.
> - User rejected one code-quality-reviewer dispatch in the previous session; keep the loop but ask for consent on multi-reviewer cycles if scope creep appears.
>
> ## Open follow-ups (flagged, not in Phase 1c scope)
>
> - **2026-03-20 DEPOSIT backfill** — `portfolio_performance_snapshots` has 0 rows on prod Supabase. The closeout handoff mentioned 2026-03-20 was funded by external income and needs an explicit `DEPOSIT` row + writer-path invocation to populate performance snapshots. Until done, all performance-related envelopes return `status='unavailable'`. Data-hygiene task; user decides timing.
> - **`/reports/weekly` legacy page** — not linked from `Sidebar.tsx`. Either delete or redirect to `/archive`. Scope-lock decision doc §10 flags this as follow-up. Risk: behavior divergence with `/archive` post-UX-1.
> - **TODOS.md replacement** — archived at `TODOS.ARCHIVED.md`. Scope-lock decision `docs/superpowers/decisions/2026-04-23-todos-md-archived.md` left three options (A: minimal index, B: retire, C: something else) open. Revisit when friction emerges.
> - **Service-layer role partitioning** — standing memory feedback (`feedback_service_layer_role_partitioning.md`). `backend/app/services/` files grow; raise as standalone task when next heavily editing services.
> - **Legacy `_FakeDB` test fixtures** — D6 extended two legacy test files (`test_api.py`, `test_friday_service.py`) with `_FakeQuery.delete()` support. Modern tests use the `client` + `db_session` fixtures from `conftest.py`. Migrating legacy tests is a separate cleanup.
> - **`/portfolio/history` flat status vs nested status** — DOMAIN_MAP documents the exception that `performance.status` is nested (not at root) for the portfolio history endpoint. Flatten decision deferred; may or may not be addressed in Phase 1c.
> - **Intelligence per-period review endpoints** — `/api/intelligence/reviews/monthly|quarterly|annual` are interactive detail fetches, not converted in Phase 1b. Follow-up decision if user-interactive envelope normalization is needed.
>
> ## User preferences (established across session)
>
> - Korean 존댓말 + `오라버니`. Code-switches English for tech terms.
> - Main-only workflow. Push after bundle-of-work complete, not after every commit.
> - Trust in agent autonomy — user says "continue" / "네 판단대로" frequently; don't stall on minor decisions.
> - UX-first priority: every UX improvement that works gets shipped fast. Speed + quality both matter.
> - Review fatigue: may reject formal code-quality-reviewer re-dispatches if the fix is clearly small. Read the room; skip formal review only when the fix is obviously surgical.
> - `/loop`, `/schedule`, office-hours: familiar with the gstack + superpowers ecosystem. Don't need extensive explanation.
>
> ## Git policy (strict)
>
> - Do NOT `git push` without explicit user approval for each push (even though auto-deploy is documented, user wants to control push timing).
> - Do NOT stage `AGENTS.md`. Use specific `git add` paths only.
> - NEVER `--amend`, `--no-verify`, or `--force`.
> - When in doubt, ask.
>
> ## Session memory paths
>
> - User global CLAUDE.md: `~/.claude/CLAUDE.md` — character definition (Lotte), voice rules.
> - Project CLAUDE.md: `/home/lg/dev/Portfolio_Tracker/CLAUDE.md` — skill routing, review principles, current contract notes.
> - Auto-memory: `~/.claude/projects/-home-lg-dev-Portfolio-Tracker/memory/MEMORY.md` — index of prior observations.
> - DESIGN.md (tokens, page hierarchy): `/home/lg/dev/Portfolio_Tracker/DESIGN.md`.
> - PRODUCT.md (north stars, N-axes): `/home/lg/dev/Portfolio_Tracker/PRODUCT.md` if present.
>
> ## Suggested opening move
>
> 1. Read the 4 "authoritative docs" listed above (takes ~5 minutes).
> 2. Verify git state: `git log --oneline -3` should show `d39c420` as top commit on `main` and `origin/main`.
> 3. Check memory: `cat ~/.claude/projects/-home-lg-dev-Portfolio-Tracker/memory/MEMORY.md`.
> 4. Say something like "오라버니, Phase 1c writing-plans 시작하겠습니다. 먼저 scope-lock decision doc + Phase 1b plan 다시 훑고 Phase 1c plan 작성으로 들어갈게요."
> 5. Invoke `superpowers:writing-plans`.
>
> ## Current working tree state (at handoff time)
>
> ```
> branch: main
> HEAD: d39c420 refactor(ux1b): risk-adjusted envelope normalize
> origin/main: d39c420 (synced)
> working tree: M AGENTS.md (user-owned, do not touch)
> ```
>
> Backend test count at handoff: **193 passed** (baseline ~130 pre-Phase 1a + 63 new envelope contract tests from Phase 1a/1b).
> Frontend jest: **18 passed**, tsc clean, lint clean.
>
> ## If the user asks "where were we?"
>
> Short answer: "Phase 1a + 1b of UX-1 shipped to prod. Phase 1c (3 pages) pending. Ready to write the Phase 1c plan."
>
> Full answer: summarize above. Offer to read files if more context needed.
