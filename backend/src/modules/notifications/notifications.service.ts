import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../users/domain/user-role.enum';

export type NotificationIcon =
  | 'Building2'
  | 'MessageCircle'
  | 'FileText'
  | 'Star';

export type NotificationType =
  | 'LIKE_PUBLICATION'
  | 'COMMENT_PUBLICATION'
  | 'NEW_MESSAGE'
  | 'NEW_CONVERSATION'
  | 'MESSAGE_REPLY'
  | 'NEW_BUYER'
  | 'NEW_SUPPLIER'
  | 'PROFILE_VIEW'
  | 'NEW_EDUCATIONAL_CONTENT'
  | 'REVIEW_RECEIVED'
  | 'MONTHLY_REPORT'
  | 'SYSTEM';

export type NotificationEntityType =
  | 'publication'
  | 'message'
  | 'user'
  | 'report'
  | 'content'
  | 'review';

type NotificationRole = UserRole.BUYER | UserRole.SUPPLIER;

export type NotificationRecord = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  fromUserId?: string;
  icon: NotificationIcon;
  time: string;
  isRead: boolean;
  role: NotificationRole;
  url?: string;
  createdAt: string;
};

type PublicNotification = Omit<NotificationRecord, 'role'>;

type CreateNotificationData = {
  userId: string;
  type?: NotificationType;
  title: string;
  body?: string;
  description?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  fromUserId?: string;
  icon: NotificationIcon;
  role: NotificationRole;
  time?: string;
  url?: string;
};

type CreateNotificationsForUsersData = Omit<CreateNotificationData, 'userId'> & {
  userIds: string[];
};

@Injectable()
export class NotificationsService {
  private notifications: NotificationRecord[] = [];

  listByRole(role: NotificationRole, userId?: string): PublicNotification[] {
    if (!userId) {
      return [];
    }

    return this.notifications
      .filter(
        (notification) =>
          notification.role === role &&
          notification.userId === userId,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(({ role: _role, ...notification }) => notification);
  }

  listByUser(
    userId: string,
    filters?: { isRead?: boolean; type?: NotificationType; limit?: number; offset?: number },
  ): PublicNotification[] {
    const base = this.notifications
      .filter((notification) => notification.userId === userId)
      .filter((notification) =>
        typeof filters?.isRead === 'boolean' ? notification.isRead === filters.isRead : true,
      )
      .filter((notification) => (filters?.type ? notification.type === filters.type : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const offset = Math.max(0, filters?.offset ?? 0);
    const limit = Math.max(1, filters?.limit ?? 100);

    return base
      .slice(offset, offset + limit)
      .map(({ role: _role, ...notification }) => notification);
  }

  unreadCount(userId: string): { count: number } {
    const count = this.notifications.filter(
      (notification) => notification.userId === userId && !notification.isRead,
    ).length;
    return { count };
  }

  markAsRead(id: string, userId: string): { success: true; id: string } {
    const notification = this.notifications.find((item) => item.id === id && item.userId === userId);

    if (!notification) {
      throw new NotFoundException('Notificacion no encontrada.');
    }

    notification.isRead = true;
    return { success: true, id };
  }

  markAllAsRead(userId: string): { success: true; updated: number } {
    let updated = 0;
    this.notifications.forEach((notification) => {
      if (notification.userId === userId && !notification.isRead) {
        notification.isRead = true;
        updated += 1;
      }
    });

    return { success: true, updated };
  }

  remove(id: string, userId: string): { success: true; id: string } {
    const index = this.notifications.findIndex((item) => item.id === id && item.userId === userId);

    if (index === -1) {
      throw new NotFoundException('Notificacion no encontrada.');
    }

    this.notifications.splice(index, 1);
    return { success: true, id };
  }

  create(data: CreateNotificationData): NotificationRecord {
    const createdAt = new Date().toISOString();
    const notification: NotificationRecord = {
      id: crypto.randomUUID(),
      userId: data.userId,
      type: data.type ?? 'SYSTEM',
      title: data.title,
      body: data.body ?? data.description ?? '',
      entityType: data.entityType,
      entityId: data.entityId,
      fromUserId: data.fromUserId,
      icon: data.icon,
      time: data.time ?? 'Ahora',
      role: data.role,
      url: data.url,
      isRead: false,
      createdAt,
    };

    this.notifications.push(notification);
    return notification;
  }

  createForUsers(data: CreateNotificationsForUsersData): NotificationRecord[] {
    const userIds = Array.from(new Set(data.userIds.filter(Boolean)));

    if (!userIds.length) {
      return [];
    }

    return userIds.map((userId) =>
      this.create({
        userId,
        type: data.type,
        title: data.title,
        body: data.body,
        description: data.description,
        entityType: data.entityType,
        entityId: data.entityId,
        fromUserId: data.fromUserId,
        icon: data.icon,
        role: data.role,
        time: data.time,
        url: data.url,
      }),
    );
  }

  exists(filters: { userId: string; type: NotificationType; entityId?: string }): boolean {
    return this.notifications.some(
      (notification) =>
        notification.userId === filters.userId &&
        notification.type === filters.type &&
        (filters.entityId ? notification.entityId === filters.entityId : true),
    );
  }
}
