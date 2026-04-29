import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getConversations } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ConversationSummary } from '@/types';
import { toast } from '@/components/ui/sonner';
import { isBuyerLikeRole } from '@/lib/roles';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getTimeLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    return 'Ahora';
  }

  if (diffHours < 24) {
    return `Hace ${diffHours}h`;
  }

  if (diffDays < 7) {
    return `Hace ${diffDays}d`;
  }

  return date.toLocaleDateString();
}

const MessageBell = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [lastUnreadCount, setLastUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => items.reduce((total, item) => total + (item.unreadCount ?? 0), 0),
    [items],
  );
  const formattedCount = useMemo(() => {
    if (unreadCount > 99) return '99+';
    return String(unreadCount);
  }, [unreadCount]);

  const refreshDropdown = async () => {
    try {
      const data = await getConversations();
      setItems(data.slice(0, 6));
      const nextUnreadCount = data.reduce((total, item) => total + (item.unreadCount ?? 0), 0);
      if (lastUnreadCount > 0 && nextUnreadCount > lastUnreadCount) {
        toast('Tienes mensajes nuevos', {
          description: 'Abre mensajeria para responderlos.',
        });
      }
      setLastUnreadCount(nextUnreadCount);
    } catch {
      // noop
    }
  };

  useEffect(() => {
    void refreshDropdown();
    const id = window.setInterval(() => {
      void refreshDropdown();
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

  const onOpenConversation = (conversationId: string) => {
    setOpen(false);
    navigate(`/mensajes?conversationId=${conversationId}`);
  };

  const onOpenAll = () => {
    setOpen(false);
    navigate('/mensajes');
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
        aria-label="Abrir mensajeria"
      >
        <MessageCircle className="h-5 w-5 text-foreground sm:h-4 sm:w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center">
            {formattedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-50 max-h-[min(70dvh,520px)] overflow-hidden rounded-2xl border border-border bg-card shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[min(380px,calc(100vw-1.5rem))]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Mensajes</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.role === 'supplier' ? 'Conversaciones con compradores' : 'Conversaciones con proveedores'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAll}
              className="shrink-0 text-xs text-primary hover:underline"
            >
              Ver todo
            </button>
          </div>

          <div className="max-h-[calc(min(70dvh,520px)-72px)] overflow-y-auto">
            {items.map((item) => {
              const currentUserIsBuyer = isBuyerLikeRole(user?.role);
              const name = currentUserIsBuyer ? item.supplierName : item.buyerName;
              const company = currentUserIsBuyer ? item.supplierCompany : item.buyerCompany;
              const avatarClass = currentUserIsBuyer
                ? 'bg-success/20 text-success-foreground'
                : 'bg-destructive/10 text-destructive';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenConversation(item.id)}
                  className="w-full border-b border-border/70 px-3 py-3 text-left transition-colors hover:bg-muted/60 sm:px-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium ${avatarClass}`}>
                      {getInitials(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        <span className="hidden shrink-0 text-[11px] text-muted-foreground min-[430px]:inline">{getTimeLabel(item.updatedAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{company}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={`text-xs truncate ${item.unreadCount > 0 ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
                          {item.lastMessage || 'Abrir conversacion'}
                        </p>
                        {item.unreadCount > 0 && (
                          <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center">
                            {item.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {items.length === 0 && (
              <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                Aun no tienes conversaciones activas.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBell;
