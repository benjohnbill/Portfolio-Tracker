"""
Notification service for sending alerts via Telegram.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

import httpx

from . import discord_notifier


class NotificationService:
    """Handles sending notifications to configured channels."""

    TELEGRAM_API_BASE = "https://api.telegram.org"

    @staticmethod
    def _get_telegram_config() -> tuple[Optional[str], Optional[str]]:
        """Get Telegram bot token and chat ID from environment."""
        bot_token = os.getenv("TELEGRAM_PORTFOLIO_BOT_TOKEN")
        chat_id = os.getenv("TELEGRAM_PORTFOLIO_CHAT_ID")
        return bot_token, chat_id

    @staticmethod
    def send_telegram_message(message: str, parse_mode: str = "HTML") -> bool:
        """
        Send a message via Telegram bot.
        
        Args:
            message: The message text to send
            parse_mode: "HTML" or "Markdown" formatting
            
        Returns:
            True if sent successfully, False otherwise
        """
        bot_token, chat_id = NotificationService._get_telegram_config()
        
        if not bot_token or not chat_id:
            print("Telegram not configured: missing TELEGRAM_PORTFOLIO_BOT_TOKEN or TELEGRAM_PORTFOLIO_CHAT_ID")
            return False

        url = f"{NotificationService.TELEGRAM_API_BASE}/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": parse_mode,
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.post(url, json=payload)
                if response.status_code == 200:
                    print(f"Telegram notification sent successfully")
                    return True
                else:
                    print(f"Telegram API error: {response.status_code} - {response.text}")
                    return False
        except Exception as e:
            print(f"Failed to send Telegram notification: {e}")
            return False

    @staticmethod
    def send_cron_success(
        duration_seconds: float,
        vxn_updated: bool,
        mstr_seeded: bool,
        weekly_score: Optional[int],
        records_processed: int = 0,
    ) -> bool:
        """Send a success notification for cron job completion."""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        
        message = (
            f"✅ <b>Portfolio Update Success</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"⏱ Duration: {duration_seconds:.1f}s\n"
            f"📊 Weekly Score: {weekly_score or 'N/A'}\n"
            f"📈 VXN Updated: {'Yes' if vxn_updated else 'No'}\n"
            f"🏢 MSTR Seeded: {'Yes' if mstr_seeded else 'No'}\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🕐 {timestamp}"
        )

        result = NotificationService.send_telegram_message(message)
        discord_notifier.send_discord_message(message)
        return result

    @staticmethod
    def send_cron_failure(
        error_message: str,
        duration_seconds: float,
        step: str = "unknown",
    ) -> bool:
        """Send a failure notification for cron job errors."""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        
        # Truncate error message if too long
        error_display = error_message[:500] + "..." if len(error_message) > 500 else error_message
        
        message = (
            f"❌ <b>Portfolio Update Failed</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"📍 Step: {step}\n"
            f"⏱ Duration: {duration_seconds:.1f}s\n"
            f"━━━━━━━━━━━━━━━\n"
            f"<b>Error:</b>\n<code>{error_display}</code>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🕐 {timestamp}"
        )

        result = NotificationService.send_telegram_message(message)
        discord_notifier.send_discord_message(message)
        return result

    @staticmethod
    def send_test_message() -> bool:
        """Send a test message to verify configuration."""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        
        message = (
            f"🧪 <b>Portfolio Tracker Test</b>\n"
            f"━━━━━━━━━━━━━━━\n"
            f"Telegram notifications are working!\n"
            f"━━━━━━━━━━━━━━━\n"
            f"🕐 {timestamp}"
        )

        result = NotificationService.send_telegram_message(message)
        discord_notifier.send_discord_message(message)
        return result
