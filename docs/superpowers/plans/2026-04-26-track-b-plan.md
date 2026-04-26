# Track B Implementation Plan
# Naming Hygiene + Archive Backfill + Frontend Display Switch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the naming convention rollout, fix KR ETF display names in the frontend, clean up QQQ residue in service code, and prepare archive backfill migrations.

**Architecture:** Frontend-first (B3 → B4 → B1 → B2). B3 and B4 deploy independently of Track A's production state; B1 is code-written now, deploy-gated until Track A prod migrations are applied; B2 is blocked on price data from the user. All code ships on `main`.

**Tech Stack:** FastAPI backend (Python, SQLAlchemy, Alembic), Next.js 14 frontend (TypeScript, RSC), SQLite C-track for tests, Supabase Postgres for production.

---

## File Map

| File | Group | Change |
|---|---|---|
| `frontend/src/components/features/portfolio/AssetAllocationSection.tsx` | B3 | Swap bold/muted: name↔symbol |
| `backend/app/services/friday_service.py` | B3 | Add `_names_map`; add `name` to `holdings_changed` |
| `frontend/src/lib/api.ts` | B3 | Add `name: string \| null` to `FridayComparison.holdings_changed` |
| `frontend/src/app/friday/archive/page.tsx` | B3 | `item.name ?? item.symbol` in sleeve-shift line |
| `frontend/src/components/features/AddAssetModal.tsx` | B3 | New placeholder + helper text |
| `backend/app/services/score_service.py` | B4 / B1 | B4: remove `"QQQ"` token; B1: replace KODEX/TIGER tokens with `"NDX_"` |
| `backend/app/services/quant_service.py` | B4 | Standardise NDX proxy comments at lines 304 and 363-364 |
| `backend/tests/test_cashflow_consumer_rebinding.py` | B4 | `asset_ticker="QQQ"` → `"KODEX_1X"` |
| `backend/tests/test_api.py` | B4 | `asset_ticker="QQQ"` → `"KODEX_1X"` |
| `backend/tests/integration/test_freeze_flow.py` | B4 | `asset_ticker="QQQ"` → `"KODEX_1X"` |
| `backend/tests/test_briefing_service.py` | B4 | `asset_ticker="QQQ"` → `"KODEX_1X"` |
| `backend/tests/fixtures/seeds.py` | B4 | Default `asset_ticker` → `"KODEX_1X"` |
| `backend/alembic/versions/<rev>_track_b_ndx_symbol_revision.py` | B1 | New migration: KODEX_1X→NDX_1X, TIGER_2X→NDX_2X |
| `backend/app/services/stress_service.py` | B1 | Rename TICKER_PROXY keys |
| `backend/app/services/algo_service.py` | B1 | Holdings checks + action strings: KODEX_1X→NDX_1X, TIGER_2X→NDX_2X |
| `backend/tests/test_track_a_algo_rotation.py` | B1 | Action string assertions: NDX_1X/NDX_2X |
| `backend/tests/test_track_a_account_silo.py` | B1 | Symbol seeds: NDX_1X, NDX_2X |
| `backend/tests/test_track_a_anchor_aware_curve.py` | B1 | Seed symbol: NDX_1X |
| `backend/alembic/versions/<rev>_track_b_ace_tlt_rename.py` | B1 | New migration: TLT→ACE_TLT, Korean name |
| `backend/alembic/versions/<rev>_track_b_brazil_bond_name.py` | B1 | New migration: BRAZIL_BOND name→Korean |
| `docs/architecture/asset-naming-convention.md` | B1 | Document revised convention |

---

## Task 1 (B3-1): AssetAllocationSection — swap name/symbol display

**Files:**
- Modify: `frontend/src/components/features/portfolio/AssetAllocationSection.tsx:62-65`

- [ ] **Step 1: Confirm current state**

  Lines 62-65 currently read:
  ```tsx
  <span className="text-sm font-bold text-white">{asset.asset}</span>
  <span className="text-[10px] text-muted-foreground">{asset.quantity} shares</span>
  </div>
  <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{asset.name}</p>
  ```
  `asset.asset` (symbol like `KODEX_1X`) is bold; `asset.name` (Korean full name) is muted.
  Target: swap so `asset.name` is bold, `asset.asset` is muted secondary identifier.

- [ ] **Step 2: Apply the swap**

  In `AssetAllocationSection.tsx` change lines 62 and 65:
  ```tsx
  <span className="text-sm font-bold text-white">{asset.name}</span>
  <span className="text-[10px] text-muted-foreground">{asset.quantity} shares</span>
  </div>
  <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{asset.asset}</p>
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/frontend
  npx tsc --noEmit 2>&1 | grep "AssetAllocationSection"
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/components/features/portfolio/AssetAllocationSection.tsx
  git commit -m "feat(track-b/b3): AssetAllocationSection — name as primary label, symbol as secondary"
  ```

---

## Task 2 (B3-2): Backend — add name to holdings_changed

