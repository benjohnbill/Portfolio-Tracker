<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# legacy

## Purpose
Frozen historical material from the previous iteration. Contains the original vanilla JS frontend, Python backend, agent orchestration framework, and skill registry. **Not authoritative — do not edit unless explicitly requested.**

## Key Files

| File | Description |
|------|-------------|
| `README.md` | Marks this directory as frozen/non-authoritative |
| `Agent.md`, `Backend_Agent.md`, `Frontend_Agent.md`, `Control_Tower_Agent.md` | Historical agent specifications |
| `Harness_Policy.md` | Legacy execution policies |
| `PHASE_1_REPORT.md` | Phase 1 completion report |
| `requirements.txt` | Previous Python dependencies |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `backend/` | Original FastAPI backend with rebalance calculations and data caches |
| `frontend/` | Vanilla HTML/JS/CSS frontend with chart rendering and strategy logic |
| `orchestration/` | Agent orchestration framework with JSON contract schemas |
| `skills/` | Skill registry, approval workflow, and environment-sync specification |
| `tools/` | Windows PowerShell bootstrap and setup utilities |

## For AI Agents

### Working In This Directory
- **Do not edit** files here unless the user explicitly requests it
- Use as historical reference only; active code lives in `backend/` and `frontend/` at repo root
- If comparing old vs new approaches, this directory shows what was replaced

<!-- MANUAL: -->
