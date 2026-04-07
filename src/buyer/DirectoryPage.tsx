import { Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSupplierSectors } from '@/lib/api';

const DirectoryPage = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['supplier-sectors'],
    queryFn: getSupplierSectors,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Directorio de proveedores</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Selecciona un sector para ver proveedores disponibles.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando sectores...</p>}
      {isError && <p className="text-sm text-destructive">No se pudo cargar el directorio.</p>}

      {!isLoading && !isError && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data ?? []).map((item) => (
            <Link
              key={item.sector}
              to={`/buyer/directory/${encodeURIComponent(item.sector)}`}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors"
            >
              <Building2 className="w-5 h-5 text-primary" />
              <p className="mt-3 text-lg font-semibold text-foreground">{item.sector}</p>
              <p className="text-sm text-muted-foreground">
                {item.count} proveedor(es) en este sector
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DirectoryPage;