**Files:**
- Modify: `backend/app/services/friday_service.py`
- Modify: `frontend/src/lib/api.ts`
- Test: `backend/tests/test_friday_service.py`

- [ ] **Step 1: Write the failing test**

  Add to `backend/tests/test_friday_service.py`:
  ```python
  def test_compare_snapshots_holdings_changed_includes_name(db_session):
      """compare_snapshots must include name in each holdings_changed entry."""
      from datetime import date
      from app.models import WeeklySnapshot

      frozen_a = {
          "portfolioSnapshot": {
              "totalValueKRW": 1_000_000,
              "allocation": [
                  {"asset": "NDX_1X", "name": "KODEX 미국나스닥100", "weight": 0.5, "value": 500_000},
              ],
          }
      }
      frozen_b = {
          "portfolioSnapshot": {
              "totalValueKRW": 1_200_000,
              "allocation": [
                  {"asset": "NDX_1X", "name": "KODEX 미국나스닥100", "weight": 0.6, "value": 720_000},
              ],
          }
      }
      snap_a = WeeklySnapshot(week_ending=date(2026, 4, 17), frozen_report=frozen_a)
      snap_b = WeeklySnapshot(week_ending=date(2026, 4, 24), frozen_report=frozen_b)
      db_session.add_all([snap_a, snap_b])
      db_session.commit()

      result = FridayService.compare_snapshots(db_session, date(2026, 4, 17), date(2026, 4, 24))
      changed = result["deltas"]["holdings_changed"]

      assert len(changed) == 1
      assert changed[0]["symbol"] == "NDX_1X"
      assert changed[0]["name"] == "KODEX 미국나스닥100"
      assert "weight_a" in changed[0]
      assert "weight_b" in changed[0]
  ```

- [ ] **Step 2: Run test — verify it fails**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/test_friday_service.py::test_compare_snapshots_holdings_changed_includes_name -v
  ```
  Expected: `FAILED` — `name` key missing from holdings_changed dict.

- [ ] **Step 3: Add `_names_map` to friday_service.py**

  Insert after `_holdings_map` (after line 490), before `compare_snapshots`:
  ```python
  @staticmethod
  def _names_map(payload: Dict[str, Any]) -> Dict[str, str]:
      allocation = FridayService._get_nested(payload, ["portfolioSnapshot", "allocation"], default=[])
      if not isinstance(allocation, list):
          return {}
      result: Dict[str, str] = {}
      for item in allocation:
          if not isinstance(item, dict):
              continue
          symbol = item.get("asset") or item.get("symbol")
          name = item.get("name")
          if symbol and name:
              result[str(symbol)] = str(name)
      return result
  ```

- [ ] **Step 4: Update `compare_snapshots` to use `_names_map`**

  In `compare_snapshots`, after the two `holdings_a / holdings_b` lines (currently lines 515-516), add:
  ```python
  names_a = FridayService._names_map(report_a)
  names_b = FridayService._names_map(report_b)
  ```
  Then update the `holdings_changed` list comprehension (currently lines 518-527) to include `name`:
  ```python
  holdings_changed = [
      {
          "symbol": symbol,
          "name": names_a.get(symbol) or names_b.get(symbol),
          "weight_a": holdings_a.get(symbol, 0.0),
          "weight_b": holdings_b.get(symbol, 0.0),
          "delta": holdings_b.get(symbol, 0.0) - holdings_a.get(symbol, 0.0),
      }
      for symbol in symbols
      if holdings_a.get(symbol, 0.0) != holdings_b.get(symbol, 0.0)
  ]
  ```

- [ ] **Step 5: Update TypeScript type in api.ts**

  Find `FridayComparison` in `frontend/src/lib/api.ts` (around line 503). Current:
  ```typescript
  holdings_changed: Array<{
      symbol: string;
      weight_a: number;
      weight_b: number;
      delta: number;
  }>;
  ```
  Update to:
  ```typescript
  holdings_changed: Array<{
      symbol: string;
      name: string | null;
      weight_a: number;
      weight_b: number;
      delta: number;
  }>;
  ```

- [ ] **Step 6: Run test — verify it passes**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/test_friday_service.py::test_compare_snapshots_holdings_changed_includes_name -v
  ```
  Expected: `PASSED`.

- [ ] **Step 7: TypeScript check**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/frontend
  npx tsc --noEmit 2>&1 | head -20
  ```
  Expected: no new errors.

- [ ] **Step 8: Run full backend suite**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/ -q
  ```
  Expected: 233+ passed, 0 failures.

- [ ] **Step 9: Commit**

  ```bash
  git add backend/app/services/friday_service.py frontend/src/lib/api.ts backend/tests/test_friday_service.py
  git commit -m "feat(track-b/b3): add name field to holdings_changed in compare_snapshots"
  ```

---

## Task 3 (B3-3): Archive page — display name in sleeve-shift descriptions

