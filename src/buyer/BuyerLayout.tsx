import { Bell, BookOpen, Building2, FileText, LayoutDashboard, LogOut, MessageCircle, Shield, Users } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import NotificationBell from '@/components/NotificationBell';

const buyerNavItems = [
  { to: '/buyer/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/buyer/directory', label: 'Directorio de proveedores', icon: Building2 },
  { to: '/buyer/sale', label: 'Liquidaciones', icon: FileText },
  { to: '/contenido-educativo', label: 'Contenido educativo', icon: BookOpen },
  { to: '/community', label: 'Comunidad', icon: MessageCircle },
  { to: '/notifications', label: 'Notificaciones', icon: Bell },
];

const supplierNavItems = [
  { to: '/supplier/dashboard', label: 'Inicio proveedor', icon: LayoutDashboard },
  { to: '/supplier/directory', label: 'Directorio de compradores', icon: Building2 },
  { to: '/publicaciones', label: 'Publicaciones', icon: FileText },
];

const BuyerLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const navSections = isAdmin
    ? [
        { title: 'Administrador', items: [{ to: '/admin/dashboard', label: 'Panel administrativo', icon: Shield }] },
        { title: 'Comprador', items: buyerNavItems },
        { title: 'Proveedor', items: supplierNavItems },
      ]
    : [{ title: '', items: buyerNavItems }];

  const isActive = (path: string) => {
    if (path === '/buyer/directory') {
      return (
        location.pathname === '/buyer/directory' ||
        location.pathname.startsWith('/buyer/directory/') ||
        location.pathname.startsWith('/buyer/supplier/')
      );
    }

    if (path === '/community') {
      return location.pathname === '/community' || location.pathname.startsWith('/post/');
    }

    if (path === '/contenido-educativo') {
      return location.pathname === '/contenido-educativo';
    }

    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <aside className="w-72 h-screen bg-[#0f2a5e] text-white flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-white/15">
          <p className="text-xl font-bold tracking-tight">SupplyConnect</p>
          <span className="inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/25 border border-blue-300/40">
            <Users className="w-3 h-3" />
            Comprador
          </span>
        </div>

        <nav className="px-3 py-3 space-y-2 flex-1 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title || 'default'} className="space-y-0.5">
              {section.title && (
                <p className="px-3 pb-1 text-[11px] uppercase tracking-wide text-white/55">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.to)
                      ? 'bg-white text-[#0f2a5e]'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex-shrink-0 px-4 py-3 border-t border-white/10">
          <p className="text-xs text-white/65">Sesion iniciada</p>
          <p className="text-sm font-medium truncate">{user?.fullName ?? 'Comprador'}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesion
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-end gap-3 mb-4">
            <span className="text-sm font-medium text-foreground truncate max-w-[260px]">
              {user?.fullName ?? 'Comprador'}
            </span>
            <NotificationBell />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default BuyerLayout;
