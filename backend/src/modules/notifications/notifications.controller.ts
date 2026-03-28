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
  NotificationIcon,
  NotificationsService,
} from './notifications.service';

type NotificationRole = UserRole.BUYER | UserRole.SUPPLIER;

type CreateNotificationBody = {
  icon?: NotificationIcon;
  title?: string;
  description?: string;
  time?: string;
  role?: NotificationRole;
  userId?: string;
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
    @CurrentUser() user: { sub: string },
  ) {
    if (role !== UserRole.BUYER && role !== UserRole.SUPPLIER) {
      throw new BadRequestException(
        'El parametro role debe ser "buyer" o "supplier".',
      );
    }

    return this.notificationsService.listByRole(role, user.sub);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }

  @Post()
  create(@Body() body: CreateNotificationBody) {
    if (
      !body.icon ||
      !body.title ||
      !body.description ||
      !body.time ||
      !body.role
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
      icon: body.icon,
      title: body.title,
      description: body.description,
      time: body.time,
      role: body.role,
      userId: body.userId,
    });
  }
}
