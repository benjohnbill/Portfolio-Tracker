# SESSION_KICKOFF (Handover Document)

> **CRITICAL:** 이 문서는 세션 초기화 후 새 에이전트의 빠른 동기화를 위해 생성되었습니다. 내용을 확인하고 작업을 시작했다면, 컨텍스트 정화를 위해 이 파일을 즉시 삭제하십시오.

## 1. Current Runtime Status
- **Frontend:** Next.js (Port 3000) is running in the background.
- **Backend:** FastAPI (Port 8000) is running in the background.
- **DB:** SQLite (`backend/data/portfolio.db`) is active and seeded with real transactions.

## 2. Recent Major Achievements (Phase 3.3 Complete)
- **KIS API Integration:** Successfully linked Korea Investment & Securities API.
- **Brazil Bond Sync:** Brazil Bonds are tracked via `tr_id="CTRP6504R"` and filtered by name ("BNTNF", "NTNF").
- **Auto-Pricing Engine:** The `create_transaction` API now auto-fetches market prices (Yahoo/FDR/KIS) if the price field is left empty.
- **Dynamic Assets:** Users can now add ANY ticker (including KR codes) directly from the UI.

## 3. Technical Debt & Knowledge
- **Brazil Bond Ticker:** Use `BRAZIL_BOND` as the symbol for manual entry to trigger KIS API lookup.
- **Pydantic Fix:** `TransactionCreate` schema has been updated to accept date as a string to prevent validation errors.

## 4. Immediate Next Step
- **Visual Verification:** Check the dashboard (`localhost:3000`) to confirm the `BRAZIL_BOND` (approx. ₩1.86M) is correctly reflected in the Total Value and Holdings list.
- **Phase 4 Planning:** Start discussing advanced analysis (Dividend tracking, LLM-based portfolio insights).

---
**AI Action:** Read this file, sync your state, and delete this file before proceeding.
