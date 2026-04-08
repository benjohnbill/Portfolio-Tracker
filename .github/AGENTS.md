<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-08 -->

# .github

## Purpose
GitHub configuration including CI/CD workflows.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `workflows/` | GitHub Actions workflow definitions |

## For AI Agents

### Working In This Directory
- Two workflows exist: daily quant update and keep-alive heartbeat
- Both reference `BACKEND_BASE_URL` secret for the deployed backend
- Changes here affect CI/CD — confirm with user before modifying

### Key Workflows

| Workflow | Purpose |
|----------|---------|
| `workflows/daily-quant-update.yml` | Scheduled daily call to `/api/cron/update-signals` |
| `workflows/keep-alive.yml` | Periodic ping to `/api/assets` to prevent hibernation |

<!-- MANUAL: -->
