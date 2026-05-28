import type { TcoAnalysisResult } from './tcoAnalysisApi';

export type TcoPresentationAlternative = {
  id: string;
  name: string;
  provider?: string;
  label: string;
};

export type TcoPresentationRow = {
  component: string;
  values: Record<string, string>;
  unit?: string;
  source?: string;
  note?: string;
  isTotal?: boolean;
};

export type TcoPresentationSection = {
  title: string;
  description?: string;
  rows: TcoPresentationRow[];
  totalRow?: TcoPresentationRow;
};

export type TcoPresentationKpi = {
  label: string;
  value: string;
  note?: string;
};

export type TcoPresentationModel = {
  header: {
    title: string;
    analysisType: string;
    itemName: string;
    horizon: string;
    currency: string;
    unitOfComparison: string;
  };
  alternatives: TcoPresentationAlternative[];
  kpis: TcoPresentationKpi[];
  matrix: TcoPresentationSection[];
  totals: TcoPresentationRow[];
  ranking: Array<Record<string, unknown>>;
  risks: Array<Record<string, unknown>>;
  baseParameters: Record<string, unknown>;
  benchmarkAssumptions: Array<Record<string, unknown>>;
  transparencyTable: Array<Record<string, unknown>>;
  financialModel: Array<Record<string, unknown>>;
  missingData: string[];
  assumptions: string[];
  hiddenCosts: string[];
  recommendation: {
    finalRecommendation: string;
    recommendedAction: string;
    economicOption: string;
    technicalOption: string;
    lowestRiskOption: string;
    balancedOption: string;
    finalRecommendedOption: string;
    rationale: string;
    negotiationPoints: string[];
    nextSteps: string[];
  };
};

type DashboardMatrix = {
  analysis_type?: string;
  currency?: string;
  horizon?: string;
  unit_of_comparison?: string;
  alternatives?: Array<{ id?: string; name?: string; provider?: string; label?: string }>;
  sections?: Array<{
    title?: string;
    description?: string;
    rows?: Array<{
      component?: string;
      values?: Record<string, unknown>;
      unit?: string;
      source?: string;
      note?: string;
    }>;
    total_row?: {
      component?: string;
      values?: Record<string, unknown>;
      unit?: string;
      note?: string;
    };
  }>;
  totals?: Array<{ metric?: string; values?: Record<string, unknown>; unit?: string; note?: string }>;
  kpis?: Array<{ label?: string; value?: unknown; note?: string }>;
};

const EMPTY_LABELS = new Set(['', 'null', 'undefined', 'n/a', 'na']);

