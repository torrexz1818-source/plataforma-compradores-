from fastapi import APIRouter
from fastapi.responses import Response

from app.agents.generic_mvp import GenericAgentRequest, GenericPdfRequest, build_stub_result
from app.utils.pdf_report import build_agent_pdf

router = APIRouter(prefix="/agents/supplier-evaluation-ranking", tags=["Supplier evaluation ranking"])

OUTPUTS = ["Score por proveedor", "Ranking", "Fortalezas", "Riesgos", "Documentacion faltante", "Recomendacion", "PDF descargable"]


@router.post("/analyze")
async def analyze(payload: GenericAgentRequest):
    return build_stub_result("Evaluacion y Ranking de Proveedores", OUTPUTS, payload)


@router.post("/generate-pdf")
async def generate_pdf(payload: GenericPdfRequest):
    content = build_agent_pdf("ranking-proveedores.pdf", "Evaluacion y Ranking de Proveedores", payload.result)
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="ranking-proveedores.pdf"'})
