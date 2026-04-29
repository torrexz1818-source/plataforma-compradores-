import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Building2, FileText, MessageCircle, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getNotificationsV2,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/api';
import { getNotificationUrl } from '@/lib/notificationRouter';
import { NotificationItem } from '@/types';

const iconMap: Record<string, React.ElementType> = {
  Building2,
  MessageCircle,
  FileText,
  Star,
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement | null>(null);

  const formattedCount = useMemo(() => {
    if (count > 99) return '99+';
    return String(count);
  }, [count]);

  const refreshCount = async () => {
    try {
      const data = await getUnreadNotificationsCount();
      setCount(data.count);
    } catch {
      // noop
    }
  };

  const refreshDropdown = async () => {
    try {
      const data = await getNotificationsV2({ isRead: false, limit: 5 });
      setItems(data);
    } catch {
      // noop
    }
  };

  useEffect(() => {
    void refreshCount();
    const id = window.setInterval(() => {
      void refreshCount();
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshDropdown();
  }, [open]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const onOpenAll = () => {
    setOpen(false);
    navigate('/notificaciones');
  };

  const onOpenItem = async (item: NotificationItem) => {
    try {
      await markNotificationAsRead(item.id);
    } catch {
      // noop
    }
    setOpen(false);
    await refreshCount();
    navigate(getNotificationUrl(item));
  };

  const onReadAll = async () => {
    try {
      await markAllNotificationsAsRead();
      setItems([]);
      setCount(0);
    } catch {
      // noop
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors sm:h-10 sm:w-10 sm:rounded-md ${
          open
            ? 'border-[#0E109E]/35 bg-[#0E109E]/10'
            : 'border-border bg-card hover:bg-[#0E109E]/10 active:bg-[#0E109E]/15'
        }`}
        aria-label="Abrir notificaciones"
      >
        <Bell className="h-5 w-5 text-foreground sm:h-4 sm:w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-white text-[10px] font-medium flex items-center justify-center">
            {formattedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-50 max-h-[min(70dvh,520px)] overflow-hidden rounded-2xl border border-border bg-card shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[min(360px,calc(100vw-1.5rem))]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3">
            <p className="text-sm font-medium text-foreground">Notificaciones</p>
            <button
              type="button"
              onClick={onOpenAll}
              className="shrink-0 text-xs text-primary hover:underline"
            >
              Ver todas
            </button>
          </div>

          <div className="max-h-[calc(min(70dvh,520px)-96px)] overflow-y-auto">
            {items.map((item) => {
              const Icon = iconMap[item.icon] ?? Bell;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void onOpenItem(item)}
                  className="w-full border-b border-border/70 px-3 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground line-clamp-2">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.body ?? item.description}</p>
                    </div>
                    <span className="hidden shrink-0 text-[11px] text-muted-foreground min-[430px]:inline">{item.time}</span>
                  </div>
                </button>
              );
            })}
            {items.length === 0 && (
              <p className="px-3 py-6 text-sm text-muted-foreground text-center">
                No tienes notificaciones no leídas.
              </p>
            )}
          </div>

          <div className="px-3 py-2 border-t border-border">
            <button
              type="button"
              onClick={() => void onReadAll()}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Marcar todas como leídas
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
