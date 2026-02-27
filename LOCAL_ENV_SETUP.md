# LOCAL_ENV_SETUP.md

## Purpose

OneDrive 동기화 환경에서 노트북/데스크톱 모두 동일하게 동작하는 로컬 Python 런타임 복구 절차.

## Rule

1. 코드/문서만 OneDrive로 공유한다.
2. 가상환경은 기기 로컬 경로로 분리한다.
3. 기본 venv root:
- `C:\venvs_hub` (한글 사용자명 환경 권장)
- 또는 `$env:LIFE_VENV_ROOT`

## Desktop / Laptop Setup (same steps)

Prerequisite:
- Python 3.11+ must be installed on each machine (`py -3 --version` or `python --version`).

```powershell
$env:LIFE_VENV_ROOT = "C:\venvs_hub"
.\tools\bootstrap_env.ps1 -Recreate -InstallPreCommit
.\tools\project_python.ps1 --version
.\tools\project_python.ps1 tools/validate_contracts.py
.\tools\project_python.ps1 tools/run_control_tower_gate.py
```

If Python launcher is not discovered automatically:

```powershell
.\tools\bootstrap_env.ps1 -Recreate -BasePython "C:\Path\To\python.exe"
```

Optional lock refresh:

```powershell
.\tools\bootstrap_env.ps1 -WriteLock
```

## Do Not

- 프로젝트 내부 `venv/.venv`를 canonical runtime으로 사용하지 않는다.
- `pyvenv.cfg`에 타 기기 절대경로가 들어간 환경을 재사용하지 않는다.
