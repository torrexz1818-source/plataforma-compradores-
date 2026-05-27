import type React from 'react';
import type { DashboardResult } from '../dashboardCreatorApi';
import { DashboardChartRenderer } from './DashboardChartRenderer';
import { DashboardCover } from './DashboardCover';
import { DashboardExecutiveSummary } from './DashboardExecutiveSummary';
import { DashboardFindings } from './DashboardFindings';
import { DashboardKpiGrid } from './DashboardKpiGrid';
import { DashboardMissingData } from './DashboardMissingData';
import { DashboardRecommendations } from './DashboardRecommendations';
import { DashboardTables } from './DashboardTables';

type Props = {
  result: DashboardResult;
  actions?: React.ReactNode;
};

export function DashboardReportView({ result, actions }: Props) {
  const charts = result.charts.filter((chart) => chart.data?.length);

  return (
    <div id="dashboard-creator-export-view" className="space-y-5 rounded-[8px] border border-slate-200 bg-white p-4 text-slate-950 shadow-sm sm:p-5">
      <DashboardCover result={result} actions={actions} />
      <DashboardExecutiveSummary result={result} />
      <DashboardKpiGrid result={result} />
      {charts.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {charts.map((chart) => <DashboardChartRenderer key={chart.chart_id} chart={chart} result={result} />)}
        </section>
      ) : null}
      <DashboardTables result={result} />
      <DashboardFindings result={result} />
      <DashboardRecommendations result={result} />
      <DashboardMissingData result={result} />
      {result.disclaimer ? <p className="text-xs leading-5 text-slate-500">{result.disclaimer}</p> : null}
    </div>
  );
}
