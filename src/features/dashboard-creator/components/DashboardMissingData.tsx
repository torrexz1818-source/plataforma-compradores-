import type { DashboardResult } from '../dashboardCreatorApi';
import { asArray } from './dashboardUtils';

export function DashboardMissingData({ result }: { result: DashboardResult }) {
  const missing = asArray(result.missingData);
  const warnings = asArray(result.qualityWarnings).length ? asArray(result.qualityWarnings) : result.data_profile.data_quality_warnings;
  const filters = result.suggested_filters ?? [];
  if (!missing.length && !warnings.length && !filters.length) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">Datos faltantes</p>
        {missing.length ? (
          <div className="mt-4 space-y-3">
            {missing.slice(0, 10).map((item, index) => (
              <article key={`${item.indicator}-${index}`} className="rounded-[8px] border border-[#F3313F]/20 bg-[#F3313F]/5 p-3">
                <p className="text-sm font-semibold text-slate-950">{item.indicator}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.reason}</p>
                {item.required_fields?.length ? (
                  <p className="mt-2 text-xs text-slate-500">Campos necesarios: {item.required_fields.join(', ')}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-slate-600">No se registraron datos faltantes criticos.</p>}
      </div>
      <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">Calidad de datos</p>
        <p className="mt-2 text-sm text-slate-600">
          {result.data_profile.rows_detected} filas, {result.data_profile.columns_detected} columnas, {result.data_profile.files_processed} archivo(s).
        </p>
        {filters.length ? <p className="mt-2 text-xs text-[#0E109E]">Filtros sugeridos: {filters.join(', ')}</p> : null}
        {warnings.length ? (
          <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
            {warnings.slice(0, 12).map((item, index) => (
              <li key={`${item}-${index}`} className="border-l-2 border-amber-400 pl-3">{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
