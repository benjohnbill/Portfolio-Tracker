# Workflow & AI Guardrails

Archived from `conductor/workflow.md` during control-plane reduction.

## 1. The Conductor-Maestro Paradigm
This project no longer uses "Control Tower" or isolated agent roles. We now operate on a unified AI-native architecture:
- **Conductor:** Managed state via `plan.md` and coordinated the big picture.
- **Maestro:** Executed multi-file or complex tasks based on the `plan.md`.
- **MCP & Skills:** Dynamically injected context and tools depending on the current task's scope.

## 2. Execution Protocol
1. **Always read `plan.md` first:** Identify the current phase and active task.
2. **Observe Tool Guardrails:** Respect the `> [Allowed MCPs: ...]` and `> [Forbidden: ...]` tags in the current phase.
3. **Bootstrap References:** Use `../DOMAIN_MAP.md`, `../LOCAL_ENV_SETUP.md`, and `../MCP_USAGE_POLICY.md` when startup context is unclear.
4. **Context First:** Use documentation and code context before writing code.
5. **Validation:** After any code change, verify it with the appropriate local checks for the touched area.
6. **Update State:** Once a task is validated, mark it as `[x]` in `plan.md`.

## 3. Local Development Constraints
- **Frontend changes:** Must use `shadcn/ui` components for consistency. Start server with `npm run dev`.
- **Backend changes:** Do not modify `models.py` without a migration strategy. Start server with `uvicorn backend.app.main:app --reload`.

## 4. Reporting
When a task or phase completes, report:
- ✅ Summary
- 📋 Next Steps
- 📦 Git/verification commands used (when relevant)
