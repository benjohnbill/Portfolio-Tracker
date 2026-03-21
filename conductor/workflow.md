# Workflow & AI Guardrails

## 1. The Conductor-Maestro Paradigm
This project no longer uses "Control Tower" or isolated agent roles. We now operate on a unified AI-native architecture:
- **Conductor:** Manages state via `plan.md` and coordinates the big picture.
- **Maestro:** Executes multi-file or complex tasks based on the `plan.md`.
- **MCP & Skills:** Dynamically injected context and tools depending on the current task's scope.

## 2. Execution Protocol
1. **Always read `plan.md` first:** Identify the current phase and active task.
2. **Observe Tool Guardrails:** Respect the `> [Allowed MCPs: ...]` and `> [Forbidden: ...]` tags in the current phase.
3. **Context First:** Use `context7` to read library documentation (Next.js, FastAPI, Recharts) before writing code.
4. **Validation:** After any code change, verify it (e.g., via `chrome-devtools` for UI or `database-toolbox` for DB).
5. **Update State:** Once a task is validated, mark it as `[x]` in `plan.md`.

## 3. Local Development Constraints
- **Frontend changes:** Must use `shadcn/ui` components for consistency. Start server with `npm run dev`.
- **Backend changes:** Do not modify `models.py` without a migration strategy. Start server with `uvicorn backend.app.main:app --reload`.

## 4. Reporting (EXIT_PROTOCOL)
Follow the global AI Governance Pointer (`[01_AI_Governance_Center]/EXIT_PROTOCOL.md`) to provide standard ✅ [Summary], 📋 [Next Steps], and 📦 [Git Commands] when a phase or task completes.
