"""
Tests for NotificationService message composition.

Covers the Phase D Plan C Discord echo: when the latest WeeklySnapshot has a
non-empty comment, the cron success message appends a blockquote line with it.
"""
from __future__ import annotations

from unittest.mock import patch

from app.services.notification_service import NotificationService


def test_send_cron_success_appends_comment_when_present(monkeypatch):
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_BOT_TOKEN", "t")
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_CHAT_ID", "c")

    sent = {}

    def _fake_telegram(message, parse_mode="HTML"):
        sent["telegram"] = message
        return True

    def _fake_discord(message):
        sent["discord"] = message
        return True

    with patch.object(NotificationService, "send_telegram_message", side_effect=_fake_telegram), \
         patch("app.services.notification_service.discord_notifier.send_discord_message", side_effect=_fake_discord):
        NotificationService.send_cron_success(
            duration_seconds=12.3,
            vxn_updated=True,
            mstr_seeded=False,
            weekly_score=72,
            latest_comment="Trimmed NDX; watching DXY",
        )

    assert "> 💬 Last week's comment:" in sent["telegram"]
    assert '"Trimmed NDX; watching DXY"' in sent["telegram"]
    assert sent["telegram"] == sent["discord"]  # identical source text; discord_notifier does its own markdown pass


def test_send_cron_success_omits_comment_line_when_absent(monkeypatch):
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_BOT_TOKEN", "t")
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_CHAT_ID", "c")

    sent = {}

    def _fake_telegram(message, parse_mode="HTML"):
        sent["telegram"] = message
        return True

    with patch.object(NotificationService, "send_telegram_message", side_effect=_fake_telegram), \
         patch("app.services.notification_service.discord_notifier.send_discord_message", return_value=True):
        NotificationService.send_cron_success(
            duration_seconds=12.3,
            vxn_updated=True,
            mstr_seeded=False,
            weekly_score=72,
            latest_comment=None,
        )

    assert "Last week's comment" not in sent["telegram"]


def test_send_cron_success_omits_comment_line_when_empty_string(monkeypatch):
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_BOT_TOKEN", "t")
    monkeypatch.setenv("TELEGRAM_PORTFOLIO_CHAT_ID", "c")

    sent = {}

    def _fake_telegram(message, parse_mode="HTML"):
        sent["telegram"] = message
        return True

    with patch.object(NotificationService, "send_telegram_message", side_effect=_fake_telegram), \
         patch("app.services.notification_service.discord_notifier.send_discord_message", return_value=True):
        NotificationService.send_cron_success(
            duration_seconds=12.3,
            vxn_updated=True,
            mstr_seeded=False,
            weekly_score=72,
            latest_comment="   ",
        )

    assert "Last week's comment" not in sent["telegram"]
