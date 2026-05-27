export const DASHBOARD_CREATOR_DISCLAIMER =
  'Este dashboard de compras fue generado con asistencia de IA a partir de los archivos cargados por el usuario. La información, indicadores y recomendaciones deben ser revisados y validados por el comprador antes de tomar decisiones finales.';

export function DashboardDisclaimer() {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-[#0E109E]">Disclaimer</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        {DASHBOARD_CREATOR_DISCLAIMER}
      </p>
    </section>
  );
}
