import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../users/domain/user-role.enum';
import { UsersService } from '../users/users.service';

type MessageRecord = {
  id: string;
  conversationId?: string;
  senderId: string;
  supplierId: string;
  buyerId?: string;
  publicationId?: string;
  postId?: string;
  message: string;
  createdAt: Date;
};

type ConversationRecord = {
  id: string;
  buyerId: string;
  supplierId: string;
  publicationId?: string;
  createdAt: Date;
  updatedAt: Date;
};

type CreateMessageInput = {
  senderId: string;
  supplierId: string;
  buyerId?: string;
  publicationId?: string;
  postId?: string;
  message: string;
};

type InboxItem = {
  id: string;
  conversationId?: string;
  buyerId: string;
  buyerName: string;
  buyerCompany: string;
  text: string;
  createdAt: string;
  publicationId?: string;
  postId?: string;
  replied: boolean;
  replyText?: string;
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

    const publicationId = data.publicationId ?? data.postId;
    const { conversation } = await this.ensureConversation({
      buyerId,
      supplierId,
      publicationId,
    });

    const record: MessageRecord = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      senderId: sender.id,
      supplierId,
      buyerId,
      publicationId,
      postId: publicationId,
      message: messageText,
      createdAt: new Date(),
    };

    await this.collection().insertOne(record);
    await this.conversationsCollection().updateOne(
      { id: conversation.id },
      { $set: { updatedAt: new Date() } },
    );

    if (sender.role === UserRole.SUPPLIER) {
      this.notificationsService.create({
        icon: 'MessageCircle',
        type: publicationId ? 'MESSAGE_REPLY' : 'MESSAGE_REPLY',
        title: `${sender.fullName} respondio tu mensaje`,
        body: messageText.slice(0, 80),
        entityType: 'message',
        entityId: conversation.id,
        fromUserId: sender.id,
        role: UserRole.BUYER,
        userId: buyer.id,
        url: `/mensajes?conversationId=${conversation.id}`,
        time: 'Ahora',
      });
    } else {
      this.notificationsService.create({
        icon: 'MessageCircle',
        type: publicationId ? 'NEW_MESSAGE' : 'MESSAGE_REPLY',
        title: publicationId
          ? `${buyer.fullName} de ${buyer.company} te envio un mensaje`
          : `${buyer.fullName} respondio tu mensaje`,
        body: messageText.slice(0, 80) || 'Inicio una conversacion contigo',
        entityType: publicationId ? 'publication' : 'message',
        entityId: publicationId ?? conversation.id,
        fromUserId: buyer.id,
        role: UserRole.SUPPLIER,
        userId: supplier.id,
        url: publicationId
          ? `/publicaciones?highlight=${publicationId}&expand=messages`
          : `/mensajes?conversationId=${conversation.id}`,
        time: 'Ahora',
      });
    }

    return {
      id: record.id,
      conversationId: record.conversationId,
      senderId: record.senderId,
      supplierId: record.supplierId,
      buyerId: record.buyerId,
      publicationId: record.publicationId,
      postId: record.postId,
      message: record.message,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async getSupplierInbox(supplierId: string): Promise<InboxItem[]> {
    const supplier = await this.usersService.findSupplierById(supplierId);

    if (!supplier) {
      throw new BadRequestException('Proveedor no encontrado');
    }

    const messages = await this.collection()
      .find({ supplierId })
      .sort({ createdAt: 1 })
      .toArray();

    const incoming = messages.filter(
      (message) => message.buyerId && message.senderId !== supplierId,
    );
    const outgoing = messages.filter(
      (message) => message.buyerId && message.senderId === supplierId,
    );

    const buyerIds = Array.from(
      new Set(incoming.map((message) => message.buyerId).filter((value): value is string => Boolean(value))),
    );
    const buyers = await this.usersService.findManyByIds(buyerIds);
    const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer]));

    return incoming
      .map((message) => {
        const buyerId = message.buyerId as string;
        const buyer = buyerMap.get(buyerId);
        const reply = outgoing
          .filter(
            (item) =>
              item.buyerId === buyerId &&
              (item.publicationId ?? item.postId) === (message.publicationId ?? message.postId) &&
              item.createdAt.getTime() >= message.createdAt.getTime(),
          )
          .slice(-1)[0];

        return {
          id: message.id,
          conversationId: message.conversationId,
          buyerId,
          buyerName: buyer?.fullName ?? 'Comprador',
          buyerCompany: buyer?.company ?? 'Empresa',
          text: message.message,
          createdAt: message.createdAt.toISOString(),
          publicationId: message.publicationId ?? message.postId,
          postId: message.postId,
          replied: Boolean(reply),
          replyText: reply?.message,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getConversationByParticipants(data: {
    viewerId: string;
    buyerId: string;
    supplierId: string;
  }) {
    if (data.viewerId !== data.buyerId && data.viewerId !== data.supplierId) {
      throw new ForbiddenException('No autorizado para consultar esta conversacion');
    }

    const conversation = await this.conversationsCollection().findOne({
      buyerId: data.buyerId,
      supplierId: data.supplierId,
    });

    if (!conversation) {
      return null;
    }

    return this.mapConversationSummary(conversation);
  }

  async createConversation(data: {
    viewerId: string;
    toUserId: string;
    publicationId?: string;
  }) {
    const viewer = await this.usersService.requireActiveUser(data.viewerId);
    const target = await this.usersService.requireActiveUser(data.toUserId);

    if (viewer.role === target.role) {
      throw new BadRequestException('La conversacion debe ser entre comprador y proveedor');
    }

    const buyerId = viewer.role === UserRole.BUYER ? viewer.id : target.id;
    const supplierId = viewer.role === UserRole.SUPPLIER ? viewer.id : target.id;

    const { conversation, isNew } = await this.ensureConversation({
      buyerId,
      supplierId,
      publicationId: data.publicationId,
    });

    if (isNew) {
      const [buyer, supplier] = await Promise.all([
        this.usersService.findBuyerById(conversation.buyerId),
        this.usersService.findSupplierById(conversation.supplierId),
      ]);

      if (buyer && supplier) {
        this.notificationsService.create({
          icon: 'MessageCircle',
          type: 'NEW_CONVERSATION',
          title: `${buyer.fullName} de ${buyer.company} quiere contactarte`,
          body: 'Inicio una conversacion contigo',
          entityType: 'message',
          entityId: conversation.id,
          fromUserId: buyer.id,
          role: UserRole.SUPPLIER,
          userId: supplier.id,
          url: `/mensajes?conversationId=${conversation.id}`,
          time: 'Ahora',
        });
      }
    }

    return this.mapConversationSummary(conversation);
  }

  async listConversations(viewerId: string) {
    const viewer = await this.usersService.requireActiveUser(viewerId);
    const filter =
      viewer.role === UserRole.BUYER
        ? { buyerId: viewer.id }
        : viewer.role === UserRole.SUPPLIER
          ? { supplierId: viewer.id }
          : null;

    if (!filter) {
      return [];
    }

    const conversations = await this.conversationsCollection()
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();

    return Promise.all(conversations.map((item) => this.mapConversationSummary(item)));
  }

  async listConversationMessages(conversationId: string, viewerId: string) {
    const conversation = await this.requireConversationAccess(conversationId, viewerId);
    const messages = await this.collection()
      .find({ conversationId: conversation.id })
      .sort({ createdAt: 1 })
      .toArray();

    return messages.map((message) => ({
      id: message.id,
      conversationId: conversation.id,
      senderId: message.senderId,
      text: message.message,
      createdAt: message.createdAt.toISOString(),
    }));
  }

  async sendConversationMessage(data: {
    conversationId: string;
    viewerId: string;
    message: string;
  }) {
    const conversation = await this.requireConversationAccess(data.conversationId, data.viewerId);
    return this.create({
      senderId: data.viewerId,
      supplierId: conversation.supplierId,
      buyerId: conversation.buyerId,
      publicationId: conversation.publicationId,
      message: data.message,
    });
  }

  private async ensureConversation(data: {
    buyerId: string;
    supplierId: string;
    publicationId?: string;
  }): Promise<{ conversation: ConversationRecord; isNew: boolean }> {
    const existing = await this.conversationsCollection().findOne({
      buyerId: data.buyerId,
      supplierId: data.supplierId,
    });

    if (existing) {
      return { conversation: existing, isNew: false };
    }

    const now = new Date();
    const conversation: ConversationRecord = {
      id: crypto.randomUUID(),
      buyerId: data.buyerId,
      supplierId: data.supplierId,
      publicationId: data.publicationId,
      createdAt: now,
      updatedAt: now,
    };

    await this.conversationsCollection().insertOne(conversation);
    return { conversation, isNew: true };
  }

  private async requireConversationAccess(conversationId: string, viewerId: string) {
    const conversation = await this.conversationsCollection().findOne({ id: conversationId });
    if (!conversation) {
      throw new NotFoundException('Conversacion no encontrada');
    }

    if (conversation.buyerId !== viewerId && conversation.supplierId !== viewerId) {
      throw new ForbiddenException('No autorizado para acceder a esta conversacion');
    }

    return conversation;
  }

  private async mapConversationSummary(conversation: ConversationRecord) {
    const [buyer, supplier] = await Promise.all([
      this.usersService.findBuyerById(conversation.buyerId),
      this.usersService.findSupplierById(conversation.supplierId),
    ]);
    const lastMessage = await this.collection()
      .find({ conversationId: conversation.id })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    return {
      id: conversation.id,
      buyerId: conversation.buyerId,
      supplierId: conversation.supplierId,
      publicationId: conversation.publicationId,
      buyerName: buyer?.fullName ?? 'Comprador',
      buyerCompany: buyer?.company ?? 'Empresa',
      supplierName: supplier?.fullName ?? 'Proveedor',
      supplierCompany: supplier?.company ?? 'Empresa',
      supplierSector: supplier?.sector ?? 'General',
      lastMessage: lastMessage[0]?.message ?? '',
      updatedAt: conversation.updatedAt.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
    };
  }

  private collection() {
    return this.databaseService.collection<MessageRecord>('messages');
  }

  private conversationsCollection() {
    return this.databaseService.collection<ConversationRecord>('conversations');
  }
}
