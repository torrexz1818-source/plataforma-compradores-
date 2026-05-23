from fastapi import APIRouter
from fastapi.responses import Response

from app.agents.generic_mvp import GenericAgentRequest, GenericPdfRequest, build_stub_result
from app.utils.pdf_report import build_agent_pdf

router = APIRouter(prefix="/agents/dashboard-creator", tags=["Dashboard creator"])

OUTPUTS = ["Dashboard visual generado", "KPIs principales", "Graficos", "Tablas", "Insights", "Recomendaciones", "PDF descargable"]


@router.post("/generate")
async def generate(payload: GenericAgentRequest):
    return build_stub_result("Creador de Dashboard", OUTPUTS, payload)


@router.post("/generate-pdf")
async def generate_pdf(payload: GenericPdfRequest):
    content = build_agent_pdf("dashboard-nodus-ia.pdf", "Creador de Dashboard", payload.result)
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="dashboard-nodus-ia.pdf"'})