**Files:**
- Modify: `frontend/src/app/friday/archive/page.tsx:182`

- [ ] **Step 1: Apply the change**

  Line 182 currently reads:
  ```tsx
  <p key={item.symbol}>
    {item.symbol}: {(item.weight_a * 100).toFixed(1)}% → {(item.weight_b * 100).toFixed(1)}% ({item.delta >= 0 ? '+' : ''}{(item.delta * 100).toFixed(1)}%)
  </p>
  ```
  Change to:
  ```tsx
  <p key={item.symbol}>
    {item.name ?? item.symbol}: {(item.weight_a * 100).toFixed(1)}% → {(item.weight_b * 100).toFixed(1)}% ({item.delta >= 0 ? '+' : ''}{(item.delta * 100).toFixed(1)}%)
  </p>
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/frontend
  npx tsc --noEmit 2>&1 | grep "archive"
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/app/friday/archive/page.tsx
  git commit -m "feat(track-b/b3): archive page — show asset name in sleeve-shift descriptions"
  ```

---

## Task 4 (B3-4): AddAssetModal — update helper text for naming convention

**Files:**
- Modify: `frontend/src/components/features/AddAssetModal.tsx:165-173`

- [ ] **Step 1: Apply the change**

  Lines 165-173 currently:
  ```tsx
  <div className="space-y-2">
    <label className="text-sm font-medium">Asset Symbol (Ticker)</label>
    <Input
      type="text"
      placeholder="e.g. QQQ or 409820"
      value={formData.symbol}
      onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
      required
    />
    <p className="text-[10px] text-muted-foreground mt-1">Enter US ticker or 6-digit KR code.</p>
  </div>
  ```
  Change to:
  ```tsx
  <div className="space-y-2">
    <label className="text-sm font-medium">Asset Symbol (Ticker)</label>
    <Input
      type="text"
      placeholder="e.g. KODEX_1X, MSTR"
      value={formData.symbol}
      onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
      required
    />
    <p className="text-[10px] text-muted-foreground mt-1">
      기존 KR ETF: 심볼 그대로 (NDX_1X, ACE_TLT)　신규 KR ETF: 6자리 KRX 코드 (e.g. 476760)　해외 자산: 티커 그대로 (MSTR, DBMF)
    </p>
  </div>
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/frontend
  npx tsc --noEmit 2>&1 | grep "AddAssetModal"
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/components/features/AddAssetModal.tsx
  git commit -m "feat(track-b/b3): AddAssetModal — update placeholder and helper for naming convention"
  ```

---

## Task 5 (B4-1): score_service — remove dead "QQQ" NDX token

**Files:**
- Modify: `backend/app/services/score_service.py:23`
- Test: `backend/tests/test_score_service.py` (create if missing)

- [ ] **Step 1: Write the failing test**

  Create `backend/tests/test_score_service.py` (or append if it exists):
  ```python
  from app.services.score_service import asset_to_category


  def test_ndx_still_classifies_via_kodex_and_tiger():
      """KODEX_1X and TIGER_2X still classify as NDX after QQQ removal."""
      assert asset_to_category("KODEX_1X") == "NDX"
      assert asset_to_category("TIGER_2X") == "NDX"
      assert asset_to_category("TIGER_1X") == "NDX"  # TIGER substring still active


  def test_qqq_no_longer_in_ndx_token_list():
      """QQQ token removed — raw 'QQQ' string no longer classifies as NDX."""
      assert asset_to_category("QQQ") != "NDX"
  ```

- [ ] **Step 2: Run tests — verify failure**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/test_score_service.py -v
  ```
  Expected: `test_qqq_no_longer_in_ndx_token_list` FAILS (QQQ currently returns "NDX").

- [ ] **Step 3: Remove "QQQ" from score_service.py**

  Line 23 currently:
  ```python
  if any(token in s for token in ["QQQ", "TIGER", "379810", "KODEX_1X", "KODEX1X"]):
  ```
  Change to:
  ```python
  if any(token in s for token in ["TIGER", "379810", "KODEX_1X", "KODEX1X"]):
  ```

- [ ] **Step 4: Run tests — verify pass**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/test_score_service.py -v
  ```
  Expected: all PASSED.

- [ ] **Step 5: Run full suite**

  ```bash
  .venv/bin/pytest tests/ -q
  ```
  Expected: 234+ passed, 0 failures.

- [ ] **Step 6: Commit**

  ```bash
  git add backend/app/services/score_service.py backend/tests/test_score_service.py
  git commit -m "refactor(track-b/b4): score_service — remove dead QQQ NDX token"
  ```

---

## Task 6 (B4-2): quant_service — standardise NDX proxy comments

**Files:**
- Modify: `backend/app/services/quant_service.py`

Two locations need a clear comment distinguishing the `"QQQ"` Yahoo Finance ticker from the renamed asset symbol:

- **Line 304** (`get_ndx_status`): currently has a long inline comment. Standardise it.
- **Lines 362-364** (`get_ndx_history`): docstring mentions QQQ, but the call at 364 is undocumented.

