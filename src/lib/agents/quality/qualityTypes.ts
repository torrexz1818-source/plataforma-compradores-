import type { ExportBuildOptions, ExportPayload } from '@/lib/exports/types';

export type QualityStatus =
  | 'approved'
  | 'approved_with_warnings'
  | 'user_permission_required'
  | 'blocked';

export type QualityIssueSeverity = 'blocking' | 'recoverable' | 'warning' | 'suggestion';

export type AgentProgressStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'warning'
  | 'permission_required'
  | 'blocked'
  | 'failed';

export type AgentQualityKey =
  | 'dashboard_creator'
  | 'proposal_comparison'
  | 'terms_of_reference'
  | 'tco_analysis'
  | 'generic'
  | string;

export type QualityUserPermission = {
  accepted: boolean;
  acceptedAt?: string;
  statement?: string;
  source?: 'manual_input' | 'override';
  qualityId?: string;
};

export type QualityManualInput = {
  text?: string;
  fields?: Record<string, string>;
};

export type QualityGateOptions = ExportBuildOptions & {
  qualityPermission?: QualityUserPermission;
  manualQualityInput?: QualityManualInput;
  userInstructions?: string;
};

export type QualityGateInput = {
  agentKey?: AgentQualityKey;
  result: unknown;
  options?: QualityGateOptions;
};

export type QualityIssue = {
  code: string;
  message: string;
  severity: QualityIssueSeverity;
  field?: string;
  stage?: string;
  suggestion?: string;
  userCanOverride?: boolean;
};

export type QualityValidationResult = {
  issues: QualityIssue[];
  detectedData?: string[];
};

export type QualityGateReport = {
  status: QualityStatus;
  score: number;
  criticalIssues: string[];
  warnings: string[];
  suggestions: string[];
  missingFields: {
    critical: string[];
    optional: string[];
  };
  userCanOverride: boolean;
  requiresUserInput: boolean;
  sanitizedPayload: ExportPayload;
  userMessage: string;
  detectedData: string[];
};

export type FileQualityReport = {
  status: QualityStatus;
  score: number;
  criticalIssues: string[];
  warnings: string[];
  suggestions: string[];
  userCanOverride: boolean;
  requiresUserInput: boolean;
  userMessage: string;
};

export type FileValidationInput = {
  agentKey: AgentQualityKey;
  files: File[];
  requireFiles?: boolean;
  maxFiles?: number;
  maxFileSizeMb?: number;
};
