import type { DashboardResult } from '../dashboardCreatorApi';
import { asArray } from './dashboardUtils';

type Props = {
  result: DashboardResult;
};

export function DashboardExecutiveSummary({ result }: Props) {
  const summary = result.executiveSummary;
  const indicators = asArray(summary?.main_indicators).length
    ? asArray(summary?.main_indicators)
    : result.kpis.slice(0, 6).map((kpi) => kpi.title);
  const limitations = asArray(summary?.limitations).length ? asArray(summary?.limitations) : result.missing_information;

  return (
    <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">Resumen ejecutivo</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {summary?.information_found || result.executive_summary}
        </p>
        {summary?.analysis_built ? (
          <p className="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            {summary.analysis_built}
          </p>
        ) : null}
      </div>
      <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">Indicadores y limites</p>
        {indicators.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {indicators.slice(0, 8).map((item) => (
              <span key={item} className="rounded-full bg-[#0E109E]/7 px-3 py-1 text-xs font-medium text-[#0E109E]">
                {item}
              </span>
            ))}
          </div>
        ) : null}
        {limitations.length ? (
          <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
            {limitations.slice(0, 5).map((item) => (
              <li key={item} className="border-l-2 border-[#F3313F] pl-3">{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
