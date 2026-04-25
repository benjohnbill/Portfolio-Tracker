# Portfolio Anchor — Track A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a verified anchor at 2026-04-25 in both the archive (`portfolio_snapshots`) and performance (`portfolio_performance_snapshots`) tables, lock the new asset naming convention, onboard the TIGER_2X asset for next-Friday NDX leverage rotation, and make `get_equity_curve` anchor-aware so forward TWR series begins at the anchor date.

**Architecture:** Two Alembic data migrations apply schema-free changes (asset rows + anchor rows). The existing TWR-style logic inside `PortfolioService.get_equity_curve` is extended to (1) treat the manual anchor as the performance base and (2) force `explicit_cashflows=True` from the anchor date forward. The cron `generate_portfolio_snapshots` is taught to skip rows whose `source_version="manual-anchor-v1"` so the anchor is not overwritten on subsequent runs.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, pytest, sqlite (C-track) + docker postgres (D-track).

**Spec:** `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md` (commit `d74a97a`)

**Critical deadline:** Next Friday (2026-05-01). Track A must be shippable by then so the user's NDX rotation buy of TIGER_2X enters the system as a tracked holding.

---

## File Structure

**New files:**
- `docs/architecture/asset-naming-convention.md` — Convention rule documentation (T1)
- `backend/alembic/versions/<rev>_track_a_asset_naming.py` — Asset migration (T2)
- `backend/alembic/versions/<rev>_track_a_anchor_rows.py` — Anchor row insertion (T5)
- `backend/tests/test_track_a_asset_state.py` — Asset migration verification (T2)
- `backend/tests/test_track_a_account_silo.py` — `infer_account_silo` simplification (T3)
- `backend/tests/test_track_a_stress_proxy.py` — TICKER_PROXY re-keying (T4)
- `backend/tests/test_track_a_anchor_state.py` — Anchor row verification (T5)
- `backend/tests/test_track_a_anchor_aware_curve.py` — `get_equity_curve` anchor-aware behavior (T6)
- `backend/tests/test_track_a_twr_swap.py` — Same-day swap cashflow-neutral test (T7)
- `backend/tests/test_track_a_algo_rotation.py` — algo_service NDX rotation regression (T8)
- `docs/superpowers/decisions/2026-04-25-service-layer-split-deferred.md` — Service-split flag (T9)
- `docs/superpowers/handoff/2026-04-25-track-a-deployment.md` — Production deployment checklist (T10)

**Modified files:**
- `PRODUCT.md` — §6 sleeve table, §7 account structure (T1)
- `backend/app/services/portfolio_service.py` — `ISA_KR_CODES` (line 12), `infer_account_silo` (lines 36–51), `get_equity_curve` (around lines 280–375) (T3, T6)
- `backend/app/services/stress_service.py` — `TICKER_PROXY` dict (lines 25–35) (T4)
- `backend/app/services/ingestion_service.py` — `generate_portfolio_snapshots` UPSERT (lines 127–166) (T6)

---

## Pre-flight check

Before starting, confirm test infra works:

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/pytest tests/ -x -q --co 2>&1 | head -20
```

Expected: pytest collects test files without import errors. If it fails, fix the test environment before proceeding (likely `pip install -e .` or `pip install -r requirements.txt`).

---

## Task 1: Naming Convention Doc + PRODUCT.md Corrections

**Files:**
- Create: `docs/architecture/asset-naming-convention.md`
- Modify: `PRODUCT.md` (§6 and §7)

- [ ] **Step 1: Create `docs/architecture/` directory if missing**

```bash
mkdir -p /home/lg/dev/Portfolio_Tracker/docs/architecture
```

- [ ] **Step 2: Write the naming convention document**

Create `docs/architecture/asset-naming-convention.md` with:

```markdown
# Asset Naming Convention

**Status:** Active (locked 2026-04-25, see `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`)

## Rule

The `assets` table uses three fields with disjoint roles:

| Field | Role | Example values |
|---|---|---|
| `asset.symbol` | In-code semantic label, used by services for category and signal matching | `KODEX_1X`, `TIGER_2X`, `ACE_TLT`, `MSTR`, `DBMF`, `GLDM`, `BRAZIL_BOND` |
| `asset.code` | Entity unique identifier, used for DB integrity and price-feed lookup | `379810`, `418660`, `476760`, `MSTR`, `DBMF`, `GLDM`, `BRAZIL_BOND` |
| `asset.name` | Human-facing full name (Korean for KR-listed, native for foreign), used for frontend display | `KODEX 미국나스닥100`, `TIGER 미국나스닥100레버리지(합성)`, `ACE 미국30년국채액티브` |

## Rationale

The semantic-label convention was selected over alternatives:

- **Code-first** (`symbol="418660"`): rejected because `algo_service` and `score_service` substring matching depend on labels like `TIGER` and `KODEX_1X`. A pure-code symbol would silently break category resolution.
- **US ticker borrowing** (`symbol="QLD"` for KR 418660): rejected because it perpetuates KR-US collisions. The existing `TLT` / `TLT_US` workaround pattern is evidence of how this fails.

The semantic label aligns with `algo_service.py` (`"KODEX_1X" in holdings`), `score_service.asset_to_category` (substring-OR matching includes `TIGER`, `KODEX_1X`), and PRODUCT.md §6 sleeve tables.

## How to add a new asset

1. Pick a `symbol` that is a stable semantic label (e.g., `TIGER_2X`, not `TIGER 미국나스닥100레버리지`). Prefer underscores over hyphens. ASCII-only.
2. Set `code` to the entity's authoritative identifier (KR 6-digit code for Korean ETFs, US ticker for US-listed, internal token like `BRAZIL_BOND` for non-public assets).
3. Set `name` to the full human-readable name in the language of the listing market (Korean for KR-listed).
4. If the asset belongs to an existing sleeve, ensure `score_service.asset_to_category` substring matching catches it. If not, add a token to the appropriate sleeve list.
5. If the asset participates in stress tests, add a key to `stress_service.TICKER_PROXY` mapping its semantic label to a US-listed historical proxy ticker.

## Migration history

- 2026-04-25: Convention formalised. `id=1` migrated from `symbol="QQQ"` → `symbol="KODEX_1X"`. New asset `TIGER_2X` (code 418660) added. Remaining KR ETF rename pass deferred to Track B.
```

- [ ] **Step 3: Edit PRODUCT.md §6 (Asset Categories)**

In `PRODUCT.md`, find the table under `## 6. Asset Categories (Sleeves)`. Replace the NDX and BONDS/CASH rows:

```diff
 | Sleeve | Target Weight | Constituent Assets |
 |---|---|---|
-| NDX | 30% | QQQ, TIGER_2X (379810), KODEX_1X |
+| NDX | 30% | KODEX_1X (379810), TIGER_2X (418660) |
 | DBMF | 30% | DBMF |
 | BRAZIL | 10% | BRAZIL_BOND |
 | MSTR | 10% | MSTR |
 | GLDM | 10% | GLDM, GLD |
-| BONDS/CASH | 10% | TLT, BIL, VBIL, IEF |
+| BONDS/CASH | 10% | ACE_TLT (476760), BIL, VBIL, IEF |
```

- [ ] **Step 4: Edit PRODUCT.md §7 (Account Structure)**

In the same file, find the table under `## 7. Account Structure`. Replace the ISA row:

```diff
 | Account Silo | Description | Examples |
 |---|---|---|
-| ISA (ISA_ETF) | Korean-listed ETFs held in an Individual Savings Account | TIGER_2X (379810), KODEX_1X (463300), TLT proxy (476760) |
+| ISA (ISA_ETF) | Korean-listed ETFs held in an Individual Savings Account | KODEX_1X (379810), TIGER_2X (418660), ACE_TLT (476760) |
```

- [ ] **Step 5: Verify the changes render correctly**

```bash
grep -A 2 "## 6. Asset Categories" /home/lg/dev/Portfolio_Tracker/PRODUCT.md | head -15
grep -A 5 "## 7. Account Structure" /home/lg/dev/Portfolio_Tracker/PRODUCT.md | head -15
```

Expected: see the new code mappings (`418660`, `KODEX_1X`, `ACE_TLT`).

- [ ] **Step 6: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add \
  docs/architecture/asset-naming-convention.md \
  PRODUCT.md
