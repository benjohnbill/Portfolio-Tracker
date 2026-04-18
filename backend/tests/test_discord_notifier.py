"""
Tests for the Discord webhook notifier.

Mirrors the style of notification_service tests: uses monkeypatch to stub
environment variables and httpx.Client.post.
"""
from __future__ import annotations

import httpx
import pytest

from app.services import discord_notifier


class _FakeResponse:
    def __init__(self, status_code: int, text: str = ""):
        self.status_code = status_code
        self.text = text


class _FakeClient:
    """Minimal stand-in for httpx.Client used as a context manager."""

    def __init__(self, response: _FakeResponse | None = None, raise_exc: Exception | None = None):
        self._response = response
        self._raise_exc = raise_exc
        self.calls: list[tuple[str, dict]] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def post(self, url, json=None):
        self.calls.append((url, json))
        if self._raise_exc is not None:
            raise self._raise_exc
        return self._response


def _install_fake_client(monkeypatch, fake: _FakeClient) -> None:
    """Replace httpx.Client with a factory returning our fake."""
    def _factory(*args, **kwargs):
        return fake
    monkeypatch.setattr(discord_notifier.httpx, "Client", _factory)


# ---------- env var handling ----------


def test_send_returns_false_when_env_missing(monkeypatch):
    monkeypatch.delenv("DISCORD_WEBHOOK_URL", raising=False)
    fake = _FakeClient(response=_FakeResponse(204))
    _install_fake_client(monkeypatch, fake)

    result = discord_notifier.send_discord_message("hello")

    assert result is False
    assert fake.calls == []  # no HTTP call attempted


# ---------- HTML → Markdown conversion ----------


def test_html_to_markdown_bold():
    assert discord_notifier._html_to_discord_markdown("<b>bold</b>") == "**bold**"


def test_html_to_markdown_inline_code():
    assert discord_notifier._html_to_discord_markdown("<code>x</code>") == "`x`"


def test_html_to_markdown_italic():
    assert discord_notifier._html_to_discord_markdown("<i>x</i>") == "*x*"


def test_html_to_markdown_preserves_emoji_and_dividers():
    src = "✅ win\n━━━━━━━━━━━━━━━\ndone"
    out = discord_notifier._html_to_discord_markdown(src)
    assert "✅" in out
    assert "━━━━━━━━━━━━━━━" in out


def test_html_to_markdown_strips_unknown_tags_safely():
    src = "<span class='x'>hi</span><br/><div>there</div>"
    out = discord_notifier._html_to_discord_markdown(src)
    # No crash; no raw tags remaining.
    assert "<span" not in out
    assert "<div" not in out
    assert "hi" in out
    assert "there" in out


def test_html_to_markdown_multiline_code_uses_triple_backticks():
    src = "<code>line1\nline2\nline3</code>"
    out = discord_notifier._html_to_discord_markdown(src)
    assert "```" in out
    assert "line1" in out
    assert "line2" in out
    assert "line3" in out


# ---------- truncation ----------


def test_message_truncated_to_1800_chars(monkeypatch):
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/webhook")
    fake = _FakeClient(response=_FakeResponse(204))
    _install_fake_client(monkeypatch, fake)

    long_msg = "a" * 5000
    result = discord_notifier.send_discord_message(long_msg)

    assert result is True
    assert len(fake.calls) == 1
    _, payload = fake.calls[0]
    assert len(payload["content"]) <= 1800


# ---------- HTTP response handling ----------


def test_http_204_returns_true(monkeypatch):
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/webhook")
    fake = _FakeClient(response=_FakeResponse(204))
    _install_fake_client(monkeypatch, fake)

    assert discord_notifier.send_discord_message("hi") is True


def test_http_200_returns_false(monkeypatch):
    # Discord success is 204; 200 should NOT be considered success.
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/webhook")
    fake = _FakeClient(response=_FakeResponse(200, text="unexpected"))
    _install_fake_client(monkeypatch, fake)

    assert discord_notifier.send_discord_message("hi") is False


def test_http_500_returns_false(monkeypatch):
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/webhook")
    fake = _FakeClient(response=_FakeResponse(500, text="server err"))
    _install_fake_client(monkeypatch, fake)

    assert discord_notifier.send_discord_message("hi") is False


# ---------- exception handling ----------


def test_timeout_exception_returns_false(monkeypatch):
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/webhook")
    fake = _FakeClient(raise_exc=httpx.TimeoutException("timed out"))
    _install_fake_client(monkeypatch, fake)

    assert discord_notifier.send_discord_message("hi") is False


def test_generic_exception_returns_false(monkeypatch):
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/webhook")
    fake = _FakeClient(raise_exc=RuntimeError("boom"))
    _install_fake_client(monkeypatch, fake)

    assert discord_notifier.send_discord_message("hi") is False


# ---------- payload shape ----------


def test_payload_contains_content_field(monkeypatch):
    monkeypatch.setenv("DISCORD_WEBHOOK_URL", "https://discord.test/webhook")
    fake = _FakeClient(response=_FakeResponse(204))
    _install_fake_client(monkeypatch, fake)

    discord_notifier.send_discord_message("<b>hello</b>")

    assert len(fake.calls) == 1
    url, payload = fake.calls[0]
    assert url == "https://discord.test/webhook"
    assert "content" in payload
    assert payload["content"] == "**hello**"
