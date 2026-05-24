from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


Confidence = Literal["low", "medium", "high"]
AnalysisMode = Literal["structured_data", "document_based", "mixed"]
AnalysisType = Literal["gastos", "proveedores", "compras", "contratos", "inventario", "cotizaciones", "cumplimiento", "financiero", "mixto"]
StructureLevel = Literal["high", "medium", "low"]
KpiSource = Literal["python", "llm_structured_from_documents"]
ChartSource = Literal["python_calculated", "llm_structured", "suggested"]
ObservationType = Literal["opportunity", "risk", "warning", "trend", "data_quality"]
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


class ChartDataPoint(BaseModel):
    label: str
    value: float | int
    group: str | None = None


class DashboardChart(BaseModel):
    chart_id: str
    title: str
    type: ChartType
    description: str
    x_axis: str | None = None
    y_axis: str | None = None
    data: list[ChartDataPoint] = Field(default_factory=list)
    data_source: ChartSource = "python_calculated"
    confidence: Confidence = "medium"
    insight: str


class DashboardTable(BaseModel):
    title: str
    description: str
    source: KpiSource = "python"
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)


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
    suggested_filters: list[str] = Field(default_factory=list)
    layout_suggestion: list[LayoutSuggestion] = Field(default_factory=list)
    pdf_available: bool = True
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
