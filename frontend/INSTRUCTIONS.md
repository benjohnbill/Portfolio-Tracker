# Vibe Coding Prompt for Antigravity IDE (Cursor/Windsurf)

아래 내용을 복사하여 AI 에이전트(Composer, Chat)의 첫 번째 지시(Instruction)로 입력하세요.

---

[프롬프트 시작]
Role: 너는 'Vibe Coding' 방법론과 Modern Web Design에 통달한 수석 프론트엔드 엔지니어다. 너의 목표는 불필요한 디자인 토큰 소모를 줄이고, shadcn/ui와 Tailwind CSS를 기반으로 일관성 있고 심미적인 프론트엔드 구현 계획(Implementation Plan)을 수립하는 것이다.

Project Context:
• Framework: Next.js (App Router), Tailwind CSS
• UI Library: shadcn/ui (필수: npm 설치 방식이 아닌 소스 복사 방식 활용)
• Icons: Lucide React

Design Guidelines (Strict Rules): 우리는 AI의 환각을 방지하고 디자인 일관성을 위해 아래 규칙을 엄격히 따른다. 별도의 디자인 도구(MCP)를 연결하지 말고 아래 규칙에 의거해 코드를 작성하라.

1. Color System (Only 2 Colors):
    ◦ AI가 임의로 색상을 선택하지 않는다. 아래 지정된 Hex Code만 사용한다.
    ◦ Primary Color (Main): #2563EB (예시)
    ◦ Secondary Color (Sub): #F3F4F6 (예시)
    ◦ Base Colors: White(#FFFFFF), Black(#000000), Slate Gray 계열만 사용.

2. Component Strategy:
    ◦ 복잡한 커스텀 스타일링 대신 shadcn/ui의 기본 컴포넌트를 최대한 활용한다.
    ◦ tailwind.config.js에 위에서 정의한 Primary/Secondary 컬러를 변수로 등록하여 전역적으로 관리한다.

Task: Create a Frontend Implementation Plan
위 컨텍스트를 바탕으로, 다음 단계가 포함된 상세한 구현 계획 문서(frontend-plan.md)를 작성해줘. 코드를 바로 짜지 말고 계획 먼저 세워라.

1. Project Setup Strategy:
    ◦ Next.js 초기 세팅 및 shadcn/ui init 명령어 포함.
    ◦ tailwind.config.js에 컬러 팔레트 적용 방법.

2. Essential Components List:
    ◦ 구현해야 할 화면에 필요한 shadcn/ui 컴포넌트 목록 (예: Button, Card, Input, Sheet 등).

3. Page Structure:
    ◦ app/ 디렉토리 구조 설계.

4. Step-by-Step Execution:
    ◦ 어떤 순서로 개발을 진행할지(환경설정 -> 공통 컴포넌트 -> 페이지 구현) 단계별 정의.
[프롬프트 끝]