git -C /home/lg/dev/Portfolio_Tracker commit -m "docs(track-a): asset naming convention + PRODUCT sleeve corrections

- Formalise symbol/code/name field separation in new architecture doc
- Correct PRODUCT.md sleeve and account tables: 379810=KODEX_1X (was
  TIGER_2X label), 418660=TIGER_2X (new), 476760=ACE_TLT (renamed
  from generic TLT label, name aligned with broker app)

Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md"
```

---

## Task 2: Asset Migration — id=1 Rename + New TIGER_2X Row

**Files:**
- Create: `backend/tests/test_track_a_asset_state.py`
- Create: `backend/alembic/versions/<auto-generated>_track_a_asset_naming.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_track_a_asset_state.py`:

```python
"""Track A — Asset migration verification.

After the migration runs, asset id=1 must have symbol="KODEX_1X" and a Korean
name, and a new asset must exist for TIGER_2X / 418660.
"""
from sqlalchemy.orm import Session

from app.models import Asset, AccountType, AccountSilo


def test_kodex_1x_migration_applied(db_session: Session):
    """Asset id=1 has been renamed from placeholder QQQ to semantic KODEX_1X."""
    asset = db_session.query(Asset).filter(Asset.id == 1).first()
    assert asset is not None, "Asset id=1 must exist (KODEX 미국나스닥100)"
    assert asset.symbol == "KODEX_1X", (
        f"Asset id=1 symbol must be 'KODEX_1X' after migration, got {asset.symbol!r}"
    )
    assert asset.name == "KODEX 미국나스닥100", (
        f"Asset id=1 name must be Korean full name, got {asset.name!r}"
    )
    assert asset.code == "379810"
    assert asset.source == "KR"


def test_tiger_2x_asset_created(db_session: Session):
    """TIGER_2X asset row exists with correct fields."""
    asset = db_session.query(Asset).filter(Asset.code == "418660").first()
    assert asset is not None, "Asset with code 418660 must exist after migration"
    assert asset.symbol == "TIGER_2X"
    assert asset.name == "TIGER 미국나스닥100레버리지(합성)"
    assert asset.source == "KR"
    assert asset.account_type == AccountType.ISA
    assert asset.account_silo == AccountSilo.ISA_ETF
```

Note: the `db_session` fixture comes from the existing `conftest.py` C-track sqlite setup. Verify the fixture name by inspecting `backend/tests/conftest.py` first; if the fixture is named differently (e.g., `session`, `db`), adapt the parameter.

- [ ] **Step 2: Verify the test fixture name matches**

```bash
grep -n "@pytest.fixture\|def db_session\|def session" /home/lg/dev/Portfolio_Tracker/backend/tests/conftest.py | head
```

If the fixture is named `db_session`, the test code above is correct. Otherwise rename the parameter.

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/pytest tests/test_track_a_asset_state.py -v
```

Expected: FAIL — either no asset id=1 exists (empty test DB) or asset id=1 has symbol="QQQ" (production-snapshot fixture).

- [ ] **Step 4: Generate Alembic migration skeleton**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/alembic revision -m "track_a_asset_naming"
```

This creates a new file in `backend/alembic/versions/` with an auto-generated revision id. Note the filename — referenced as `<rev>_track_a_asset_naming.py` below.

- [ ] **Step 5: Write the migration body**

Edit the newly created file. Replace its body with:

```python
"""Track A asset naming migration

Revision ID: <auto>
Revises: <previous head>
Create Date: 2026-04-25

- Rename Asset id=1 from placeholder symbol "QQQ" to semantic "KODEX_1X"
  and Korean-localise its name.
- Insert new Asset row for TIGER_2X (code 418660), the KR 2x leveraged
  NDX ETF, in ISA / ISA_ETF.

Both changes are idempotent (use UPDATE WHERE and INSERT WHERE NOT EXISTS).
"""
from alembic import op
import sqlalchemy as sa


# Revision identifiers, used by Alembic.
revision = "<auto>"  # filled by alembic
down_revision = "<auto>"  # filled by alembic
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Migrate Asset id=1: QQQ -> KODEX_1X, Korean name
    op.execute(
        sa.text("""
            UPDATE assets
            SET symbol = 'KODEX_1X',
                name = 'KODEX 미국나스닥100'
            WHERE id = 1 AND symbol = 'QQQ' AND code = '379810'
        """)
    )

    # 2. Insert TIGER_2X if not present (idempotent)
    op.execute(
        sa.text("""
            INSERT INTO assets (symbol, code, name, source, account_type, account_silo)
            SELECT 'TIGER_2X', '418660', 'TIGER 미국나스닥100레버리지(합성)',
                   'KR', 'ISA', 'ISA_ETF'
            WHERE NOT EXISTS (
                SELECT 1 FROM assets WHERE code = '418660'
            )
        """)
    )


def downgrade() -> None:
    # Remove TIGER_2X
    op.execute(sa.text("DELETE FROM assets WHERE code = '418660'"))

    # Revert id=1 to placeholder symbol
    op.execute(
        sa.text("""
            UPDATE assets
            SET symbol = 'QQQ',
                name = 'KODEX Nasdaq100 TR'
            WHERE id = 1 AND symbol = 'KODEX_1X'
        """)
    )
```

Replace `<auto>` placeholders with the actual revision id and previous head as filled in by `alembic revision`.

- [ ] **Step 6: Apply migration to test DB**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/alembic upgrade head
```

Expected output: a line confirming the new revision was applied.

- [ ] **Step 7: Run the test to verify it passes**

```bash
.venv/bin/pytest tests/test_track_a_asset_state.py -v
```

Expected: PASS for both tests.

- [ ] **Step 8: Verify migration is idempotent**

Apply it again — should be a no-op:

```bash
.venv/bin/alembic upgrade head
.venv/bin/pytest tests/test_track_a_asset_state.py -v
```

Expected: PASS, no errors.

- [ ] **Step 9: Test downgrade**

```bash
.venv/bin/alembic downgrade -1
.venv/bin/pytest tests/test_track_a_asset_state.py -v
```

Expected: tests FAIL (asset id=1 reverted, TIGER_2X removed).

- [ ] **Step 10: Re-apply for next task**

```bash
.venv/bin/alembic upgrade head
.venv/bin/pytest tests/test_track_a_asset_state.py -v
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add \
  backend/alembic/versions/*track_a_asset_naming*.py \
  backend/tests/test_track_a_asset_state.py
git -C /home/lg/dev/Portfolio_Tracker commit -m "feat(track-a): asset migration — KODEX_1X rename + TIGER_2X onboard

- Migrate asset id=1 from placeholder symbol QQQ to semantic KODEX_1X
  and localise name to Korean (KODEX 미국나스닥100)
- Insert new asset row for TIGER_2X / 418660 (TIGER 미국나스닥100
  레버리지(합성)) in ISA / ISA_ETF for next-Friday NDX leverage onboard
- Migration is idempotent and reversible

Tests: tests/test_track_a_asset_state.py (2/2 pass)
Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md"
```

---

## Task 3: portfolio_service Account Silo Simplification + ISA_KR_CODES Extension

**Files:**
- Create: `backend/tests/test_track_a_account_silo.py`
- Modify: `backend/app/services/portfolio_service.py:12` (ISA_KR_CODES)
- Modify: `backend/app/services/portfolio_service.py:36-51` (`infer_account_type`, `infer_account_silo`)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_track_a_account_silo.py`:

```python
"""Track A — infer_account_silo simplification.

After Track A, infer_account_silo must use only `asset.code in ISA_KR_CODES`
for KR ETF detection (no symbol fallback). The TIGER_2X code 418660 must
be recognised as ISA_ETF.
"""
import pytest

from app.models import Asset, AccountType, AccountSilo
from app.services.portfolio_service import PortfolioService


def make_asset(symbol, code, source="KR"):
    return Asset(
        symbol=symbol,
        code=code,
        name=f"{symbol} display name",
        source=source,
    )


def test_isa_kr_codes_includes_418660():
    assert "418660" in PortfolioService.ISA_KR_CODES, (
        "TIGER_2X code 418660 must be in ISA_KR_CODES for inference"
    )


