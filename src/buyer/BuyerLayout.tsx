import { BookOpen, Bot, BriefcaseBusiness, Building2, FileText, LayoutDashboard, LogOut, MessageCircle, Newspaper, Shield, Users } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import NotificationBell from '@/components/NotificationBell';
import MessageBell from '@/components/MessageBell';
import NewsAccessButton from '@/components/NewsAccessButton';
import { isBuyerLikeRole } from '@/lib/roles';

const buyerNavItems = [
  { to: '/buyer/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/community', label: 'Comunidad', icon: MessageCircle },
  {
    to: '/contenido-educativo',
    label: 'Contenido Educativo',
    icon: BookOpen,
    children: [
      { to: '/empleabilidad', label: 'Empleabilidad', icon: BriefcaseBusiness },
      { to: '/nexu-experts', label: 'Nexu Experts', icon: Users },
    ],
  },
  { to: '/buyer/sale', label: 'Liquidaciones', icon: FileText },
  { to: '/nexu-ia', label: 'Nexu IA', icon: Bot },
  { to: '/buyer/directory', label: 'Directorio de proveedores', icon: Building2 },
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
  const roleBadge = isAdmin
    ? {
        label: 'Administrador',
        icon: Shield,
        className: 'bg-destructive/20 border border-destructive/30 text-white/90',
      }
    : user?.role === 'expert'
      ? {
          label: 'Experto Nexu',
          icon: Users,
          className: 'bg-secondary/20 border border-secondary/30 text-white/90',
        }
    : {
        label: 'Comprador',
        icon: Users,
        className: 'bg-primary/20 border border-primary/30',
      };

  const navSections = isAdmin
    ? [
        {
          title: 'Administrador',
          items: [
            { to: '/admin/dashboard', label: 'Panel administrativo', icon: Shield },
            { to: '/novedades', label: 'Novedades', icon: Newspaper },
          ],
        },
        { title: 'Comprador', items: buyerNavItems },
        { title: 'Proveedor', items: supplierNavItems },
      ]
    : [{ title: '', items: isBuyerLikeRole(user?.role) ? buyerNavItems : buyerNavItems }];

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

    if (path === '/buyer/sale') {
      return location.pathname === '/buyer/sale' || location.pathname.startsWith('/buyer/sale/');
    }

    if (path === '/contenido-educativo') {
      return (
        location.pathname === '/contenido-educativo' ||
        location.pathname.startsWith('/post/') ||
        location.pathname === '/empleabilidad' ||
        location.pathname === '/nexu-experts' ||
        location.pathname.startsWith('/nexu-experts/')
      );
    }

    if (path === '/nexu-ia') {
      return location.pathname === '/nexu-ia' || location.pathname.startsWith('/nexu-ia/');
    }

    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen app-shell flex overflow-hidden">
      <aside className="w-72 h-screen sidebar-shell flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-white/15">
          <p className="text-xl font-bold tracking-tight">BUYER NODUS</p>
          <span className={`inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge.className}`}>
            <roleBadge.icon className="w-3 h-3" />
            {roleBadge.label}
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
                item.children ? (
                  <div key={item.label} className="space-y-1">
                    <NavLink
                      to={item.to}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.to)
                          ? 'sidebar-link-active'
                          : 'sidebar-link'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </NavLink>
                    <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive(child.to)
                              ? 'sidebar-link-active'
                              : 'sidebar-link'
                          }`}
                        >
                          <child.icon className="w-4 h-4" />
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.to)
                        ? 'sidebar-link-active'
                        : 'sidebar-link'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                )
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
          <div className="topbar-shell flex items-center justify-end gap-3 mb-6 rounded-2xl px-4 py-3">
            <span className="text-sm font-medium text-foreground truncate max-w-[260px]">
              {user?.fullName ?? 'Comprador'}
            </span>
            <MessageBell />
            <NotificationBell />
            <NewsAccessButton />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default BuyerLayout;
