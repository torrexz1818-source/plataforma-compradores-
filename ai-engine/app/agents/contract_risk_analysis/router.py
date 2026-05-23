from fastapi import APIRouter
from fastapi.responses import Response

from app.agents.generic_mvp import GenericAgentRequest, GenericPdfRequest, build_stub_result
from app.utils.pdf_report import build_agent_pdf

router = APIRouter(prefix="/agents/contract-risk-analysis", tags=["Contract risk analysis"])

OUTPUTS = ["Resumen contractual", "Matriz de riesgos", "Clausulas criticas", "Obligaciones", "Recomendaciones", "PDF descargable"]


@router.post("/analyze")
async def analyze(payload: GenericAgentRequest):
    return build_stub_result("Analisis de Contratos y Deteccion de Riesgos", OUTPUTS, payload)


@router.post("/generate-pdf")
async def generate_pdf(payload: GenericPdfRequest):
    content = build_agent_pdf("analisis-riesgos-contrato.pdf", "Analisis de Contratos y Deteccion de Riesgos", payload.result, {**(payload.branding or {}), "pdf_mode": payload.pdf_mode})
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="analisis-riesgos-contrato.pdf"'})
