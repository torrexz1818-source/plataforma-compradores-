import { useQuery } from '@tanstack/react-query';
import { Building2, UserRound, Users } from 'lucide-react';
import { getPlatformStats } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/roles';

const sectorColors = [
  'bg-primary',
  'bg-secondary',
  'bg-primary/80',
  'bg-success',
  'bg-secondary/80',
  'bg-primary/70',
  'bg-success/90',
  'bg-secondary/70',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getAvatarClass(role: string) {
  if (role === 'supplier') return 'bg-success text-success-foreground';
  return 'bg-destructive text-white';
}

const SupplierDashboard = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
  });

  const totalSectorUsers = (data?.sectorBreakdown ?? []).reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Resumen general de la plataforma</p>
      </section>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando estadisticas...</p>}
      {isError && <p className="text-sm text-destructive">No se pudo cargar el dashboard.</p>}

      {data && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-7 w-7" />
                </div>
                <div className="h-16 w-1 rounded-full bg-primary" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total usuarios</p>
                  <p className="mt-1 text-3xl font-bold leading-none text-foreground">{data.totalUsers}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Usuarios registrados en la plataforma</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <UserRound className="h-7 w-7" />
                </div>
                <div className="h-16 w-1 rounded-full bg-destructive" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Compradores</p>
                  <p className="mt-1 text-3xl font-bold leading-none text-foreground">{data.buyers}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Empresas compradoras activas</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/20 text-success-foreground">
                  <Building2 className="h-7 w-7" />
                </div>
                <div className="h-16 w-1 rounded-full bg-success" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Proveedores</p>
                  <p className="mt-1 text-3xl font-bold leading-none text-foreground">{data.suppliers}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Proveedores registrados</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-xl shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Usuarios por sector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.sectorBreakdown.map((item, index) => {
                  const rawPercent = totalSectorUsers > 0 ? (item.count / totalSectorUsers) * 100 : 0;
                  const widthPercent = rawPercent > 0 ? Math.max(rawPercent, 4) : 0;
                  const roundedPercent = Math.round(rawPercent);

                  return (
                    <div key={item.sector} className="grid grid-cols-[120px_1fr_70px] items-center gap-3">
                      <span className="truncate text-sm text-foreground">{item.sector}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-primary/10">
                        <div
                          className={`h-full rounded-full ${sectorColors[index % sectorColors.length]}`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <span className="text-right text-sm text-muted-foreground">
                        {item.count} ({roundedPercent}%)
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ultimos registros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto">
                <table className="min-w-[560px] w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs text-foreground">
                      <th className="w-[34%] py-2 pr-3 font-semibold">Nombre</th>
                      <th className="w-[28%] py-2 pr-3 font-semibold">Empresa</th>
                      <th className="w-[20%] py-2 pr-3 font-semibold">Sector</th>
                      <th className="w-[18%] py-2 pr-0 font-semibold">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latestUsers.map((user) => (
                      <tr key={user.id} className="border-b border-border/60">
                        <td className="py-3 pr-3 align-middle">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getAvatarClass(user.role)}`}
                            >
                              {getInitials(user.name)}
                            </span>
                            <span className="min-w-0 break-words leading-tight">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 align-middle break-words leading-tight">{user.company}</td>
                        <td className="py-3 pr-3 align-middle break-words leading-tight">{user.sector}</td>
                        <td className="py-3 pr-0 align-middle">
                          <Badge className={getRoleBadgeClass(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
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
