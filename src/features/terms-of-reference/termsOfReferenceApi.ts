import { runAiAgent } from '@/lib/agentRunApi';

export type TermsFormField = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'file' | 'number';
  required: boolean;
  placeholder: string;
  options: string[];
};

export type TermsFormSection = {
  section_title: string;
  fields: TermsFormField[];
};

export type TermsFormSchema = {
  detected_category: string;
  requirement_type: string;
  complexity: 'low' | 'medium' | 'high';
  recommended_template: string;
  form_sections: TermsFormSection[];
  recommended_safety_requirements: string[];
  suggested_documents: string[];
  notes_for_buyer: string[];
};

export type TermsGeneratedDocument = {
  general_data: {
    requirement_name: string;
    requirement_type: string;
    category: string;
    location: string | null;
    required_date: string | null;
  };
  tdr_type?: string;
  background?: string;
  objective: string;
  scope: string;
  technical_characteristics: string[];
  required_activities: string[];
  final_deliverables: string[];
  required_documents?: string[];
  applicable_standards?: string[];
  suggested_schedule?: string[];
  execution_conditions?: string[];
  justification: string;
  safety_requirements: string[];
  supplier_conditions: string[];
  commercial_conditions?: string[];
  evaluation_criteria?: string[];
  evaluation_matrix?: Array<{
    criterion?: string;
    subcriterion?: string;
    score?: number;
    required_evidence?: string;
  }>;
  compliance_matrix?: Array<{
    requirement?: string;
    type?: string;
    expected_evidence?: string;
    mandatory?: string;
    status?: string;
  }>;
  identified_risks?: Array<{
    risk?: string;
    impact?: string;
    mitigation?: string;
  }>;
  guarantees_penalties?: Array<{
    item?: string;
    type?: string;
    condition?: string;
    status?: string;
  }>;
  final_report_structure: string[];
  budget_chain: {
    project: string | null;
    cost_center: string | null;
    account: string | null;
    budget_reference: string | null;
    currency: string | null;
  };
  suggested_annexes: string[];
  additional_observations: string[];
};

export type TermsResult = {
  title: string;
  requirement_type: string;
  category: string;
  template_used: string;
  document_request?: string;
  generated_documents?: string[];
  process_code?: string;
  contracting_entity?: Record<string, unknown>;
  invited_bidders?: Array<Record<string, unknown>>;
  executive_summary: string;
  generated_document: TermsGeneratedDocument;
  supporting_documents_summary: Array<{
    file_name: string;
    detected_type: string;
    relevant_findings: string[];
    limitations: string[];
  }>;
  missing_information: string[];
  buyer_recommendations: string[];
  recommended_questions?: string[];
  consistency_validation?: string[];
  quality_check: {
    is_complete: boolean;
    warnings: string[];
    missing_sections: string[];
  };
  completion_score?: number;
  completion_level?: 'Alta' | 'Media' | 'Baja';
  risk_level?: 'Bajo' | 'Medio' | 'Alto';
  checklist?: Array<{
    label: string;
    status: 'complete' | 'incomplete' | 'recommended';
    detail?: string | null;
  }>;
  flow_steps?: string[];
  dashboard_metrics?: Array<{
    label: string;
    value: string;
    status: 'complete' | 'warning' | 'risk' | 'neutral';
    detail?: string | null;
  }>;
  tender_bases?: {
    object: string;
    scope: string;
    minimum_supplier_requirements: string[];
    requested_documentation: string[];
    evaluation_criteria: string[];
    proposal_submission_conditions: string[];
    question_deadline: string;
    proposal_deadline: string;
    submission_method: string;
    award_criteria: string[];
    disqualification_conditions: string[];
    buyer_observations: string[];
    disclaimer: string;
  };
  supplier_invitation_email?: {
    subject: string;
    greeting: string;
    body: string;
    attached_documents: string[];
    response_deadline: string;
    contact_details: string;
    closing: string;
  };
  process_schedule?: Array<{
    number?: string;
    phase?: string;
    activity?: string;
    responsible?: string;
    start?: string;
    end?: string;
    duration?: string;
    deliverable?: string;
    observations?: string;
  }>;
  tender_process?: string[];
  document_traceability?: Array<Record<string, unknown>>;
  downloadReadiness?: Record<string, unknown> | null;
  disclaimer: string;
};

export type GenerateTermsPayload = {
  initialDescription: string;
  fields: Record<string, string>;
  safetyRequirements: string[];
  dynamicFormData: Record<string, string>;
  files: File[];
};

const ALLOWED_FILE_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'csv', 'jpg', 'jpeg', 'png'];
const MAX_FILES = 8;
const MAX_FILE_SIZE_MB = 10;

function getFriendlyErrorMessage(message: string) {
  if (message.toLowerCase().includes('failed to fetch')) {
    return 'No se pudo conectar con el motor de IA. Verifica que el AI Engine esté levantado.';
  }
  return message || 'No se pudo completar la acción. Intenta nuevamente.';
}

export function validateTermsFiles(files: File[]) {
  if (files.length > MAX_FILES) {
    return `Puedes subir como máximo ${MAX_FILES} archivos.`;
  }

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
      return 'Formato de archivo no permitido.';
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return 'El archivo supera el tamaño permitido.';
    }
  }

  return null;
}

export async function createTermsFormSchema(initialDescription: string): Promise<TermsFormSchema> {
  const formData = new FormData();
  formData.append('agentId', 'terms_of_reference');
  formData.append('operation', 'form_schema');
  formData.append('initial_description', initialDescription);

  try {
    return await runAiAgent<TermsFormSchema>(formData);
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error instanceof Error ? error.message : ''));
  }
}

export async function generateTermsOfReference(payload: GenerateTermsPayload): Promise<TermsResult> {
  const formData = new FormData();
  const fields = payload.fields;

  formData.append('agentId', 'terms_of_reference');
  formData.append('operation', 'generate');
  formData.append('initial_description', payload.initialDescription);
  formData.append('title', fields.title || '');
  formData.append('requirement_type', fields.requirement_type || '');
  formData.append('category', fields.category || '');
  formData.append('location', fields.location || '');
  formData.append('required_date', fields.required_date || '');
  formData.append('objective', fields.objective || '');
  formData.append('scope', fields.scope || '');
  formData.append('activities', fields.activities || '');
  formData.append('deliverables', fields.deliverables || '');
  formData.append('justification', fields.justification || '');
  formData.append('safety_requirements', JSON.stringify(payload.safetyRequirements));
  formData.append('budget_project', fields.budget_project || '');
  formData.append('budget_cost_center', fields.budget_cost_center || '');
  formData.append('budget_account', fields.budget_account || '');
  formData.append('budget_reference', fields.budget_reference || '');
  formData.append('currency', fields.currency || '');
  formData.append('additional_instructions', fields.additional_instructions || '');
  formData.append('dynamic_form_data', JSON.stringify(payload.dynamicFormData));
  payload.files.forEach((file) => formData.append('files', file, file.name));

  try {
    return await runAiAgent<TermsResult>(formData);
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error instanceof Error ? error.message : ''));
  }
}
