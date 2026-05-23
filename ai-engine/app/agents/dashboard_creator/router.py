from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import Response

from app.agents.dashboard_creator.pdf_generator import build_dashboard_pdf
from app.agents.dashboard_creator.schemas import DashboardPdfRequest, DashboardResult
from app.agents.dashboard_creator.service import generate_dashboard

router = APIRouter(prefix="/agents/dashboard-creator", tags=["Dashboard creator"])


@router.post("/generate", response_model=DashboardResult)
async def generate(
    title: str = Form(...),
    objective: str = Form(...),
    audience: str | None = Form(default=None),
    period: str | None = Form(default=None),
    data_type: str | None = Form(default=None),
    visualization_focus: str | None = Form(default="Automático"),
    additional_context: str | None = Form(default=None),
    use_llm_insights: bool = Form(default=True),
    files: list[UploadFile] = File(...),
):
    return await generate_dashboard(
        title=title,
        objective=objective,
        audience=audience,
        period=period,
        data_type=data_type,
        visualization_focus=visualization_focus,
        additional_context=additional_context,
        use_llm_insights=use_llm_insights,
        files=files,
    )


@router.post("/generate-pdf")
async def generate_pdf(payload: DashboardPdfRequest):
    content = build_dashboard_pdf(payload.result, {**(payload.branding or {}), "pdf_mode": payload.pdf_mode})
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="dashboard-nodus-ia.pdf"'},
    )
