import { NotificationItem } from '@/types';

export function getNotificationUrl(notification: NotificationItem): string {
  if (notification.url) {
    return notification.url;
  }

  const { type, entityId, fromUserId } = notification;
  switch (type) {
    case 'LIKE_PUBLICATION':
      return `/publicaciones?highlight=${entityId}`;
    case 'COMMENT_PUBLICATION':
      return `/publicaciones?highlight=${entityId}&expand=messages`;
    case 'NEW_MESSAGE':
      return `/publicaciones?highlight=${entityId}&expand=messages`;
    case 'NEW_CONVERSATION':
      return `/mensajes?conversationId=${entityId}`;
    case 'MESSAGE_REPLY':
      return `/mensajes?conversationId=${entityId}`;
    case 'NEW_BUYER':
      return `/directorio-compradores?highlight=${entityId}`;
    case 'NEW_SUPPLIER':
      return `/directorio-proveedores?highlight=${entityId}`;
    case 'PROFILE_VIEW':
      return `/perfil/${fromUserId}`;
    case 'NEW_EDUCATIONAL_CONTENT':
      return `/contenido-educativo?highlight=${entityId}`;
    case 'REVIEW_RECEIVED':
      return '/perfil?section=reviews';
    case 'MONTHLY_REPORT':
      return `/reportes?month=${entityId}`;
    default:
      return '/notificaciones';
  }
}
