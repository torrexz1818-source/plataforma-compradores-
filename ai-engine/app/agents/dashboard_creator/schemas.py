from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


Confidence = Literal["low", "medium", "high"]
AnalysisMode = Literal["structured_data", "document_based", "mixed"]
AnalysisType = Literal["gastos", "proveedores", "compras", "contratos", "inventario", "cotizaciones", "cumplimiento", "financiero", "mixto"]
StructureLevel = Literal["high", "medium", "low"]
KpiSource = Literal["python", "backend", "calculated", "llm_structured_from_documents"]
ChartSource = Literal["python_calculated", "llm_structured", "suggested"]
ObservationType = Literal["opportunity", "risk", "warning", "trend", "data_quality"]
KpiStatus = Literal["positive", "warning", "critical", "neutral"]
ChartType = Literal[
    "bar",
    "horizontal_bar",
    "line",
    "area",
    "pie",
    "donut",
    "stacked_bar",
    "table",
    "kpi",
    "matrix",
    "alert",
]


class DataProfile(BaseModel):
    files_processed: int = 0
    rows_detected: int = 0
    columns_detected: int = 0
    detected_columns: list[str] = Field(default_factory=list)
    date_columns: list[str] = Field(default_factory=list)
    numeric_columns: list[str] = Field(default_factory=list)
    category_columns: list[str] = Field(default_factory=list)
    data_quality_warnings: list[str] = Field(default_factory=list)
    files: list[dict[str, Any]] = Field(default_factory=list)
    columns: list[dict[str, Any]] = Field(default_factory=list)
    candidateFields: dict[str, list[str]] = Field(default_factory=dict)
    rowSamples: list[dict[str, Any]] = Field(default_factory=list)
    basicStats: dict[str, Any] = Field(default_factory=dict)
    possibleAnalyses: list[dict[str, Any]] = Field(default_factory=list)
    notPossibleAnalyses: list[dict[str, Any]] = Field(default_factory=list)
    userInput: dict[str, Any] = Field(default_factory=dict)
    confidence: Confidence = "medium"


class DataUnderstanding(BaseModel):
    files_processed: int = 0
    source_types: list[str] = Field(default_factory=list)
    detected_analysis_type: AnalysisType = "mixto"
    structure_level: StructureLevel = "low"
    notes: list[str] = Field(default_factory=list)


class DashboardKpi(BaseModel):
    title: str
    value: str
    description: str
    calculation_logic: str
    source: KpiSource = "python"
    confidence: Confidence = "medium"
    unit: str | None = None
    status: KpiStatus = "neutral"
    evidence_refs: list[str] = Field(default_factory=list)


class ChartDataPoint(BaseModel):
    label: str
    value: float | int
    group: str | None = None


class ChartLegendItem(BaseModel):
    label: str
    value: str | None = None
    color: str | None = None


class DashboardChart(BaseModel):
    chart_id: str
    title: str
    type: ChartType
    description: str
    x_axis: str | None = None
    y_axis: str | None = None
    data: list[ChartDataPoint] = Field(default_factory=list)
    legend: list[ChartLegendItem] = Field(default_factory=list)
    data_source: ChartSource = "python_calculated"
    confidence: Confidence = "medium"
    insight: str
    colors: list[str] = Field(default_factory=list)


class DashboardTable(BaseModel):
    title: str
    description: str
    source: KpiSource = "python"
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    observations: list[str] = Field(default_factory=list)


class DashboardInsight(BaseModel):
    title: str
    description: str
    impact: Confidence = "medium"
    recommended_action: str


class DashboardDocumentSummary(BaseModel):
    file_name: str
    detected_type: str
    text_preview: str | None = None
    relevant_findings: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class DashboardObservation(BaseModel):
    title: str
    description: str
    type: ObservationType = "warning"


class LayoutSuggestion(BaseModel):
    section: str
    component_type: Literal["kpi", "chart", "table", "insight", "alert"]
    title: str
    priority: int


class DashboardMetadata(BaseModel):
    title: str | None = None
    report_name: str | None = None
    created_from: str = "Buyer Nodus"
    agent_name: str = "Creador de Dashboard"
    agent_key: str = "dashboard_creator"
    user: str | None = None
    generated_at: str | None = None
    analyzed_files: list[dict[str, Any]] = Field(default_factory=list)


