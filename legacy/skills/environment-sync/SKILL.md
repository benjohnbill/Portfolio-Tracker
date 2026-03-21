# Skill: Environment Sync (Model B - Advisory)

이 스킬은 멀티디바이스 개발 환경에서 코드와 로컬 실행 환경 간의 차이(Drift)를 감지하고, 이를 일관되게 복구하여 개발 연속성을 보장하는 데 특화되어 있습니다.

---

## 0. 참조 (System Reference)
- **상위 시스템 프로토콜:** [SYSTEM_SKILL_ENVIRONMENT_SYNC.md](D:\OneDrive\Desktop\Life_System\02_Core_Resources\01_Agent_Orchastration_System\SYSTEM_SKILL_ENVIRONMENT_SYNC.md)

---

## 1. 핵심 원칙 (MDOP - Model B)

1.  **Advisory Mode:** 에이전트는 환경 불일치를 감지했을 때 즉시 수정하지 않고, 사용자에게 변경 사항을 보고한 뒤 **명시적 승인(Y/n)**을 받아야 합니다.
2.  **Source of Truth:** 환경의 기준점은 `MULTI_DEVICE_MIGRATION_GUIDE.md`에 명시된 의존성 리스트와 `.env` 요구사항입니다.
3.  **Dynamic Isolation:** 가상환경은 드라이브 루트의 공유 폴더인 `\.venvs_hub\[project-name]`를 사용하여 기기 간 경로 충돌을 방지합니다.

---

## 2. 작동 절차 (Procedural Guide)

### 단계 1: Drift 감지 (Detection)
세션 시작 또는 `git pull` 직후 다음 항목을 점검합니다.
- **venv 확인:** `\.venvs_hub\portfolio_tracker_dev` 경로에 유효한 Python 인터프리터가 존재하는지 확인.
- **의존성 확인:** `requirements.txt`와 현재 `pip freeze` 결과의 해시를 대조하여 미설치 또는 버전 불일치 패키지 추출.
- **비밀 정보 확인:** `.env` 파일 내에 `MULTI_DEVICE_MIGRATION_GUIDE.md`에서 요구하는 필수 키가 누락되었는지 확인.

### 단계 2: 현황 보고 (Reporting)
발견된 차이점을 사용자에게 리포트합니다.
> **[Environment Drift Detected]**
> - 누락된 패키지: `pandas`, `fastapi`
> - 누락된 .env 키: `FINANCIAL_API_KEY`
> - 가상환경 상태: 재구축 필요 (또는 정상)
> 
> **환경을 업데이트하시겠습니까? (Y/n)**

### 단계 3: 복구 실행 (Execution)
사용자 승인 시 다음 명령을 순차적으로 수행합니다.
1.  **venv 생성/복구:** 가상환경 부재 시 `python -m venv` 생성.
2.  **의존성 설치:** `pip install -r requirements.txt` 실행.
3.  **비밀 정보 요청:** 누락된 `.env` 키에 대해 사용자에게 입력을 요청하고 파일을 생성/업데이트합니다.
4.  **Hook 동기화:** `pre-commit install`을 재실행하여 현재 기기 경로에 맞게 Hook을 갱신합니다.

---

## 3. 에이전트 지침 (Agent Instructions)

- 작업을 시작할 때 반드시 이 스킬을 호출하여 환경 정합성을 먼저 확인하십시오.
- 절대로 사용자의 승인 없이 `.env` 파일을 덮어쓰거나 가상환경을 삭제하지 마십시오.
- 모든 경로는 `tools/project_python.ps1`의 동적 탐색 로직을 준수해야 합니다.
