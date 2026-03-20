# LOCAL_ENV_SETUP.md

## Purpose

OneDrive 동기화 환경에서 노트북/데스크톱 모두 동일하게 동작하는 로컬 Python 런타임 복구 절차.

## Rule

1. 코드/문서만 OneDrive로 공유한다.
2. 가상환경은 기기 로컬 경로로 분리한다.
3. 기본 venv root:
- `.venvs_hub` (프로젝트 상위 디렉토리 또는 드라이브 루트 `\.venvs_hub`에 미리 생성 권장)
- 또는 `$env:LIFE_VENV_ROOT`

## Desktop / Laptop Setup (same steps)

Prerequisite:
- Python 3.11+ must be installed on each machine (`py -3 --version` or `python --version`).
- **추천**: 프로젝트 상위 폴더나 드라이브 루트(`C:\` 등)에 `.venvs_hub` 폴더를 직접 생성해두면 자동으로 인식됩니다.

```powershell
.\tools\bootstrap_env.ps1 -Recreate -InstallPreCommit
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
