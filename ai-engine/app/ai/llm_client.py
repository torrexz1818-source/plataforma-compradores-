from typing import Any

from fastapi import HTTPException
from openai import AsyncOpenAI, OpenAIError

from app.agents.proposal_comparison.prompts import SYSTEM_PROMPT
from app.ai.json_utils import parse_json_response
from app.config import get_settings


async def analyze_with_openai(user_prompt: str, system_prompt: str | None = None) -> dict[str, Any]:
    settings = get_settings()

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY no está configurada en el AI Engine.",
        )

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt or SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=502,
            detail="OpenAI no pudo procesar el análisis en este momento.",
        ) from exc

    content = response.choices[0].message.content or ""

    try:
        return parse_json_response(content)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="OpenAI devolvió una respuesta que no es JSON válido.",
        ) from exc