- [ ] **Step 1: Update line 304**

  Current:
  ```python
  ticker = "QQQ" # Proxy for NDX to avoid caching index ticker separately if not needed, or use ^NDX if cached
  ```
  Change to:
  ```python
  ticker = "QQQ"  # Yahoo Finance ticker for NDX index price feed — distinct from the renamed NDX_1X asset symbol
  ```

- [ ] **Step 2: Update lines 362-364**

  Current:
  ```python
  @staticmethod
  def get_ndx_history(db: Session, period: str = "1y"):
      """Returns historical NDX price and 250MA series (proxied via QQQ)."""
      return QuantService.get_asset_history(db, "QQQ", period)
  ```
  Change to:
  ```python
  @staticmethod
  def get_ndx_history(db: Session, period: str = "1y"):
      """Returns historical NDX price and 250MA series (proxied via QQQ)."""
      # QQQ = Yahoo Finance ticker for NDX price feed — distinct from the renamed NDX_1X asset symbol
      return QuantService.get_asset_history(db, "QQQ", period)
  ```

- [ ] **Step 3: Run full suite — no regressions**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/ -q
  ```
  Expected: 234+ passed, 0 failures.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/app/services/quant_service.py
  git commit -m "docs(track-b/b4): quant_service — clarify QQQ as Yahoo Finance NDX feed, not asset symbol"
  ```

---

## Task 7 (B4-3): Test seed cleanup — WeeklyDecision.asset_ticker QQQ → KODEX_1X

**Files:**
- Modify: `backend/tests/test_cashflow_consumer_rebinding.py` (lines 115, 138)
- Modify: `backend/tests/test_api.py` (line 150)
- Modify: `backend/tests/integration/test_freeze_flow.py` (lines 49, 87, 111)
- Modify: `backend/tests/test_briefing_service.py` (line 112)
- Modify: `backend/tests/fixtures/seeds.py` (line 107)

`WeeklyDecision.asset_ticker` is a free-text journalling field (no FK). Seeds are semantically correct either way — this is consistency-only cleanup so seeds match the current production symbol.

- [ ] **Step 1: Update test_cashflow_consumer_rebinding.py**

  Find both occurrences of `asset_ticker="QQQ"` (lines 115 and 138). Change each to `asset_ticker="KODEX_1X"`.

- [ ] **Step 2: Update test_api.py**

  Line 150: `"asset_ticker": "QQQ"` → `"asset_ticker": "KODEX_1X"`.

- [ ] **Step 3: Update integration/test_freeze_flow.py**

  Lines 49, 87, 111: each `"asset_ticker": "QQQ"` → `"asset_ticker": "KODEX_1X"`.

- [ ] **Step 4: Update test_briefing_service.py**

  Line 112: `asset_ticker="QQQ"` → `asset_ticker="KODEX_1X"`.

- [ ] **Step 5: Update fixtures/seeds.py**

  Line 107: default parameter `asset_ticker: str = "QQQ"` → `asset_ticker: str = "KODEX_1X"`.

