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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted transition-colors"
      >
        <Bell className="w-4 h-4 text-foreground" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
            {formattedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] rounded-lg border border-border bg-card shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Notificaciones</p>
            <button
              type="button"
              onClick={onOpenAll}
              className="text-xs text-primary hover:underline"
            >
              Ver todas
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {items.map((item) => {
              const Icon = iconMap[item.icon] ?? Bell;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void onOpenItem(item)}
                  className="w-full text-left px-3 py-3 border-b border-border/70 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground line-clamp-2">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{item.body ?? item.description}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{item.time}</span>
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
