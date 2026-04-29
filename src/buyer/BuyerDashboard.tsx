import { ArrowRight, Building2, Play, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getPlatformStats } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const { data: platformStats, isLoading: isStatsLoading, isError: isStatsError } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
  });

  const totalSectorUsers = (platformStats?.sectorBreakdown ?? []).reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-3 py-5 sm:px-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="hero-brand relative mb-8 overflow-hidden rounded-[28px] p-5 shadow-[var(--shadow-purple)] sm:p-8"
        style={{
          background: 'var(--gradient-brand)',
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-24 bottom-[-42px] h-32 w-32 rounded-full bg-secondary/10 blur-2xl" />
        <div className="hero-radial-light pointer-events-none absolute inset-y-0 right-0 w-[42%]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/85">
              Panel de comprador
            </div>
            <h1 className="mb-3 text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl lg:text-4xl">
              BUYER NODUS
            </h1>
            <p className="max-w-xl text-sm leading-6 text-primary-foreground/85 sm:text-base sm:leading-7 lg:text-lg">
              Es un ecosistema digital B2B especializada para compradores donde aprenden, comparten experiencias y automatizan sus procesos.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:min-w-[240px]">
            <Button
              variant="secondary"
              onClick={() => navigate('/community')}
              className="h-11 rounded-xl bg-white text-primary font-medium shadow-sm hover:bg-white/95"
            >
              Comunidad <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-white/20 bg-white/10 text-primary-foreground hover:bg-white/18"
              onClick={() => navigate('/contenido-educativo')}
            >
              <Play className="w-4 h-4 mr-1" /> Ir a contenido educativo
            </Button>
          </div>
        </div>
      </motion.div>

      {isStatsLoading && <p className="text-sm text-muted-foreground mb-6">Cargando estadisticas...</p>}
      {isStatsError && <p className="text-sm text-destructive mb-6">No se pudo cargar el dashboard.</p>}

      {platformStats && (
        <div className="space-y-6 mb-8">
          <section>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Resumen general de la plataforma</p>
          </section>

          <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="min-w-0 overflow-hidden rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex min-w-0 items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-7 w-7" />
                </div>
                <div className="h-16 w-1 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Total usuarios</p>
                  <p className="mt-1 text-3xl font-bold leading-none text-foreground">{platformStats.totalUsers}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Usuarios registrados en la plataforma</p>
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex min-w-0 items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <UserRound className="h-7 w-7" />
                </div>
                <div className="h-16 w-1 rounded-full bg-destructive" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Compradores</p>
                  <p className="mt-1 text-3xl font-bold leading-none text-foreground">{platformStats.buyers}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Empresas compradoras activas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="min-w-0 overflow-hidden rounded-xl shadow-[var(--shadow-card)]">
              <CardContent className="flex min-w-0 items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/20 text-success-foreground">
                  <Building2 className="h-7 w-7" />
                </div>
                <div className="h-16 w-1 rounded-full bg-success" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Proveedores</p>
                  <p className="mt-1 text-3xl font-bold leading-none text-foreground">{platformStats.suppliers}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Proveedores registrados</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Card className="min-w-0 overflow-hidden rounded-xl shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Usuarios por sector
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 space-y-3">
                {platformStats.sectorBreakdown.map((item, index) => {
                  const rawPercent = totalSectorUsers > 0 ? (item.count / totalSectorUsers) * 100 : 0;
                  const widthPercent = rawPercent > 0 ? Math.max(rawPercent, 4) : 0;
                  const roundedPercent = Math.round(rawPercent);

                  return (
                    <div key={item.sector} className="grid min-w-0 grid-cols-[minmax(72px,0.85fr)_minmax(88px,1fr)_56px] items-center gap-2 sm:grid-cols-[120px_1fr_70px] sm:gap-3">
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

            <Card className="min-w-0 overflow-hidden rounded-xl shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Ultimos registros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full max-w-full overflow-x-auto overscroll-x-contain pb-1 touch-pan-x [-webkit-overflow-scrolling:touch]">
                <table className="min-w-[640px] w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs text-foreground">
                      <th className="w-[34%] py-2 pr-3 font-semibold">Nombre</th>
                      <th className="w-[28%] py-2 pr-3 font-semibold">Empresa</th>
                      <th className="w-[20%] py-2 pr-3 font-semibold">Sector</th>
                      <th className="w-[18%] py-2 pr-0 font-semibold">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformStats.latestUsers.map((user) => (
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
        </div>
      )}
    </div >
  );
};

export default BuyerDashboard;
