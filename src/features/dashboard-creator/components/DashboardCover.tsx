import type React from 'react';
import { Badge } from '@/components/ui/badge';
import type { DashboardResult } from '../dashboardCreatorApi';
import { asArray, compactDate, getVisualConfig } from './dashboardUtils';

type Props = {
  result: DashboardResult;
  actions?: React.ReactNode;
};

export function DashboardCover({ result, actions }: Props) {
  const visual = getVisualConfig(result);
  const metadata = result.metadata;
  const files = asArray(metadata?.analyzed_files?.length ? metadata?.analyzed_files : result.source_files);

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {metadata?.created_from || 'Buyer Nodus'}
            </Badge>
            <Badge variant="outline" style={{ borderColor: `${visual.primary}33`, color: visual.primary }}>
              {metadata?.agent_name || 'Creador de Dashboard'}
            </Badge>
            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
              Confianza: {result.confidence_level}
            </Badge>
          </div>
          <h2 className="mt-4 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
            {metadata?.title || result.dashboard_title}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{result.objective}</p>
          <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="block font-medium text-slate-950">Reporte</span>
              {metadata?.report_name || result.dashboard_title}
            </div>
            <div>
              <span className="block font-medium text-slate-950">Audiencia</span>
              {result.audience || 'No especificado'}
            </div>
            <div>
              <span className="block font-medium text-slate-950">Periodo</span>
              {result.period || 'No especificado'}
            </div>
            <div>
              <span className="block font-medium text-slate-950">Fecha</span>
              {compactDate(metadata?.generated_at)}
            </div>
          </div>
          {files.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {files.slice(0, 6).map((file, index) => (
                <span key={`${String(file.file_name ?? file.name ?? index)}-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {String(file.file_name ?? file.name ?? 'Archivo')} · {String(file.detected_type ?? file.type ?? 'dato')}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? <div data-export-hidden="true">{actions}</div> : null}
      </div>
    </section>
  );
}
