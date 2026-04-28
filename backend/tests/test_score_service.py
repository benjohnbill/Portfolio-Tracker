from app.services.score_service import asset_to_category


def test_ndx_classifies_via_ndx_prefix():
    """NDX_1X and NDX_2X classify as NDX after B1 symbol revision."""
    assert asset_to_category("NDX_1X") == "NDX"
    assert asset_to_category("NDX_2X") == "NDX"


def test_qqq_no_longer_in_ndx_token_list():
    """QQQ token removed — raw 'QQQ' string no longer classifies as NDX."""
    assert asset_to_category("QQQ") != "NDX"


def test_kodex_1x_classifies_as_ndx():
    """KODEX_1X is the current Track A production symbol — must classify as NDX until Track B B1 runs."""
    assert asset_to_category("KODEX_1X") == "NDX"


def test_tiger_2x_classifies_as_ndx():
    """TIGER_2X is the current Track A production symbol — must classify as NDX until Track B B1 runs."""
    assert asset_to_category("TIGER_2X") == "NDX"
