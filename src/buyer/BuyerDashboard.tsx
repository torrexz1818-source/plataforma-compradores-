import { ArrowRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import StatsCard from '@/components/StatsCard';
import { getHomeFeed, getPlatformStats } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['home-feed'],
    queryFn: getHomeFeed,
  });
  const { data: platformStats, isLoading: isStatsLoading, isError: isStatsError } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
  });

  const totalSectorUsers = (platformStats?.sectorBreakdown ?? []).reduce((acc, item) => acc + item.count, 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="gradient-primary rounded-lg p-8 mb-8"
      >
        <h1 className="text-3xl font-bold text-primary-foreground mb-2">SUPPLYCONNECT</h1>
        <p className="text-primary-foreground/80 text-base max-w-xl mb-6">
          La plataforma donde compradores B2B aprenden, comparten experiencias y descubren los mejores proveedores.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/community')} className="font-medium">
            Comunidad <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button
            variant="outline"
            className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
            onClick={() => navigate('/contenido-educativo')}
          >
            <Play className="w-4 h-4 mr-1" /> Ir a contenido educativo
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(data?.stats ?? []).map((stat, i) => (
          <StatsCard key={stat.label} {...stat} index={i} />
        ))}
      </div>

      {isStatsLoading && <p className="text-sm text-muted-foreground mb-6">Cargando estadisticas...</p>}
      {isStatsError && <p className="text-sm text-destructive mb-6">No se pudo cargar el dashboard.</p>}

      {platformStats && (
        <div className="space-y-6 mb-8">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Resumen general de la plataforma</p>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total usuarios</p>
                <p className="text-3xl font-bold mt-1">{platformStats.totalUsers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Compradores</p>
                <p className="text-3xl font-bold mt-1">{platformStats.buyers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Proveedores</p>
                <p className="text-3xl font-bold mt-1">{platformStats.suppliers}</p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Usuarios por sector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {platformStats.sectorBreakdown.map((item) => {
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
                    {platformStats.latestUsers.map((user) => (
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
        </div>
      )}
    </div >
  );
};

export default BuyerDashboard;
