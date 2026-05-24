from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import Response

from app.agents.tco_analysis.pdf_generator import build_tco_pdf
from app.agents.tco_analysis.schemas import TcoAnalysisResult, TcoPdfRequest
from app.agents.tco_analysis.service import analyze_tco

router = APIRouter(prefix="/agents/tco-analysis", tags=["TCO analysis"])


@router.post("/analyze", response_model=TcoAnalysisResult)
async def analyze(
    title: str = Form(...),
    item_name: str = Form(...),
    analysis_type: str = Form(...),
    evaluation_horizon: str = Form(...),
    comparison_unit: str = Form(default="Por compra"),
    currency: str = Form(...),
    purchase_volume: str | None = Form(default=None),
    objective: str | None = Form(default=None),
    alternatives_json: str | None = Form(default=None),
    general_context: str | None = Form(default=None),
    additional_instructions: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
):
    return await analyze_tco(
        title=title,
        item_name=item_name,
        analysis_type=analysis_type,
        evaluation_horizon=evaluation_horizon,
        comparison_unit=comparison_unit,
        currency=currency,
        purchase_volume=purchase_volume,
        objective=objective,
        alternatives_json=alternatives_json,
        general_context=general_context,
        additional_instructions=additional_instructions,
        files=files,
    )


@router.post("/generate-pdf")
async def generate_pdf(payload: TcoPdfRequest):
    content = build_tco_pdf(payload.result, {**(payload.branding or {}), "pdf_mode": payload.pdf_mode})
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="analisis-tco.pdf"'},
    )
