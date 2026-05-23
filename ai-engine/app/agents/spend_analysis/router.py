from fastapi import APIRouter
from fastapi.responses import Response

from app.agents.generic_mvp import GenericAgentRequest, GenericPdfRequest, build_stub_result
from app.utils.agent_result_pdf import build_platform_result_pdf

router = APIRouter(prefix="/agents/spend-analysis", tags=["Spend analysis"])

OUTPUTS = ["Resumen de gastos", "Top proveedores", "Top categorias", "Variaciones", "Alertas", "Recomendaciones", "PDF descargable"]


@router.post("/analyze")
async def analyze(payload: GenericAgentRequest):
    return build_stub_result("Analisis de Gastos", OUTPUTS, payload)


@router.post("/generate-pdf")
async def generate_pdf(payload: GenericPdfRequest):
    content = build_platform_result_pdf(payload.result, "Analisis de Gastos", {**(payload.branding or {}), "pdf_mode": payload.pdf_mode}, "Analisis de Gastos")
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="analisis-gastos.pdf"'})
