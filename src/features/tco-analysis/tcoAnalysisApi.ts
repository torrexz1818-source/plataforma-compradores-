import { runAiAgent } from '@/lib/agentRunApi';

export type TcoAlternativeInput = {
  supplier_name: string;
  origin_country?: string;
  destination_country?: string;
  brand_model?: string;
  quantity?: string;
  currency?: string;
  base_price?: string;
  incoterm?: string;
  lead_time?: string;
  payment_terms?: string;
  warranty?: string;
  observations?: string;
  acquisition_cost?: string;
  international_freight?: string;
  international_insurance?: string;
  customs_taxes?: string;
  tariffs?: string;
  customs_agent_cost?: string;
  handling_cost?: string;
  internal_transport_cost?: string;
  installation_cost?: string;
  training_cost?: string;
  annual_maintenance_cost?: string;
  corrective_maintenance_cost?: string;
  annual_operation_cost?: string;
  annual_energy_cost?: string;
  spare_parts_cost?: string;
  support_cost?: string;
  administrative_cost?: string;
  financial_cost?: string;
  exit_cost?: string;
  residual_value?: string;
  other_costs?: string;
  delay_risk?: string;
  quality_risk?: string;
  regulatory_risk?: string;
  exchange_rate_risk?: string;
  logistics_risk?: string;
  single_supplier_risk?: string;
  penalties?: string;
  stockout_risk?: string;
  document_risk?: string;
  known_risks?: string;
};

export type TcoAnalysisResult = {
  analysis_title: string;
  item_name: string;
  analysis_type: string;
  evaluation_horizon: string;
  comparison_unit: string;
  currency: string;
  executive_summary: {
    best_alternative: string;
    best_alternative_score?: number | null;
    best_alternative_score_label?: string | null;
    why_it_wins: string;
    estimated_saving_or_overcost: string;
    main_risk: string;
    final_recommendation: string;
  };
  data_used: Array<Record<string, unknown>>;
  base_parameters?: {
    analysis_type?: string | null;
    product_or_service?: string | null;
    currency?: string | null;
    horizon_years?: number | string | null;
    quantity?: number | string | null;
    unit_of_comparison?: string | null;
    annual_usage?: number | string | null;
    annual_km?: number | string | null;
    useful_life_years?: number | string | null;
    exchange_rate?: number | string | null;
    discount_rate?: number | string | null;
    tax_rate?: number | string | null;
    financing_rate?: number | string | null;
    notes?: string[];
    [key: string]: unknown;
  } | null;
  benchmark_assumptions?: Array<Record<string, unknown>>;
  transparency_table?: Array<Record<string, unknown>>;
  financial_model?: Array<Record<string, unknown>>;
  scorecard?: {
    scoring_method?: string;
    total_possible_score?: number;
    confidence_level?: 'alta' | 'media' | 'baja' | string;
    criteria?: Array<{
      criterion_id?: string;
      criterion_name?: string;
      description?: string | null;
      weight?: number;
      applies_to_analysis_type?: string | null;
      scoring_logic?: string | null;
      alternatives?: Array<{
        alternative?: string;
        raw_value?: number | string | null;
        normalized_score?: number | null;
        weighted_score?: number | null;
        evidence?: string | null;
        source?: string | null;
        confidence_level?: string | null;
        comment?: string | null;
      }>;
    }>;
    totals?: Array<{
      alternative?: string;
      total_score?: number;
      level?: string;
      rank?: number;
      main_strength?: string;
      main_weakness?: string;
      confidence_level?: string;
    }>;
    decision_summary?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
  tco_matrix: Array<{ cost_component: string; values: Record<string, number | string | null>; notes?: string }>;
  tco_dashboard_matrix?: Record<string, unknown> | null;
  tco_totals: Array<Record<string, unknown>>;
  ranking: Array<{
    position: number;
    alternative: string;
    ranking_type: string;
    total_tco?: number | null;
    score?: number | null;
    score_label?: string | null;
    score_breakdown?: Record<string, unknown>;
    source_basis?: string[];
    reason: string;
  }>;
  interpretation: Record<string, unknown>;
  risk_analysis: Array<Record<string, unknown>>;
  sensitivity_analysis: Record<string, unknown>;
  strategic_recommendation: {
    recommended_action: string;
    economic_option?: string | null;
    technical_option?: string | null;
    lowest_risk_option?: string | null;
    balanced_option?: string | null;
    final_recommended_option?: string | null;
    recommendation_rationale?: string | null;
    negotiation_points?: string[];
    next_steps?: string[];
    [key: string]: unknown;
  };
  hidden_costs_detected?: string[];
  detected_alternatives?: Array<{
    supplier_name: string;
    source_file: string;
    detected_price?: string | null;
    warranty?: string | null;
    lead_time?: string | null;
    detected_costs?: string[];
    source_evidence?: string[];
    data_detected: string[];
    data_missing: string[];
    confidence_level?: 'low' | 'medium' | 'high';
  }>;
  extracted_data_quality?: {
    detected_alternatives_count: number;
    documents_processed: number;
    confidence_level: 'low' | 'medium' | 'high';
    warnings: string[];
  };
  missing_information: string[];
  questions_for_user_or_suppliers: string[];
  assumptions_and_limits: string[];
  supporting_documents_summary: Array<Record<string, unknown>>;
  calculation_warnings?: string[];
  model_provider?: string | null;
  model_name?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  cost_input?: number | null;
  cost_output?: number | null;
  cost_total?: number | null;
  latency_ms?: number | null;
  disclaimer: string;
};

export type AnalyzeTcoPayload = {
  title: string;
  itemName: string;
  analysisType: string;
  evaluationHorizon: string;
  comparisonUnit: string;
  currency: string;
  purchaseVolume?: string;
  objective?: string;
  alternatives?: TcoAlternativeInput[];
  generalContext?: string;
  additionalInstructions?: string;
  files: File[];
};

function getFriendlyErrorMessage(message: string) {
  if (message.toLowerCase().includes('failed to fetch')) {
    return 'No se pudo conectar con el AI Engine.';
  }

  return message || 'No se pudo generar el análisis TCO.';
}

export async function analyzeTco(payload: AnalyzeTcoPayload): Promise<TcoAnalysisResult> {
  const formData = new FormData();
  formData.append('agentId', 'tco_analysis');
  formData.append('operation', 'analyze');
  formData.append('title', payload.title);
  formData.append('item_name', payload.itemName);
  formData.append('analysis_type', payload.analysisType);
  formData.append('evaluation_horizon', payload.evaluationHorizon);
  formData.append('comparison_unit', payload.comparisonUnit);
  formData.append('currency', payload.currency);
  if (payload.alternatives?.length) {
    formData.append('alternatives_json', JSON.stringify(payload.alternatives));
  }

  if (payload.purchaseVolume?.trim()) formData.append('purchase_volume', payload.purchaseVolume.trim());
  if (payload.objective?.trim()) formData.append('objective', payload.objective.trim());
  if (payload.generalContext?.trim()) formData.append('general_context', payload.generalContext.trim());
  if (payload.additionalInstructions?.trim()) {
    formData.append('additional_instructions', payload.additionalInstructions.trim());
  }

  payload.files.forEach((file) => formData.append('files', file, file.name));

  try {
    return await runAiAgent<TcoAnalysisResult>(formData);
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error instanceof Error ? error.message : ''));
  }
}
