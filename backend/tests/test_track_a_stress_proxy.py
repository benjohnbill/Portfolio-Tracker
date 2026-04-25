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