class ExecutiveSummaryBlock(BaseModel):
    information_found: str | None = None
    analysis_built: str | None = None
    main_indicators: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class DashboardFinding(BaseModel):
    title: str
    description: str
    evidence: str | None = None
    source_component: str | None = None
    confidence: Confidence = "medium"
    inferred: bool = False


class MissingDataItem(BaseModel):
    indicator: str
    reason: str
    required_fields: list[str] = Field(default_factory=list)


class VisualConfig(BaseModel):
    background: str = "white"
    primary: str = "#0E109E"
    secondary: str = "#5A31D5"
    danger: str = "#F3313F"
    success: str = "#B2EB4A"


class DashboardPlan(BaseModel):
    title: str | None = None
    report_name: str | None = None
    objective: str | None = None
    reportInfo: dict[str, Any] = Field(default_factory=dict)
    selectedIndicators: list[dict[str, Any]] = Field(default_factory=list)
    skippedIndicators: list[dict[str, Any]] = Field(default_factory=list)
    chartPlan: list[dict[str, Any]] = Field(default_factory=list)
    tablePlan: list[dict[str, Any]] = Field(default_factory=list)
    narrativePlan: dict[str, Any] = Field(default_factory=dict)
    applicable_indicators: list[dict[str, Any]] = Field(default_factory=list)
    not_applicable_indicators: list[dict[str, Any]] = Field(default_factory=list)
    suggested_charts: list[dict[str, Any]] = Field(default_factory=list)
    suggested_tables: list[dict[str, Any]] = Field(default_factory=list)
    preliminary_summary: str | None = None
    allowed_findings: list[dict[str, Any]] = Field(default_factory=list)
    allowed_recommendations: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    confidence_level: Confidence = "medium"


class DashboardResult(BaseModel):
    dashboard_title: str
    objective: str
    audience: str | None = None
    period: str | None = None
    data_type: str | None = None
    analysis_mode: AnalysisMode = "structured_data"
    confidence_level: Confidence = "medium"
    confidence_reason: str | None = None
    executive_summary: str
    llm_used: bool = False
    data_understanding: DataUnderstanding
    data_profile: DataProfile
    kpis: list[DashboardKpi] = Field(default_factory=list)
    charts: list[DashboardChart] = Field(default_factory=list)
    tables: list[DashboardTable] = Field(default_factory=list)
    insights: list[DashboardInsight] = Field(default_factory=list)
    observations: list[DashboardObservation] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    document_summaries: list[DashboardDocumentSummary] = Field(default_factory=list)
    source_files: list[dict[str, Any]] = Field(default_factory=list)
    document_traceability: list[dict[str, Any]] = Field(default_factory=list)
    suggested_filters: list[str] = Field(default_factory=list)
    layout_suggestion: list[LayoutSuggestion] = Field(default_factory=list)
    metadata: DashboardMetadata | None = None
    executiveSummary: ExecutiveSummaryBlock | None = None
    dataProfile: DataProfile | None = None
    dashboardPlan: DashboardPlan | None = None
    findings: list[DashboardFinding] = Field(default_factory=list)
    missingData: list[MissingDataItem] = Field(default_factory=list)
    qualityWarnings: list[str] = Field(default_factory=list)
    visualConfig: VisualConfig = Field(default_factory=VisualConfig)
    pdf_available: bool = True
    downloadReadiness: dict[str, Any] | None = None
    model_provider: str | None = None
    model_name: str | None = None
    tokens_input: int | None = None
    tokens_output: int | None = None
    cost_input: float | None = None
    cost_output: float | None = None
    cost_total: float | None = None
    latency_ms: int | None = None
    disclaimer: str = (
        "Este dashboard fue generado con asistencia de IA y análisis automatizado. "
        "Debe ser validado por el comprador antes de tomar decisiones."
    )


class DashboardPdfRequest(BaseModel):
    result: dict[str, Any]
    pdf_mode: str | None = None
    branding: dict[str, Any] | None = None
