import { BookOpen, Bot, BriefcaseBusiness, Building2, FileText, Home, LogOut, Newspaper, Shield, Users } from 'lucide-react';
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

const buyerNavItems = [
  { title: 'Dashboard', url: '/buyer/dashboard', icon: Home },
  { title: 'Comunidad', url: '/community', icon: Users },
  { title: 'Contenido Educativo', icon: BookOpen },
  { title: 'Empleabilidad', url: '/empleabilidad', icon: BriefcaseBusiness, indent: true },
  { title: 'Nodus Experts', url: '/nexu-experts', icon: Users, indent: true },
  { title: 'Oportunidades de stock', url: '/buyer/sale', icon: FileText },
  { title: 'Nodus IA', url: '/nexu-ia', icon: Bot },
  { title: 'Directorio de proveedores', url: '/buyer/directory', icon: Building2 },
];

const supplierNavItems = [
  { title: 'Dashboard', url: '/supplier/dashboard', icon: Home },
  { title: 'Directorio compradores', url: '/supplier/directory', icon: Building2 },
  { title: 'Publicaciones', url: '/publicaciones', icon: Newspaper },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const baseItems = user?.role === 'supplier' ? supplierNavItems : buyerNavItems;
  const isActive = (path: string) => location.pathname === path;
  const items = user?.role === 'admin'
    ? [
        { title: 'Administrador', grouped: [{ title: 'Panel administrativo', url: '/admin/dashboard', icon: Shield }] },
        { title: 'Comprador', grouped: buyerNavItems },
        { title: 'Proveedor', grouped: supplierNavItems },
      ]
    : [{ title: '', grouped: baseItems }];

  const initials = user?.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2) ?? 'SC';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="bg-sidebar">
        <div className={`p-4 ${collapsed ? 'px-2' : 'px-5'}`}>
          <h1 className={`font-bold text-sidebar-foreground ${collapsed ? 'text-xs text-center' : 'text-lg'}`}>
            {collapsed ? 'BN' : 'BUYER NODUS'}
          </h1>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((section) => (
                <div key={section.title || 'default'} className="space-y-0.5">
                  {section.title && !collapsed && (
                    <p className="px-3 pb-1 text-[11px] uppercase tracking-wide text-sidebar-foreground/60">
                      {section.title}
                    </p>
                  )}
                  {section.grouped.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      {item.url ? (
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.url === '/'}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                              item.indent && !collapsed ? 'ml-4' : ''
                            } ${
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
                      ) : (
                        <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/85">
                          <item.icon className="w-5 h-5" />
                          {!collapsed && <span>{item.title}</span>}
                        </div>
                      )}
                    </SidebarMenuItem>
                  ))}
                </div>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        <div className={`flex items-center gap-3 p-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground text-sm font-medium flex-shrink-0">
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
