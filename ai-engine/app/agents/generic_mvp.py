from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class GenericAgentRequest(BaseModel):
    title: str | None = None
    context: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class GenericPdfRequest(BaseModel):
    result: dict[str, Any]
    pdf_mode: str | None = None
    branding: dict[str, Any] | None = None


def build_stub_result(agent_name: str, expected_outputs: list[str], payload: GenericAgentRequest) -> dict[str, Any]:
    return {
        "agent_name": agent_name,
        "status": "prepared_mvp",
        "executive_summary": (
            f"{agent_name} esta preparado como MVP controlado. "
            "Cuando el administrador lo active, este endpoint puede recibir datos estructurados "
            "y devolver una salida base para iterar la logica profunda."
        ),
        "input_summary": {
            "title": payload.title,
            "context": payload.context,
            "data_keys": list(payload.data.keys()),
        },
        "expected_outputs": expected_outputs,
        "recommendations": [
            "Validar datos cargados antes de enviar al LLM.",
            "No guardar archivos originales ni texto documental completo.",
            "Registrar tokens, costo y latencia desde el backend orquestador.",
        ],
        "disclaimer": "Resultado MVP. Requiere validacion del comprador antes de uso operativo.",
    }
