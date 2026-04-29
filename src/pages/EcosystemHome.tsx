import {
  ArrowRight,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Building2,
  LayoutDashboard,
  FileText,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const baseModuleCards = [
  {
    title: 'Dashboard',
    description: 'Consulta el resumen general de usuarios, sectores y actividad reciente.',
    to: '/buyer/dashboard',
    supplierTo: '/supplier/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Novedades',
    description: 'Revisa noticias, anuncios y publicaciones recientes de la plataforma.',
    to: '/novedades',
    icon: Newspaper,
  },
  {
    title: 'Comunidad',
    description: 'Conecta con compradores, proveedores y profesionales del sector.',
    to: '/community',
    icon: MessageCircle,
  },
  {
    title: 'Contenido Educativo',
    description: 'Accede a cursos, recursos y materiales para fortalecer tus conocimientos.',
    to: '/contenido-educativo',
    icon: BookOpen,
  },
  {
    title: 'Empleabilidad',
    description: 'Explora oportunidades laborales y perfiles profesionales relacionados al sector.',
    to: '/empleabilidad',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Nodus Experts',
    description: 'Encuentra expertos y especialistas para resolver necesidades específicas.',
    to: '/nexu-experts',
    icon: Users,
  },
  {
    title: 'Oportunidades de stock',
    description: 'Publica productos y ofertas disponibles en liquidación.',
    to: '/buyer/sale',
    supplierTo: '/supplier/sale',
    icon: FileText,
  },
  {
    title: 'Nodus IA',
    description: 'Utiliza herramientas inteligentes para apoyar tus procesos y decisiones.',
    to: '/nexu-ia',
    icon: Bot,
  },
  {
    title: 'Directorio de proveedores',
    description: 'Busca, filtra y revisa proveedores registrados en la plataforma.',
    to: '/buyer/directory',
    icon: Building2,
  },
  {
    title: 'Mensajería',
    description: 'Gestiona tus conversaciones y contactos dentro de la plataforma.',
    to: '/mensajes',
    icon: MessagesSquare,
  },
];

const EcosystemHome = () => {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ').filter(Boolean)[0];

  const moduleCards = baseModuleCards.map((card) => ({
    ...card,
    to: user?.role === 'supplier' && card.supplierTo ? card.supplierTo : card.to,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-3 pb-8 sm:px-6">
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
            ¿Qué quieres hacer hoy en el ecosistema?
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/82 sm:text-base">
            Selecciona una opción para comenzar a gestionar tus actividades dentro de la plataforma.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {moduleCards.map((module, index) => (
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
                  Abrir módulo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </section>
    </div>
  );
};

export default EcosystemHome;
