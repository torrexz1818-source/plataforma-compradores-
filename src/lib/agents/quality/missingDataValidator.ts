import type { ExportPayload } from '@/lib/exports/types';
import type { AgentQualityKey, QualityValidationResult } from './qualityTypes';
import {
  validateDashboardMinimumData,
  validateProposalComparisonMinimumData,
  validateTcoMinimumData,
  validateTermsMinimumData,
} from './adapters';

function normalizeAgentKey(agentKey?: AgentQualityKey) {
  const raw = String(agentKey || 'generic');
  if (raw.includes('dashboard')) return 'dashboard_creator';
  if (raw.includes('proposal') || raw.includes('quote')) return 'proposal_comparison';
  if (raw.includes('terms')) return 'terms_of_reference';
  if (raw.includes('tco')) return 'tco_analysis';
  return raw;
}

export function validateMinimumDataByAgent(input: {
  agentKey?: AgentQualityKey;
  result: unknown;
  payload: ExportPayload;
}): QualityValidationResult {
  const agentKey = normalizeAgentKey(input.agentKey);

  if (agentKey === 'dashboard_creator') {
    return validateDashboardMinimumData(input.result, input.payload);
  }
  if (agentKey === 'proposal_comparison') {
    return validateProposalComparisonMinimumData(input.result, input.payload);
  }
  if (agentKey === 'terms_of_reference') {
    return validateTermsMinimumData(input.result, input.payload);
  }
  if (agentKey === 'tco_analysis') {
    return validateTcoMinimumData(input.result, input.payload);
  }

  return { issues: [] };
}
