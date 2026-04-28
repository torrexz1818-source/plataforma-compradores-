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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted transition-colors"
        aria-label="Abrir mensajeria"
      >
        <MessageCircle className="w-4 h-4 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] font-medium flex items-center justify-center">
            {formattedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] rounded-2xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Mensajes</p>
              <p className="text-[11px] text-muted-foreground">
                {user?.role === 'supplier' ? 'Conversaciones con compradores' : 'Conversaciones con proveedores'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAll}
              className="text-xs text-primary hover:underline"
            >
              Ver todo
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const name = isBuyerLikeRole(user?.role) ? item.supplierName : item.buyerName;
              const company = isBuyerLikeRole(user?.role) ? item.supplierCompany : item.buyerCompany;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenConversation(item.id)}
                  className="w-full text-left px-4 py-3 border-b border-border/70 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                      {getInitials(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0">{getTimeLabel(item.updatedAt)}</span>
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