function asText(value: unknown, fallback = 'Dato faltante') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fallback;
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return EMPTY_LABELS.has(trimmed.toLowerCase()) ? fallback : trimmed;
  }
  if (Array.isArray(value)) {
    const text = value.map((item) => asText(item, '')).filter(Boolean).join(' | ');
    return text || fallback;
  }
  return JSON.stringify(value);
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function displayValue(value: unknown, context?: string) {
  const text = asText(value, '');
  if (!text) {
    if (context?.toLowerCase().includes('km')) return 'Requiere km/año o vida útil';
    if (context?.toLowerCase().includes('usuario')) return 'Requiere número de usuarios';
    if (context?.toLowerCase().includes('unitario')) return 'No calculable con datos actuales';
    return 'Dato faltante';
  }
  if (['no especificado', 'no determinado'].includes(text.toLowerCase())) return 'Dato faltante';
  return text;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getAlternativeNames(result: TcoAnalysisResult, matrix?: DashboardMatrix) {
  const matrixNames = asArray(matrix?.alternatives)
    .map((item) => asText(item.label || item.name || item.provider, ''))
    .filter(Boolean);
  const totalNames = asArray<Record<string, unknown>>(result.tco_totals)
    .map((item) => asText(item.alternative, ''))
    .filter(Boolean);
  const rankingNames = asArray<Record<string, unknown>>(result.ranking)
    .map((item) => asText(item.alternative, ''))
    .filter(Boolean);
  const detectedNames = asArray(result.detected_alternatives)
    .map((item) => asText(item.supplier_name, ''))
    .filter(Boolean);
  const matrixValueNames = asArray(result.tco_matrix)
    .flatMap((row) => Object.keys(asRecord(row.values)));
  return unique([...matrixNames, ...totalNames, ...rankingNames, ...detectedNames, ...matrixValueNames]);
}

function normalizeAlternatives(result: TcoAnalysisResult, matrix?: DashboardMatrix): TcoPresentationAlternative[] {
  const names = getAlternativeNames(result, matrix);
  return names.map((name, index) => ({ id: `alt-${index + 1}`, name, label: name }));
}

function normalizeRow(
  component: string,
  values: Record<string, unknown>,
  alternatives: TcoPresentationAlternative[],
  options: { unit?: string; source?: string; note?: string; isTotal?: boolean } = {},
): TcoPresentationRow {
  const normalizedValues = alternatives.reduce<Record<string, string>>((acc, alternative) => {
    acc[alternative.label] = displayValue(values[alternative.label] ?? values[alternative.name], component);
    return acc;
  }, {});
  return {
    component: asText(component, 'Componente'),
    values: normalizedValues,
    unit: options.unit,
    source: options.source,
    note: options.note,
    isTotal: options.isTotal,
  };
}

function sectionTitleFor(component: string) {
  const text = component.toLowerCase();
  if (/precio|adquisici|compra|licencia|honorario/.test(text)) return 'Adquisición / costo base';
  if (/flete|aduana|arancel|seguro|transporte|log[ií]stica|nacionalizaci/.test(text)) return 'Logística y nacionalización';
  if (/implementaci|instalaci|configuraci|integraci|migraci|capacitaci/.test(text)) return 'Implementación';
  if (/manten|operaci|energia|energía|combustible|soporte|renovaci|repuesto|sla/.test(text)) return 'Operación y soporte';
  if (/riesgo|penalidad|salida|parada|siniestralidad|obsolescencia|merma/.test(text)) return 'Riesgos y costos ocultos';
  if (/residual|depreciaci|vida/.test(text)) return 'Vida útil y residual';
  if (/tco|total|anualizado|usuario|hora|km|kil[oó]metro|unidad/.test(text)) return 'Totales TCO';
  return 'Otros componentes';
}

function buildSectionsFromLegacyMatrix(result: TcoAnalysisResult, alternatives: TcoPresentationAlternative[]) {
  const grouped = new Map<string, TcoPresentationRow[]>();
  asArray(result.tco_matrix).forEach((row) => {
    const component = asText(row.cost_component, 'Componente');
    const title = sectionTitleFor(component);
    const normalized = normalizeRow(component, asRecord(row.values), alternatives, {
      note: row.notes,
      isTotal: /total|tco/i.test(component),
    });
    grouped.set(title, [...(grouped.get(title) ?? []), normalized]);
  });

  return Array.from(grouped.entries()).map(([title, rows]) => ({
    title,
    rows,
  }));
}

function buildSectionsFromDashboardMatrix(matrix: DashboardMatrix, alternatives: TcoPresentationAlternative[]) {
  return asArray(matrix.sections).map((section) => ({
    title: asText(section.title, 'Matriz TCO'),
    description: section.description,
    rows: asArray(section.rows).map((row) =>
      normalizeRow(asText(row.component, 'Componente'), asRecord(row.values), alternatives, {
        unit: row.unit,
        source: row.source,
        note: row.note,
      }),
    ),
    totalRow: section.total_row
      ? normalizeRow(asText(section.total_row.component, 'Total'), asRecord(section.total_row.values), alternatives, {
          unit: section.total_row.unit,
          note: section.total_row.note,
          isTotal: true,
        })
      : undefined,
  }));
}

function buildTotals(result: TcoAnalysisResult, alternatives: TcoPresentationAlternative[], matrix?: DashboardMatrix) {
  const dashboardTotals = asArray(matrix?.totals).map((row) =>
    normalizeRow(asText(row.metric, 'Indicador'), asRecord(row.values), alternatives, {
      unit: row.unit,
      note: row.note,
      isTotal: true,
    }),
  );
  if (dashboardTotals.length) return dashboardTotals;

  const rows = [
    ['Precio inicial', 'initial_price'],
    ['TCO total estimado', 'total_tco'],
    ['TCO unitario', 'tco_per_unit'],
    ['TCO mensual', 'tco_monthly'],
    ['TCO anualizado', 'tco_annual'],
  ].map(([label, key]) => {
    const values = asArray<Record<string, unknown>>(result.tco_totals).reduce<Record<string, unknown>>((acc, item) => {
      const alternative = asText(item.alternative, '');
      if (alternative) acc[alternative] = item[key];
      return acc;
    }, {});
    return normalizeRow(label, values, alternatives, { isTotal: true });
  });
  return rows;
}

function buildKpis(result: TcoAnalysisResult, totals: TcoPresentationRow[], matrix?: DashboardMatrix) {
  const summary = result.executive_summary;
  const dashboardKpis = asArray(matrix?.kpis)
    .map((item) => ({ label: asText(item.label, ''), value: displayValue(item.value), note: item.note }))
    .filter((item) => item.label);
  if (dashboardKpis.length) return dashboardKpis;

  const winner = summary.best_alternative;
  const tcoTotal = totals.find((row) => /tco total/i.test(row.component))?.values[winner];
  return [
    { label: 'Mejor alternativa', value: displayValue(winner), note: summary.why_it_wins },
    { label: 'TCO ganador', value: displayValue(tcoTotal, 'TCO total') },
    { label: 'Ahorro estimado', value: displayValue(summary.estimated_saving_or_overcost) },
    {
      label: 'Score ganador',
      value: `${displayValue(summary.best_alternative_score)} / 100`,
      note: summary.best_alternative_score_label ?? undefined,
    },
    { label: 'Riesgo principal', value: displayValue(summary.main_risk) },
    {
      label: 'Confianza',
      value: displayValue(result.extracted_data_quality?.confidence_level),
      note: result.extracted_data_quality ? `${result.extracted_data_quality.documents_processed} documentos` : undefined,
    },
  ];
}

export function normalizeTcoForPresentation(result: TcoAnalysisResult): TcoPresentationModel {
  const dashboardMatrix = asRecord(result.tco_dashboard_matrix) as DashboardMatrix;
  const hasDashboardMatrix = Boolean(asArray(dashboardMatrix.sections).length);
  const alternatives = normalizeAlternatives(result, dashboardMatrix);
  const matrix = hasDashboardMatrix
    ? buildSectionsFromDashboardMatrix(dashboardMatrix, alternatives)
    : buildSectionsFromLegacyMatrix(result, alternatives);
  const totals = buildTotals(result, alternatives, dashboardMatrix);

  return {
    header: {
      title: result.analysis_title,
      analysisType: dashboardMatrix.analysis_type || result.analysis_type,
      itemName: result.item_name,
      horizon: dashboardMatrix.horizon || result.evaluation_horizon,
      currency: dashboardMatrix.currency || result.currency,
      unitOfComparison: dashboardMatrix.unit_of_comparison || result.comparison_unit,
    },
    alternatives,
    kpis: buildKpis(result, totals, dashboardMatrix),
    matrix,
    totals,
    ranking: result.ranking,
    risks: result.risk_analysis,
    baseParameters: asRecord(result.base_parameters),
    benchmarkAssumptions: asArray<Record<string, unknown>>(result.benchmark_assumptions),
    transparencyTable: asArray<Record<string, unknown>>(result.transparency_table),
    financialModel: asArray<Record<string, unknown>>(result.financial_model),
    missingData: result.missing_information,
    assumptions: [...result.assumptions_and_limits, ...(result.calculation_warnings ?? [])],
    hiddenCosts: result.hidden_costs_detected ?? [],
    recommendation: {
      finalRecommendation: displayValue(result.executive_summary.final_recommendation),
      recommendedAction: displayValue(result.strategic_recommendation.recommended_action),
      economicOption: displayValue(result.strategic_recommendation.economic_option),
      technicalOption: displayValue(result.strategic_recommendation.technical_option),
      lowestRiskOption: displayValue(result.strategic_recommendation.lowest_risk_option),
      balancedOption: displayValue(result.strategic_recommendation.balanced_option),
      finalRecommendedOption: displayValue(result.strategic_recommendation.final_recommended_option),
      rationale: displayValue(result.strategic_recommendation.recommendation_rationale || result.executive_summary.why_it_wins),
      negotiationPoints: result.strategic_recommendation.negotiation_points ?? [],
      nextSteps: result.strategic_recommendation.next_steps ?? [],
    },
  };
}

export function flattenTcoMatrixRows(model: TcoPresentationModel) {
  return model.matrix.flatMap((section) => [
    { Seccion: section.title, Componente: section.description || section.title, Tipo: 'Seccion' },
    ...section.rows.map((row) => ({
      Seccion: section.title,
      Componente: row.component,
      ...row.values,
      Unidad: row.unit ?? '',
      Fuente: row.source ?? '',
      Nota: row.note ?? '',
      Tipo: row.isTotal ? 'Total' : 'Detalle',
    })),
    ...(section.totalRow
      ? [{
          Seccion: section.title,
          Componente: section.totalRow.component,
          ...section.totalRow.values,
          Unidad: section.totalRow.unit ?? '',
          Fuente: section.totalRow.source ?? '',
          Nota: section.totalRow.note ?? '',
          Tipo: 'Total',
        }]
      : []),
  ]);
}

export function tcoKpiRows(model: TcoPresentationModel) {
  return model.kpis.map((item) => ({ KPI: item.label, Valor: item.value, Nota: item.note ?? '' }));
}
