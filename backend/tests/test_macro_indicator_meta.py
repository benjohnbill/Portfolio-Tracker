from app.data.macro_indicator_meta import INDICATOR_META, META_LOGIC_VERSION


EXPECTED_KEYS = {
    "net_liquidity", "m2_yoy", "nfci",
    "real_yield_10y", "yield_spread_10y2y", "yield_spread_10y3m",
    "cpi_yoy", "core_pce_yoy",
    "real_gdp_growth", "nfp_change_3m_avg", "sahm_rule",
    "vxn", "credit_spread",
}

EXPECTED_BUCKETS = {
    "Liquidity/FCI": {"net_liquidity", "m2_yoy", "nfci"},
    "Rates": {"real_yield_10y", "yield_spread_10y2y", "yield_spread_10y3m"},
    "Inflation": {"cpi_yoy", "core_pce_yoy"},
    "Growth/Labor": {"real_gdp_growth", "nfp_change_3m_avg", "sahm_rule"},
    "Stress/Sentiment": {"vxn", "credit_spread"},
}

EXPECTED_CORES = {"sahm_rule", "core_pce_yoy", "nfci", "yield_spread_10y3m"}


def test_meta_logic_version_present_and_semver():
    assert META_LOGIC_VERSION == "1.0.0"


def test_meta_covers_all_13_indicators():
    assert set(INDICATOR_META.keys()) == EXPECTED_KEYS


def test_meta_bucket_assignment_matches_spec():
    by_bucket: dict[str, set[str]] = {}
    for key, meta in INDICATOR_META.items():
        by_bucket.setdefault(meta.bucket, set()).add(key)
    assert by_bucket == EXPECTED_BUCKETS


def test_each_bucket_has_at_most_one_core_indicator():
    cores_by_bucket: dict[str, list[str]] = {}
    for key, meta in INDICATOR_META.items():
        if meta.core_indicator:
            cores_by_bucket.setdefault(meta.bucket, []).append(key)
    for bucket, cores in cores_by_bucket.items():
        assert len(cores) <= 1, f"{bucket} has multiple cores: {cores}"


def test_expected_core_indicators_marked():
    actual_cores = {key for key, meta in INDICATOR_META.items() if meta.core_indicator}
    assert actual_cores == EXPECTED_CORES


def test_threshold_rationale_source_recorded_for_every_meta():
    valid = {"academic", "policy", "historical_percentile", "custom"}
    for key, meta in INDICATOR_META.items():
        assert meta.threshold_rationale_source in valid, key


def test_signal_asymmetry_recorded_for_every_meta():
    valid = {"fn_dominant", "fp_dominant", "symmetric"}
    for key, meta in INDICATOR_META.items():
        assert meta.signal_asymmetry in valid, key


def test_persistence_weeks_default_is_one_for_v24():
    """Phase A hysteresis is deferred — every persistence_weeks must be 1 in v2.4
    except T10Y3M which uses 4 (NY Fed model standard)."""
    for key, meta in INDICATOR_META.items():
        if key == "yield_spread_10y3m":
            assert meta.persistence_weeks == 4, key
        else:
            assert meta.persistence_weeks == 1, key
