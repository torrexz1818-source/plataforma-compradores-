import { useMemo, useState } from 'react';
import { Bell, Building2, FileText, MessageCircle, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isToday, isYesterday, subDays } from 'date-fns';
import {
  deleteNotification,
  getNotificationsV2,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/api';
import { getNotificationUrl } from '@/lib/notificationRouter';
import { NotificationItem } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const iconMap: Record<string, React.ElementType> = {
  Building2,
  MessageCircle,
  FileText,
  Star,
};

const FILTERS = [
  { key: 'ALL', label: 'Todas' },
  { key: 'UNREAD', label: 'No leídas' },
  { key: 'LIKE', label: 'Likes' },
  { key: 'COMMENT', label: 'Comentarios' },
  { key: 'MESSAGE', label: 'Mensajes' },
  { key: 'NEW_USER', label: 'Nuevos usuarios' },
  { key: 'PROFILE', label: 'Vistas perfil' },
  { key: 'CONTENT', label: 'Contenido' },
  { key: 'REPORT', label: 'Reportes' },
] as const;

function getGroupLabel(dateString?: string) {
  if (!dateString) return 'Este mes';
  const date = new Date(dateString);
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  if (date >= subDays(new Date(), 7)) return 'Esta semana';
  return 'Este mes';
}

function getTypeBadge(type?: string) {
  if (!type) return 'bg-slate-100 text-slate-700';
  if (type.includes('LIKE')) return 'bg-pink-100 text-pink-700';
  if (type.includes('COMMENT') || type.includes('MESSAGE')) return 'bg-blue-100 text-blue-700';
  if (type.includes('NEW_BUYER') || type.includes('NEW_SUPPLIER')) return 'bg-emerald-100 text-emerald-700';
  if (type.includes('PROFILE')) return 'bg-amber-100 text-amber-700';
  if (type.includes('EDUCATIONAL')) return 'bg-green-100 text-green-800';
  if (type.includes('REPORT') || type.includes('MONTHLY')) return 'bg-slate-100 text-slate-700';
  return 'bg-slate-100 text-slate-700';
}

function matchesFilter(item: NotificationItem, filter: string) {
  const type = item.type ?? '';
  const unread = !(item.isRead ?? item.read);

  if (filter === 'UNREAD') return unread;
  if (filter === 'LIKE') return type.includes('LIKE');
  if (filter === 'COMMENT') return type.includes('COMMENT');
  if (filter === 'MESSAGE') return type.includes('MESSAGE') || type.includes('CONVERSATION');
  if (filter === 'NEW_USER') return type.includes('NEW_BUYER') || type.includes('NEW_SUPPLIER');
  if (filter === 'PROFILE') return type.includes('PROFILE');
  if (filter === 'CONTENT') return type.includes('EDUCATIONAL');
  if (filter === 'REPORT') return type.includes('REPORT') || type.includes('MONTHLY');
  return true;
}

const Notifications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const notificationsQuery = useQuery({
    queryKey: ['notifications-v2'],
    queryFn: () => getNotificationsV2({ limit: 200 }),
  });

  const filtered = useMemo(
    () => (notificationsQuery.data ?? []).filter((item) => matchesFilter(item, activeFilter)),
    [notificationsQuery.data, activeFilter],
  );

  const grouped = useMemo(() => {
    const groups: Record<string, NotificationItem[]> = {
      Hoy: [],
      Ayer: [],
      'Esta semana': [],
      'Este mes': [],
    };

    filtered.forEach((item) => {
      groups[getGroupLabel(item.createdAt)].push(item);
    });

    return groups;
  }, [filtered]);

  const markAll = async () => {
    await markAllNotificationsAsRead();
    await queryClient.invalidateQueries({ queryKey: ['notifications-v2'] });
  };

  const onOpen = async (item: NotificationItem) => {
    if (!(item.isRead ?? item.read)) {
      await markNotificationAsRead(item.id);
    }
    await queryClient.invalidateQueries({ queryKey: ['notifications-v2'] });
    navigate(getNotificationUrl(item));
  };

  const onDelete = async (id: string) => {
    await deleteNotification(id);
    await queryClient.invalidateQueries({ queryKey: ['notifications-v2'] });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Notificaciones</h1>
          </div>
          <button
            type="button"
            onClick={() => void markAll()}
            className="text-sm text-primary hover:underline"
          >
            Marcar todas como leídas
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                activeFilter === filter.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {notificationsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Cargando notificaciones...</p>
        )}

        {!notificationsQuery.isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tienes notificaciones por ahora</p>
          </div>
        )}

        {(['Hoy', 'Ayer', 'Esta semana', 'Este mes'] as const).map((group) => (
          grouped[group].length > 0 && (
            <section key={group} className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-2">{group}</h2>
              <div className="space-y-2">
                {grouped[group].map((item) => {
                  const Icon = iconMap[item.icon] ?? Bell;
                  const unread = !(item.isRead ?? item.read);
                  return (
                    <article
                      key={item.id}
                      className={`rounded-lg border px-3 py-3 bg-card hover:bg-muted/50 transition-colors ${
                        (item.type ?? '').includes('REPORT') ? 'border-l-2 border-l-slate-400' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-1">
                          {unread && <span className="block w-2 h-2 rounded-full bg-blue-600" />}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${getTypeBadge(item.type)}`}>
                              {item.type ?? 'SYSTEM'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.body ?? item.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(item.createdAt ?? new Date().toISOString()), { addSuffix: true })}
                          </p>
                          <button
                            type="button"
                            onClick={() => void onOpen(item)}
                            className="text-xs text-primary hover:underline mt-1"
                          >
                            Ver →
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onDelete(item.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Eliminar
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )
        ))}
    </div>
  );
};

export default Notifications;
