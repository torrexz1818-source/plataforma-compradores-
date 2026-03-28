import { ArrowRight, Star } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { suppliers } from './data';

const SectorSuppliers = () => {
  const { sector = '' } = useParams();
  const items = suppliers.filter((supplier) => supplier.sector === sector);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground capitalize">
        Proveedores de {sector || 'sector'}
      </h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        {items.length} proveedor(es) encontrado(s).
      </p>

      <div className="space-y-3">
        {items.map((supplier) => (
          <article
            key={supplier.id}
            className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4"
          >
            <div>
              <p className="text-base font-semibold text-foreground">{supplier.name}</p>
              <p className="text-sm text-muted-foreground">{supplier.description}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{supplier.city}</span>
                <span>•</span>
                <span>{supplier.category}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {supplier.rating} ({supplier.reviews})
                </span>
              </div>
            </div>
            <Link
              to={`/buyer/supplier/${supplier.id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Ver perfil
              <ArrowRight className="w-4 h-4" />
            </Link>
          </article>
        ))}

        {!items.length && (
          <p className="text-sm text-muted-foreground">No hay proveedores para este sector.</p>
        )}
      </div>
    </div>
  );
};

export default SectorSuppliers;
