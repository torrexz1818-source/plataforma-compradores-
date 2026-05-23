import re

from fastapi import HTTPException

from app.agents.terms_of_reference.schemas import TermsOfReferenceResult
from app.utils.agent_result_pdf import build_platform_result_pdf


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return value[:80] or "termino_referencia"


def build_pdf(document_payload: dict, branding_payload: dict | None = None) -> tuple[bytes, str]:
    try:
        result = TermsOfReferenceResult.model_validate(document_payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="El JSON del documento no tiene la estructura minima requerida.") from exc

    return (
        build_platform_result_pdf(document_payload, "Elaboracion de terminos de referencia", branding_payload, result.title),
        f"termino_referencia_{slugify(result.title)}.pdf",
    )
