import type React from 'react';
import { Badge } from '@/components/ui/badge';
import type { DashboardResult } from '../dashboardCreatorApi';
import { compactDate, getVisualConfig } from './dashboardUtils';

type Props = {
  result: DashboardResult;
  actions?: React.ReactNode;
};

export function DashboardCover({ result, actions }: Props) {
  const visual = getVisualConfig(result);
  const metadata = result.metadata;

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              Buyer Nodus
            </Badge>
            <Badge variant="outline" style={{ borderColor: `${visual.primary}33`, color: visual.primary }}>
              Creador de Dashboard
            </Badge>
          </div>
          <h2 className="mt-4 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
            {metadata?.title || result.dashboard_title}
          </h2>
          <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <span className="block font-medium text-slate-950">Reporte</span>
              {metadata?.report_name || result.dashboard_title}
            </div>
            <div>
              <span className="block font-medium text-slate-950">Audiencia</span>
              {result.audience || 'No especificado'}
            </div>
            <div>
              <span className="block font-medium text-slate-950">Fecha</span>
              {compactDate(metadata?.generated_at)}
            </div>
          </div>
        </div>
        {actions ? <div data-export-hidden="true">{actions}</div> : null}
      </div>
    </section>
  );
}
