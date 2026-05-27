import { Badge } from '@/components/ui/badge';
import type { DashboardResult } from '../dashboardCreatorApi';
import { businessText } from './dashboardUtils';

export function DashboardFindings({ result }: { result: DashboardResult }) {
  const findings = result.findings?.filter((item) => businessText(item.title) && businessText(item.description)) ?? [];
  const observations = result.observations.filter((item) => businessText(item.title) && businessText(item.description));
  const items = findings.length
    ? findings
    : observations.map((item) => ({
      title: item.title,
      description: item.description,
      evidence: item.type,
      confidence: 'medium' as const,
      inferred: false,
    }));

  if (!items.length) return null;

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-950">Hallazgos</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.slice(0, 10).map((item) => (
          <article key={`${item.title}-${item.evidence || ''}`} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-950">{businessText(item.title)}</p>
              {item.inferred ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">inferencia</Badge> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{businessText(item.description)}</p>
            {businessText(item.evidence) ? <p className="mt-2 text-xs font-medium text-slate-500">Evidencia: {businessText(item.evidence)}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
