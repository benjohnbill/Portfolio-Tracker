from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, ValidationError


class WeeklySummaryPayload(BaseModel):
    headline: str
    keyChanges: list[str]
    whyScoreChanged: str
    actionFocus: str
    watchItems: list[str]


class LLMService:
    @staticmethod
    def _build_prompt(report: Dict[str, Any], previous_report: Optional[Dict[str, Any]] = None) -> str:
        payload = {
            "currentReport": report,
            "previousReport": previous_report,
        }
        return (
            "You are summarizing a deterministic weekly portfolio report. "
            "Do not invent facts. Use only the provided JSON. Return concise JSON matching the required schema.\n\n"
            f"{json.dumps(payload, ensure_ascii=False)}"
        )

    @staticmethod
    def _openai_summary(prompt: str) -> WeeklySummaryPayload:
        from openai import OpenAI

        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=30.0, max_retries=2)
        response = client.chat.completions.create(
            model=os.getenv("WEEKLY_REPORT_OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Return only valid JSON for the weekly summary schema."},
                {"role": "user", "content": prompt},
            ],
        )
        content = response.choices[0].message.content or "{}"
        return WeeklySummaryPayload.parse_obj(json.loads(content))

    @staticmethod
    def _gemini_summary(prompt: str) -> WeeklySummaryPayload:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=os.environ["GEMINI_API_KEY_MAIN"])
        response = client.models.generate_content(
            model=os.getenv("WEEKLY_REPORT_GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_json_schema=WeeklySummaryPayload.schema(),
            ),
        )
        return WeeklySummaryPayload.parse_raw(response.text)

    @staticmethod
    def generate_summary(report: Dict[str, Any], previous_report: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        provider = os.getenv("WEEKLY_REPORT_LLM_PROVIDER", "openai").lower()
        prompt = LLMService._build_prompt(report, previous_report)

        providers = [provider]
        if provider == "openai":
            providers.append("gemini")
        elif provider == "gemini":
            providers.append("openai")

        summary = None
        model = None
        used_provider = None
        for candidate in providers:
            try:
                if candidate == "gemini":
                    summary = LLMService._gemini_summary(prompt)
                    model = os.getenv("WEEKLY_REPORT_GEMINI_MODEL", "gemini-2.5-flash")
                else:
                    summary = LLMService._openai_summary(prompt)
                    model = os.getenv("WEEKLY_REPORT_OPENAI_MODEL", "gpt-4o-mini")
                used_provider = candidate
                break
            except (KeyError, ImportError, ValidationError, json.JSONDecodeError, Exception):
                continue

        if summary is None or model is None or used_provider is None:
            return None

        return {
            "provider": used_provider,
            "model": model,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            **summary.model_dump(),
        }
