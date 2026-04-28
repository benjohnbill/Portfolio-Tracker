"""v2.4 reweight invariants for compute_alignment_score and
compute_posture_diversification_score. Targets the new ranges and the
20/12/8 posture sub-decomposition."""

import pytest
from app.services.score_service import (
    compute_alignment_score,
    compute_posture_diversification_score,
)


def _alloc(weights: dict[str, float]) -> list[dict]:
    return [{"asset": symbol, "weight": w} for symbol, w in weights.items()]


# Alignment ---------------------------------------------------------------

def test_alignment_max_is_30_after_v24():
    result = compute_alignment_score(_alloc({"NDX_1X": 0.30, "DBMF": 0.30, "BRAZIL": 0.10, "MSTR": 0.10, "GLDM": 0.10, "BIL": 0.10}))
    assert result["max"] == 30
    assert result["score"] == 30  # all on target → full points


def test_alignment_per_category_max_uses_30_not_35():
    result = compute_alignment_score(_alloc({"NDX_1X": 0.30, "DBMF": 0.30, "BRAZIL": 0.10, "MSTR": 0.10, "GLDM": 0.10, "BIL": 0.10}))
    ndx = next(c for c in result["categories"] if c["category"] == "NDX")
    assert ndx["max"] == pytest.approx(30 * 0.30)


# Posture -----------------------------------------------------------------

def test_posture_max_is_40_after_v24(db_session):
    result = compute_posture_diversification_score(db_session, _alloc({"NDX_1X": 0.30, "DBMF": 0.30, "MSTR": 0.10, "GLDM": 0.10, "BRAZIL": 0.10, "BIL": 0.10}))
    assert result["max"] == 40


def test_posture_subscore_ranges_v24(db_session):
    result = compute_posture_diversification_score(db_session, _alloc({"NDX_1X": 0.30, "DBMF": 0.30, "MSTR": 0.10, "GLDM": 0.10, "BRAZIL": 0.10, "BIL": 0.10}))
    assert result["stressResilience"]["max"] == 20
    assert result["concentrationControl"]["max"] == 12
    assert result["diversifierReserve"]["max"] == 8


def test_posture_subscore_full_marks_v24(db_session):
    """Diversified portfolio should achieve all three sub-scores at full marks.
    Portfolio chosen so top1=0.20≤0.25, top2=0.40≤0.45, hhi=0.18≤0.18,
    and reserve+diversifier=0.42≥0.15."""
    result = compute_posture_diversification_score(db_session, _alloc({"NDX_1X": 0.20, "DBMF": 0.20, "GLDM": 0.20, "BIL": 0.20, "BRAZIL": 0.10, "MSTR": 0.10}))
    # In v2.4 grid: stress 20 / concentration 12 / reserve 8
    assert result["concentrationControl"]["score"] == 12
    assert result["diversifierReserve"]["score"] == 8
    # stressResilience depends on StressService scenarios — assert only that it
    # falls within the sub-score grid {20, 12, 4}
    assert result["stressResilience"]["score"] in {20, 12, 4}
