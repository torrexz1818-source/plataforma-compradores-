import { Building2, Eye, MessageCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const stats = [
  { label: 'Compradores interesados', value: '18', icon: Building2 },
  { label: 'Vistas de perfil', value: '246', icon: Eye },
  { label: 'Mensajes nuevos', value: '7', icon: MessageCircle },
  { label: 'Conversion estimada', value: '14%', icon: TrendingUp },
];

const SupplierDashboard = () => {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-900 text-white p-8">
        <h1 className="text-3xl font-bold tracking-tight">Panel del proveedor</h1>
        <p className="mt-2 text-emerald-100 max-w-2xl">
          Gestiona tu presencia, conecta con compradores y publica novedades de tu empresa.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/supplier/directory"
            className="inline-flex items-center gap-2 rounded-lg bg-white text-emerald-800 px-4 py-2 text-sm font-semibold"
          >
            Ver compradores
          </Link>
          <Link
            to="/supplier/posts"
            className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold"
          >
            Publicar actualizacion
          </Link>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <article key={stat.label} className="bg-card border border-border rounded-xl p-5">
            <stat.icon className="w-5 h-5 text-emerald-700" />
            <p className="mt-3 text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default SupplierDashboard;
