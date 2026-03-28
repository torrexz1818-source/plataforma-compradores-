import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../users/domain/user-role.enum';
import { UsersService } from '../users/users.service';

type MessageRecord = {
  id: string;
  senderId: string;
  supplierId: string;
  buyerId?: string;
  postId?: string;
  message: string;
  createdAt: Date;
};

type CreateMessageInput = {
  senderId: string;
  supplierId: string;
  buyerId?: string;
  postId?: string;
  message: string;
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(data: CreateMessageInput) {
    const messageText = data.message?.trim();

    if (!messageText) {
      throw new BadRequestException('El mensaje no puede estar vacio');
    }

    const sender = await this.usersService.requireActiveUser(data.senderId);
    let supplierId = data.supplierId;
    let buyerId = data.buyerId;

    if (sender.role === UserRole.SUPPLIER) {
      if (!supplierId) {
        throw new BadRequestException('supplierId es obligatorio para este tipo de mensaje');
      }
      if (sender.id !== supplierId) {
        throw new BadRequestException('supplierId invalido para el emisor actual');
      }

      if (!buyerId) {
        throw new BadRequestException('buyerId es obligatorio para contactar compradores');
      }
    }

    if (sender.role === UserRole.BUYER) {
      buyerId = sender.id;
      if (!supplierId) {
        throw new BadRequestException('supplierId es obligatorio para contactar proveedores');
      }
    }

    if (sender.role === UserRole.ADMIN) {
      throw new BadRequestException('El administrador no puede enviar este tipo de mensaje');
    }

    if (!supplierId || !buyerId) {
      throw new BadRequestException('Los destinatarios del mensaje son invalidos');
    }

    const supplier = await this.usersService.findSupplierById(supplierId);
    if (!supplier) {
      throw new BadRequestException('El proveedor destino no existe');
    }

    const buyer = await this.usersService.findBuyerById(buyerId);
    if (!buyer) {
      throw new BadRequestException('El comprador destino no existe');
    }

    const record: MessageRecord = {
      id: crypto.randomUUID(),
      senderId: sender.id,
      supplierId,
      buyerId,
      postId: data.postId,
      message: messageText,
      createdAt: new Date(),
    };

    await this.collection().insertOne(record);

    if (sender.role === UserRole.SUPPLIER) {
      this.notificationsService.create({
        icon: 'MessageCircle',
        title: 'Un proveedor quiere contactarte',
        description: `${sender.company} envio un mensaje desde el directorio`,
        role: UserRole.BUYER,
        userId: buyer.id,
        time: 'Ahora',
      });
    } else {
      this.notificationsService.create({
        icon: 'MessageCircle',
        title: 'Un comprador quiere contactarte',
        description: `${buyer.company} envio un mensaje desde Estel`,
        role: UserRole.SUPPLIER,
        userId: supplier.id,
        time: 'Ahora',
      });
    }

    return {
      id: record.id,
      senderId: record.senderId,
      supplierId: record.supplierId,
      buyerId: record.buyerId,
      postId: record.postId,
      message: record.message,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private collection() {
    return this.databaseService.collection<MessageRecord>('messages');
  }
}
