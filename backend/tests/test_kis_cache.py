from unittest.mock import patch, MagicMock
from app.services.kis_service import KISService, _KIS_BRAZIL_BOND_CACHE


def _fake_kis_response(brazil_amount=100.0, exchange_rate=250.0):
    resp = MagicMock()
    resp.json.return_value = {
        "rt_cd": "0",
        "output1": [
            {
                "prdt_name": "BNTNF brazil bond",
                "frcr_evlu_amt2": str(brazil_amount),
                "bass_exrt": str(exchange_rate),
            }
        ],
    }
    return resp


def test_get_brazil_bond_value_caches_within_day():
    _KIS_BRAZIL_BOND_CACHE.clear()

    with patch("app.services.kis_service.KISAuth.get_access_token", return_value="fake-token"), \
         patch("app.services.kis_service.requests.get", return_value=_fake_kis_response()) as mock_get:
        first = KISService.get_brazil_bond_value()
        second = KISService.get_brazil_bond_value()

    assert first == 100.0 * 250.0
    assert second == 100.0 * 250.0
    assert mock_get.call_count == 1  # second call must hit cache


def test_get_brazil_bond_value_does_not_cache_failures():
    """Zero/negative values (failures) should not be cached so the next call retries."""
    _KIS_BRAZIL_BOND_CACHE.clear()

    failing_resp = MagicMock()
    failing_resp.json.return_value = {"rt_cd": "1", "msg1": "boom"}

    success_resp = _fake_kis_response(brazil_amount=50.0, exchange_rate=300.0)

    with patch("app.services.kis_service.KISAuth.get_access_token", return_value="fake-token"), \
         patch("app.services.kis_service.requests.get", side_effect=[failing_resp, success_resp]) as mock_get:
        first = KISService.get_brazil_bond_value()
        second = KISService.get_brazil_bond_value()

    assert first == 0.0
    assert second == 50.0 * 300.0
    assert mock_get.call_count == 2  # failure was not cached