- [ ] **Step 6: Run full suite**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/ -q
  ```
  Expected: 234+ passed, 0 failures.

- [ ] **Step 7: Commit**

  ```bash
  git add backend/tests/test_cashflow_consumer_rebinding.py \
          backend/tests/test_api.py \
          backend/tests/integration/test_freeze_flow.py \
          backend/tests/test_briefing_service.py \
          backend/tests/fixtures/seeds.py
  git commit -m "test(track-b/b4): update WeeklyDecision seed asset_ticker QQQ → KODEX_1X"
  ```

---

## Task 8 (B1-0): NDX symbol revision — migration + all code changes

**⚠️ DEPLOY GATE: Code is written and tested now. Run `alembic upgrade head` against production ONLY after Track A production migrations (`8e08d095c59e`, `393b0d9c9ffd`) are confirmed applied.**

**Files:**
- Create: `backend/alembic/versions/<rev>_track_b_ndx_symbol_revision.py`
- Modify: `backend/app/services/stress_service.py` (TICKER_PROXY lines 25-26)
- Modify: `backend/app/services/algo_service.py` (lines 162, 164, 167, 249, 252, 255)
- Modify: `backend/app/services/score_service.py` (line 23 — further update from Task 5)
- Modify: `backend/tests/test_track_a_algo_rotation.py`
- Modify: `backend/tests/test_track_a_account_silo.py`
- Modify: `backend/tests/test_track_a_anchor_aware_curve.py`
- Modify: `docs/architecture/asset-naming-convention.md`

- [ ] **Step 1: Write the failing tests**

  Create `backend/tests/test_track_b_ndx_revision.py`:
  ```python
  """
  Verifies the B1 Migration 0 (track_b_ndx_symbol_revision):
  - id=1 changes from KODEX_1X to NDX_1X
  - id=5 changes from TIGER_2X to NDX_2X
  - score_service classifies NDX_1X and NDX_2X as NDX
  - stress_service TICKER_PROXY has NDX_1X and NDX_2X keys
  - algo_service action strings reference NDX_1X and NDX_2X
  """
  import pytest
  from sqlalchemy import text
  from app.services.score_service import asset_to_category
  from app.services.stress_service import StressService
  from app.services.algo_service import AlgoService


  def test_ndx_1x_classifies_as_ndx():
      assert asset_to_category("NDX_1X") == "NDX"


  def test_ndx_2x_classifies_as_ndx():
      assert asset_to_category("NDX_2X") == "NDX"


  def test_ticker_proxy_has_ndx_1x():
      assert "NDX_1X" in StressService.TICKER_PROXY
      assert StressService.TICKER_PROXY["NDX_1X"] == "QQQ"


  def test_ticker_proxy_has_ndx_2x():
      assert "NDX_2X" in StressService.TICKER_PROXY


  def test_ticker_proxy_no_kodex_1x():
      assert "KODEX_1X" not in StressService.TICKER_PROXY


  def test_ticker_proxy_no_tiger_2x():
      assert "TIGER_2X" not in StressService.TICKER_PROXY


  def test_migration_ndx_revision(db_session):
      """Migration SQL applies cleanly and sets correct final state."""
      # Seed pre-migration state (KODEX_1X, TIGER_2X)
      db_session.execute(text("UPDATE assets SET symbol='KODEX_1X' WHERE id=1"))
      db_session.execute(text("UPDATE assets SET symbol='TIGER_2X' WHERE id=5"))
      db_session.commit()

      # Apply Migration 0 SQL
      db_session.execute(text(
          "UPDATE assets SET symbol='NDX_1X' WHERE id=1 AND symbol='KODEX_1X'"
      ))
      db_session.execute(text(
          "UPDATE assets SET symbol='NDX_2X' WHERE id=5 AND symbol='TIGER_2X'"
      ))
      db_session.commit()

      r1 = db_session.execute(text("SELECT symbol FROM assets WHERE id=1")).scalar()
      r5 = db_session.execute(text("SELECT symbol FROM assets WHERE id=5")).scalar()
      assert r1 == "NDX_1X", f"Expected NDX_1X, got {r1}"
      assert r5 == "NDX_2X", f"Expected NDX_2X, got {r5}"


  def test_migration_ndx_revision_idempotent(db_session):
      """Re-running migration SQL is a no-op when symbols already updated."""
      db_session.execute(text("UPDATE assets SET symbol='NDX_1X' WHERE id=1"))
      db_session.execute(text("UPDATE assets SET symbol='NDX_2X' WHERE id=5"))
      db_session.commit()

      # Re-run — WHERE guards prevent double-update
      db_session.execute(text(
          "UPDATE assets SET symbol='NDX_1X' WHERE id=1 AND symbol='KODEX_1X'"
      ))
      db_session.execute(text(
          "UPDATE assets SET symbol='NDX_2X' WHERE id=5 AND symbol='TIGER_2X'"
      ))
      db_session.commit()

      r1 = db_session.execute(text("SELECT symbol FROM assets WHERE id=1")).scalar()
      r5 = db_session.execute(text("SELECT symbol FROM assets WHERE id=5")).scalar()
      assert r1 == "NDX_1X"
      assert r5 == "NDX_2X"
  ```

- [ ] **Step 2: Run tests — verify failures**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/test_track_b_ndx_revision.py -v
  ```
  Expected: `test_ndx_1x_classifies_as_ndx`, `test_ticker_proxy_has_ndx_1x`, `test_ticker_proxy_no_kodex_1x` FAIL.

- [ ] **Step 3: Update score_service.py**

  Line 23 currently (after B4-1):
  ```python
  if any(token in s for token in ["TIGER", "379810", "KODEX_1X", "KODEX1X"]):
  ```
  Change to:
  ```python
  if any(token in s for token in ["NDX_"]):
  ```
  Rationale: `"NDX_"` substring covers `NDX_1X` and `NDX_2X`. Removes stale `TIGER`, `KODEX_1X`, `KODEX1X`, `379810` tokens — all obsolete after migration.

- [ ] **Step 4: Update stress_service.py TICKER_PROXY**

  Lines 25-26 currently:
  ```python
  'KODEX_1X':    'QQQ',     # was 'QQQ': 'QQQ'
  'TIGER_2X':    'QLD',     # NEW (US 2x NDX historical proxy)
  ```
  Change to:
  ```python
  'NDX_1X':      'QQQ',     # NDX 1× unleveraged — Yahoo Finance proxy for stress simulation
  'NDX_2X':      'QLD',     # NDX 2× leveraged — QLD is US 2× NDX historical proxy
  ```

