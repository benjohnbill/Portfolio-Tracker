"""Track A + B1 — stress_service.TICKER_PROXY re-keying.

Track A: proxy table re-keyed from raw tickers (QQQ, TLT) to semantic labels.
B1: KODEX_1X -> NDX_1X, TIGER_2X -> NDX_2X (issuer brand replaced by index name).

After B1, the proxy table uses NDX_1X and NDX_2X as keys.
"""
from app.services.stress_service import StressService


def test_ndx_1x_proxies_to_qqq():
    assert StressService.TICKER_PROXY["NDX_1X"] == "QQQ"


def test_ndx_2x_proxies_to_qld():
    assert StressService.TICKER_PROXY["NDX_2X"] == "QLD"


def test_ace_tlt_proxies_to_tlt():
    assert StressService.TICKER_PROXY["ACE_TLT"] == "TLT"


def test_legacy_qqq_key_removed():
    """The placeholder 'QQQ' key must be gone after Track A migration."""
    assert "QQQ" not in StressService.TICKER_PROXY


def test_legacy_tlt_key_removed():
    """The placeholder 'TLT' key must be gone after Track A migration."""
    assert "TLT" not in StressService.TICKER_PROXY


def test_kodex_1x_key_removed():
    """KODEX_1X removed after B1 revision — NDX_1X is the new key."""
    assert "KODEX_1X" not in StressService.TICKER_PROXY


def test_tiger_2x_key_removed():
    """TIGER_2X removed after B1 revision — NDX_2X is the new key."""
    assert "TIGER_2X" not in StressService.TICKER_PROXY


def test_unchanged_keys_preserved():
    """Keys that did not need migration must be preserved."""
    expected = {"CSI300", "NIFTY", "MSTR", "DBMF", "GLDM", "BIL", "PFIX", "VBIL", "SPY"}
    for k in expected:
        assert k in StressService.TICKER_PROXY, f"{k} must remain in TICKER_PROXY"
