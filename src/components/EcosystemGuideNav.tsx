import { BookOpen, Bot, BriefcaseBusiness, Building2, CalendarDays, FileText, MessageCircle, MessagesSquare, Users, Bell, BarChart3, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserRole } from '@/types';

const itemsByRole: Record<'buyer' | 'supplier' | 'expert', Array<{ label: string; to: string; icon: typeof Users }>> = {
  buyer: [
    { label: 'Inteligencia colectiva', to: '/community', icon: MessageCircle },
    { label: 'Contenido educativo', to: '/contenido-educativo', icon: BookOpen },
    { label: 'Directorio de proveedores', to: '/buyer/directory', icon: Building2 },
    { label: 'Nodus IA', to: '/nexu-ia', icon: Bot },
    { label: 'Nodus Experts', to: '/nexu-experts', icon: Users },
    { label: 'Empleabilidad', to: '/empleabilidad', icon: BriefcaseBusiness },
    { label: 'Ofertas y requerimientos / Economía circular', to: '/buyer/sale', icon: FileText },
    { label: 'Mensajes', to: '/mensajes', icon: MessagesSquare },
    { label: 'Reportes', to: '/reportes', icon: BarChart3 },
  ],
  supplier: [
    { label: 'Directorio de compradores', to: '/supplier/directory', icon: Building2 },
    { label: 'Ofertas y requerimientos / Economía circular', to: '/supplier/sale', icon: FileText },
    { label: 'Mensajes', to: '/mensajes', icon: MessagesSquare },
    { label: 'Notificaciones', to: '/notificaciones', icon: Bell },
    { label: 'Reportes', to: '/reportes', icon: BarChart3 },
    { label: 'Membresía', to: '/perfil', icon: UserRound },
  ],
  expert: [
    { label: 'Perfil de experto', to: '/perfil', icon: UserRound },
    { label: 'Disponibilidad', to: '/expert/calendar-setup', icon: CalendarDays },
    { label: 'Sesiones', to: '/nexu-experts', icon: Users },
    { label: 'Inteligencia colectiva', to: '/community', icon: MessageCircle },
    { label: 'Contenido', to: '/contenido-educativo', icon: BookOpen },
    { label: 'Mensajes', to: '/mensajes', icon: MessagesSquare },
    { label: 'Reportes', to: '/reportes', icon: BarChart3 },
  ],
};

const EcosystemGuideNav = ({ role }: { role?: UserRole }) => {
  if (role !== 'buyer' && role !== 'supplier' && role !== 'expert') {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h1 className="text-lg font-bold text-foreground">¿Qué quieres hacer hoy en el ecosistema?</h1>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {itemsByRole[role].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
};

export default EcosystemGuideNav;
