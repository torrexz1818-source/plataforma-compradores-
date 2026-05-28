import type { TcoAnalysisResult } from './tcoAnalysisApi';

export type TcoPresentationAlternative = {
  id: string;
  name: string;
  provider?: string;
  label: string;
  aliases?: string[];
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
  scorecard: {
    scoringMethod: string;
    totalPossibleScore: string;
    confidenceLevel: string;
    criteria: Array<Record<string, unknown>>;
    totals: Array<Record<string, unknown>>;
    decisionSummary: Record<string, unknown>;
  };
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
const INTERNAL_LABELS = new Set([
  'tipo',
  'tipo de dato',
  'source tecnico',
  'source técnico',
  'internalid',
  'id interno',
  'rows',
  'sections',
  'values',
]);
const SIMPLE_SOURCE_LABELS: Record<string, string> = {
  document: 'Documento',
  documento: 'Documento',
  documental: 'Documento',
  user: 'Usuario',
  usuario: 'Usuario',
  calculated: 'Calculado',
  calculado: 'Calculado',
  estimate: 'Estimado',
  estimated: 'Estimado',
  estimado: 'Estimado',
  benchmark: 'Benchmark',
  missing: 'Faltante',
  faltante: 'Faltante',
  no_aplica: 'No aplica',
  'no aplica': 'No aplica',
};

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
  return fallback;
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

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isInternalLabel(value: string) {
  const normalized = normalizeKey(value);
  return INTERNAL_LABELS.has(normalized) || /^a\d+$/.test(normalized) || /^alt\s*\d+$/.test(normalized);
}

function cleanSourceLabel(value: unknown) {
  const text = asText(value, '').trim();
  if (!text) return '';
  const normalized = normalizeKey(text);
  if (/[\\/]/.test(text) || /\.(pdf|xlsx|xls|csv|docx|pptx|png|jpe?g)$/i.test(text)) return 'Documento';
  if (normalized.includes('resultado estructurado') || normalized.includes('matriz tco')) return 'Calculado';
  return SIMPLE_SOURCE_LABELS[normalized] ?? (text.length > 36 ? text.slice(0, 33).trimEnd() + '...' : text);
}

function dedupeTexts(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const text = asText(value, '').trim();
    const key = normalizeKey(text);
    if (!text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = asText(value, '').replace(/,/g, '');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function confidenceRank(value: unknown) {
  const text = normalizeKey(asText(value, ''));
  if (text.includes('alta') || text.includes('high')) return 3;
  if (text.includes('media') || text.includes('medium')) return 2;
  if (text.includes('baja') || text.includes('low')) return 1;
  return 0;
}

function fullAlternativeLabel(name: string, allNames: string[]) {
  const current = asText(name, '').trim();
  if (!current || isInternalLabel(current)) return '';
  const normalized = normalizeKey(current);
  const containing = allNames
    .filter((candidate) => {
      const candidateText = asText(candidate, '').trim();
      const candidateKey = normalizeKey(candidateText);
      return candidateText && candidateKey !== normalized && candidateKey.includes(normalized);
    })
    .sort((a, b) => b.length - a.length)[0];
  return containing || current;
}

function unique(values: string[]) {
  return dedupeTexts(values);
}

function matrixAlternativeAliasGroups(matrix?: DashboardMatrix) {
  return asArray(matrix?.alternatives)
    .map((item) => ({
      label: asText(item.label || item.name || item.provider, ''),
      provider: asText(item.provider, ''),
      aliases: dedupeTexts([item.id, item.label, item.name, item.provider].map((value) => asText(value, ''))),
    }))
    .filter((item) => item.label);
}

function getAlternativeNames(result: TcoAnalysisResult, matrix?: DashboardMatrix) {
  const matrixGroups = matrixAlternativeAliasGroups(matrix);
  const matrixNames = matrixGroups
    .map((item) => item.label)
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
  const aliasById = new Map<string, string>();
  matrixGroups.forEach((group) => {
    group.aliases.forEach((alias) => aliasById.set(normalizeKey(alias), group.label));
  });
  const matrixValueNames = asArray(result.tco_matrix)
    .flatMap((row) => Object.keys(asRecord(row.values)).map((key) => aliasById.get(normalizeKey(key)) || key));
  const rawNames = unique([...matrixNames, ...totalNames, ...rankingNames, ...detectedNames, ...matrixValueNames]);
  return unique(rawNames.map((name) => fullAlternativeLabel(name, rawNames)).filter(Boolean));
}

function normalizeAlternatives(result: TcoAnalysisResult, matrix?: DashboardMatrix): TcoPresentationAlternative[] {
  const rawNames = getAlternativeNames(result, matrix);
  const matrixGroups = matrixAlternativeAliasGroups(matrix);
  return rawNames.map((name, index) => {
    const related = matrixGroups.filter((group) => group.label === name || normalizeKey(name).includes(normalizeKey(group.label)) || normalizeKey(group.label).includes(normalizeKey(name)));
    const aliases = unique([name, ...related.flatMap((group) => group.aliases)]);
    return { id: `alt-${index + 1}`, name, label: name, provider: related[0]?.provider, aliases };
  });
}

function normalizeRow(
  component: string,
  values: Record<string, unknown>,
  alternatives: TcoPresentationAlternative[],
  options: { unit?: string; source?: string; note?: string; isTotal?: boolean } = {},
): TcoPresentationRow {
  const normalizedValues = alternatives.reduce<Record<string, string>>((acc, alternative) => {
    const candidateKeys = unique([alternative.label, alternative.name, alternative.provider ?? '', ...(alternative.aliases ?? [])]);
    const rawValue = candidateKeys.reduce<unknown>((found, key) => (found !== undefined ? found : values[key]), undefined);
    acc[alternative.label] = displayValue(rawValue, component);
    return acc;
  }, {});
  return {
    component: asText(component, 'Componente'),
    values: normalizedValues,
    unit: options.unit,
    source: cleanSourceLabel(options.source),
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

function normalizeScorecard(result: TcoAnalysisResult) {
  const scorecard = asRecord(result.scorecard);
  const netTcoByAlternative = new Map(
    asArray<Record<string, unknown>>(result.financial_model).map((item) => [asText(item.alternative, ''), item.net_tco]),
  );
  const totals = asArray<Record<string, unknown>>(scorecard.totals)
    .map((item) => ({
      ...item,
      total_score: numberValue(item.total_score) ?? item.total_score,
      total_tco: item.total_tco ?? netTcoByAlternative.get(asText(item.alternative, '')),
    }))
    .sort((a, b) => {
      const scoreDelta = (numberValue(b.total_score) ?? -1) - (numberValue(a.total_score) ?? -1);
      if (scoreDelta) return scoreDelta;
      const tcoDelta = (numberValue(a.total_tco) ?? Number.POSITIVE_INFINITY) - (numberValue(b.total_tco) ?? Number.POSITIVE_INFINITY);
      if (Number.isFinite(tcoDelta) && tcoDelta) return tcoDelta;
      return confidenceRank(b.confidence_level) - confidenceRank(a.confidence_level);
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));
  return {
    scoringMethod: asText(scorecard.scoring_method, 'Scorecard no disponible'),
    totalPossibleScore: displayValue(scorecard.total_possible_score ?? 100),
    confidenceLevel: displayValue(scorecard.confidence_level),
    criteria: asArray<Record<string, unknown>>(scorecard.criteria),
    totals,
    decisionSummary: asRecord(scorecard.decision_summary),
  };
}

function normalizeRanking(result: TcoAnalysisResult, scorecardTotals: Array<Record<string, unknown>>) {
  if (scorecardTotals.length) {
    return scorecardTotals.map((item, index) => ({
      position: index + 1,
      alternative: item.alternative,
      ranking_type: 'Scorecard multicriterio',
      score: item.total_score,
      score_label: item.level,
      total_tco: item.total_tco,
      reason: [item.main_strength ? `Fortaleza: ${asText(item.main_strength)}` : '', item.main_weakness ? `Debilidad: ${asText(item.main_weakness)}` : '']
        .filter(Boolean)
        .join(' | '),
    }));
  }
  return asArray<Record<string, unknown>>(result.ranking)
    .sort((a, b) => (numberValue(b.score) ?? -1) - (numberValue(a.score) ?? -1))
    .map((item, index) => ({ ...item, position: index + 1 }));
}

function normalizeTransparency(result: TcoAnalysisResult) {
  return asArray<Record<string, unknown>>(result.transparency_table).map((item) => ({
    alternative: asText(item.alternative, 'General'),
    field: asText(item.field ?? item.dato, 'Dato'),
    value: displayValue(item.value),
    source: cleanSourceLabel(item.source),
    type: cleanSourceLabel(item.type),
    confidence_level: displayValue(item.confidence_level),
    observation: asText(item.observation, 'Sin observación adicional.'),
  }));
}

function synchronizedHorizon(result: TcoAnalysisResult, matrix?: DashboardMatrix) {
  const params = asRecord(result.base_parameters);
  const years = displayValue(params.horizon_years, '');
  if (years && !['Dato faltante', 'No calculable con datos actuales'].includes(years)) {
    return years === 'Por compra' || years.toLowerCase().includes('vida') ? years : `${years} años`;
  }
  return matrix?.horizon || result.evaluation_horizon;
}

export function normalizeTcoForPresentation(result: TcoAnalysisResult): TcoPresentationModel {
  const dashboardMatrix = asRecord(result.tco_dashboard_matrix) as DashboardMatrix;
  const hasDashboardMatrix = Boolean(asArray(dashboardMatrix.sections).length);
  const alternatives = normalizeAlternatives(result, dashboardMatrix);
  const matrix = hasDashboardMatrix
    ? buildSectionsFromDashboardMatrix(dashboardMatrix, alternatives)
    : buildSectionsFromLegacyMatrix(result, alternatives);
  const totals = buildTotals(result, alternatives, dashboardMatrix);
  const scorecard = normalizeScorecard(result);

  return {
    header: {
      title: result.analysis_title,
      analysisType: dashboardMatrix.analysis_type || result.analysis_type,
      itemName: result.item_name,
      horizon: synchronizedHorizon(result, dashboardMatrix),
      currency: dashboardMatrix.currency || result.currency,
      unitOfComparison: dashboardMatrix.unit_of_comparison || result.comparison_unit,
    },
    alternatives,
    kpis: buildKpis(result, totals, dashboardMatrix),
    matrix,
    totals,
    ranking: normalizeRanking(result, scorecard.totals),
    risks: result.risk_analysis,
    baseParameters: asRecord(result.base_parameters),
    benchmarkAssumptions: asArray<Record<string, unknown>>(result.benchmark_assumptions),
    transparencyTable: normalizeTransparency(result),
    financialModel: asArray<Record<string, unknown>>(result.financial_model),
    scorecard,
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
    { Seccion: section.title, Componente: section.description || section.title },
    ...section.rows.map((row) => ({
      Seccion: section.title,
      Componente: row.component,
      ...row.values,
      Unidad: row.unit ?? '',
      Fuente: row.source ?? '',
      Nota: row.note ?? '',
    })),
    ...(section.totalRow
      ? [{
          Seccion: section.title,
          Componente: section.totalRow.component,
          ...section.totalRow.values,
          Unidad: section.totalRow.unit ?? '',
          Fuente: section.totalRow.source ?? '',
          Nota: section.totalRow.note ?? '',
        }]
      : []),
  ]);
}

export function tcoKpiRows(model: TcoPresentationModel) {
  return model.kpis.map((item) => ({ KPI: item.label, Valor: item.value, Nota: item.note ?? '' }));
}
