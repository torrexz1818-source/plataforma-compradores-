from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


RiskLevel = Literal["low", "medium", "high"]


class TcoAlternative(BaseModel):
    model_config = ConfigDict(extra="allow")

    supplier_name: str = Field(..., min_length=1)
    origin_country: str | None = None
    destination_country: str | None = None
    brand_model: str | None = None
    quantity: float | str | None = None
    currency: str | None = None
    base_price: float | str | None = None
    incoterm: str | None = None
    lead_time: str | None = None
    payment_terms: str | None = None
    warranty: str | None = None
    observations: str | None = None


class SupportingDocumentSummary(BaseModel):
    file_name: str
    detected_type: str
    relevant_findings: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class DetectedAlternative(BaseModel):
    supplier_name: str
    source_file: str
    detected_price: str | None = None
    warranty: str | None = None
    lead_time: str | None = None
    detected_costs: list[str] = Field(default_factory=list)
    data_detected: list[str] = Field(default_factory=list)
    data_missing: list[str] = Field(default_factory=list)
    source_evidence: list[str] = Field(default_factory=list)
    confidence_level: RiskLevel = "medium"


class ExtractedDataQuality(BaseModel):
    detected_alternatives_count: int = 0
    documents_processed: int = 0
    confidence_level: RiskLevel = "low"
    warnings: list[str] = Field(default_factory=list)


class ExecutiveSummary(BaseModel):
    best_alternative: str
    best_alternative_score: float | None = None
    best_alternative_score_label: str | None = None
    why_it_wins: str
    estimated_saving_or_overcost: str
    main_risk: str
    final_recommendation: str


class DataUsedItem(BaseModel):
    alternative: str
    base_price: str | None = None
    quantity: str | None = None
    currency: str | None = None
    horizon: str | None = None
    origin: str | None = None
    destination: str | None = None
    incoterm: str | None = None
    lead_time: str | None = None
    key_assumptions: list[str] = Field(default_factory=list)


class TcoMatrixRow(BaseModel):
    cost_component: str
    values: dict[str, float | int | str | None] = Field(default_factory=dict)
    notes: str = ""


class TcoDashboardAlternative(BaseModel):
    id: str | None = None
    name: str
    provider: str | None = None
    label: str


class TcoDashboardMatrixRow(BaseModel):
    component: str
    values: dict[str, float | int | str | None] = Field(default_factory=dict)
    unit: str | None = None
    source: str | None = None
    note: str | None = None


class TcoDashboardSection(BaseModel):
    title: str
    description: str | None = None
    rows: list[TcoDashboardMatrixRow] = Field(default_factory=list)
    total_row: TcoDashboardMatrixRow | None = None


class TcoDashboardTotal(BaseModel):
    metric: str
    values: dict[str, float | int | str | None] = Field(default_factory=dict)
    unit: str | None = None
    note: str | None = None


class TcoDashboardKpi(BaseModel):
    label: str
    value: str | float | int | None
    note: str | None = None


class TcoDashboardMatrix(BaseModel):
    model_config = ConfigDict(extra="allow")

    analysis_type: str | None = None
    currency: str | None = None
    horizon: str | None = None
    unit_of_comparison: str | None = None
    alternatives: list[TcoDashboardAlternative] = Field(default_factory=list)
    sections: list[TcoDashboardSection] = Field(default_factory=list)
    totals: list[TcoDashboardTotal] = Field(default_factory=list)
    kpis: list[TcoDashboardKpi] = Field(default_factory=list)


class BaseParameters(BaseModel):
    model_config = ConfigDict(extra="allow")

    analysis_type: str | None = None
    product_or_service: str | None = None
    currency: str | None = None
    horizon_years: float | str | None = None
    quantity: float | str | None = None
    unit_of_comparison: str | None = None
    annual_usage: float | str | None = None
    annual_km: float | str | None = None
    useful_life_years: float | str | None = None
    exchange_rate: float | str | None = None
    discount_rate: float | str | None = None
    tax_rate: float | str | None = None
    financing_rate: float | str | None = None
    notes: list[str] = Field(default_factory=list)


