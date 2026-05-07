import { useMutation } from '@tanstack/react-query';

import {
  analyzeProposalComparison,
  type AnalyzeProposalComparisonPayload,
} from './proposalComparisonApi';

export function useProposalComparison() {
  return useMutation({
    mutationFn: (payload: AnalyzeProposalComparisonPayload) => analyzeProposalComparison(payload),
  });
}
