from app.services.score_service import asset_to_category


def test_ndx_still_classifies_via_kodex_and_tiger():
    """KODEX_1X and TIGER_2X still classify as NDX after QQQ removal."""
    assert asset_to_category("KODEX_1X") == "NDX"
    assert asset_to_category("TIGER_2X") == "NDX"
    assert asset_to_category("TIGER_1X") == "NDX"  # TIGER substring still active


def test_qqq_no_longer_in_ndx_token_list():
    """QQQ token removed — raw 'QQQ' string no longer classifies as NDX."""
    assert asset_to_category("QQQ") != "NDX"
