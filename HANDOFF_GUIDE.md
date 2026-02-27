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
OneDrive 환경에서의 경로 문제를 피하기 위해 가상환경을 프로젝트 외부(`C:\venvs_hub`)에 생성합니다.
```powershell
# 1. 환경 변수 설정
$env:LIFE_VENV_ROOT = "C:\venvs_hub"

# 2. 부트스트랩 스크립트 실행 (가상환경 생성 및 의존성 설치)
.	ools\bootstrap_env.ps1 -Recreate -InstallPreCommit
```

### B. Node.js 프론트엔드 환경
```powershell
cd frontend
npm install
npm run dev
```

---

## 4. AI에게 요청할 초기 지침 (Prompt for New AI)
새로운 세션을 시작할 때 다음 내용을 입력하세요:
> "현재 Portfolio Tracker 프로젝트를 이어받았습니다. `DOMAIN_MAP.md`와 `HANDOFF_GUIDE.md`를 읽고 프로젝트의 아키텍처와 현재 상태를 파악해줘. 가상환경은 `tools/project_python.ps1`을 통해 관리되고 있어. 준비가 되면 현재 남은 Phase 2 과업이 무엇인지 요약해줘."

---

## 5. ⚠️ 수동 설정 및 개인정보 (User Action Required)
시스템 보안과 개인화를 위해 다음 정보는 사용자가 직접 설정하거나 AI의 요청에 따라 입력해야 합니다.

### A. 환경 변수 (.env)
다음 파일들은 `.gitignore`에 의해 제외되어 있으므로 새로 생성해야 합니다:
- `backend/.env`:
  - `DATABASE_URL`: sqlite:///./data/portfolio.db (기본값)
  - `FINANCIAL_API_KEY`: (Yahoo Finance 또는 한국투자증권 API 키 필요 시)
- `frontend/.env.local`:
  - `NEXT_PUBLIC_API_URL`: http://localhost:8000 (로컬 개발용)

### B. 데이터베이스 초기화
최초 실행 시 DB 스키마를 생성해야 합니다.
```powershell
.	ools\project_python.ps1 backend/scripts/init_db.py
```

### C. 개인 자산 정보
- `backend/data/portfolio.db` 내의 초기 자산 데이터는 사용자의 실제 포트폴리오에 맞게 수정이 필요합니다. (AI에게 "초기 자산 데이터를 입력하고 싶어"라고 요청하세요.)

---

## 7. 🔒 개인정보 및 보안 데이터 (Manual Input Required)
새로운 환경에서 작업을 시작할 때, AI가 다음 정보들을 요청할 것입니다. **이 정보들은 파일에 직접 기록하지 말고, 세션 중에만 제공하거나 `.env` 파일에 안전하게 보관하세요.**

1.  **API Keys:**
    - 한국투자증권 (App Key, Secret Key)
    - Yahoo Finance API Key (필요 시)
2.  **Portfolio Data:**
    - 현재 보유 중인 종목명 및 수량
    - 평균 매수 단가
3.  **Local Paths:**
    - (필요 시) 특정 로컬 데이터 백업 경로

AI가 작업을 시작하면 반드시 **"보안이 필요한 API 키나 개인 자산 정보를 입력할 준비가 되었으니 확인해줘"**라고 말하게 설정되어 있습니다.
