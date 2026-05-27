import type React from 'react';
import type { DashboardResult } from '../dashboardCreatorApi';
import { DashboardChartRenderer } from './DashboardChartRenderer';
import { DashboardCover } from './DashboardCover';
import { DashboardDisclaimer } from './DashboardDisclaimer';
import { DashboardExecutiveSummary } from './DashboardExecutiveSummary';
import { DashboardFindings } from './DashboardFindings';
import { DashboardKpiGrid } from './DashboardKpiGrid';
import { DashboardRecommendations } from './DashboardRecommendations';
import { DashboardTables } from './DashboardTables';
import { sanitizeDashboardForPublicView } from './dashboardUtils';

type Props = {
  result: DashboardResult;
  actions?: React.ReactNode;
};

export function DashboardReportView({ result, actions }: Props) {
  const publicResult = sanitizeDashboardForPublicView(result);
  const charts = publicResult.charts.filter((chart) => chart.data?.length);

  return (
    <div id="dashboard-creator-export-view" className="space-y-5 rounded-[8px] border border-slate-200 bg-white p-4 text-slate-950 shadow-sm sm:p-5">
      <DashboardCover result={publicResult} actions={actions} />
      <DashboardExecutiveSummary result={publicResult} />
      <DashboardKpiGrid result={publicResult} />
      {charts.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {charts.map((chart) => <DashboardChartRenderer key={chart.chart_id} chart={chart} result={publicResult} />)}
        </section>
      ) : null}
      <DashboardTables result={publicResult} />
      <DashboardFindings result={publicResult} />
      <DashboardRecommendations result={publicResult} />
      <DashboardDisclaimer />
    </div>
  );
}