def test_kodex_1x_inferred_isa_etf_by_code():
    """Even with new symbol KODEX_1X (not in legacy fallback set), code-based
    matching must still infer ISA_ETF."""
    asset = make_asset(symbol="KODEX_1X", code="379810", source="KR")
    assert PortfolioService.infer_account_silo(asset) == AccountSilo.ISA_ETF
    assert PortfolioService.infer_account_type(asset) == AccountType.ISA


def test_tiger_2x_inferred_isa_etf_by_code():
    asset = make_asset(symbol="TIGER_2X", code="418660", source="KR")
    assert PortfolioService.infer_account_silo(asset) == AccountSilo.ISA_ETF
    assert PortfolioService.infer_account_type(asset) == AccountType.ISA


def test_ace_tlt_inferred_isa_etf_by_code():
    """Forward-compat: when Track B renames id=3 to ACE_TLT, code-based
    matching must continue to work."""
    asset = make_asset(symbol="ACE_TLT", code="476760", source="KR")
    assert PortfolioService.infer_account_silo(asset) == AccountSilo.ISA_ETF


def test_us_asset_inferred_overseas_etf():
    asset = make_asset(symbol="DBMF", code="DBMF", source="US")
    assert PortfolioService.infer_account_silo(asset) == AccountSilo.OVERSEAS_ETF


def test_brazil_bond_inferred_brazil_silo():
    asset = make_asset(symbol="BRAZIL_BOND", code="BRAZIL_BOND", source="US")
    assert PortfolioService.infer_account_silo(asset) == AccountSilo.BRAZIL_BOND


def test_kr_unknown_code_falls_back_to_overseas():
    """A KR-source asset whose code is NOT in ISA_KR_CODES should NOT be
    classified as ISA_ETF (no silent inclusion)."""
    asset = make_asset(symbol="KR_RANDOM", code="999999", source="KR")
    silo = PortfolioService.infer_account_silo(asset)
    assert silo != AccountSilo.ISA_ETF, (
        f"Unknown KR code must not be ISA_ETF, got {silo}"
    )
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/pytest tests/test_track_a_account_silo.py -v
```

Expected: FAIL on `test_isa_kr_codes_includes_418660` (418660 not yet added) and possibly `test_kodex_1x_inferred_isa_etf_by_code` if the symbol fallback set is bypassed by tests.

- [ ] **Step 3: Modify ISA_KR_CODES**

Edit `backend/app/services/portfolio_service.py` line 12:

```python
# BEFORE
    ISA_KR_CODES = {"379810", "463300", "476760", "453870"}

# AFTER
    ISA_KR_CODES = {"379810", "418660", "463300", "476760", "453870"}
```

- [ ] **Step 4: Simplify infer_account_silo and infer_account_type**

Edit `backend/app/services/portfolio_service.py` around lines 36–51. Replace both methods:

```python
    @staticmethod
    def infer_account_type(asset: Asset) -> AccountType:
        if asset.symbol == "BRAZIL_BOND":
            return AccountType.OVERSEAS
        if asset.source == "KR" and asset.code in PortfolioService.ISA_KR_CODES:
            return AccountType.ISA
        return AccountType.OVERSEAS

    @staticmethod
    def infer_account_silo(asset: Asset) -> AccountSilo:
        if asset.symbol == "BRAZIL_BOND":
            return AccountSilo.BRAZIL_BOND
        if asset.source == "KR" and asset.code in PortfolioService.ISA_KR_CODES:
            return AccountSilo.ISA_ETF
        return AccountSilo.OVERSEAS_ETF
```

The legacy `or asset.symbol in {"QQQ", "CSI300", "TLT", "NIFTY"}` clause is dropped. Entity identity becomes the responsibility of `code`.

- [ ] **Step 5: Run the test to verify it passes**

```bash
.venv/bin/pytest tests/test_track_a_account_silo.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Run the full existing test suite to catch regressions**

```bash
.venv/bin/pytest tests/ -x -q
```

Expected: all tests pass. If any existing test fails because it relied on the legacy symbol fallback, inspect the failure — the right fix is usually to update the test data to use a real `code` value, not to revert the simplification.

- [ ] **Step 7: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add \
  backend/app/services/portfolio_service.py \
  backend/tests/test_track_a_account_silo.py
git -C /home/lg/dev/Portfolio_Tracker commit -m "refactor(track-a): infer_account_silo uses code only, drop symbol fallback

- Add 418660 (TIGER_2X) to ISA_KR_CODES
- Drop legacy symbol-based fallback set {QQQ, CSI300, TLT, NIFTY} from
  infer_account_type/silo. Entity identity is the responsibility of
  asset.code per the locked naming convention.
- New asset symbols (KODEX_1X, TIGER_2X) are correctly inferred via
  code-only matching; future Track B renames (e.g., ACE_TLT) covered.

Tests: tests/test_track_a_account_silo.py (7/7 pass)
Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md"
```

---

## Task 4: stress_service.TICKER_PROXY Re-keying

**Files:**
- Create: `backend/tests/test_track_a_stress_proxy.py`
- Modify: `backend/app/services/stress_service.py:25-35`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_track_a_stress_proxy.py`:

```python
"""Track A — stress_service.TICKER_PROXY re-keying.

After migration, the proxy table must use the new semantic labels as keys
(KODEX_1X, ACE_TLT) and include TIGER_2X mapped to QLD as a 2x NDX
historical proxy.
"""
from app.services.stress_service import StressService


def test_kodex_1x_proxies_to_qqq():
    assert StressService.TICKER_PROXY["KODEX_1X"] == "QQQ"


def test_tiger_2x_proxies_to_qld():
    assert StressService.TICKER_PROXY["TIGER_2X"] == "QLD"


def test_ace_tlt_proxies_to_tlt():
    assert StressService.TICKER_PROXY["ACE_TLT"] == "TLT"


def test_legacy_qqq_key_removed():
    """The placeholder 'QQQ' key must be gone after migration."""
    assert "QQQ" not in StressService.TICKER_PROXY


def test_legacy_tlt_key_removed():
    """The placeholder 'TLT' key must be gone after migration."""
    assert "TLT" not in StressService.TICKER_PROXY


def test_unchanged_keys_preserved():
    """Keys that did not need migration must be preserved."""
    expected = {"CSI300", "NIFTY", "MSTR", "DBMF", "GLDM", "BIL", "PFIX", "VBIL", "SPY"}
    for k in expected:
        assert k in StressService.TICKER_PROXY, f"{k} must remain in TICKER_PROXY"
```

If `TICKER_PROXY` is not a class attribute on `StressService`, adapt the import and reference to the actual location (likely module-level dict in `stress_service.py`).

- [ ] **Step 2: Confirm `TICKER_PROXY` location**

```bash
grep -n "TICKER_PROXY" /home/lg/dev/Portfolio_Tracker/backend/app/services/stress_service.py
```

Use the result to confirm whether the test references it as `StressService.TICKER_PROXY` or `stress_service.TICKER_PROXY`. Adjust the test accordingly.

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/pytest tests/test_track_a_stress_proxy.py -v
```

Expected: FAIL on the new keys (KODEX_1X, TIGER_2X, ACE_TLT) and the "removed" assertions.

- [ ] **Step 4: Update TICKER_PROXY**

Edit `backend/app/services/stress_service.py` lines 25–35. Replace the dict body:

```python
    TICKER_PROXY = {
        'KODEX_1X':    'QQQ',     # was 'QQQ': 'QQQ'
        'TIGER_2X':    'QLD',     # NEW (US 2x NDX historical proxy)
        'ACE_TLT':     'TLT',     # was 'TLT': 'TLT'
        'CSI300':      'ASHR',
        'NIFTY':       'INDA',
        'MSTR':        'MSTR',
        'DBMF':        'DBMF',
        'GLDM':        'GLD',
        'BIL':         'BIL',
        'PFIX':        'PFIX',
        'VBIL':        'BND',
        'SPY':         'SPY',
    }
```

(Note: the leverage multiplier for TIGER_2X-as-2× is **not** applied here. The proxy table maps current holdings to historical proxy tickers for stress replay; leverage exposure modeling is Track D.)

- [ ] **Step 5: Run the test to verify it passes**

```bash
.venv/bin/pytest tests/test_track_a_stress_proxy.py -v
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Run full suite to catch regressions**

```bash
.venv/bin/pytest tests/ -x -q
```

