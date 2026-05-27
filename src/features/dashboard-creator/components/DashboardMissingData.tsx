import type { DashboardResult } from '../dashboardCreatorApi';

export function DashboardMissingData({ result }: { result: DashboardResult }) {
  void result;
  return null;
}
