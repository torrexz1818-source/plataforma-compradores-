from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from app.ai.json_utils import parse_json_response
from app.config import get_settings


def _safe_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _extract_text(response: Any) -> str:
    parts: list[str] = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(str(text))
            continue
        if isinstance(block, dict) and block.get("type") == "text" and block.get("text"):
            parts.append(str(block["text"]))
    return "\n".join(parts).strip()


def _extract_usage(response: Any) -> dict[str, int | None]:
    usage = getattr(response, "usage", None)
    if not usage:
        return {"tokens_input": None, "tokens_output": None}
    return {
        "tokens_input": getattr(usage, "input_tokens", None),
        "tokens_output": getattr(usage, "output_tokens", None),
    }


def _configuration_error(message: str) -> HTTPException:
    return HTTPException(status_code=500, detail=message)


def validate_claude_settings() -> None:
    settings = get_settings()
    if settings.ai_provider != "anthropic":
        raise _configuration_error("AI_PROVIDER debe ser anthropic para Nodus IA.")
    if not settings.anthropic_api_key:
        raise _configuration_error("ANTHROPIC_API_KEY no esta configurada en el AI Engine.")
    if not settings.anthropic_model:
        raise _configuration_error(
            "ANTHROPIC_MODEL no esta configurado. Confirma el ID exacto del modelo en la consola de Anthropic o /v1/models."
        )


def create_anthropic_client() -> Any:
    settings = get_settings()
    try:
        from anthropic import AsyncAnthropic
    except Exception as exc:  # pragma: no cover - depends on deployment packaging
        raise _configuration_error("La dependencia anthropic no esta instalada en el AI Engine.") from exc

    return AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.anthropic_timeout_seconds,
        max_retries=settings.anthropic_max_retries,
    )


async def generate_agent_response(
    *,
    agentType: str,
    systemPrompt: str,
    userPrompt: str,
    documentPayload: Any | None = None,
    outputContract: Any | None = None,
    expectedSchema: Any | None = None,
    maxTokens: int | None = None,
    temperature: float | None = None,
    metadata: dict[str, Any] | None = None,
    imageContent: list[dict[str, Any]] | None = None,
    client: Any | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    validate_claude_settings()
    anthropic_client = client or create_anthropic_client()
    max_tokens = maxTokens or settings.anthropic_max_tokens
    model = settings.anthropic_model
    output_contract = outputContract if outputContract is not None else expectedSchema

    context_parts = [userPrompt]
    if documentPayload is not None:
        context_parts.append("\n\nDOCUMENT_CONTEXT:\n" + _safe_json(documentPayload))
    if output_contract is not None:
        context_parts.append("\n\nOUTPUT_CONTRACT:\n" + _safe_json(output_contract))
    if metadata:
        context_parts.append("\n\nRUN_METADATA:\n" + _safe_json(metadata))
    context_parts.append("\n\nDevuelve solo un objeto JSON valido, sin markdown ni comentarios.")

    message_content: list[dict[str, Any]] = [{"type": "text", "text": "\n".join(context_parts)}]
    if imageContent:
        message_content.extend(imageContent)

    warnings: list[str] = []
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response = await anthropic_client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature if temperature is not None else settings.anthropic_temperature,
                system=systemPrompt,
                messages=[{"role": "user", "content": message_content}],
            )
            content = _extract_text(response)
            result = parse_json_response(content)
            result["_model"] = model
            result["_usage"] = _extract_usage(response)
            if warnings:
                result["_warnings"] = warnings
            return result
        except HTTPException:
            raise
        except Exception as exc:
            last_error = exc
            if attempt == 0:
                warnings.append("La primera respuesta no cumplio el contrato JSON; se reintento una vez.")
                message_content[0]["text"] += "\n\nLa respuesta anterior no fue JSON valido. Reintenta con JSON estricto."
                continue

    raise HTTPException(
        status_code=502,
        detail="El servicio de analisis no devolvio una respuesta valida para la solicitud.",
    ) from last_error


async def analyze_with_claude(user_prompt: str, system_prompt: str) -> dict[str, Any]:
    return await generate_agent_response(
        agentType="generic",
        systemPrompt=system_prompt,
        userPrompt=user_prompt,
    )