Expected: PASS. Any stress test that constructs synthetic holdings with key `"QQQ"` will fail — those tests are using legacy assumptions and should be updated as part of this commit (use new key `"KODEX_1X"`).

- [ ] **Step 7: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add \
  backend/app/services/stress_service.py \
  backend/tests/test_track_a_stress_proxy.py
git -C /home/lg/dev/Portfolio_Tracker commit -m "refactor(track-a): stress_service.TICKER_PROXY re-keyed for new convention

- Re-key 'QQQ' -> 'KODEX_1X' and 'TLT' -> 'ACE_TLT' to match the
  semantic-label asset symbols
- Add 'TIGER_2X' -> 'QLD' (US 2x NDX) as historical stress proxy.
  Note: leverage multiplier is NOT applied at this layer — that is
  Track D scope (effective exposure in score_service)

Tests: tests/test_track_a_stress_proxy.py (6/6 pass)
Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md"
```

---

## Task 5: Anchor Row Insertion (Archive + Performance)

**Files:**
- Create: `backend/tests/test_track_a_anchor_state.py`
- Create: `backend/alembic/versions/<auto>_track_a_anchor_rows.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_track_a_anchor_state.py`:

```python
"""Track A — anchor row state verification.

After the anchor migration runs, both portfolio_snapshots and
portfolio_performance_snapshots must contain a row at 2026-04-25 with the
locked values from the spec.
"""
from datetime import date

from sqlalchemy.orm import Session

from app.models import PortfolioSnapshot, PortfolioPerformanceSnapshot


ANCHOR_DATE = date(2026, 4, 25)


def test_archive_anchor_row(db_session: Session):
    row = db_session.query(PortfolioSnapshot).filter(
        PortfolioSnapshot.date == ANCHOR_DATE
    ).first()
    assert row is not None, "Archive anchor row must exist at 2026-04-25"
    assert row.total_value == 21353133.0
    assert row.invested_capital == 21253002.0
    assert row.cash_balance == 100131.0


def test_performance_anchor_row(db_session: Session):
    row = db_session.query(PortfolioPerformanceSnapshot).filter(
        PortfolioPerformanceSnapshot.date == ANCHOR_DATE
    ).first()
    assert row is not None, "Performance anchor row must exist at 2026-04-25"
    assert row.performance_value == 100.0
    assert row.benchmark_value == 100.0
    assert row.daily_return == 0.0
    assert row.alpha == 0.0
    assert row.coverage_start_date == ANCHOR_DATE
    assert row.coverage_status == "ready"
    assert row.source_version == "manual-anchor-v1"
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/pytest tests/test_track_a_anchor_state.py -v
```

Expected: FAIL — no rows at 2026-04-25.

- [ ] **Step 3: Generate Alembic migration skeleton**

```bash
.venv/bin/alembic revision -m "track_a_anchor_rows"
```

Note the new filename and revision id.

- [ ] **Step 4: Write the migration body**

Edit the new file. Replace its body with:

```python
"""Track A anchor rows

Revision ID: <auto>
Revises: <previous head — should be the track_a_asset_naming revision>
Create Date: 2026-04-25

Inserts the manual anchor at 2026-04-25 into both:
  - portfolio_snapshots (archive series)
  - portfolio_performance_snapshots (performance series, base 100.0)

Values sourced from the user's Toss app (verified read-only audit, see
docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md §6.3).

Idempotent via INSERT WHERE NOT EXISTS.
"""
from datetime import date, datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "<auto>"
down_revision = "<auto>"
branch_labels = None
depends_on = None


ANCHOR_DATE = date(2026, 4, 25)


def upgrade() -> None:
    # Archive anchor row — total wealth + invested + cash decomposition
    op.execute(
        sa.text("""
            INSERT INTO portfolio_snapshots (date, total_value, invested_capital, cash_balance)
            SELECT :anchor_date, 21353133.0, 21253002.0, 100131.0
            WHERE NOT EXISTS (
                SELECT 1 FROM portfolio_snapshots WHERE date = :anchor_date
            )
        """),
        {"anchor_date": ANCHOR_DATE},
    )

    # If a row already exists at this date (e.g., from prior cron run with
    # placeholder values), update it to the verified anchor values. We keep
    # this UPDATE separate so a fresh INSERT and an existing-row UPDATE are
    # both handled.
    op.execute(
        sa.text("""
            UPDATE portfolio_snapshots
            SET total_value = 21353133.0,
                invested_capital = 21253002.0,
                cash_balance = 100131.0
            WHERE date = :anchor_date
        """),
        {"anchor_date": ANCHOR_DATE},
    )

    # Performance anchor row — base 100.0, source_version flags it for cron protection
    op.execute(
        sa.text("""
            INSERT INTO portfolio_performance_snapshots
                (date, performance_value, benchmark_value, daily_return, alpha,
                 coverage_start_date, coverage_status, source_version, updated_at)
            SELECT :anchor_date, 100.0, 100.0, 0.0, 0.0,
                   :anchor_date, 'ready', 'manual-anchor-v1', :now
            WHERE NOT EXISTS (
                SELECT 1 FROM portfolio_performance_snapshots WHERE date = :anchor_date
            )
        """),
        {"anchor_date": ANCHOR_DATE, "now": datetime.now(timezone.utc)},
    )


def downgrade() -> None:
    op.execute(
        sa.text("""
            DELETE FROM portfolio_performance_snapshots
            WHERE date = :anchor_date AND source_version = 'manual-anchor-v1'
        """),
        {"anchor_date": ANCHOR_DATE},
    )
    # Note: archive row is not removed on downgrade because it may have been
    # generated by the daily cron prior to this migration. The downgrade
    # leaves archive series intact.
