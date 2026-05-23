from fastapi import APIRouter
from fastapi.responses import Response

from app.agents.generic_mvp import GenericAgentRequest, GenericPdfRequest, build_stub_result
from app.utils.agent_result_pdf import build_platform_result_pdf

router = APIRouter(prefix="/agents/purchase-order", tags=["Purchase order"])

OUTPUTS = ["Orden de compra estructurada", "Tabla de items", "Totales", "Condiciones de pago y entrega", "PDF descargable"]


@router.post("/generate")
async def generate(payload: GenericAgentRequest):
    return build_stub_result("Elaboracion de Orden de Compra", OUTPUTS, payload)


@router.post("/generate-pdf")
async def generate_pdf(payload: GenericPdfRequest):
    content = build_platform_result_pdf(payload.result, "Elaboracion de Orden de Compra", {**(payload.branding or {}), "pdf_mode": payload.pdf_mode}, "Elaboracion de Orden de Compra")
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="orden-compra.pdf"'})
