from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import Response

from app.agents.terms_of_reference.pdf_generator import build_pdf
from app.agents.terms_of_reference.schemas import FormSchemaRequest, FormSchemaResponse, PdfRequest, TermsOfReferenceResult
from app.agents.terms_of_reference.service import create_form_schema, generate_terms_of_reference

router = APIRouter(prefix="/agents/terms-of-reference", tags=["Terms of reference"])


@router.post("/form-schema", response_model=FormSchemaResponse)
async def form_schema(payload: FormSchemaRequest):
    return await create_form_schema(payload.initial_description)


@router.post("/generate", response_model=TermsOfReferenceResult)
async def generate(
    initial_description: str = Form(...),
    title: str = Form(...),
    requirement_type: str = Form(...),
    category: str = Form(...),
    location: str | None = Form(default=None),
    required_date: str | None = Form(default=None),
    objective: str = Form(...),
    scope: str = Form(...),
    activities: str | None = Form(default=None),
    deliverables: str = Form(...),
    justification: str = Form(...),
    safety_requirements: str | None = Form(default=None),
    budget_project: str | None = Form(default=None),
    budget_cost_center: str | None = Form(default=None),
    budget_account: str | None = Form(default=None),
    budget_reference: str | None = Form(default=None),
    currency: str | None = Form(default=None),
    additional_instructions: str | None = Form(default=None),
    dynamic_form_data: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
):
    return await generate_terms_of_reference(
        initial_description=initial_description,
        title=title,
        requirement_type=requirement_type,
        category=category,
        location=location,
        required_date=required_date,
        objective=objective,
        scope=scope,
        activities=activities,
        deliverables=deliverables,
        justification=justification,
        safety_requirements=safety_requirements,
        budget_project=budget_project,
        budget_cost_center=budget_cost_center,
        budget_account=budget_account,
        budget_reference=budget_reference,
        currency=currency,
        additional_instructions=additional_instructions,
        dynamic_form_data=dynamic_form_data,
        files=files,
    )


@router.post("/generate-pdf")
async def generate_pdf(payload: PdfRequest):
    content, filename = build_pdf(payload.document, {**(payload.branding or {}), "pdf_mode": payload.pdf_mode})
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
