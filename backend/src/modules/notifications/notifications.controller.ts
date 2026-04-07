import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { UserRole } from '../users/domain/user-role.enum';
import {
  NotificationEntityType,
  NotificationIcon,
  NotificationType,
  NotificationsService,
} from './notifications.service';

type NotificationRole = UserRole.BUYER | UserRole.SUPPLIER;

type CreateNotificationBody = {
  icon?: NotificationIcon;
  type?: NotificationType;
  title?: string;
  body?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  fromUserId?: string;
  time?: string;
  role?: NotificationRole;
  userId?: string;
  url?: string;
};

const VALID_ICONS: NotificationIcon[] = [
  'Building2',
  'MessageCircle',
  'FileText',
  'Star',
];

@Controller('notifications')
@UseGuards(AuthenticatedGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Query('role') role: string | undefined,
    @Query('isRead') isRead: string | undefined,
    @Query('type') type: NotificationType | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @CurrentUser() user: { sub: string },
  ) {
    if (role && role !== UserRole.BUYER && role !== UserRole.SUPPLIER) {
      throw new BadRequestException(
        'El parametro role debe ser "buyer" o "supplier".',
      );
    }

    const parsedIsRead =
      typeof isRead === 'string'
        ? isRead === 'true'
          ? true
          : isRead === 'false'
            ? false
            : undefined
        : undefined;

    return this.notificationsService.listByUser(user.sub, {
      isRead: parsedIsRead,
      type,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.unreadCount(user.sub);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.notificationsService.remove(id, user.sub);
  }

  @Post()
  create(@Body() body: CreateNotificationBody) {
    if (
      !body.icon ||
      !body.title ||
      !body.role ||
      !body.userId
    ) {
      throw new BadRequestException('Faltan campos requeridos.');
    }

    if (body.role !== UserRole.BUYER && body.role !== UserRole.SUPPLIER) {
      throw new BadRequestException(
        'El campo role debe ser "buyer" o "supplier".',
      );
    }

    if (!VALID_ICONS.includes(body.icon)) {
      throw new BadRequestException(
        'Icon invalido. Valores permitidos: Building2, MessageCircle, FileText, Star.',
      );
    }

    return this.notificationsService.create({
      userId: body.userId,
      icon: body.icon,
      type: body.type,
      title: body.title,
      body: body.body,
      entityType: body.entityType,
      entityId: body.entityId,
      fromUserId: body.fromUserId,
      time: body.time,
      role: body.role,
      url: body.url,
    });
  }
}
