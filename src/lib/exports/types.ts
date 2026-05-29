export type ExportFormat = 'pdf' | 'excel' | 'ppt';

export type ExportBlockType =
  | 'summary'
  | 'kpi'
  | 'chart'
  | 'table'
  | 'insight'
  | 'risk'
  | 'recommendation'
  | 'decision'
  | 'matrix'
  | 'timeline'
  | 'dashboard_filter'
  | 'alert'
  | 'ranking';

export type ExportBlock = {
  id: string;
  type: ExportBlockType;
  title?: string;
  description?: string;
  data: unknown;
  priority: number;
  formats?: ExportFormat[];
  visualHint?: string;
};

export type ExportPayload = {
  agentId: string;
  title: string;
  subtitle?: string;
  blocks: ExportBlock[];
};

export type ExportAuditStatus = 'approved' | 'approved_with_warnings' | 'blocked';

export type ExportAuditReport = {
  status: ExportAuditStatus;
  score: number;
  criticalIssues: string[];
  warnings: string[];
  suggestions: string[];
  missingFields: {
    critical: string[];
    optional: string[];
  };
  sanitizedPayload: ExportPayload;
  userMessage: string;
  detectedData: string[];
};

export type ExportBuildOptions = {
  termsScope?: {
    documentCode: string;
    documentTitle: string;
    sections: string[];
    hasPendingWarnings?: boolean;
  };
};