class BenchmarkAssumption(BaseModel):
    model_config = ConfigDict(extra="allow")

    field: str
    value: str | float | int | None = None
    range_min: str | float | int | None = None
    range_max: str | float | int | None = None
    unit: str | None = None
    reason: str | None = None
    source_type: Literal["benchmark", "estimado", "usuario", "documento"] = "estimado"
    confidence_level: Literal["alta", "media", "baja"] = "baja"
    applies_to: str | None = None
    warning: str | None = None


class TransparencyItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    alternative: str
    field: str
    value: str | float | int | None = None
    source: str | None = None
    type: Literal["documento", "usuario", "calculado", "estimado", "faltante", "no_aplica"] = "faltante"
    confidence_level: Literal["alta", "media", "baja"] = "baja"
    observation: str | None = None


class FinancialModelItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    alternative: str
    acquisition_costs: float | str | None = None
    logistics_costs: float | str | None = None
    implementation_costs: float | str | None = None
    operating_costs: float | str | None = None
    maintenance_costs: float | str | None = None
    support_costs: float | str | None = None
    insurance_costs: float | str | None = None
    financing_costs: float | str | None = None
    administrative_costs: float | str | None = None
    risk_costs: float | str | None = None
    exit_costs: float | str | None = None
    residual_value: float | str | None = None
    net_tco: float | str | None = None
    annualized_tco: float | str | None = None
    unit_tco: float | str | None = None
    usage_tco: float | str | None = None
    calculation_basis: str | None = None
    confidence_level: Literal["alta", "media", "baja"] = "baja"
    warnings: list[str] = Field(default_factory=list)


class ScorecardAlternativeScore(BaseModel):
    model_config = ConfigDict(extra="allow")

    alternative: str
    raw_value: str | float | int | None = None
    normalized_score: float | None = None
    weighted_score: float | None = None
    evidence: str | None = None
    source: Literal["documento", "usuario", "calculado", "estimado", "benchmark", "faltante"] = "faltante"
    confidence_level: Literal["alta", "media", "baja"] = "baja"
    comment: str | None = None


class ScorecardCriterion(BaseModel):
    model_config = ConfigDict(extra="allow")

    criterion_id: str
    criterion_name: str
    description: str | None = None
    weight: float
    applies_to_analysis_type: str | None = None
    scoring_logic: str | None = None
    alternatives: list[ScorecardAlternativeScore] = Field(default_factory=list)


class ScorecardTotal(BaseModel):
    model_config = ConfigDict(extra="allow")

    alternative: str
    total_score: float
    level: str
    rank: int
    main_strength: str
    main_weakness: str
    confidence_level: Literal["alta", "media", "baja"] = "baja"


class ScorecardDecisionSummary(BaseModel):
    model_config = ConfigDict(extra="allow")

    economic_option: str | None = None
    technical_option: str | None = None
    lowest_risk_option: str | None = None
    balanced_option: str | None = None
    final_recommended_option: str | None = None
    rationale: str | None = None


class TcoScorecard(BaseModel):
    model_config = ConfigDict(extra="allow")

    scoring_method: str = "Scorecard multicriterio TCO ponderado de 100 puntos"
    total_possible_score: float = 100
    confidence_level: Literal["alta", "media", "baja"] = "baja"
    criteria: list[ScorecardCriterion] = Field(default_factory=list)
    totals: list[ScorecardTotal] = Field(default_factory=list)
    decision_summary: ScorecardDecisionSummary = Field(default_factory=ScorecardDecisionSummary)


class TcoTotalItem(BaseModel):
    alternative: str
    initial_price: float | None = None
    total_tco: float | None = None
    tco_per_unit: float | None = None
    tco_monthly: float | None = None
    tco_annual: float | None = None
    risk_level: RiskLevel = "medium"
    main_hidden_costs: list[str] = Field(default_factory=list)


