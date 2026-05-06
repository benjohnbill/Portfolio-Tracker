# Portfolio Tracker

## Operational reference map

Operational details live in dedicated docs — read on demand:
- **Build/test/lint/dev/CI**: `AGENTS.md` §COMMANDS, §VALIDATION EXPECTATIONS
- **Architecture & data flow**: `ARCHITECTURE.md`
- **Product north stars (N1–N8), non-goals, weekly loop semantics**: `PRODUCT.md`
- **Design system (typography, color, spacing)**: `DESIGN.md`
- **Local env setup, secrets, ports**: `LOCAL_ENV_SETUP.md`
- **Per-directory conventions**: `<dir>/AGENTS.md` (23 guides under backend/, frontend/, docs/)
- **Project conventions** (coding, testing, git, karpathy guidelines): `.claude/rules/*.md` (auto-loaded by Claude Code)

## Quick commands (fallback)

```bash
# Frontend
cd frontend && npm run dev          # local dev server
cd frontend && npm run lint         # repo-local config
cd frontend && npm run build        # type-check + build

# Backend (venv required — uvicorn is NOT on system PATH)
cd backend && .venv/bin/python -m pytest tests -q
cd backend && .venv/bin/python -m pytest tests/test_friday_service.py -q
cd backend && .venv/bin/uvicorn app.main:app --reload     # port 8000
```

> Backend uvicorn lives at `backend/.venv/bin/uvicorn`; system PATH lookup fails.
> Port 8000 conflicts with claude-mem ChromaDB worker if that is running.

## 자가 기록

작업 중 발견한 것 (envelope 패턴 위반, 새 service 분리, 새 testing edge case, 새 contract 등)은
관련 문서에 능동 갱신 — `ARCHITECTURE.md`, `PRODUCT.md`, `.claude/rules/*.md` 중 적절한 곳.
글로벌 `~/.claude/CLAUDE.md` §프로젝트 CLAUDE.md 패턴 참조.

## Pre-commit gotchas

- Never commit `backend/.env`, `KIS_*` values, `CRON_SECRET`, or live `DATABASE_URL`
- Don't add request-time DDL to Friday paths — point operators to migrations instead
- `GET /api/reports/weekly/latest` stays read-only (no regenerate/upsert on GET)
- Frontend: keep `package.json` lint script non-interactive (no `next lint` setup prompts)
- Don't stage root `AGENTS.md` `<claude-mem-context>` block (auto-injected, never commit)

## Skill routing

Skills auto-route via description. Active guidance table is in global `~/.claude/CLAUDE.md` §능동 가이드.
프로젝트 specific skill 확장은 `.claude/rules/`에서 정의.

## Current Contract Notes
- `GET /api/reports/weekly/latest` is a read-only persisted-report endpoint. Do not regenerate or upsert reports on that GET path.
- If the current week has no persisted report yet, the backend currently falls back to the latest persisted report. Treat that as intentional until a separate live-preview redesign is approved.
- Friday snapshot/archive surfaces must handle partial snapshots safely. Missing score, value, regime, or rules data should render explicit unavailable placeholders rather than crash.
- Do not add request-time DDL back into Friday request paths. Missing tables should point operators to migrations/setup, not be created inside normal reads/writes.

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

See `PRODUCT.md` §3 (Core Loop) and §9 (Accumulation-as-Hero) for freeze-as-contract semantics, 3-scalar confidence anchors, and structured invalidation schema. When editing the freeze flow, read those sections first — they are the authoritative source. This file intentionally avoids duplicating them to prevent drift.
