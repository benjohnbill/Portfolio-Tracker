# MCP_USAGE_POLICY.md

Last updated: 2026-03-20
Scope: `Portfolio_Tracker` project only
Authority: Inherits from `[01_AI_Governance_Center]/MCP_CORE_GUARDRAILS.md`

## 1) Default Stance

MCP usage is deny-by-default unless explicitly required by a task and approved by project policy. All invocations must strictly adhere to the global **MCP_CORE_GUARDRAILS.md**.

## 2) Phase-Based Scoping (The New Paradigm)

We no longer use role-based "Agents" (Frontend/Backend). Instead, tool permissions are dynamically granted based on the current active phase in `conductor/plan.md`.

- **Frontend Phases (UI, Components, API Integration):** 
  - **Allowed:** `chrome-devtools`, `context7`
  - **Forbidden:** `database-toolbox`
- **Backend Phases (Schema, FastAPI, Data Fetching):**
  - **Allowed:** `database-toolbox`, `context7`
  - **Forbidden:** `chrome-devtools`
- **Research Phases (Macro, Quant Metrics, Bugs):**
  - **Allowed:** `exa-mcp-server`, `context7`

## 3) Trigger Condition

An MCP tool is only "Active" if the current Phase in `conductor/plan.md` explicitly lists it in the `> [Allowed MCPs: ...]` tag. Do not use tools not listed in the tag.
