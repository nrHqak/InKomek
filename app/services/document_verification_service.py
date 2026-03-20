from __future__ import annotations

import json
import re
from typing import Any


DOCUMENT_PROMPT = """You validate disability-document photos for onboarding.

Return strict JSON:
{
  "is_valid_document": true,
  "confidence": 0.0,
  "reason": "short reason"
}

Rules:
- confidence must be between 0.0 and 1.0
- reason must be short and factual
- no markdown
"""


class DocumentVerificationService:
    def __init__(self, *, api_key: str, model: str) -> None:
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required.")
        try:
            from google import genai as _genai
            from google.genai import types as _types
        except Exception as exc:
            raise RuntimeError(
                "google-genai package is not installed. Install it with: pip install google-genai"
            ) from exc
        self._types = _types
        self.client = _genai.Client(api_key=api_key)
        self.model = model

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any]:
        raw = (text or "").strip()
        if not raw:
            raise ValueError("Empty model response.")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", raw)
            if not match:
                raise ValueError("Model response does not contain JSON.")
            return json.loads(match.group(0))

    def verify(self, *, image_bytes: bytes, mime_type: str) -> dict[str, Any]:
        if not image_bytes:
            raise ValueError("Image is empty.")

        response = self.client.models.generate_content(
            model=self.model,
            contents=[
                self._types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                DOCUMENT_PROMPT,
            ],
            config=self._types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )
        payload = self._extract_json(response.text or "")

        valid = bool(payload.get("is_valid_document", False))
        try:
            confidence = float(payload.get("confidence", 0.5))
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))
        reason = str(payload.get("reason", "")).strip() or "Document verification completed."

        return {
            "is_valid_document": valid,
            "confidence": confidence,
            "reason": reason[:300],
            "model": self.model,
        }
