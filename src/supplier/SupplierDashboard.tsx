import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, FileText, LayoutDashboard, UserRound, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPlatformStats } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRoleBadgeClass, getRoleLabel } from '@/lib/roles';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

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

const supplierModuleCards = [
  {
    title: 'Dashboard',
    description: 'Consulta tu indice principal y el resumen general de la plataforma.',
    to: '/supplier/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Directorio de compradores',
    description: 'Busca compradores activos por sector y revisa perfiles comerciales.',
    to: '/supplier/directory',
    icon: Building2,
  },
  {
    title: 'Oportunidades de stock',
    description: 'Publica y revisa oportunidades de inventario con la misma estructura del modulo.',
    to: '/supplier/sale',
    icon: FileText,
  },
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
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ').filter(Boolean)[0];
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
  });

  const totalSectorUsers = (data?.sectorBreakdown ?? []).reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-[28px] p-5 text-white shadow-[var(--shadow-purple)] sm:p-8"
        style={{ background: 'var(--gradient-brand)' }}
      >
        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-white/12 blur-2xl" />
        <div className="pointer-events-none absolute bottom-[-48px] right-24 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative max-w-3xl">
          {firstName && (
            <p className="mb-3 text-sm font-medium text-white/80">
              Hola, {firstName}
            </p>
          )}
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            Indice del proveedor
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/82 sm:text-base">
            Selecciona uno de tus modulos principales para gestionar compradores y oportunidades de stock.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {supplierModuleCards.map((module, index) => (
          <Card
            key={module.title}
            className="group h-full overflow-hidden rounded-2xl shadow-[var(--shadow-card)] transition-[transform,box-shadow,background] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
          >
            <Link
              to={module.to}
              className="flex h-full min-h-[178px] flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
              aria-label={`Ir a ${module.title}`}
            >
              <CardContent className="flex h-full flex-col p-5 sm:p-6">
                <div
                  className={cn(
                    'mb-5 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors',
                    index % 3 === 0 && 'bg-primary/10 text-primary group-hover:bg-primary/14',
                    index % 3 === 1 && 'bg-secondary/12 text-secondary group-hover:bg-secondary/18',
                    index % 3 === 2 && 'bg-destructive/10 text-destructive group-hover:bg-destructive/14',
                  )}
                >
                  <module.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold leading-snug text-foreground">
                    {module.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {module.description}
                  </p>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition-colors group-hover:text-primary">
                  Abrir modulo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h2>
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