- [ ] **Step 5: Update algo_service.py**

  Five locations (lines 162, 164, 167, 249, 252, 255):

  Line 162 (comment):
  ```python
  # NDX: If NDX < 250MA AND holding NDX_2X -> ACTION: "SELL NDX_2X -> BUY NDX_1X" (Safety Mode)
  ```
  Line 164:
  ```python
  if "NDX_2X" in holdings:
  ```
  Line 167:
  ```python
  "action": "SELL NDX_2X -> BUY NDX_1X",
  ```
  Line 249 (comment):
  ```python
  # NDX: If NDX > 250MA AND holding NDX_1X -> ACTION: "SELL NDX_1X -> BUY NDX_2X" (Growth Mode)
  ```
  Line 252:
  ```python
  if "NDX_1X" in holdings:
  ```
  Line 255:
  ```python
  "action": "SELL NDX_1X -> BUY NDX_2X",
  ```

- [ ] **Step 6: Create alembic migration file**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/alembic revision -m "track_b_ndx_symbol_revision"
  ```
  This creates `backend/alembic/versions/<generated_rev>_track_b_ndx_symbol_revision.py`.

  Open the generated file and fill in `upgrade()` and `downgrade()`:
  ```python
  """track_b_ndx_symbol_revision

  Revises the NDX ETF symbol convention: KODEX_1X -> NDX_1X, TIGER_2X -> NDX_2X.
  Convention moves from {ISSUER}_{LEVERAGE} to {INDEX}_{MULTIPLIER}.

  Deploy gate: Apply ONLY after Track A migrations 8e08d095c59e + 393b0d9c9ffd
  are confirmed on production (those migrations set KODEX_1X and TIGER_2X).
  """
  from alembic import op
  # down_revision is the last Track A migration
  revision = '<generated>'
  down_revision = '393b0d9c9ffd'
  branch_labels = None
  depends_on = None


  def upgrade() -> None:
      op.execute(
          "UPDATE assets SET symbol = 'NDX_1X' WHERE id = 1 AND symbol = 'KODEX_1X'"
      )
      op.execute(
          "UPDATE assets SET symbol = 'NDX_2X' WHERE id = 5 AND symbol = 'TIGER_2X'"
      )


  def downgrade() -> None:
      op.execute(
          "UPDATE assets SET symbol = 'KODEX_1X' WHERE id = 1 AND symbol = 'NDX_1X'"
      )
      op.execute(
          "UPDATE assets SET symbol = 'TIGER_2X' WHERE id = 5 AND symbol = 'NDX_2X'"
      )
  ```

- [ ] **Step 7: Update test_track_a_algo_rotation.py**

  All KODEX_1X → NDX_1X, TIGER_2X → NDX_2X in this file:
  - Line 4 comment: update
  - Line 9-10 comments: update
  - Line 87 docstring: `"SELL NDX_1X -> BUY NDX_2X"` etc.
  - Line 90: `_seed_holding(db_session, "NDX_1X")`
  - Lines 115, 118 assertions: `"NDX_1X" in a["action"] and "NDX_2X" in a["action"]`
  - Line 126 docstring: `"SELL NDX_2X -> BUY NDX_1X"` etc.
  - Line 130: `_seed_holding(db_session, "NDX_2X")`
  - Lines 155, 158 assertions: `"NDX_2X" in a["action"] and "NDX_1X" in a["action"]`

- [ ] **Step 8: Update test_track_a_account_silo.py**

  Line 31: `asset = make_asset(symbol="NDX_1X", code="379810", source="KR")`
  Line 37: `asset = make_asset(symbol="NDX_2X", code="418660", source="KR")`
  Update any docstrings/comments referencing the old symbol names.

- [ ] **Step 9: Update test_track_a_anchor_aware_curve.py**

  Line 52: `symbol="NDX_1X"`

- [ ] **Step 10: Update docs/architecture/asset-naming-convention.md**

  The document at `docs/architecture/asset-naming-convention.md` documents the Track A `{ISSUER}_{LEVERAGE}` convention. Update the convention description to `{INDEX}_{MULTIPLIER}` and update the examples table:

  - `KODEX_1X` → `NDX_1X`
  - `TIGER_2X` → `NDX_2X`
  - Add a note: "Convention revised in Track B: issuer brand (KODEX, TIGER) replaced by underlying index (NDX) — portfolio management semantics, not issuer identity."

- [ ] **Step 11: Run new tests — verify pass**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/test_track_b_ndx_revision.py -v
  ```
  Expected: all PASSED.

- [ ] **Step 12: Run full suite**

  ```bash
  .venv/bin/pytest tests/ -q
  ```
  Expected: 240+ passed, 0 failures.

- [ ] **Step 13: Commit**

  ```bash
  git add backend/alembic/versions/*track_b_ndx_symbol_revision* \
          backend/app/services/stress_service.py \
          backend/app/services/algo_service.py \
          backend/app/services/score_service.py \
          backend/tests/test_track_b_ndx_revision.py \
          backend/tests/test_track_a_algo_rotation.py \
          backend/tests/test_track_a_account_silo.py \
          backend/tests/test_track_a_anchor_aware_curve.py \
          docs/architecture/asset-naming-convention.md
  git commit -m "feat(track-b/b1): NDX symbol revision — KODEX_1X→NDX_1X, TIGER_2X→NDX_2X"
  ```

