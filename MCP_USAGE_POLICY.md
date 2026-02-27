# MCP_USAGE_POLICY.md

Last updated: 2026-02-26
Scope: `-01_Coding` repository only

## 1) Default Stance

MCP usage is deny-by-default unless explicitly required by a task and approved by project policy.

## 2) Allowed Usage Conditions

MCP can be used only when all conditions are met:
1. Task objective cannot be completed by local repository tools alone.
2. No secrets, tokens, or sensitive user data are exposed.
3. Action is logged in handoff evidence.

## 3) Disallowed Actions

- Activating new external skills/providers during cycle close.
- Sending repository secrets or private credentials to external services.
- Making source-of-truth decisions from MCP output without local evidence validation.

## 4) Required Logging

For each MCP-assisted task, record:
- reason MCP was needed,
- command/action summary,
- resulting artifact path and validation outcome.