```

Replace `<auto>` placeholders with the actual Alembic-generated revision id and `down_revision` (the asset naming migration from Task 2).

- [ ] **Step 5: Apply the migration**

```bash
.venv/bin/alembic upgrade head
```

Expected: revision applied successfully.

- [ ] **Step 6: Run the test to verify it passes**

```bash
.venv/bin/pytest tests/test_track_a_anchor_state.py -v
```

Expected: both tests PASS.

- [ ] **Step 7: Idempotency check**

```bash
.venv/bin/alembic upgrade head   # no-op
.venv/bin/pytest tests/test_track_a_anchor_state.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add \
  backend/alembic/versions/*track_a_anchor_rows*.py \
  backend/tests/test_track_a_anchor_state.py
git -C /home/lg/dev/Portfolio_Tracker commit -m "feat(track-a): anchor rows at 2026-04-25 — archive + performance base

- Insert portfolio_snapshots[2026-04-25]: total 21,353,133 KRW, invested
  21,253,002, cash 100,131 (single-KRW total per spec §6.4)
- Insert portfolio_performance_snapshots[2026-04-25]: performance_value
  100.0 base, benchmark_value 100.0, source_version='manual-anchor-v1'
  (the latter flags the row for cron-protection in Task 6)
- Migration is idempotent (INSERT WHERE NOT EXISTS + UPDATE for archive)

Source values verified against user's Toss app screenshots, captured
2026-04-25 19:53 KT, reconciled 5/6 holdings exact match (QQQ -2 share
discrepancy resolved as operator over-sell, deferred to Track B).

Tests: tests/test_track_a_anchor_state.py (2/2 pass)
Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md"
```

---

## Task 6: Anchor-Aware get_equity_curve + Cron Protection

This task makes the existing TWR-style logic anchor-aware (uses anchor row as performance base) and protects the anchor row from cron overwrites. This is the riskiest task in Track A — the most regression-prone.

**Files:**
- Create: `backend/tests/test_track_a_anchor_aware_curve.py`
- Modify: `backend/app/services/portfolio_service.py:152-375` (`get_equity_curve`)
- Modify: `backend/app/services/ingestion_service.py:127-166` (`generate_portfolio_snapshots`)

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_track_a_anchor_aware_curve.py`:

```python
"""Track A — anchor-aware get_equity_curve and cron protection.

When a manual-anchor row exists in portfolio_performance_snapshots:
  1. get_equity_curve must treat the anchor date as performance base
     (performance_value = 100.0 on anchor day) regardless of whether
     transactions on or before that date contain explicit cashflows.
  2. The cron generate_portfolio_snapshots must NOT overwrite the
     manual-anchor row (source_version='manual-anchor-v1').

These guarantees are essential because next-Friday's purchase may be
a pure swap (BUY/SELL only, no DEPOSIT/WITHDRAW), and without the
anchor-aware behavior the performance series would never start.
"""
from datetime import date, datetime, timezone

import pytest
from sqlalchemy.orm import Session

from app.models import PortfolioPerformanceSnapshot, Asset, Transaction
from app.services.portfolio_service import PortfolioService
from app.services.ingestion_service import PriceIngestionService


ANCHOR_DATE = date(2026, 4, 25)


def test_get_equity_curve_uses_anchor_as_performance_base(db_session: Session):
    """If a manual-anchor row exists, the day's performance_value in the
    returned history is 100.0 (anchor base)."""
    history = PortfolioService.get_equity_curve(db_session, period="all")
    assert history, "get_equity_curve must return non-empty history"

    anchor_day = next(
        (d for d in history if d["date"] == ANCHOR_DATE.isoformat()),
        None,
    )
    assert anchor_day is not None, (
        f"Anchor date {ANCHOR_DATE} must appear in equity curve history"
    )
    assert anchor_day.get("performance_value") == pytest.approx(100.0), (
        f"Performance value at anchor must be 100.0 base, got {anchor_day.get('performance_value')}"
    )
    assert anchor_day.get("performance_coverage_status") == "ready"


def test_generate_snapshots_preserves_manual_anchor(db_session: Session):
    """Running the cron after the anchor exists must not overwrite the
    anchor row's manual-anchor-v1 source."""
    # Seed: anchor row exists from Task 5 migration.
    anchor_before = db_session.query(PortfolioPerformanceSnapshot).filter(
        PortfolioPerformanceSnapshot.date == ANCHOR_DATE
    ).first()
    assert anchor_before is not None
    assert anchor_before.source_version == "manual-anchor-v1"
    original_perf_value = anchor_before.performance_value
    original_source = anchor_before.source_version

    # Act: run the cron that re-generates snapshots.
    PriceIngestionService.generate_portfolio_snapshots(db_session)
    db_session.commit()

    # Assert: anchor row preserved.
    anchor_after = db_session.query(PortfolioPerformanceSnapshot).filter(
        PortfolioPerformanceSnapshot.date == ANCHOR_DATE
    ).first()
    assert anchor_after is not None
    assert anchor_after.source_version == original_source, (
        f"Anchor source must remain 'manual-anchor-v1', got {anchor_after.source_version!r}"
    )
    assert anchor_after.performance_value == pytest.approx(original_perf_value), (
        "Anchor performance_value must be preserved by cron"
    )
```

- [ ] **Step 2: Run the test — observe what fails**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/pytest tests/test_track_a_anchor_aware_curve.py -v
```

Expected: both tests FAIL. The first fails because `get_equity_curve` only sets `performance_value` when `explicit_cashflows=True` (i.e., when a DEPOSIT/WITHDRAW transaction exists), and the test fixture has none. The second fails because the cron's UPSERT unconditionally overwrites all fields.

- [ ] **Step 3: Make get_equity_curve anchor-aware**

Edit `backend/app/services/portfolio_service.py`. In `get_equity_curve`, before the day-by-day loop, add an anchor lookup:

```python
        # === Track A: anchor-aware behavior ===
        manual_anchor = (
            db.query(PortfolioPerformanceSnapshot)
            .filter(PortfolioPerformanceSnapshot.source_version == "manual-anchor-v1")
            .order_by(PortfolioPerformanceSnapshot.date.asc())
            .first()
        )
        manual_anchor_date = manual_anchor.date if manual_anchor else None
        anchor_performance_base = float(manual_anchor.performance_value) if manual_anchor else None
        # === end Track A ===
```

This block goes immediately after the existing transaction/price loading and before the `current_date += timedelta(days=1)` loop begins. Use `grep -n "current_date += timedelta" backend/app/services/portfolio_service.py` to find the exact insertion point.

Then, **inside** the day-by-day loop (around line 312 where `performance_daily_return = None` is currently set), replace the cashflow-gated block:

```python
                # === Track A: anchor-aware performance computation ===
                # On the anchor day, force performance_value to the anchor base
                # regardless of cashflow presence. From the day after the anchor,
                # treat explicit_cashflows as effectively True (the anchor row
                # provides the missing context).
                is_at_or_after_anchor = (
                    manual_anchor_date is not None and current_date >= manual_anchor_date
                )

                performance_daily_return = None
                if is_at_or_after_anchor:
                    if current_date == manual_anchor_date:
                        # Anchor day: pin to base (e.g., 100.0).
                        performance_value = anchor_performance_base
                        performance_daily_return = 0.0
                    elif previous_absolute_value is None or performance_value is None:
                        # Defensive: shouldn't happen if anchor day was processed,
                        # but if so, re-base from current absolute value.
                        performance_daily_return = 0.0
                        performance_value = anchor_performance_base
                    elif previous_absolute_value > 0:
                        # Forward TWR: subtract net cashflow from delta to isolate
                        # price-driven return.
                        performance_daily_return = (
                            absolute_value_krw - previous_absolute_value - net_cashflow
                        ) / previous_absolute_value
                        performance_value = performance_value * (1 + performance_daily_return)
                    else:
                        performance_daily_return = 0.0
                elif explicit_cashflows:
                    # Pre-anchor legacy path (preserved for any historical period
                    # that already had explicit cashflows recorded).
                    if previous_absolute_value is None or performance_value is None:
                        performance_daily_return = 0.0
                        performance_value = absolute_value_krw
                    elif previous_absolute_value > 0:
                        performance_daily_return = (
                            absolute_value_krw - previous_absolute_value - net_cashflow
                        ) / previous_absolute_value
                        performance_value = performance_value * (1 + performance_daily_return)
                    else:
                        performance_daily_return = 0.0
                # === end Track A ===
```

This replaces (does **not** add to) the existing block at lines 312–321. The legacy `explicit_cashflows`-gated logic is moved into the `elif` branch and remains intact for any pre-anchor history that already had explicit cashflows.

Update the `if explicit_cashflows and performance_value is not None:` gate that emits the `performance_*` fields into the `item` dict. Replace:

```python
                if explicit_cashflows and performance_value is not None:
```

with:

```python
                if (is_at_or_after_anchor or explicit_cashflows) and performance_value is not None:
```

- [ ] **Step 4: Run the first test to verify it passes**

```bash
.venv/bin/pytest tests/test_track_a_anchor_aware_curve.py::test_get_equity_curve_uses_anchor_as_performance_base -v
```

Expected: PASS.

- [ ] **Step 5: Make the cron preserve the anchor row**

Edit `backend/app/services/ingestion_service.py`. In `generate_portfolio_snapshots`, modify the performance-records UPSERT block (lines 146–166) to skip rows whose existing `source_version` is `"manual-anchor-v1"`:

```python
        perf_count = 0
        for record in performance_records:
            # === Track A: do not overwrite manual-anchor rows ===
            existing = db.query(PortfolioPerformanceSnapshot).filter(
                PortfolioPerformanceSnapshot.date == record["date"]
            ).first()
            if existing is not None and existing.source_version == "manual-anchor-v1":
                # Skip this record entirely — the manual anchor is the
                # authoritative value for this date.
                continue
            # === end Track A ===

            stmt = insert(PortfolioPerformanceSnapshot).values(**record)
            stmt = stmt.on_conflict_do_update(
                index_elements=['date'],
                set_=dict(
                    performance_value=stmt.excluded.performance_value,
                    benchmark_value=stmt.excluded.benchmark_value,
                    daily_return=stmt.excluded.daily_return,
                    alpha=stmt.excluded.alpha,
                    coverage_start_date=stmt.excluded.coverage_start_date,
                    coverage_status=stmt.excluded.coverage_status,
                    source_version=stmt.excluded.source_version,
                    updated_at=stmt.excluded.updated_at,
                )
            )
            db.execute(stmt)
            perf_count += 1
        if performance_records:
            db.commit()
            print(f"Successfully generated/updated {perf_count} portfolio performance snapshots.")
```

Add the import at the top of `ingestion_service.py` if not already present:

```python
from ..models import PortfolioPerformanceSnapshot
```

(Check existing imports first with `grep -n "PortfolioPerformanceSnapshot" backend/app/services/ingestion_service.py`.)

- [ ] **Step 6: Run the second test to verify it passes**

```bash
.venv/bin/pytest tests/test_track_a_anchor_aware_curve.py::test_generate_snapshots_preserves_manual_anchor -v
```

Expected: PASS.

- [ ] **Step 7: Run both anchor-aware tests + full suite**

```bash
.venv/bin/pytest tests/test_track_a_anchor_aware_curve.py -v
.venv/bin/pytest tests/ -x -q
```

Expected: anchor-aware tests PASS. Existing performance/cashflow contract tests in `test_portfolio_cashflow_split_contract.py` should also continue to pass — if any fail, inspect carefully because the anchor-aware logic is the most likely regression site. The pre-anchor legacy path (`elif explicit_cashflows`) preserves the old behavior for tests that don't use a manual anchor.

- [ ] **Step 8: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add \
  backend/app/services/portfolio_service.py \
  backend/app/services/ingestion_service.py \
  backend/tests/test_track_a_anchor_aware_curve.py
git -C /home/lg/dev/Portfolio_Tracker commit -m "feat(track-a): anchor-aware get_equity_curve + cron protection

- get_equity_curve now reads the manual-anchor row at start and uses it
  as the performance base. From the anchor date forward, performance
  series is computed regardless of explicit_cashflows, so a pure swap
  next Friday (BUY+SELL with no DEPOSIT) does not stall the series.
- Pre-anchor legacy path preserved (elif explicit_cashflows) to avoid
  regressing existing cashflow-aware tests.
- ingestion_service.generate_portfolio_snapshots now skips overwriting
  any portfolio_performance_snapshots row whose source_version is
  'manual-anchor-v1', protecting the manual anchor from cron clobber.

Tests: tests/test_track_a_anchor_aware_curve.py (2/2 pass), full
suite green.
Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md"
```

---

## Task 7: Same-Day Swap Cashflow-Neutral Test

**Files:**
- Create: `backend/tests/test_track_a_twr_swap.py`

This task is verification-only — it asserts that the existing TWR logic correctly treats a same-day BUY+SELL (with no DEPOSIT/WITHDRAW) as a cashflow-neutral asset rotation. No code changes expected; if the test fails, that is a real bug in `get_equity_curve` and must be fixed inline.

- [ ] **Step 1: Write the test**

Create `backend/tests/test_track_a_twr_swap.py`:

```python
"""Track A — same-day swap is cashflow-neutral.

When a BUY of one asset and a SELL of another asset occur on the same date
with no DEPOSIT or WITHDRAW, the day's net_cashflow is 0 and the day's
performance_daily_return is driven only by holdings price movement. This
matches the next-Friday rotation scenario where KODEX_1X is partially
sold to fund a TIGER_2X buy.
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.models import (
    Asset, AccountType, AccountSilo,
    Transaction, RawDailyPrice,
    PortfolioPerformanceSnapshot,
)
from app.services.portfolio_service import PortfolioService


ANCHOR_DATE = date(2026, 4, 25)


def _seed_asset(db: Session, *, symbol, code, source="KR"):
    a = Asset(
        symbol=symbol, code=code, name=f"{symbol} test asset",
        source=source,
        account_type=AccountType.ISA if source == "KR" else AccountType.OVERSEAS,
        account_silo=AccountSilo.ISA_ETF if source == "KR" else AccountSilo.OVERSEAS_ETF,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def test_same_day_swap_with_zero_net_cashflow_is_price_only(db_session: Session):
    """SELL X + BUY Y on the same day with equal total_amount produces
    net_cashflow = 0; performance_daily_return reflects only the holdings'
    price movement that day, not the swap itself."""
    # Use anchor row from Task 5 migration as the base.
    # Add minimal price history and a same-day swap on day = ANCHOR_DATE + 1.
    swap_date = ANCHOR_DATE + timedelta(days=1)

    a1 = _seed_asset(db_session, symbol="KODEX_1X_TEST", code="TEST_1X")
    a2 = _seed_asset(db_session, symbol="TIGER_2X_TEST", code="TEST_2X")

    # Hold pre-swap state via prior BUYs (anchor day).
    db_session.add(Transaction(
        date=datetime.combine(ANCHOR_DATE, datetime.min.time()),
        asset_id=a1.id, type="BUY",
        quantity=100, price=10000, total_amount=1000000,
        account_type=AccountType.ISA,
    ))
    db_session.commit()

    # Same-day swap on swap_date: SELL 50 of a1 + BUY equivalent of a2.
    db_session.add(Transaction(
        date=datetime.combine(swap_date, datetime.min.time()),
        asset_id=a1.id, type="SELL",
        quantity=50, price=10000, total_amount=500000,
        account_type=AccountType.ISA,
    ))
    db_session.add(Transaction(
        date=datetime.combine(swap_date, datetime.min.time()),
        asset_id=a2.id, type="BUY",
        quantity=100, price=5000, total_amount=500000,
        account_type=AccountType.ISA,
    ))
    db_session.commit()

    history = PortfolioService.get_equity_curve(db_session, period="all")
    swap_day = next(
        (d for d in history if d["date"] == swap_date.isoformat()),
        None,
    )
    assert swap_day is not None, "swap day must be in history"

    # net_cashflow on the swap day should be 0 (BUY/SELL are not cashflow events).
    assert swap_day.get("net_cashflow", 0) == 0, (
        f"Same-day swap with no DEPOSIT/WITHDRAW must have net_cashflow=0, "
        f"got {swap_day.get('net_cashflow')}"
    )

    # If holdings prices did not change, performance_daily_return ≈ 0.
    # We did not insert a price update on swap_date, so values should match.
    pdr = swap_day.get("performance_daily_return")
    assert pdr is not None
    assert abs(pdr) < 1e-6, (
        f"With no price movement and zero cashflow, performance_daily_return "
        f"must be ~0, got {pdr}"
    )
```

This test does not seed `RawDailyPrice` rows, which means `get_equity_curve`'s price lookup will fall back to last-transaction-price logic. If that fallback breaks the test, seed minimal price rows or extend the fixture. The exact fallback behavior is in `portfolio_service.get_equity_curve` lines 296–304.

- [ ] **Step 2: Run the test**

```bash
cd /home/lg/dev/Portfolio_Tracker/backend
.venv/bin/pytest tests/test_track_a_twr_swap.py -v
```

Expected: PASS. The test asserts the existing semantics; if it fails, the fault is in the existing logic and not new code.

- [ ] **Step 3: If the test fails, debug**

Likely failure modes:
- `net_cashflow` is non-zero because BUY/SELL are accidentally counted. Inspect `get_equity_curve`'s cashflow accumulator — it should only sum DEPOSIT/WITHDRAW.
- `performance_daily_return` is non-zero due to price-data interpolation noise. Inspect `_latest_numeric` and the price fallback.

Fix root cause inline; do not weaken the assertion thresholds.

- [ ] **Step 4: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add backend/tests/test_track_a_twr_swap.py
git -C /home/lg/dev/Portfolio_Tracker commit -m "test(track-a): same-day swap is cashflow-neutral

Verifies that BUY+SELL on the same date with no DEPOSIT/WITHDRAW produces
net_cashflow=0 and performance_daily_return ~0 (under no price movement).
This is the next-Friday rotation scenario: KODEX_1X partial sell funds
TIGER_2X buy with no external cashflow.

Tests: tests/test_track_a_twr_swap.py (1/1 pass)
Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md §10.2"
```

---

## Task 8: algo_service NDX Rotation Regression Test

**Files:**
- Create: `backend/tests/test_track_a_algo_rotation.py`

The asset migration in Task 2 unblocks the silent bug where `algo_service.py:252` checks `"KODEX_1X" in holdings` against current symbols `{"QQQ", ...}`. After migration, holdings include `"KODEX_1X"` and the rotation signal can fire. This test asserts that.

- [ ] **Step 1: Inspect the algo_service signal entry point**

```bash
grep -n "def \|generate_signals\|return.*action\|growth_mode\|safety_mode" /home/lg/dev/Portfolio_Tracker/backend/app/services/algo_service.py | head
```

Identify the function that, given `holdings` and market state, returns the rotation signal. Likely `generate_signals(db)` or similar. Use the actual name in the test below.

- [ ] **Step 2: Write the test**

Create `backend/tests/test_track_a_algo_rotation.py`:

```python
"""Track A — algo_service NDX rotation signals fire after asset migration.

Before migration, holdings used placeholder symbol "QQQ" and the
'"KODEX_1X" in holdings' check at algo_service.py:252 silently failed,
suppressing the Growth Mode signal. After migration, the check matches
and the signal fires correctly.

These tests use stubs / fakes to control the NDX 250MA branch without
needing real price history.
"""
from unittest.mock import patch

import pytest

from app.services.algo_service import AlgoService


def test_growth_mode_fires_when_holding_kodex_1x_and_ndx_above_250ma():
    """With KODEX_1X in holdings and NDX above its 250MA, the Growth Mode
    signal (SELL KODEX_1X -> BUY TIGER_2X) must be in the output."""
    # Arrange: stub the NDX status to be above 250MA, holdings contain KODEX_1X.
    fake_ndx = {"current_price": 20000, "ma_250": 18000, "rsi": 50}
    fake_gldm = {"current_price": 0, "ma_250": 0, "rsi": 50}
    fake_tlt = {"current_price": 0, "ma_250": 0, "rsi": 50}
    holdings = {"KODEX_1X", "DBMF", "MSTR", "GLDM", "BRAZIL_BOND"}

    with patch.object(AlgoService, "_get_ticker_signals") as mock_signals:
        mock_signals.side_effect = lambda db, ticker: {
            "QQQ": fake_ndx, "GLDM": fake_gldm, "TLT": fake_tlt,
        }.get(ticker, {"current_price": 0, "ma_250": 0, "rsi": 50})

        # The exact entry-point name varies; if generate_signals is the
        # function returning the rotation list, call it. Adapt as needed.
        signals = AlgoService.generate_signals_for_holdings(db=None, holdings=holdings, mstr_signal={})

    # Assert: at least one signal action contains "BUY TIGER_2X" or
    # "SELL KODEX_1X -> BUY TIGER_2X".
    actions = [s.get("action", "") for s in signals]
    assert any("TIGER_2X" in a and "KODEX_1X" in a for a in actions), (
        f"Growth Mode signal did not fire. Got actions: {actions}"
    )


def test_safety_mode_fires_when_holding_tiger_2x_and_ndx_below_250ma():
    fake_ndx = {"current_price": 17000, "ma_250": 18000, "rsi": 50}
    fake_gldm = {"current_price": 0, "ma_250": 0, "rsi": 50}
    fake_tlt = {"current_price": 0, "ma_250": 0, "rsi": 50}
    holdings = {"TIGER_2X", "DBMF", "MSTR", "GLDM", "BRAZIL_BOND"}

    with patch.object(AlgoService, "_get_ticker_signals") as mock_signals:
        mock_signals.side_effect = lambda db, ticker: {
            "QQQ": fake_ndx, "GLDM": fake_gldm, "TLT": fake_tlt,
        }.get(ticker, {"current_price": 0, "ma_250": 0, "rsi": 50})

        signals = AlgoService.generate_signals_for_holdings(db=None, holdings=holdings, mstr_signal={})

    actions = [s.get("action", "") for s in signals]
    assert any("KODEX_1X" in a and "TIGER_2X" in a for a in actions), (
        f"Safety Mode signal did not fire. Got actions: {actions}"
    )
```

Caveat: the function name `generate_signals_for_holdings` is a placeholder. Look up the actual entry point in `algo_service.py` (likely whatever Calls into the lines around `:162` and `:252` from outside) and adjust both calls. If the public entry point requires a `db` session and reads holdings from DB, restructure the test to seed transactions instead of passing `holdings` directly.

- [ ] **Step 3: Inspect algo_service entry point and adapt the test**

```bash
grep -n "@staticmethod\|def \|holdings" /home/lg/dev/Portfolio_Tracker/backend/app/services/algo_service.py | head -40
```

Identify the actual public entry that constructs holdings and returns the signal list. Update the test's `AlgoService.generate_signals_for_holdings` invocation to match — possibly replacing it with `AlgoService.generate_signals(db_session)` after seeding transactions to produce the desired holdings set.

- [ ] **Step 4: Run the test**

```bash
.venv/bin/pytest tests/test_track_a_algo_rotation.py -v
```

Expected: PASS for both. If not, the bug may extend beyond a missing symbol — inspect carefully.

- [ ] **Step 5: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add backend/tests/test_track_a_algo_rotation.py
git -C /home/lg/dev/Portfolio_Tracker commit -m "test(track-a): algo_service NDX rotation regression coverage

Verifies that after the KODEX_1X/TIGER_2X asset migration:
- Growth Mode signal fires when holdings contain KODEX_1X and NDX > 250MA
- Safety Mode signal fires when holdings contain TIGER_2X and NDX < 250MA

This closes the silent-bug regression that previously suppressed the
NDX rotation recommendations because holdings used placeholder symbol
'QQQ' and the algo_service check was 'KODEX_1X in holdings'.

Tests: tests/test_track_a_algo_rotation.py (2/2 pass)
Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md §10.4"
```

---

## Task 9: Service-Layer Role Partitioning Flag

This task is documentation only: per the project's standing feedback ("raise as its own task when touching the service tree"), Track A's modifications to `portfolio_service.get_equity_curve` warrant a follow-up flag.

**Files:**
- Create: `docs/superpowers/decisions/2026-04-25-service-layer-split-deferred.md`

- [ ] **Step 1: Create the decisions directory if missing**

```bash
mkdir -p /home/lg/dev/Portfolio_Tracker/docs/superpowers/decisions
```

- [ ] **Step 2: Write the deferred-decision note**

Create `docs/superpowers/decisions/2026-04-25-service-layer-split-deferred.md`:

```markdown
# Decision: Defer portfolio_service.py Split (Track A — 2026-04-25)

**Status:** Deferred (raise as its own task)
**Related Track A spec:** `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`

## Context

Track A modified `backend/app/services/portfolio_service.py` in two places:

1. `infer_account_silo` / `infer_account_type` — simplified to drop the legacy symbol fallback set (lines 36–51).
2. `get_equity_curve` — added anchor-aware behavior for performance series initialisation (around lines 280–375).

The file is now ~570 lines and `get_equity_curve` itself is over 220 lines, mixing transaction loading, price interpolation, FX conversion, archive value computation, performance value computation, benchmark normalisation, and series caching in one method.

## Standing project feedback

Project memory entry **"Service-layer role partitioning"** notes a goal to split `backend/app/services/` by single responsibilities. The standing rule is to raise this as its own task whenever touching the service tree.

## Recommended follow-up

Decompose `portfolio_service.py` into focused modules:

- `portfolio_query.py` — read-side helpers (cache, account silo inference)
- `equity_curve.py` — `get_equity_curve` and its price/FX helpers
- `performance.py` — TWR forward computation, anchor-aware base resolution
- `metrics.py` — `calculate_metrics`, `get_portfolio_summary`
- `allocation.py` — `get_portfolio_allocation`, `calculate_invested_capital`

`get_equity_curve` should be split into:
- `_load_transactions_and_prices(db, period)` (preparation)
- `_compute_daily_state(date, transactions, prices, fx)` (per-day aggregation)
- `_compute_performance_value(date, anchor, prev_state, day_state)` (anchor-aware TWR)
- `compose_equity_curve(...)` (orchestration)

This is **not** scope for Track A. It is raised here so the next person touching this file has the context.

## Risk of further accumulation

Track D (leverage-aware sleeve metrics) will need to modify performance computation again. If the split is not done before Track D, Track D's changes will land in an even larger method. Recommend prioritising the split between Track A ship and Track D start.
```

- [ ] **Step 3: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add docs/superpowers/decisions/2026-04-25-service-layer-split-deferred.md
git -C /home/lg/dev/Portfolio_Tracker commit -m "docs(track-a): flag portfolio_service.py split as follow-up task

Per standing project feedback (service-layer role partitioning), Track A's
modifications to portfolio_service.py warrant a follow-up split. Recorded
the recommended decomposition (portfolio_query / equity_curve / performance
/ metrics / allocation) and the priority order vs. Track D as a deferred
decision note.

Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md"
```

---

## Task 10: Production Deployment Checklist

This task is the handoff document for deploying Track A to the production Supabase database.

**Files:**
- Create: `docs/superpowers/handoff/2026-04-25-track-a-deployment.md`

- [ ] **Step 1: Write the deployment handoff**

Create `docs/superpowers/handoff/2026-04-25-track-a-deployment.md`:

```markdown
# Track A Deployment Checklist (Production Supabase)

**Track:** A (Anchor + Forward Processing + Leverage NDX Onboarding)
**Spec:** `docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md`
**Plan:** `docs/superpowers/plans/2026-04-25-portfolio-anchor-track-a.md`
**Target deadline:** 2026-05-01 (next Friday's NDX rotation buy)

## Pre-deploy verification

- [ ] **Verify production Supabase has migration `d2c4f6a8b901_add_portfolio_performance_snapshots` applied.**
      Per project memory (audit 2026-04-23), this table did not exist on production. If still missing, apply
      it as a prerequisite — Track A's anchor row migration depends on the table existing.

      ```bash
      # Read-only check (does not commit):
      .venv/bin/python -c "
      from sqlalchemy import create_engine, text
      import os; from dotenv import load_dotenv
      load_dotenv('backend/.env')
      e = create_engine(os.environ['DATABASE_URL'].replace('postgres://','postgresql://',1))
      with e.connect() as c:
          r = c.execute(text(\"SELECT to_regclass('portfolio_performance_snapshots')\")).scalar()
          print('Table exists:', r is not None)
      "
      ```

- [ ] **Capture production transactions and assets state** (read-only audit) and verify it matches the
      reconciliation snapshot in spec §4. If holdings drift since 2026-04-25 (e.g., user made an unscheduled
      trade), pause and re-verify anchor values against current Toss state.

- [ ] **Verify all Track A migrations ran clean on the C-track sqlite test DB** with the full pytest suite
      green (`.venv/bin/pytest tests/ -q`).

## Deploy steps (production Supabase)

- [ ] **Take Supabase backup** (or confirm point-in-time restore is enabled and recent).

- [ ] **Apply migrations against production:**

      ```bash
      cd /home/lg/dev/Portfolio_Tracker/backend
      DATABASE_URL='<PROD_DSN>' .venv/bin/alembic upgrade head
      ```

      Expected output includes the two Track A revision lines:
      `track_a_asset_naming` and `track_a_anchor_rows`.

- [ ] **Verify anchor invariants on production:**

      ```bash
      DATABASE_URL='<PROD_DSN>' .venv/bin/python -c "
      from sqlalchemy import create_engine, text
      import os
      e = create_engine(os.environ['DATABASE_URL'].replace('postgres://','postgresql://',1))
      with e.connect() as c:
          c.execute(text('BEGIN READ ONLY'))
          r = c.execute(text('SELECT * FROM portfolio_snapshots WHERE date = :d'), {'d':'2026-04-25'}).fetchone()
          print('Archive anchor:', dict(r._mapping) if r else 'MISSING')
          r = c.execute(text('SELECT * FROM portfolio_performance_snapshots WHERE date = :d'), {'d':'2026-04-25'}).fetchone()
          print('Performance anchor:', dict(r._mapping) if r else 'MISSING')
          r = c.execute(text(\"SELECT id, symbol, code, name FROM assets WHERE code = '418660' OR id = 1\")).fetchall()
          for row in r: print('Asset:', dict(row._mapping))
          c.execute(text('ROLLBACK'))
      "
      ```

      Expected:
      - Archive anchor: total_value=21353133.0, invested_capital=21253002.0, cash_balance=100131.0
      - Performance anchor: performance_value=100.0, source_version='manual-anchor-v1'
      - Asset id=1: symbol='KODEX_1X', name='KODEX 미국나스닥100'
      - Asset code=418660: symbol='TIGER_2X', name='TIGER 미국나스닥100레버리지(합성)'

- [ ] **Trigger one cron run of `generate_portfolio_snapshots`** (or wait for the scheduled run) and re-verify
      that the manual-anchor row is preserved (`source_version` still `'manual-anchor-v1'`,
      `performance_value` still `100.0`).

## Post-deploy

- [ ] **Friday 2026-05-01 — record the rotation buy.** When the user executes the BUY TIGER_2X / SELL KODEX_1X
      transactions, enter them via the existing `/api/transactions` endpoint. Verify same-day after entry that
      `portfolio_performance_snapshots[2026-05-01]` has `performance_value` close to 100.0 (modulo intraday
      price movement) and `coverage_status='ready'`.

- [ ] **Update Track B backlog** with discovered residue:
      - QQQ −2 share compensating SELL still pending
      - 2026-03-20 5 transactions price backfill still pending
      - id=3 → ACE_TLT rename still pending
      - id=14 BRAZIL_BOND name localisation still pending

## Rollback

If the migration causes production issues:

```bash
DATABASE_URL='<PROD_DSN>' .venv/bin/alembic downgrade -2
```

This reverses both Track A migrations. Note: anchor row downgrade does not remove archive row (see migration
docstring); manually delete if needed.
```

- [ ] **Step 2: Commit**

```bash
git -C /home/lg/dev/Portfolio_Tracker add docs/superpowers/handoff/2026-04-25-track-a-deployment.md
git -C /home/lg/dev/Portfolio_Tracker commit -m "docs(track-a): production deployment checklist

Captures pre-deploy verification (d2c4f6a8b901 prerequisite, production
state audit), deploy steps (Alembic upgrade head against PROD_DSN), anchor
invariant verification queries, and rollback procedure.

Target deadline: 2026-05-01 (Friday rotation buy).
Refs spec: docs/superpowers/specs/2026-04-25-portfolio-anchor-design.md"
```

---

## Self-Review

**1. Spec coverage check (against Track A Lock Table §12):**

- L1 (Naming convention β + field separation) — Task 1 ✓
- L2 (New asset TIGER_2X / 418660) — Task 2 ✓
- L3 (Asset id=1 migration) — Task 2 ✓
- L4 (`infer_account_silo` simplification) — Task 3 ✓
- L5 (`TICKER_PROXY` re-keying) — Task 4 ✓
- L6 (`ISA_KR_CODES` + 418660) — Task 3 ✓
- L7 (Archive anchor row) — Task 5 ✓
- L8 (Performance anchor row) — Task 5 ✓
- L9 (Cash representation in `PortfolioSnapshot.cash_balance`) — Task 5 ✓
- L10 (TWR entry point inside `portfolio_service` daily generator) — Task 6 ✓ (anchor-aware extension of existing logic; no new entry point needed)
- L11 (Same-day swap unit test) — Task 7 ✓
- L12 (PRODUCT.md §6/§7 corrections) — Task 1 ✓
- algo_service NDX rotation regression (spec §10.4) — Task 8 ✓
- Service-layer split flag (project memory feedback) — Task 9 ✓
- Production deployment handoff (spec §11.1, §11.2 risks) — Task 10 ✓

All 12 lock items + the spec's testing matrix + deferred-decision flag are covered.

**2. Placeholder scan:** No "TBD", "TODO", "fill in", or vague-action steps. Two places call for engineer judgement and explicitly say so (Task 8 step 3 — adapt entry-point name; Task 7 step 3 — debug if test fails). These are unavoidable given inability to run the suite during plan writing.

**3. Type consistency:** `manual-anchor-v1` source_version string used identically in Tasks 5, 6, and 10. `KODEX_1X`, `TIGER_2X`, `ACE_TLT` symbol values consistent across tasks. `ISA_KR_CODES` set membership identical in spec and Task 3. Anchor values (21353133 / 21253002 / 100131 / 100.0) identical in spec §6.3 and Task 5 migration.

**4. Risk-task assessment:** Task 6 (anchor-aware `get_equity_curve` + cron protection) is the riskiest because it modifies a 220-line method that downstream services (report, friday, intelligence, risk-adjusted) all depend on transitively. The plan mitigates by:
- Preserving the legacy `elif explicit_cashflows` branch unchanged
- Asserting full test suite passes after the change (Task 6 step 7)
- Flagging the file as ripe for split (Task 9)

If Task 6 fails the full-suite check, the right escalation is to revert the change, re-read the failing test, and adjust the anchor-aware branch — not to weaken the assertions.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-portfolio-anchor-track-a.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
