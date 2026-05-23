import { useMutation } from '@tanstack/react-query';

import {
  analyzeTco,
  downloadTcoPdf,
  type AnalyzeTcoPayload,
  type TcoAnalysisResult,
} from './tcoAnalysisApi';

export function useTcoAnalysis() {
  return useMutation({
    mutationFn: (payload: AnalyzeTcoPayload) => analyzeTco(payload),
  });
}

export function useDownloadTcoPdf() {
  return useMutation({
    mutationFn: (input: { result: TcoAnalysisResult; pdfMode?: string; branding?: Record<string, unknown> }) => downloadTcoPdf(input),
  });
}