class RankingItem(BaseModel):
    position: int
    alternative: str
    ranking_type: str
    total_tco: float | None = None
    score: float | None = None
    score_label: str | None = None
    score_breakdown: dict[str, float | int | str | None] = Field(default_factory=dict)
    source_basis: list[str] = Field(default_factory=list)
    reason: str


class Interpretation(BaseModel):
    why_winner_wins: str
    hidden_costs: list[str] = Field(default_factory=list)
    cheap_but_risky_options: list[str] = Field(default_factory=list)
    expensive_but_convenient_options: list[str] = Field(default_factory=list)
    conditions_that_change_decision: list[str] = Field(default_factory=list)


class RiskAnalysisItem(BaseModel):
    risk: str
    alternative: str
    probability: str | None = None
    economic_impact: str | None = None
    expected_risk_cost: str | None = None
    level: RiskLevel = "medium"
    mitigation: str


class SensitivityAnalysis(BaseModel):
    base: list[str] = Field(default_factory=list)
    optimistic: list[str] = Field(default_factory=list)
    pessimistic: list[str] = Field(default_factory=list)
    break_even: list[str] = Field(default_factory=list)
    most_sensitive_variable: str = "No determinado"


class StrategicRecommendation(BaseModel):
    recommended_action: str
    economic_option: str | None = None
    technical_option: str | None = None
    lowest_risk_option: str | None = None
    balanced_option: str | None = None
    final_recommended_option: str | None = None
    recommendation_rationale: str | None = None
    negotiation_points: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)


class TcoAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    analysis_title: str
    item_name: str
    analysis_type: str
    evaluation_horizon: str
    comparison_unit: str
    currency: str
    executive_summary: ExecutiveSummary
    data_used: list[DataUsedItem] = Field(default_factory=list)
    tco_matrix: list[TcoMatrixRow] = Field(default_factory=list)
    tco_dashboard_matrix: TcoDashboardMatrix | None = None
    base_parameters: BaseParameters | None = None
    benchmark_assumptions: list[BenchmarkAssumption] = Field(default_factory=list)
    transparency_table: list[TransparencyItem] = Field(default_factory=list)
    financial_model: list[FinancialModelItem] = Field(default_factory=list)
    scorecard: TcoScorecard | None = None
    tco_totals: list[TcoTotalItem] = Field(default_factory=list)
    ranking: list[RankingItem] = Field(default_factory=list)
    interpretation: Interpretation
    risk_analysis: list[RiskAnalysisItem] = Field(default_factory=list)
    sensitivity_analysis: SensitivityAnalysis
    strategic_recommendation: StrategicRecommendation
    hidden_costs_detected: list[str] = Field(default_factory=list)
    detected_alternatives: list[DetectedAlternative] = Field(default_factory=list)
    extracted_data_quality: ExtractedDataQuality = Field(default_factory=ExtractedDataQuality)
    missing_information: list[str] = Field(default_factory=list)
    questions_for_user_or_suppliers: list[str] = Field(default_factory=list)
    assumptions_and_limits: list[str] = Field(default_factory=list)
    supporting_documents_summary: list[SupportingDocumentSummary] = Field(default_factory=list)
    calculation_warnings: list[str] = Field(default_factory=list)
    model_provider: str | None = None
    model_name: str | None = None
    tokens_input: int | None = None
    tokens_output: int | None = None
    cost_input: float | None = None
    cost_output: float | None = None
    cost_total: float | None = None
    latency_ms: int | None = None
    disclaimer: str = (
        "Este análisis TCO es una recomendación asistida por IA y debe ser validado "
        "por el comprador antes de tomar una decisión final."
    )


class TcoPdfRequest(BaseModel):
    result: dict[str, Any]
    pdf_mode: str | None = None
    branding: dict[str, Any] | None = None
