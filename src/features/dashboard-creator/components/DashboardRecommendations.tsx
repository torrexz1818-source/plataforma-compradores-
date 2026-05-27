import type { DashboardResult } from '../dashboardCreatorApi';

export function DashboardRecommendations({ result }: { result: DashboardResult }) {
  const recommendations = result.recommendations.filter(Boolean);
  const insights = result.insights.filter((item) => item.title || item.description);
  if (!recommendations.length && !insights.length) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {insights.length ? (
        <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-950">Insights</p>
          <div className="mt-4 space-y-3">
            {insights.slice(0, 8).map((insight) => (
              <article key={insight.title} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-950">{insight.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{insight.description}</p>
                <p className="mt-2 text-xs font-medium text-[#0E109E]">{insight.recommended_action}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {recommendations.length ? (
        <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-950">Recomendaciones</p>
          <ol className="mt-4 space-y-3">
            {recommendations.slice(0, 10).map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-3 rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#B2EB4A] text-xs font-semibold text-slate-950">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
