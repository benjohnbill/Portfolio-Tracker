# Skill Intake Checklist

Date: 2026-02-26
Policy: `SYSTEM_SKILL_GOVERNANCE_POLICY.md`

## Pre-Install Gate
- [ ] Source is in `allowed_sources`
- [ ] Usage/maintenance signal checked
- [ ] `SKILL.md` manually reviewed for destructive commands/secrets exposure
- [ ] Conflict check completed (`Agent.md`, `Harness_Policy.md`, `MCP_USAGE_POLICY.md`)
- [ ] Registry entry created before install
- [ ] Rollback plan documented
- [ ] Checksum captured before `pilot/core`

## Skill Decisions (Current)
- [x] `find-skills`: `approve` (discovery-only), status `candidate`
- [x] `vercel-react-best-practices`: `candidate`
- [x] `web-design-guidelines`: `candidate`
- [x] `remotion-best-practices`: `decline`, status `blocked`
- [x] `frontend-design`: `candidate`

## Pilot Promotion Gate
- [ ] Minimum 2 stable cycles completed
- [ ] Quality metric improvement evidence attached
- [ ] Policy/security incident count = 0
- [ ] `checksum_sha256` is present
- [ ] Rollback drill executed once
