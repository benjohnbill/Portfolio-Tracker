# PLAN.md

This file is the active root-level plan and current-scope reference.

## Current Focus
- Stabilize the repository control plane so future agent work starts from a small, reliable bootstrap path.
- Keep active implementation centered on `backend/app/` and `frontend/src/`.
- Reduce `conductor/` to compatibility shims while preserving historical planning material under `docs/archive/`.

## Completed Batch
### Batch 1 — Root Control Plane
- [x] Repair bootstrap references
- [x] Add a root `README.md`
- [x] Establish root-level `PLAN.md`
- [x] Move setup guidance toward `docs/local-setup.md`
- [x] Reduce duplicate bootstrap docs during transition

### Batch 2 — Conductor Reduction
- [x] Archive historical conductor docs under `docs/archive/conductor-bootstrap/`
- [x] Leave compatibility shims under `conductor/`
- [x] Remove conductor from the primary bootstrap path

### Batch 3 — Legacy Freeze
- [x] Add `legacy/README.md` freeze notice
- [x] Mark `legacy/` as frozen historical material in root docs

## Next Batch
- [x] Audit workflows for stale path references
- [x] Separate env/secret cleanup from document cleanup
- [ ] Remove generated artifact noise after runtime/bootstrap is stable

### Gate 1 — Safe Env Preparation
- [x] Add tracked placeholder `backend/.env.example`
- [x] Allow `.env.example` tracking in `.gitignore`
- [x] Document stop conditions and external coordination points before any real secret changes

### Gate 2 — External Coordination Required
- [ ] Rotate and revalidate real `KIS_*` credentials outside the repo
- [ ] Verify deployed `CRON_SECRET` and GitHub `CRON_SECRET` match
- [ ] Verify GitHub `BACKEND_BASE_URL` points at the active backend
- [ ] Decide whether production `DATABASE_URL` changes are needed before touching runtime config

## Workflow Notes
- Legacy-only governance workflows tied to root `skills/`, `orchestration/`, and `tools/` paths were retired.
- Operational workflows now expect `BACKEND_BASE_URL` as a GitHub secret instead of a hardcoded deployment URL.

## Env / Secret Notes
- Gate 1 is complete: repo-safe documentation and example-file preparation only.
- Real secret rotation is intentionally deferred until external provider and deployment access are available.

## Tooling / Scope Notes
- Root docs are now the primary bootstrap path: `README.md` -> `AGENTS.md` -> `PLAN.md` -> `docs/local-setup.md`.
- `conductor/` now exists only for compatibility redirects and archive discovery.
- `legacy/` is not active source-of-truth.
