import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import { getMonthlyReport } from '@/lib/api';
import { useHighlight } from '@/hooks/useHighlight';
import { MonthlyReport } from '@/types';

const Reports = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const month = searchParams.get('month') ?? undefined;
  const highlightId = searchParams.get('highlight');
  useHighlight(highlightId);

  const reportQuery = useQuery({
    queryKey: ['monthly-report', month],
    queryFn: () => getMonthlyReport(month),
  });

  const report = reportQuery.data as MonthlyReport | undefined;
  const monthLabel = useMemo(() => month ?? report?.month ?? 'Mes actual', [month, report?.month]);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">Resumen mensual {monthLabel}</p>

        {reportQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando reporte...</p>}
        {reportQuery.isError && <p className="text-sm text-destructive">No se pudo cargar el reporte.</p>}

        {report && report.role === 'supplier' && (
          <div className="space-y-5">
            <section className="grid md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Vistas perfil</p><p className="text-xl font-semibold">{report.metrics.profileViews}</p></div>
              <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Likes</p><p className="text-xl font-semibold">{report.metrics.likes}</p></div>
              <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Mensajes</p><p className="text-xl font-semibold">{report.metrics.messages}</p></div>
              <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Vs mes anterior</p><p className="text-xl font-semibold">{report.metrics.variationVsPreviousMonth}%</p></div>
            </section>

            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-semibold mb-3">Top publicaciones</h2>
              <div className="space-y-2">
                {report.topPublications.map((item) => (
                  <div key={item.id} id={`item-${item.id}`} className="flex items-center justify-between">
                    <span className="text-sm">{item.title}</span>
                    <button className="text-sm text-primary hover:underline" onClick={() => navigate(`/publicaciones?highlight=${item.id}`)}>Ver publicación</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {report && report.role === 'buyer' && (
          <div className="space-y-5">
            <section className="grid md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Proveedores visitados</p><p className="text-xl font-semibold">{report.metrics.suppliersVisited}</p></div>
              <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Mensajes enviados</p><p className="text-xl font-semibold">{report.metrics.messagesSent}</p></div>
              <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Contenidos vistos</p><p className="text-xl font-semibold">{report.metrics.contentsViewed}</p></div>
              <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Nuevos proveedores</p><p className="text-xl font-semibold">{report.metrics.newSuppliersInMyCategories}</p></div>
            </section>

            <section className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-semibold mb-3">Proveedores recomendados</h2>
              <div className="space-y-2">
                {report.recommendedSuppliers.map((item) => (
                  <div key={item.id} id={`item-${item.id}`} className="flex items-center justify-between">
                    <span className="text-sm">{item.company} · {item.sector}</span>
                    <button className="text-sm text-primary hover:underline" onClick={() => navigate(`/perfil/${item.id}`)}>Ver proveedor</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Reports;
