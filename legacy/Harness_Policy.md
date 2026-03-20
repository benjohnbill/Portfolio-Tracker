# Harness_Policy.md

Last updated: 2026-02-26
Scope: `-01_Coding` repository only

## 1) Purpose

Define execution gates and evidence rules for control-tower operations.

## 2) Mandatory Gates

Run these checks before accepting a cycle-close handoff:
1. `.\tools\project_python.ps1 tools/validate_contracts.py`
2. `.\tools\project_python.ps1 tools/check_skill_registry.py --mode strict`
3. Role-specific validation commands declared in each task contract

If project Python is unavailable, gate is `blocked` until runtime is restored.

## 3) Evidence Priority

When claims conflict, trust sources in this order:
1. `orchestration/handoff/latest.handoff.json`
2. `orchestration/task.json`
3. `orchestration/results/*.result.json`
4. `integration_status.md`

Markdown narrative cannot override schema-valid JSON verdicts.

## 4) Skill Governance Binding

Skill onboarding must satisfy `skills/approved_skills_registry.json` policy:
- Non-allow-listed source: `blocked`
- `pilot`/`core`: checksum required
- Missing rollback plan: reject promotion

## 5) Escalation

Escalate to user decision when:
- gate failures persist after one retry,
- policy conflict exists across authority docs,
- a task requires destructive actions outside approved scope.
