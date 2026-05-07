from pydantic import BaseModel, Field


class EvaluationCriterion(BaseModel):
    name: str
    weight: float | None = None


class SupplierResult(BaseModel):
    supplier_name: str = "No especificado"
    ruc: str | None = None
    contact: str | None = None
    email: str | None = None
    phone: str | None = None
    proposal_date: str | None = None
    validity: str | None = None
    total_amount: str | None = None
    currency: str | None = None
    price_type: str | None = None
    payment_terms: str | None = None
    contract_minimum: str | None = None
    warranty: str | None = None
    certifications: list[str] = Field(default_factory=list)
    included_services: list[str] = Field(default_factory=list)
    excluded_services: list[str] = Field(default_factory=list)
    observations: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)


class RankingItem(BaseModel):
    position: int
    supplier_name: str
    score: float
    reason: str
    main_strengths: list[str] = Field(default_factory=list)
    main_risks: list[str] = Field(default_factory=list)


class ComparisonRow(BaseModel):
    criterion: str
    values: dict[str, str | None]
    comment: str


class ProposalComparisonResult(BaseModel):
    analysis_title: str
    service: str
    objective: str | None = None
    executive_summary: str
    recommended_supplier: str
    ranking: list[RankingItem]
    suppliers: list[SupplierResult]
    comparison_table: list[ComparisonRow]
    global_risks: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    questions_for_suppliers: list[str] = Field(default_factory=list)
    final_recommendation: str
    disclaimer: str = (
        "Este análisis es una recomendación asistida por IA y debe ser validado por el comprador "
        "antes de tomar una decisión final."
    )


class ExtractedDocument(BaseModel):
    filename: str
    file_type: str
    text: str
    warnings: list[str] = Field(default_factory=list)
