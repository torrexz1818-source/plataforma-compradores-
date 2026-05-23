from fastapi import APIRouter
from fastapi.responses import Response

from app.agents.generic_mvp import GenericAgentRequest, GenericPdfRequest, build_stub_result
from app.utils.pdf_report import build_agent_pdf

router = APIRouter(prefix="/agents/tco-analysis", tags=["TCO analysis"])

OUTPUTS = ["Tabla TCO por proveedor", "Costo total proyectado", "Riesgos financieros", "Recomendacion final", "PDF descargable"]


@router.post("/analyze")
async def analyze(payload: GenericAgentRequest):
    return build_stub_result("Analisis de Costo Total / TCO", OUTPUTS, payload)


@router.post("/generate-pdf")
async def generate_pdf(payload: GenericPdfRequest):
    content = build_agent_pdf("analisis-tco.pdf", "Analisis de Costo Total / TCO", payload.result)
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="analisis-tco.pdf"'})
