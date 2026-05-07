from pydantic import BaseModel, Field


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
    weighted_score: float | None = None
    reason: str
    main_strengths: list[str] = Field(default_factory=list)
    main_risks: list[str] = Field(default_factory=list)


class ComparisonRow(BaseModel):
    criterion: str
    values: dict[str, str | None]
    comment: str


class EvaluationScale(BaseModel):
    min: int = 1
    max: int = 5
    labels: dict[str, str] = Field(
        default_factory=lambda: {
            "1": "Muy deficiente",
            "2": "Deficiente",
            "3": "Aceptable",
            "4": "Bueno",
            "5": "Excelente",
        }
    )
    weighted_score_formula: str = "Puntaje ponderado = Valoración × Peso"


class EvaluationMatrixCriterion(BaseModel):
    number: int
    criterion: str
    weight_percent: float
    ratings: dict[str, float]
    observations: str


class WeightedTotal(BaseModel):
    supplier_name: str
    weighted_score: float
    ranking_position: int


class EvaluationMatrix(BaseModel):
    title: str = "Matriz de evaluación comparativa de proveedores"
    weight_sum: float = 100
    criteria: list[EvaluationMatrixCriterion] = Field(default_factory=list)
    weighted_totals: list[WeightedTotal] = Field(default_factory=list)


class CriteriaGuideItem(BaseModel):
    number: int
    criterion: str
    weight_percent: float
    evaluation_scale_description: str
    verification_source: str


class ExecutiveComparisonRow(BaseModel):
    row_label: str
    values: dict[str, str | None]


class ProposalComparisonResult(BaseModel):
    analysis_title: str
    service: str
    objective: str | None = None
    executive_summary: str
    recommended_supplier: str
    auto_generated_criteria_note: str = (
        "Los criterios y pesos fueron generados automáticamente por IA según el tipo de "
        "compra/servicio y la información contenida en las propuestas."
    )
    evaluation_scale: EvaluationScale = Field(default_factory=EvaluationScale)
    evaluation_matrix: EvaluationMatrix = Field(default_factory=EvaluationMatrix)
    criteria_guide: list[CriteriaGuideItem] = Field(default_factory=list)
    ranking: list[RankingItem]
    suppliers: list[SupplierResult]
    comparison_table: list[ComparisonRow]
    executive_comparison_table: list[ExecutiveComparisonRow] = Field(default_factory=list)
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
