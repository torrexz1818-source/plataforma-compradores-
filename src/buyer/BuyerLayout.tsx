import { Bell, Building2, FileText, LayoutDashboard, LogOut, MessageCircle, Users } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const navItems = [
  { to: '/buyer/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/buyer/directory', label: 'Directorio', icon: Building2 },
  { to: '/buyer/sale', label: 'Sale', icon: FileText },
  { to: '/community', label: 'Comunidad', icon: MessageCircle },
  { to: '/notifications', label: 'Notificaciones', icon: Bell },
];

const BuyerLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-72 bg-[#0f2a5e] text-white flex flex-col">
        <div className="px-6 py-6 border-b border-white/15">
          <p className="text-xl font-bold tracking-tight">SupplyConnect</p>
          <span className="inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/25 border border-blue-300/40">
            <Users className="w-3 h-3" />
            Comprador
          </span>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.to)
                  ? 'bg-white text-[#0f2a5e]'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/15">
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

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default BuyerLayout;
