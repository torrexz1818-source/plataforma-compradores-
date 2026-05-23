import { ElementType, useEffect, useState } from 'react';
import { BookOpen, Bot, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, FileText, LayoutDashboard, LogOut, Menu, MessageCircle, Newspaper, Shield, Store, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import NotificationBell from '@/components/NotificationBell';
import MessageBell from '@/components/MessageBell';
import UserMenu from '@/components/UserMenu';
import { BuyerNodusBrand } from '@/components/BuyerNodusBrand';
import { isBuyerLikeRole } from '@/lib/roles';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const buyerNavItems = [
  { to: '/buyer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/novedades', label: 'Novedades', icon: Newspaper },
  { to: '/community', label: 'Inteligencia colectiva', icon: MessageCircle },
  {
    to: '/contenido-educativo',
    label: 'Contenido Educativo',
    icon: BookOpen,
    children: [
      { to: '/empleabilidad', label: 'Empleabilidad', icon: BriefcaseBusiness },
      { to: '/nexu-experts', label: 'Nodus Experts', icon: Users },
    ],
  },
  { to: '/buyer/sale', label: 'Ofertas y requerimientos', icon: FileText },
  { to: '/nexu-ia', label: 'Nodus IA', icon: Bot },
  { to: '/buyer/directory', label: 'Directorio de proveedores', icon: Building2 },
];

const supplierNavItems = [
  { to: '/supplier/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/novedades', label: 'Novedades', icon: Newspaper },
  { to: '/supplier/directory', label: 'Directorio de compradores', icon: Building2 },
  { to: '/publicaciones', label: 'Publicaciones', icon: FileText },
];

const SIDEBAR_DESKTOP_WIDTH = 'w-72';
const SIDEBAR_MINI_WIDTH = 'w-20';
const MAIN_DESKTOP_OFFSET = 'lg:ml-72';
const MAIN_MINI_OFFSET = 'lg:ml-20';
const MOBILE_DRAWER_WIDTH = '!w-[min(92dvw,360px)] max-[430px]:!w-[min(90dvw,350px)]';

type SidebarNavItem = {
  to: string;
  label: string;
  icon: ElementType;
  children?: SidebarNavItem[];
};

const BuyerLayout = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [compradorOpen, setCompradorOpen] = useState(false);
  const [proveedorOpen, setProveedorOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const shouldShowTopbar = location.pathname !== '/inicio' && location.pathname !== '/supplier/inicio';
  const roleBadge = isAdmin
    ? {
        label: 'Administrador',
        icon: Shield,
        className: 'bg-destructive/20 border border-destructive/30 text-white/90',
      }
    : user?.role === 'expert'
      ? {
          label: 'Experto Nodus',
          icon: Users,
          className: 'bg-secondary/20 border border-secondary/30 text-white/90',
        }
    : {
        label: 'Comprador',
        icon: Users,
        className: 'bg-destructive/20 border border-destructive/30 text-white/90',
      };
  const adminBuyerItems = buyerNavItems;
  const adminSupplierItems = supplierNavItems.filter((item) => item.to !== '/novedades');

  const navSections = isAdmin
    ? [
        {
          title: 'Administrador',
          items: [
            { to: '/admin/dashboard', label: 'Panel administrativo', icon: LayoutDashboard },
            { to: '/novedades', label: 'Novedades', icon: Newspaper },
          ],
        },
        { title: 'Comprador', items: adminBuyerItems },
        { title: 'Proveedor', items: adminSupplierItems },
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

  useEffect(() => {
    const applyResponsiveSidebarState = () => {
      const isTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches;
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

      if (isTablet) {
        setCollapsed(true);
      } else if (isDesktop) {
        setCollapsed(false);
      }
    };

    applyResponsiveSidebarState();
    window.addEventListener('resize', applyResponsiveSidebarState);

    return () => window.removeEventListener('resize', applyResponsiveSidebarState);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const renderNavItem = (
    item: SidebarNavItem,
    onNavigate?: () => void,
    isCollapsed = false,
    nested = false,
  ) => (
    item.children ? (
      <div key={item.label} className="space-y-1">
        <NavLink
          to={item.to}
          onClick={onNavigate}
          title={isCollapsed ? item.label : undefined}
          className={`flex min-h-11 items-center rounded-lg py-2 text-sm font-medium transition-colors ${isCollapsed ? 'justify-center px-2' : `gap-3 px-3 ${nested ? 'ml-4' : ''}`} ${
            isActive(item.to)
              ? 'sidebar-link-active'
              : 'sidebar-link'
          }`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="min-w-0 truncate">{item.label}</span>}
        </NavLink>
        <div className={cn('space-y-1', isCollapsed ? 'mt-1' : 'ml-4 border-l border-white/10 pl-3')}>
          {item.children.map((child) => renderNavItem(child, onNavigate, isCollapsed))}
        </div>
      </div>
    ) : (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        title={isCollapsed ? item.label : undefined}
        className={`flex min-h-11 items-center rounded-lg py-2 text-sm font-medium transition-colors ${isCollapsed ? 'justify-center px-2' : `gap-3 px-3 ${nested ? 'ml-4' : ''}`} ${
          isActive(item.to)
            ? 'sidebar-link-active'
            : 'sidebar-link'
        }`}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!isCollapsed && <span className="min-w-0 truncate">{item.label}</span>}
      </NavLink>
    )
  );

  const renderNavSection = (
    section: { title: string; items: SidebarNavItem[] },
    onNavigate?: () => void,
    isCollapsed = false,
  ) => {
    const isBuyerSection = section.title === 'Comprador';
    const isSupplierSection = section.title === 'Proveedor';
    const isCollapsibleSection = isAdmin && (isBuyerSection || isSupplierSection);

    if (!isCollapsibleSection) {
      return (
        <div key={section.title || 'default'} className="space-y-0.5">
          {section.title && !isCollapsed && (
            <p className="px-3 pb-1 text-[11px] uppercase tracking-wide text-white/55">
              {section.title}
            </p>
          )}
          {section.items.map((item) => renderNavItem(item, onNavigate, isCollapsed))}
        </div>
      );
    }

    const open = isBuyerSection ? compradorOpen : proveedorOpen;
    const setOpen = isBuyerSection ? setCompradorOpen : setProveedorOpen;
    const GroupIcon = isBuyerSection ? Users : Store;
    const hasActiveItem = section.items.some((item) => (
      isActive(item.to) || item.children?.some((child) => isActive(child.to))
    ));

    return (
      <div key={section.title} className="space-y-0.5">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          title={isCollapsed ? section.title : undefined}
          className={cn(
            'flex min-h-11 w-full items-center rounded-lg py-2 text-sm font-medium transition-colors',
            isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
            hasActiveItem ? 'sidebar-link-active' : 'sidebar-link',
          )}
        >
          <GroupIcon className="h-4 w-4 shrink-0" />
          {!isCollapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-left">{section.title}</span>
              <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-90')} />
            </>
          )}
        </button>
        <div
          className={cn(
            'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out',
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0 space-y-1">
            {section.items.map((item) => renderNavItem(item, onNavigate, isCollapsed, !isCollapsed))}
          </div>
        </div>
      </div>
    );
  };

  const renderSidebarContent = (onNavigate?: () => void, isCollapsed = false) => (
    <>
      <div className={cn('border-b border-white/15 py-4', isCollapsed ? 'px-2 text-center' : 'px-4')}>
        <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'justify-between gap-3')}>
          <BuyerNodusBrand collapsed={isCollapsed} />
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/20 text-white/90 transition-colors hover:bg-white/10 md:inline-flex"
            aria-label={isCollapsed ? 'Expandir menú' : 'Achicar menú'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <span className={cn('mt-3 items-center gap-1 rounded-full text-xs font-medium', roleBadge.className, isCollapsed ? 'inline-flex px-2 py-2' : 'inline-flex px-2.5 py-1')}>
          <roleBadge.icon className="w-3 h-3" />
          {!isCollapsed && roleBadge.label}
        </span>
      </div>

      <nav className={cn('flex-1 space-y-2 overflow-y-auto py-3', isCollapsed ? 'px-2' : 'px-3')}>
        {navSections.map((section) => renderNavSection(section, onNavigate, isCollapsed))}
      </nav>

    </>
  );

  return (
    <div className="h-[100dvh] w-full max-w-full app-shell overflow-hidden">
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 hidden h-[100dvh] max-h-[100dvh] flex-col overflow-hidden sidebar-shell lg:flex',
          collapsed ? SIDEBAR_MINI_WIDTH : SIDEBAR_DESKTOP_WIDTH,
        )}
        style={{ transition: 'width 0.25s ease' }}
      >
        {renderSidebarContent(undefined, collapsed)}
      </aside>

      <main
        className={cn(
          'ml-0 h-[100dvh] min-w-0 max-w-full overflow-x-hidden overflow-y-auto',
          collapsed ? MAIN_MINI_OFFSET : MAIN_DESKTOP_OFFSET,
        )}
        style={{ transition: 'margin 0.25s ease' }}
      >
        {shouldShowTopbar && (
        <div className="sticky top-0 z-20 w-full bg-[var(--gradient-soft)]/95 px-[clamp(12px,4vw,20px)] py-3 backdrop-blur sm:px-6">
          <div className="topbar-shell flex w-full min-w-0 items-center justify-between gap-2 rounded-none px-3 py-3 sm:gap-3 sm:px-4">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted lg:hidden"
                    aria-label="Abrir menú"
                    aria-haspopup="true"
                    aria-expanded={mobileMenuOpen}
                    aria-controls="buyer-mobile-menu"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  id="buyer-mobile-menu"
                  side="left"
                  className={cn(
                    'sidebar-shell !fixed !inset-y-0 !left-0 flex !h-[100dvh] !max-h-[100dvh] flex-col overflow-y-auto !border-r-0 !bg-[var(--sidebar-bg)] p-0 !text-white',
                    MOBILE_DRAWER_WIDTH,
                  )}
                >
                  <SheetTitle className="sr-only">Menu principal</SheetTitle>
                  {renderSidebarContent(() => setMobileMenuOpen(false), false)}
                </SheetContent>
              </Sheet>
              <Link
                to="/inicio"
                className="min-w-0 flex-1 truncate text-base font-bold text-primary sm:text-xl lg:text-2xl"
              >
                ¿Qué quieres hacer hoy en el ecosistema?
              </Link>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <MessageBell />
              <NotificationBell />
              <UserMenu />
              </div>
          </div>
        </div>
        )}
        <div className="mx-auto w-full max-w-7xl min-w-0 px-[clamp(12px,4vw,20px)] pb-6 pt-3 sm:px-6 2xl:max-w-[1440px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default BuyerLayout;
