import { useMutation } from '@tanstack/react-query';

import {
  analyzeTco,
  type AnalyzeTcoPayload,
} from './tcoAnalysisApi';

export function useTcoAnalysis() {
  return useMutation({
    mutationFn: (payload: AnalyzeTcoPayload) => analyzeTco(payload),
  });
}
