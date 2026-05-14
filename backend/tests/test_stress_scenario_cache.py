from unittest.mock import patch, MagicMock
import pandas as pd
from app.services.stress_service import StressService


def test_fetch_scenario_closes_caches_yfinance_result(db_session):
    """Second call with same args must NOT trigger yfinance."""
    # Build a fake yfinance result — MultiIndex (Price, Ticker) shape.
    fake_df = pd.DataFrame(
        [[100.0], [110.0]],
        index=pd.to_datetime(["2020-02-19", "2020-03-23"]),
        columns=pd.MultiIndex.from_tuples([("Close", "SPY")]),
    )

    yf_mock = MagicMock(return_value=fake_df)
    with patch("app.services.stress_service.yf.download", yf_mock):
        result1 = StressService._fetch_scenario_closes(db_session, "2020_COVID", ["SPY"])
        result2 = StressService._fetch_scenario_closes(db_session, "2020_COVID", ["SPY"])

    # yfinance called exactly once for the cache miss; cache hit on second call.
    assert yf_mock.call_count == 1
    assert not result1.empty
    assert not result2.empty
