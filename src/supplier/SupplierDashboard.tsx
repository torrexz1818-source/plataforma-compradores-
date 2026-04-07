import { useQuery } from '@tanstack/react-query';
import { getPlatformStats } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SupplierDashboard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
  });

  const totalSectorUsers = (data?.sectorBreakdown ?? []).reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Resumen general de la plataforma</p>
      </section>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando estadisticas...</p>}
      {isError && <p className="text-sm text-destructive">No se pudo cargar el dashboard.</p>}

      {data && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Total usuarios</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{data.totalUsers}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Compradores</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{data.buyers}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Proveedores</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{data.suppliers}</p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usuarios por sector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.sectorBreakdown.map((item) => {
                  const widthPercent =
                    totalSectorUsers > 0 ? Math.max((item.count / totalSectorUsers) * 100, 2) : 0;

                  return (
                    <div key={item.sector} className="grid grid-cols-[130px_1fr_42px] items-center gap-3">
                      <span className="text-sm text-foreground">{item.sector}</span>
                      <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${widthPercent}%` }} />
                      </div>
                      <span className="text-sm text-foreground text-right">{item.count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ultimos registros</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="py-2 pr-4 font-semibold">Nombre</th>
                      <th className="py-2 pr-4 font-semibold">Empresa</th>
                      <th className="py-2 pr-4 font-semibold">Sector</th>
                      <th className="py-2 pr-0 font-semibold">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border/60">
                        <td className="py-3 pr-4">{user.name}</td>
                        <td className="py-3 pr-4">{user.company}</td>
                        <td className="py-3 pr-4">{user.sector}</td>
                        <td className="py-3 pr-0">
                          <Badge
                            className={
                              user.role === 'buyer'
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                            }
                          >
                            {user.role === 'buyer' ? 'Comprador' : 'Proveedor'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        </>
      )}
      {!isLoading && data && data.latestUsers.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay registros recientes para mostrar.</p>
      )}
      {!isLoading && data && data.sectorBreakdown.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay datos de sectores disponibles.</p>
      )}
    </div>
  );
};

export default SupplierDashboard;
