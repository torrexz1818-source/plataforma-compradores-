from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


Confidence = Literal["low", "medium", "high"]
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


class DashboardKpi(BaseModel):
    title: str
    value: str
    description: str
    calculation_logic: str
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
    insight: str


class DashboardTable(BaseModel):
    title: str
    description: str
    columns: list[str] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)


class DashboardInsight(BaseModel):
    title: str
    description: str
    impact: Confidence = "medium"
    recommended_action: str


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
    executive_summary: str
    llm_used: bool = False
    data_profile: DataProfile
    kpis: list[DashboardKpi] = Field(default_factory=list)
    charts: list[DashboardChart] = Field(default_factory=list)
    tables: list[DashboardTable] = Field(default_factory=list)
    insights: list[DashboardInsight] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
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