---

## Task 9 (B1-1): Migration — ACE_TLT rename

**⚠️ DEPLOY GATE: Same as B1-0 — apply to production only after Track A migrations confirmed.**

**Files:**
- Create: `backend/alembic/versions/<rev>_track_b_ace_tlt_rename.py`
- Test: `backend/tests/test_track_b_ace_tlt_rename.py`

- [ ] **Step 1: Write the failing test**

  Create `backend/tests/test_track_b_ace_tlt_rename.py`:
  ```python
  """
  Verifies track_b_ace_tlt_rename migration:
  - Asset id=3 symbol changes from TLT to ACE_TLT
  - Asset id=3 name changes to Korean string
  - score_service still classifies ACE_TLT as BONDS/CASH (via TLT substring)
  - stress_service TICKER_PROXY ACE_TLT key returns TLT
  """
  from sqlalchemy import text
  from app.services.score_service import asset_to_category
  from app.services.stress_service import StressService


  def test_ace_tlt_classifies_as_bonds():
      assert asset_to_category("ACE_TLT") == "BONDS/CASH"


  def test_stress_proxy_ace_tlt():
      assert StressService.TICKER_PROXY.get("ACE_TLT") == "TLT"


  def test_migration_ace_tlt_rename(db_session):
      """Migration SQL renames id=3 from TLT to ACE_TLT with Korean name."""
      db_session.execute(text(
          "UPDATE assets SET symbol='TLT', code='476760' WHERE id=3"
      ))
      db_session.commit()

      # Apply migration SQL
      db_session.execute(text("""
          UPDATE assets
          SET symbol = 'ACE_TLT',
              name   = 'ACE 미국30년국채액티브'
          WHERE id = 3
            AND symbol = 'TLT'
            AND code   = '476760'
      """))
      db_session.commit()

      row = db_session.execute(text(
          "SELECT symbol, name FROM assets WHERE id=3"
      )).fetchone()
      assert row.symbol == "ACE_TLT"
      assert row.name == "ACE 미국30년국채액티브"


  def test_migration_ace_tlt_idempotent(db_session):
      """Re-run is a no-op when already ACE_TLT."""
      db_session.execute(text(
          "UPDATE assets SET symbol='ACE_TLT', code='476760' WHERE id=3"
      ))
      db_session.commit()

      # WHERE symbol='TLT' guard — no rows match
      db_session.execute(text("""
          UPDATE assets
          SET symbol = 'ACE_TLT',
              name   = 'ACE 미국30년국채액티브'
          WHERE id = 3
            AND symbol = 'TLT'
            AND code   = '476760'
      """))
      db_session.commit()

      row = db_session.execute(text("SELECT symbol FROM assets WHERE id=3")).fetchone()
      assert row.symbol == "ACE_TLT"
  ```

- [ ] **Step 2: Run test — verify pass (no code changes needed)**

  `score_service` already has `"TLT"` in the BONDS/CASH list (covers `ACE_TLT` via substring).
  `stress_service.TICKER_PROXY` already has `ACE_TLT` key (Track A T4 added it).

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/test_track_b_ace_tlt_rename.py -v
  ```
  Expected: all PASSED (no code change required for service layer — only the migration file is new).

- [ ] **Step 3: Create alembic migration**

  ```bash
  .venv/bin/alembic revision -m "track_b_ace_tlt_rename"
  ```
  Fill in the generated file (set `down_revision` to the B1-0 migration revision):
  ```python
  """track_b_ace_tlt_rename

  Renames asset id=3 from TLT to ACE_TLT with Korean display name.

  Deploy gate: Apply after Track A migrations (8e08d095c59e, 393b0d9c9ffd)
  and after B1-0 (track_b_ndx_symbol_revision) are applied on production.
  """
  from alembic import op
  revision = '<generated>'
  down_revision = '<b1_0_revision>'  # track_b_ndx_symbol_revision
  branch_labels = None
  depends_on = None


  def upgrade() -> None:
      op.execute("""
          UPDATE assets
          SET symbol = 'ACE_TLT',
              name   = 'ACE 미국30년국채액티브'
          WHERE id = 3
            AND symbol = 'TLT'
            AND code   = '476760'
      """)


  def downgrade() -> None:
      op.execute("""
          UPDATE assets
          SET symbol = 'TLT',
              name   = 'ACE US 30Y Treasury Active'
          WHERE id = 3
            AND symbol = 'ACE_TLT'
            AND code   = '476760'
      """)
  ```

- [ ] **Step 4: Run full suite**

  ```bash
  .venv/bin/pytest tests/ -q
  ```
  Expected: 243+ passed, 0 failures.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/alembic/versions/*track_b_ace_tlt_rename* \
          backend/tests/test_track_b_ace_tlt_rename.py
  git commit -m "feat(track-b/b1): ACE_TLT rename migration — TLT→ACE_TLT, Korean name"
  ```

