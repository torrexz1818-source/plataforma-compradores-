import { useMutation } from '@tanstack/react-query';

import {
  downloadDashboardPdf,
  generateDashboard,
  type DashboardResult,
  type GenerateDashboardPayload,
} from './dashboardCreatorApi';

export function useDashboardCreator() {
  return useMutation({
    mutationFn: (payload: GenerateDashboardPayload) => generateDashboard(payload),
  });
}

export function useDownloadDashboardPdf() {
  return useMutation({
    mutationFn: (input: { result: DashboardResult; pdfMode?: string; branding?: Record<string, unknown> }) =>
      downloadDashboardPdf(input),
  });
}
