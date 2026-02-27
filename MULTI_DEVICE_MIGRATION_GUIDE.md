# AI Handoff & Synchronization Guide (Portfolio Tracker)

이 문서는 다른 기기나 새로운 AI 세션에서 작업을 이어받을 때, AI가 현재 상태를 즉시 파악하고 실행 환경을 구축할 수 있도록 돕는 가이드입니다.

---

## 1. 프로젝트 요약 (Context for AI)
- **이름:** Portfolio Tracker
- **목표:** 개인 자산 포트폴리오 추적, 퀀트 지표(MDD, Sharpe 등) 시각화 및 자동 리밸런싱 지원.
- **현재 단계:** Phase 1 완료 (기초 아키텍처 수립 및 API/UI 연동 완료).
- **특이사항:** AI 기반 개발(Vibe Coding)을 위해 최적화된 구조이며, 에이전트 오케스트레이션(Control Tower, Backend/Frontend Agent) 개념이 도입됨.

## 2. 기술 스택 (Tech Stack)
- **Backend:** FastAPI (Python 3.11+), SQLAlchemy (ORM), SQLite
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **Package Management:** `uv` (Python), `npm` (Node.js)
- **Governance:** JSON Schema 기반의 태스크/결과 계약 (`orchestration/contracts`)

## 3. 작업 환경 복구 (Recovery Steps)

### A. Python 백엔드 환경 (Windows 권장)
OneDrive 환경에서의 경로 문제를 피하기 위해 가상환경을 프로젝트 외부(`.venvs_hub`)에 생성합니다.
시스템은 프로젝트 루트에서 상위로 올라가며 `.venvs_hub` 폴더를 자동으로 찾습니다. (없을 경우 드라이브 루트 `\.venvs_hub` 사용)

```powershell
# 1. (선택사항) 특정 경로를 강제하고 싶을 때만 설정
# $env:LIFE_VENV_ROOT = "C:\.venvs_hub"

# 2. 부트스트랩 스크립트 실행 (가상환경 생성 및 pre-commit 설치)
# 이 스크립트는 가상환경을 만들고 pre-commit install을 자동으로 수행합니다.
.\tools\bootstrap_env.ps1 -Recreate -InstallPreCommit

# 3. pre-commit 작동 확인
# 만약 git commit 시 'pre-commit not found' 에러가 나면 아래 명령어로 수동 설치하세요.
.\tools\project_python.ps1 -m pre_commit install
```

### B. Node.js 프론트엔드 환경
```powershell
cd frontend
npm install
npm run dev
```

---

## 4. AI 세션 초기화 체크리스트 (Self-Verification for AI)
새로운 AI 에이전트는 작업을 시작하기 전 다음 사항을 스스로 검증해야 합니다.

1.  **필수 문서 읽기:**
    - [ ] `MULTI_DEVICE_MIGRATION_GUIDE.md` (본 문서)
    - [ ] `DOMAIN_MAP.md` (도메인 규칙 및 경계 파악)
2.  **환경 및 동기화 검증:**
    - [ ] `.\tools\project_python.ps1` 실행 가능 여부 확인
    - [ ] **Sync Check**: `git pull` 이후 `requirements.txt`나 `package.json`이 변경되었는지 확인.
    - [ ] 만약 의존성 파일이 변경되었다면, `.\tools\bootstrap_env.ps1` (백엔드) 또는 `npm install` (프론트엔드)을 재실행하여 로컬 환경을 코드와 동기화.
3.  **사용자 인터랙션:**
    - [ ] "보안이 필요한 API 키나 개인 자산 정보를 입력할 준비가 되었나요?"라고 질문하기

---

## 5. 일상적인 동기화 흐름 (Daily Sync / Git Pull)
이미 환경이 구축된 기기에서 작업을 재개할 때의 절차입니다.

1.  **코드 업데이트**: `git pull origin main`
2.  **환경 정합성 체크**:
    - AI는 `git diff HEAD@{1} -- requirements.txt` 등의 명령으로 의존성 변화를 감지해야 합니다.
    - 변화가 감지되면 즉시 `.\tools\bootstrap_env.ps1`을 실행하여 로컬 가상환경을 업데이트합니다. (이 스크립트는 기존 환경을 유지하면서 부족한 패키지만 추가 설치하므로 빠릅니다.)
3.  **Pre-commit 갱신**: 가상환경 경로가 물리적으로 이동했다면, `.\tools\project_python.ps1 -m pre_commit install`을 다시 실행하여 Git Hook을 현재 기기 경로로 갱신합니다.

---

## 5. AI에게 요청할 초기 지침 (Prompt for New AI)
새로운 세션을 시작할 때 다음 내용을 입력하세요:
> "현재 Portfolio Tracker 프로젝트를 이어받았습니다. `MULTI_DEVICE_MIGRATION_GUIDE.md`를 읽고 섹션 4의 'AI 세션 초기화 체크리스트'를 순서대로 수행해줘. 특히 `DOMAIN_MAP.md`를 통해 내가 어떤 규칙을 지켜야 하는지 먼저 요약해준 뒤, 다음 과업인 Phase 2 진행 방향을 제안해줘."

---

## 6. ⚠️ 수동 설정 및 개인정보 (User Action Required)

### A. 환경 변수 (.env)
다음 파일들은 `.gitignore`에 의해 제외되어 있으므로 새로 생성해야 합니다:
- `backend/.env`: `DATABASE_URL`, `FINANCIAL_API_KEY` 등
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL` 등

### B. 데이터베이스 초기화 (최초 1회)
```powershell
.\tools\project_python.ps1 backend/scripts/init_db.py
```

---

## 7. 🔒 개인정보 및 보안 데이터 (Manual Input Required)
새로운 환경에서 작업을 시작할 때, AI가 다음 정보들을 요청할 것입니다.

1.  **API Keys:** 한국투자증권 (App Key, Secret Key)
2.  **Portfolio Data:** 현재 보유 중인 종목명, 수량, 평균 매수 단가
3.  **Secrets:** 그 외 외부에 노출되어서는 안 되는 민감한 설정값들

AI는 세션이 시작될 때 위 정보들을 사용자에게 정중히 요청하도록 설계되었습니다.
