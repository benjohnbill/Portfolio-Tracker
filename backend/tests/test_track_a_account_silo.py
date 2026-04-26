"""Track A — infer_account_silo simplification.

After Track A, infer_account_silo must use only `asset.code in ISA_KR_CODES`
for KR ETF detection (no symbol fallback). The NDX_2X code 418660 must
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
        "NDX_2X code 418660 must be in ISA_KR_CODES for inference"
    )


def test_ndx_1x_inferred_isa_etf_by_code():
    """Even with new symbol NDX_1X (not in legacy fallback set), code-based
    matching must still infer ISA_ETF."""
    asset = make_asset(symbol="NDX_1X", code="379810", source="KR")
    assert PortfolioService.infer_account_silo(asset) == AccountSilo.ISA_ETF
    assert PortfolioService.infer_account_type(asset) == AccountType.ISA


def test_ndx_2x_inferred_isa_etf_by_code():
    asset = make_asset(symbol="NDX_2X", code="418660", source="KR")
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
