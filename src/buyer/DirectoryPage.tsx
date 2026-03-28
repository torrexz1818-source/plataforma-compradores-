import { Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sectors } from './data';

const DirectoryPage = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Directorio por sectores</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Selecciona un sector para ver proveedores disponibles.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectors.map((sector) => (
          <Link
            key={sector}
            to={`/buyer/directory/${sector}`}
            className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors"
          >
            <Building2 className="w-5 h-5 text-primary" />
            <p className="mt-3 text-lg font-semibold text-foreground capitalize">{sector}</p>
            <p className="text-sm text-muted-foreground">Ver proveedores del sector</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default DirectoryPage;