---

## Task 10 (B1-2): Migration — BRAZIL_BOND name localisation

**⚠️ DEPLOY GATE: Same as B1-0.**

**Files:**
- Create: `backend/alembic/versions/<rev>_track_b_brazil_bond_name.py`
- Test: `backend/tests/test_track_b_brazil_bond_name.py`

- [ ] **Step 1: Write the failing test**

  Create `backend/tests/test_track_b_brazil_bond_name.py`:
  ```python
  """Verifies track_b_brazil_bond_name migration sets localised name on id=14."""
  from sqlalchemy import text


  def test_migration_brazil_bond_name(db_session):
      db_session.execute(text(
          "UPDATE assets SET name='BRAZIL_BOND' WHERE id=14 AND symbol='BRAZIL_BOND'"
      ))
      db_session.commit()

      # Apply migration SQL
      db_session.execute(text("""
          UPDATE assets
          SET name = 'BNTNF 10 01/01/37 NTNF'
          WHERE id = 14
            AND symbol = 'BRAZIL_BOND'
      """))
      db_session.commit()

      row = db_session.execute(text(
          "SELECT symbol, name FROM assets WHERE id=14"
      )).fetchone()
      assert row.symbol == "BRAZIL_BOND"
      assert row.name == "BNTNF 10 01/01/37 NTNF"
  ```

- [ ] **Step 2: Run test — verify pass (no service changes)**

  ```bash
  cd /home/lg/dev/Portfolio_Tracker/backend
  .venv/bin/pytest tests/test_track_b_brazil_bond_name.py -v
  ```
  Expected: PASSED.

- [ ] **Step 3: Create alembic migration**

  ```bash
  .venv/bin/alembic revision -m "track_b_brazil_bond_name"
  ```
  Fill in (set `down_revision` to B1-1 revision):
  ```python
  """track_b_brazil_bond_name

  Localises the display name of BRAZIL_BOND (id=14) to the ISIN identifier.
  Symbol unchanged — only name field updated.

  Deploy gate: Apply after B1-1 (track_b_ace_tlt_rename) on production.
  """
  from alembic import op
  revision = '<generated>'
  down_revision = '<b1_1_revision>'  # track_b_ace_tlt_rename
  branch_labels = None
  depends_on = None


  def upgrade() -> None:
      op.execute("""
          UPDATE assets
          SET name = 'BNTNF 10 01/01/37 NTNF'
          WHERE id = 14
            AND symbol = 'BRAZIL_BOND'
      """)


  def downgrade() -> None:
      op.execute("""
          UPDATE assets
          SET name = 'BRAZIL_BOND'
          WHERE id = 14
            AND symbol = 'BRAZIL_BOND'
      """)
  ```

- [ ] **Step 4: Run full suite**

  ```bash
  .venv/bin/pytest tests/ -q
  ```
  Expected: 244+ passed, 0 failures.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/alembic/versions/*track_b_brazil_bond_name* \
          backend/tests/test_track_b_brazil_bond_name.py
  git commit -m "feat(track-b/b1): BRAZIL_BOND name localisation migration"
  ```

---

## Task 11 (B2): Archive backfill — deferred (awaiting price data)

**⚠️ BLOCKED: Needs actual 2026-03-20 prices from user's Toss broker history, and QQQ over-sell date + price. Do not start until user provides this data.**

**Deploy gate:** B2 applies to production ONLY after 2026-05-04 Track A verification passes. See `docs/superpowers/handoff/2026-05-04-track-a-verification.md`.

When data is available, create two migrations:
1. `track_b_backfill_20260320_prices` — UPDATE transactions SET price=<P>, total_amount=<qty*P> WHERE id IN (7,8,9,10,11) AND price=0
2. `track_b_qqq_compensating_sell` — INSERT INTO transactions (date, asset_id, type, quantity, price, total_amount, account_type, note) VALUES ('<date>', 1, 'SELL', 2, <P>, <2*P>, 'ISA', 'operator-error-correction-v1')

Post-apply: run `generate_portfolio_snapshots`, verify anchor row at 2026-04-25 preserved, verify NDX_1X net holdings = 249.

---

## Final verification after all B3+B4 tasks

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/pytest tests/ -q
```
Expected: 244+ passed, 0 failures.

```bash
cd /home/lg/dev/Portfolio_Tracker/frontend
npx tsc --noEmit
```
Expected: 0 errors.

## Deploy phasing summary

| Group | Deploy when |
|---|---|
| B3 + B4 | ✅ Anytime — independent of Track A production state |
| B1 (migrations 0, 1, 2) | After Track A production migrations `8e08d095c59e` + `393b0d9c9ffd` applied |
| B2 | After 2026-05-04 Track A verification passes |
