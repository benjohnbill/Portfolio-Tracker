"""Cron pre-warm guard — daily cron must call MacroService.get_macro_snapshot_cached.

Without this call, the first /api/macro-vitals request after each day's date
rollover hits the cold path (~8s via FRED + Yahoo round-trips). The warm-up
ensures SystemCache is seeded before any user request that day.
"""

from unittest.mock import patch

from app.main import app  # noqa: F401 — imported for fixture wiring side effect


def test_cron_warms_macro_snapshot(client, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "test-secret")

    weekly_report_stub = {"score": {"total": 0}, "weekEnding": "2026-05-14"}
    spy_delta_stub = {"processed": 0}

    with patch(
        "app.main.MacroService.get_macro_snapshot_cached"
    ) as mock_warm, patch(
        "app.services.ingestion_service.PriceIngestionService.update_raw_prices"
    ), patch(
        "app.services.ingestion_service.PriceIngestionService.generate_portfolio_snapshots"
    ), patch(
        "app.services.quant_service.QuantService.update_vxn_history",
        return_value=0,
    ), patch(
        "app.services.quant_service.QuantService.seed_mstr_corporate_actions",
        return_value=0,
    ), patch(
        "app.services.report_service.ReportService.generate_weekly_report",
        return_value=weekly_report_stub,
    ), patch(
        "app.services.portfolio_service.PortfolioService.clear_cache"
    ), patch(
        "app.services.portfolio_service.PortfolioService.get_portfolio_summary"
    ), patch(
        "app.services.portfolio_service.PortfolioService.get_portfolio_allocation"
    ), patch(
        "app.services.portfolio_service.PortfolioService.get_equity_curve"
    ), patch(
        "app.services.attribution_service.AttributionService.compute_latest"
    ), patch(
        "app.services.outcome_evaluator.OutcomeEvaluatorService.backfill_spy_deltas",
        return_value=spy_delta_stub,
    ), patch(
        "app.services.notification_service.NotificationService.send_cron_success"
    ):
        response = client.post(
            "/api/cron/update-signals",
            headers={"x-cron-secret": "test-secret"},
        )

    assert response.status_code == 200, response.text
    assert mock_warm.call_count >= 1, "cron did not warm macro snapshot"
