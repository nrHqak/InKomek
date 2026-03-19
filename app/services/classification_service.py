from __future__ import annotations

import json
import re
from typing import Any

from google import genai
from google.genai import types

ALLOWED_CATEGORIES = {
    "no_ramp",
    "broken_elevator",
    "high_curb",
    "dangerous_zone",
    "other",
    "no_problem",
}

CLASSIFICATION_PROMPT = """You are an accessibility inspector for urban infrastructure in Kazakhstan.

Analyze this image and classify it into EXACTLY ONE category:
- no_ramp: Missing wheelchair ramp at crossing/building entrance
- broken_elevator: Non-functional, broken, or inaccessible elevator/lift
- high_curb: Curb too high for wheelchair transition
- dangerous_zone: Broken sidewalk, hole, debris, unsafe path, blocked path
- other: Accessibility issue exists but does not match above
- no_problem: No visible accessibility problem

Respond strictly in JSON with this exact schema:
{
  "category": "no_ramp|broken_elevator|high_curb|dangerous_zone|other|no_problem",
  "confidence": 0.0,
  "description": "one short sentence"
}

Rules:
- confidence must be between 0.0 and 1.0
- description max 20 words
- do not include markdown fences
"""


class AccessibilityClassificationService:
    def __init__(self, *, api_key: str, model: str) -> None:
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required.")
        self.client = genai.Client(api_key=api_key)
        self.model = model

    @staticmethod
    def _extract_json_object(text: str) -> dict[str, Any]:
        raw = text.strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        fenced = re.search(r"\{[\s\S]*\}", raw)
        if fenced is None:
            raise ValueError("Gemini response did not contain JSON.")
        return json.loads(fenced.group(0))

    @staticmethod
    def _normalize(payload: dict[str, Any], model_name: str) -> dict[str, Any]:
        category = str(payload.get("category", "")).strip().lower()
        if category not in ALLOWED_CATEGORIES:
            category = "other"

        confidence_raw = payload.get("confidence", 0.5)
        try:
            confidence = float(confidence_raw)
        except (TypeError, ValueError):
            confidence = 0.5
        confidence = max(0.0, min(1.0, confidence))

        description = str(payload.get("description", "")).strip()
        if not description:
            description = "Accessibility condition detected."
        if len(description) > 300:
            description = description[:300]

        return {
            "category": category,
            "confidence": confidence,
            "description": description,
            "model": model_name,
        }

    def classify(self, *, image_bytes: bytes, mime_type: str) -> dict[str, Any]:
        if not image_bytes:
            raise ValueError("Image bytes are empty.")

        response = self.client.models.generate_content(
            model=self.model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                CLASSIFICATION_PROMPT,
            ],
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )
        if not response.text:
            raise ValueError("Gemini returned an empty response.")
        payload = self._extract_json_object(response.text)
        return self._normalize(payload, self.model)
