import { Home, Users, Shield, LogOut, Bell } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Inicio', url: '/buyer/dashboard', icon: Home },
  { title: 'Comunidad', url: '/community', icon: Users },
  { title: 'Notificaciones', url: '/notifications', icon: Bell },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const homePath = user?.role === 'supplier' ? '/supplier/dashboard' : '/buyer/dashboard';
  const baseItems = navItems.map((item) =>
    item.title === 'Inicio' ? { ...item, url: homePath } : item,
  );
  const isActive = (path: string) => location.pathname === path;
  const items = user?.role === 'admin'
    ? [...baseItems, { title: 'Admin', url: '/admin', icon: Shield }]
    : baseItems;

  const initials = user?.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? 'SC';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar">
        <div className={`p-4 ${collapsed ? 'px-2' : 'px-5'}`}>
          <h1 className={`font-bold text-sidebar-foreground ${collapsed ? 'text-xs text-center' : 'text-lg'}`}>
            {collapsed ? 'SC' : 'SUPPLYCONNECT'}
          </h1>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive(item.url)
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                      }`}
                      activeClassName=""
                    >
                      <item.icon className="w-5 h-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        <div className={`flex items-center gap-3 p-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground text-sm font-semibold flex-shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.fullName ?? 'Invitado'}</p>
            </div>
          )}
        </div>
        {user && (
          <div className={`px-3 pb-3 ${collapsed ? 'flex justify-center' : ''}`}>
            <button
              onClick={logout}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${
                collapsed ? 'justify-center w-10 px-0' : 'w-full'
              }`}
            >
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>Cerrar sesion</span>}
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
