import { useMutation } from '@tanstack/react-query';

import {
  generateDashboard,
  type GenerateDashboardPayload,
} from './dashboardCreatorApi';

export function useDashboardCreator() {
  return useMutation({
    mutationFn: (payload: GenerateDashboardPayload) => generateDashboard(payload),
  });
}
