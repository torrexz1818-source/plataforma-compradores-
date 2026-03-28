import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../users/domain/user-role.enum';

export type NotificationIcon =
  | 'Building2'
  | 'MessageCircle'
  | 'FileText'
  | 'Star';

type NotificationRole = UserRole.BUYER | UserRole.SUPPLIER;

export type NotificationRecord = {
  id: string;
  icon: NotificationIcon;
  title: string;
  description: string;
  time: string;
  read: boolean;
  role: NotificationRole;
  userId?: string;
};

type PublicNotification = Omit<NotificationRecord, 'role' | 'userId'>;

type CreateNotificationData = Pick<
  NotificationRecord,
  'icon' | 'title' | 'description' | 'role'
> & {
  time?: string;
  userId?: string;
};

@Injectable()
export class NotificationsService {
  private notifications: NotificationRecord[] = [
    {
      id: '1',
      icon: 'Building2',
      title: 'Nuevo proveedor recomendado',
      description: 'TechParts Corp coincide con tu perfil de compras.',
      time: 'Hace 10 min',
      read: false,
      role: UserRole.BUYER,
    },
    {
      id: '2',
      icon: 'MessageCircle',
      title: 'Respuesta a tu comentario',
      description:
        'Maria Lopez respondio en "Mejores practicas de negociacion".',
      time: 'Hace 1h',
      read: false,
      role: UserRole.BUYER,
    },
    {
      id: '3',
      icon: 'FileText',
      title: 'Nueva publicacion de proveedor',
      description:
        'LogiExpress SA publico una actualizacion sobre sus servicios.',
      time: 'Hace 3h',
      read: true,
      role: UserRole.BUYER,
    },
    {
      id: '4',
      icon: 'Star',
      title: 'Resena publicada',
      description: 'Tu resena de MetalWorks Inc ha sido publicada.',
      time: 'Hace 1d',
      read: true,
      role: UserRole.BUYER,
    },
    {
      id: '5',
      icon: 'Star',
      title: 'Nueva interaccion',
      description: 'Un comprador visito tu perfil y guardo tu empresa.',
      time: 'Hace 15 min',
      read: false,
      role: UserRole.SUPPLIER,
    },
    {
      id: '6',
      icon: 'MessageCircle',
      title: 'Nuevo comentario',
      description: 'Carlos Perez comento en tu publicacion.',
      time: 'Hace 2h',
      read: false,
      role: UserRole.SUPPLIER,
    },
    {
      id: '7',
      icon: 'Building2',
      title: 'Lead potencial',
      description:
        'Una empresa de manufactura mostro interes en tus servicios.',
      time: 'Hace 5h',
      read: true,
      role: UserRole.SUPPLIER,
    },
    {
      id: '8',
      icon: 'FileText',
      title: 'Tu publicacion fue compartida',
      description: 'Tu post sobre "Logistica verde" fue compartido 12 veces.',
      time: 'Hace 1d',
      read: true,
      role: UserRole.SUPPLIER,
    },
  ];

  listByRole(role: NotificationRole, userId?: string): PublicNotification[] {
    return this.notifications
      .filter(
        (notification) =>
          notification.role === role &&
          (!notification.userId || (userId && notification.userId === userId)),
      )
      .map(({ role: _role, userId: _userId, ...notification }) => notification);
  }

  markAsRead(id: string): { success: true; id: string } {
    const notification = this.notifications.find((item) => item.id === id);

    if (!notification) {
      throw new NotFoundException('Notificacion no encontrada.');
    }

    notification.read = true;
    return { success: true, id };
  }

  remove(id: string): { success: true; id: string } {
    const index = this.notifications.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException('Notificacion no encontrada.');
    }

    this.notifications.splice(index, 1);
    return { success: true, id };
  }

  create(data: CreateNotificationData): NotificationRecord {
    const notification: NotificationRecord = {
      id: Date.now().toString(),
      icon: data.icon,
      title: data.title,
      description: data.description,
      time: data.time ?? 'Ahora',
      role: data.role,
      userId: data.userId,
      read: false,
    };

    this.notifications.push(notification);
    return notification;
  }
}
