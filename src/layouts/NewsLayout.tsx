import { Outlet } from 'react-router-dom';
import HomeAccessButton from '@/components/HomeAccessButton';
import MessageBell from '@/components/MessageBell';
import NotificationBell from '@/components/NotificationBell';

const NewsLayout = () => (
  <div className="min-h-screen w-full max-w-full bg-[var(--gradient-soft)]">
    <div className="sticky top-3 z-40 mx-auto flex w-full max-w-7xl justify-center px-[clamp(12px,4vw,20px)] pt-3 sm:justify-end sm:px-6 sm:pt-6 2xl:max-w-[1440px]">
      <div className="topbar-shell flex w-fit shrink-0 items-center gap-2 rounded-2xl px-3 py-3 sm:gap-3 sm:px-4">
        <MessageBell />
        <NotificationBell />
        <HomeAccessButton />
      </div>
    </div>
    <Outlet />
  </div>
);

export default NewsLayout;
