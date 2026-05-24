from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class FormSchemaRequest(BaseModel):
    initial_description: str = Field(..., min_length=10)

    @field_validator("initial_description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Describe primero que necesitas realizar.")
        return value


class FormField(BaseModel):
    name: str
    label: str
    type: Literal["text", "textarea", "select", "multiselect", "date", "file", "number"]
    required: bool
    placeholder: str = ""
    options: list[str] = Field(default_factory=list)


class FormSection(BaseModel):
    section_title: str
    fields: list[FormField]


class FormSchemaResponse(BaseModel):
    detected_category: str
    requirement_type: str
    complexity: Literal["low", "medium", "high"]
    recommended_template: str
    form_sections: list[FormSection]
    recommended_safety_requirements: list[str] = Field(default_factory=list)
    suggested_documents: list[str] = Field(default_factory=list)
    notes_for_buyer: list[str] = Field(default_factory=list)


class GeneralData(BaseModel):
    requirement_name: str
    requirement_type: str
    category: str
    location: str | None = None
    required_date: str | None = None


class BudgetChain(BaseModel):
    project: str | None = None
    cost_center: str | None = None
    account: str | None = None
    budget_reference: str | None = None
    currency: str | None = None


class GeneratedDocument(BaseModel):
    general_data: GeneralData
    objective: str
    scope: str
    technical_characteristics: list[str] = Field(default_factory=list)
    required_activities: list[str] = Field(default_factory=list)
    final_deliverables: list[str] = Field(default_factory=list)
    justification: str
    safety_requirements: list[str] = Field(default_factory=list)
    supplier_conditions: list[str] = Field(default_factory=list)
    final_report_structure: list[str] = Field(default_factory=list)
    budget_chain: BudgetChain = Field(default_factory=BudgetChain)
    suggested_annexes: list[str] = Field(default_factory=list)
    additional_observations: list[str] = Field(default_factory=list)


class SupportingDocumentSummary(BaseModel):
    file_name: str
    detected_type: str
    relevant_findings: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class QualityCheck(BaseModel):
    is_complete: bool
    warnings: list[str] = Field(default_factory=list)
    missing_sections: list[str] = Field(default_factory=list)


class DashboardMetric(BaseModel):
    label: str
    value: str
    status: Literal["complete", "warning", "risk", "neutral"] = "neutral"
    detail: str | None = None


class ChecklistItem(BaseModel):
    label: str
    status: Literal["complete", "incomplete", "recommended"]
    detail: str | None = None


class TenderBases(BaseModel):
    object: str = "No especificado"
    scope: str = "No especificado"
    minimum_supplier_requirements: list[str] = Field(default_factory=list)
    requested_documentation: list[str] = Field(default_factory=list)
    evaluation_criteria: list[str] = Field(default_factory=list)
    proposal_submission_conditions: list[str] = Field(default_factory=list)
    question_deadline: str = "No especificado"
    proposal_deadline: str = "No especificado"
    submission_method: str = "No especificado"
    award_criteria: list[str] = Field(default_factory=list)
    disqualification_conditions: list[str] = Field(default_factory=list)
    buyer_observations: list[str] = Field(default_factory=list)
    disclaimer: str = "Estas bases son una guia inicial y deben ser revisadas por el area de compras, legal o responsable interno antes de enviarse."


class SupplierInvitationEmail(BaseModel):
    subject: str = "Invitacion a presentar propuesta"
    greeting: str = "Estimados proveedores,"
    body: str = "No especificado"
    attached_documents: list[str] = Field(default_factory=list)
    response_deadline: str = "No especificado"
    contact_details: str = "No especificado"
    closing: str = "Saludos cordiales,"


class TermsOfReferenceResult(BaseModel):
    title: str
    requirement_type: str
    category: str
    template_used: str
    executive_summary: str
    generated_document: GeneratedDocument
    supporting_documents_summary: list[SupportingDocumentSummary] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    buyer_recommendations: list[str] = Field(default_factory=list)
    quality_check: QualityCheck
    completion_score: int = Field(default=0, ge=0, le=100)
    completion_level: Literal["Alta", "Media", "Baja"] = "Media"
    risk_level: Literal["Bajo", "Medio", "Alto"] = "Medio"
    checklist: list[ChecklistItem] = Field(default_factory=list)
    flow_steps: list[str] = Field(default_factory=list)
    dashboard_metrics: list[DashboardMetric] = Field(default_factory=list)
    tender_bases: TenderBases = Field(default_factory=TenderBases)
    supplier_invitation_email: SupplierInvitationEmail = Field(default_factory=SupplierInvitationEmail)
    tender_process: list[str] = Field(default_factory=list)
    disclaimer: str = "Este documento fue generado con asistencia de IA y debe ser revisado por el comprador antes de enviarse a proveedores."


class PdfRequest(BaseModel):
    document: dict[str, Any]
    pdf_mode: str | None = None
    branding: dict[str, Any] | None = None
