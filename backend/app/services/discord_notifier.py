"""
Discord webhook notifier — runs alongside the Telegram notification service.

Mirrors the structure and exception handling of notification_service.py. When
DISCORD_WEBHOOK_URL is unset the module stays silent (prints a warning and
returns False), matching the Telegram "not configured" behavior.
"""
from __future__ import annotations

import os
import re
from typing import Optional

import httpx


DISCORD_MAX_CONTENT = 1800  # Discord hard limit is 2000; leave a buffer.


def _get_discord_webhook_url() -> Optional[str]:
    """Get Discord webhook URL from environment."""
    return os.getenv("DISCORD_WEBHOOK_URL")


def _html_to_discord_markdown(html: str) -> str:
    """
    Convert the subset of Telegram HTML we emit into Discord markdown.

    Mappings:
        <b>X</b>    -> **X**
        <i>X</i>    -> *X*
        <code>X</code> -> `X` (single backtick) or ```X``` (if multi-line)

    Emoji and unicode dividers (━━━) pass through untouched. Any other tags
    are stripped without crashing.
    """
    if not html:
        return ""

    text = html

    # <code>...</code> — multi-line uses triple backticks; single-line uses `.
    def _code_sub(match: re.Match) -> str:
        inner = match.group(1)
        if "\n" in inner:
            return f"```\n{inner}\n```"
        return f"`{inner}`"

    text = re.sub(r"<code>(.*?)</code>", _code_sub, text, flags=re.DOTALL)

    # <b>...</b> -> **...**
    text = re.sub(r"<b>(.*?)</b>", r"**\1**", text, flags=re.DOTALL)

    # <i>...</i> -> *...*
    text = re.sub(r"<i>(.*?)</i>", r"*\1*", text, flags=re.DOTALL)

    # Strip any remaining tags safely (keep inner text).
    text = re.sub(r"<[^>]+>", "", text)

    return text


def send_discord_message(message: str) -> bool:
    """
    Send a message via Discord webhook.

    Args:
        message: Telegram-HTML formatted message; will be converted to
                 Discord-compatible markdown and truncated to 1800 chars.

    Returns:
        True if Discord returned 204 No Content, False otherwise.
    """
    webhook_url = _get_discord_webhook_url()

    if not webhook_url:
        print("Discord not configured: missing DISCORD_WEBHOOK_URL")
        return False

    content = _html_to_discord_markdown(message)
    if len(content) > DISCORD_MAX_CONTENT:
        content = content[:DISCORD_MAX_CONTENT]

    payload = {"content": content}

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(webhook_url, json=payload)
            if response.status_code == 204:
                print("Discord notification sent successfully")
                return True
            else:
                print(f"Discord webhook error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        print(f"Failed to send Discord notification: {e}")
        return False
