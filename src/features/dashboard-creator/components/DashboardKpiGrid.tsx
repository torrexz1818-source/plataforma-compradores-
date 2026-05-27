import { Badge } from '@/components/ui/badge';
import type { DashboardKpi, DashboardResult } from '../dashboardCreatorApi';
import { getVisualConfig } from './dashboardUtils';

type Props = {
  result: DashboardResult;
};

function statusTone(kpi: DashboardKpi, visual: ReturnType<typeof getVisualConfig>) {
  if (kpi.status === 'positive') return { color: visual.success, label: 'positivo' };
  if (kpi.status === 'critical') return { color: visual.danger, label: 'critico' };
  if (kpi.status === 'warning' || kpi.confidence === 'low') return { color: '#F59E0B', label: 'alerta' };
  return { color: visual.primary, label: 'neutro' };
}

export function DashboardKpiGrid({ result }: Props) {
  const visual = getVisualConfig(result);
  const kpis = result.kpis.filter((kpi) => kpi.title && kpi.value);
  if (!kpis.length) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.slice(0, 12).map((kpi) => {
        const tone = statusTone(kpi, visual);
        return (
          <article key={`${kpi.title}-${kpi.value}`} className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-xs font-semibold uppercase text-slate-500">{kpi.title}</p>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tone.color }} />
            </div>
            <p className="mt-3 break-words text-3xl font-semibold tracking-normal text-slate-950">{kpi.value}</p>
            {kpi.unit ? <p className="mt-1 text-xs font-medium text-slate-500">{kpi.unit}</p> : null}
            <p className="mt-3 text-xs leading-5 text-slate-600">{kpi.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-600">{kpi.source}</Badge>
              <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-600">{tone.label}</Badge>
            </div>
          </article>
        );
      })}
    </section>
  );
}
