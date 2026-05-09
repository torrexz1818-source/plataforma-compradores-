import { Link, Outlet, useLocation } from 'react-router-dom';
import MessageBell from '@/components/MessageBell';
import NotificationBell from '@/components/NotificationBell';
import UserMenu from '@/components/UserMenu';

const NewsLayout = () => {
  const location = useLocation();
  const shouldShowTopbar = location.pathname !== '/inicio' && location.pathname !== '/supplier/inicio';

  return (
  <div className="min-h-screen w-full max-w-full bg-[var(--gradient-soft)]">
    {shouldShowTopbar && (
    <div className="sticky top-0 z-20 mb-6 flex w-full bg-[var(--gradient-soft)]/95 px-[clamp(12px,4vw,20px)] py-3 backdrop-blur sm:px-6">
      <div className="topbar-shell flex w-full min-w-0 items-center justify-between gap-2 rounded-none px-3 py-3 sm:gap-3 sm:px-4">
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
    <Outlet />
  </div>
  );
};

export default NewsLayout;
