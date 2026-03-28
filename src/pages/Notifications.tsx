import { Bell, MessageCircle, Building2, Star, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import { deleteNotification, getNotifications, markNotificationAsRead } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { NotificationItem } from '@/types';

interface Notification {
  id: string;
  icon: React.ElementType;
  iconName: NotificationItem['icon'];
  title: string;
  description: string;
  time: string;
  read: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  Building2,
  MessageCircle,
  FileText,
  Star,
};

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const role = user?.role === 'supplier' ? 'supplier' : 'buyer';
        const data = await getNotifications(role);

        // Map icon string names back to actual components
        const mapped: Notification[] = data.map(
          (n) => ({
            ...n,
            iconName: n.icon,
            icon: iconMap[n.icon] ?? Bell,
          })
        );

        setNotifications(mapped);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [user?.role]);

  const markAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // Silently ignore mark-as-read errors
    }
  };

  const removeNotification = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Silently ignore delete errors
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Notificaciones</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-6">
            Mantente al día con tu actividad.
          </p>
        </motion.div>

        {loading && (
          <p className="text-sm text-muted-foreground">Cargando notificaciones...</p>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && (
          <div className="space-y-2">
            {notifications.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => !n.read && markAsRead(n.id)}
                className={`flex items-start gap-3 p-4 rounded-lg transition-colors cursor-pointer ${
                  n.read
                    ? 'bg-card'
                    : 'bg-primary/5 border border-primary/10'
                } hover:bg-muted`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    n.read ? 'bg-muted' : 'gradient-primary'
                  }`}
                >
                  <n.icon
                    className={`w-4 h-4 ${
                      n.read ? 'text-muted-foreground' : 'text-primary-foreground'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${
                      n.read ? 'text-foreground' : 'text-foreground font-semibold'
                    }`}
                  >
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {n.time}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void removeNotification(n.id);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Eliminar
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Notifications;
