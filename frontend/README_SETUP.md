# Frontend Project Setup

이 폴더는 Portfolio Tracker의 프론트엔드(Next.js) 작업을 위한 공간입니다.

## 1. 초기화 (Initialization)

Antigravity IDE(VS Code/Cursor)의 터미널을 열고 다음 명령어를 실행하여 Next.js 프로젝트를 초기화하세요.

```bash
npx create-next-app@latest . --typescript --tailwind --eslint
```

설치 중 질문에는 다음과 같이 답변하세요:
- **Would you like to use TypeScript?** -> Yes
- **Would you like to use ESLint?** -> Yes
- **Would you like to use Tailwind CSS?** -> Yes
- **Would you like to use `src/` directory?** -> Yes (Recommended)
- **Would you like to use App Router?** -> Yes (Recommended)
- **Would you like to customize the default import alias (@/*)?** -> No

## 2. UI 라이브러리 설치 (shadcn/ui)

프로젝트 초기화가 완료되면, 다음 명령어로 `shadcn/ui`를 설정하세요.

```bash
npx shadcn-ui@latest init
```

## 3. 작업 시작 (Vibe Coding)

`INSTRUCTIONS.md` 파일에 있는 프롬프트를 복사하여 AI 에이전트에게 입력하고 작업을 시작하세요.

## 4. 백엔드 연동

백엔드 API는 `http://localhost:8000`에서 실행될 예정입니다.
Mock Data를 활용하여 UI를 먼저 구현한 뒤, 실제 API와 연동하세요.
