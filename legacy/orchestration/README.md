# Orchestration Workspace

This folder contains shared contracts and example artifacts for Control Tower orchestration.

## Structure

- `contracts/`: JSON schemas for task/result/handoff
- `examples/`: sample payloads that must pass schema validation

## Validate

```powershell
.\tools\project_python.ps1 tools/validate_contracts.py
```

Optional single-file validation:

```powershell
.\tools\project_python.ps1 tools/validate_contracts.py --file orchestration/examples/sample.task.json
```
