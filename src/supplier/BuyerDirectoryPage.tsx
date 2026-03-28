import {
  Building2,
  Factory,
  HeartPulse,
  Landmark,
  Layers3,
  ShoppingCart,
  Truck,
  Wrench,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getBuyerSectors } from '@/lib/api';

const sectorIcons: Record<string, typeof Building2> = {
  Retail: ShoppingCart,
  Manufactura: Factory,
  ManufacturaIndustrial: Factory,
  Tecnologia: Layers3,
  Salud: HeartPulse,
  Logistica: Truck,
  Construccion: Wrench,
  Finanzas: Landmark,
  General: Building2,
};

function getSectorIcon(sector: string) {
  const normalized = sector.replace(/\s+/g, '');
  return sectorIcons[sector] ?? sectorIcons[normalized] ?? Building2;
}

const BuyerDirectoryPage = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['buyer-sectors'],
    queryFn: getBuyerSectors,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Directorio de compradores</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explora compradores agrupados por sector para encontrar oportunidades comerciales.
        </p>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Cargando sectores...</div>
      )}

      {isError && (
        <div className="text-sm text-destructive">
          No se pudo cargar el directorio de compradores.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data ?? []).map((item) => {
            const Icon = getSectorIcon(item.sector);

            return (
              <Link
                key={item.sector}
                to={`/supplier/directory/${encodeURIComponent(item.sector)}`}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-emerald-500/50"
              >
                <Icon className="w-5 h-5 text-emerald-700" />
                <p className="mt-3 text-lg font-semibold text-foreground">{item.sector}</p>
                <p className="text-sm text-muted-foreground">
                  {item.count} comprador(es) en este sector
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BuyerDirectoryPage;
