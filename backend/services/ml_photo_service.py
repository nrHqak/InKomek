import base64
from pathlib import Path

import httpx

from services.config import get_settings

settings = get_settings()


async def classify_accessibility_photo(image_path: str) -> str:
    # Fallback local heuristic while Gemini integration key is not configured.
    if not settings.gemini_api_key:
        name = Path(image_path).name.lower()
        if "ramp" in name:
            return "ramp_present"
        if "elevator" in name:
            return "elevator_issue"
        return "unknown_accessibility_state"

    with open(image_path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "Classify accessibility issue in this image. "
                            "Return short label: ramp_present, ramp_absent, elevator_issue, obstacle_present."
                        )
                    },
                    {"inline_data": {"mime_type": "image/jpeg", "data": encoded}},
                ],
            }
        ]
    }

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
    )
    async with httpx.AsyncClient(timeout=40.0) as client:
        response = await client.post(url, json=payload)
    if response.status_code >= 400:
        return "classification_error"

    data = response.json()
    try:
        text_result = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        return "classification_error"
    return text_result[:200]

