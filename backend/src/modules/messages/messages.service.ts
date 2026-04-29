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
  supplierId?: string;
  buyerId?: string;
  participantIds?: string[];
  publicationId?: string | null;
  postId?: string;
  message: string;
  attachments?: MessageAttachment[];
  readBy: string[];
  createdAt: Date;
};

type MessageAttachment = {
  id: string;
  kind: 'image' | 'file' | 'location' | 'publication' | 'profile';
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
  latitude?: number;
  longitude?: number;
  label?: string;
  publicationId?: string;
  profileId?: string;
  description?: string;
  thumbnailUrl?: string;
};

type ConversationRecord = {
  id: string;
  buyerId: string;
  supplierId: string;
  participantIds?: string[];
  publicationId?: string | null;
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
  attachments?: MessageAttachment[];
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
    const attachments = (data.attachments ?? []).filter((attachment) => Boolean(attachment.kind && attachment.name));

    if (!messageText && attachments.length === 0) {
      throw new BadRequestException('El mensaje no puede estar vacio');
    }

    const sender = await this.usersService.requireActiveUser(data.senderId);
    const supplierId = data.supplierId;
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

    if (this.usersService.isBuyerLikeRole(sender.role)) {
      buyerId = sender.id;
      if (!supplierId) {
        throw new BadRequestException('supplierId es obligatorio para contactar proveedores');
      }
    }

    if (sender.role === UserRole.ADMIN) {
      throw new BadRequestException('El administrador no puede enviar este tipo de mensaje');
    }

    const requiresSensitiveAccess = attachments.some((attachment) =>
      attachment.kind === 'image' || attachment.kind === 'file' || attachment.kind === 'location',
    );

    if (requiresSensitiveAccess) {
      const hasSensitiveAccess = await this.usersService.hasSensitiveAccess(sender.id);
      if (!hasSensitiveAccess) {
        throw new ForbiddenException('Tu membresia activa es obligatoria para enviar fotos, archivos o ubicacion');
      }
    }

    if (!supplierId || !buyerId) {
      throw new BadRequestException('Los destinatarios del mensaje son invalidos');
    }

    const supplier = await this.usersService.findSupplierById(supplierId);
    if (!supplier) {
      throw new BadRequestException('El proveedor destino no existe');
    }

    const buyer = await this.usersService.findBuyerLikeById(buyerId);
    if (!buyer) {
      throw new BadRequestException('El comprador o experto destino no existe');
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
      attachments,
      readBy: [sender.id],
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
      attachments: record.attachments ?? [],
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
    publicationId?: string | null;
  }) {
    if (data.viewerId !== data.buyerId && data.viewerId !== data.supplierId) {
      throw new ForbiddenException('No autorizado para consultar esta conversacion');
    }

    const conversation =
      data.publicationId
        ? await this.conversationsCollection().findOne({
            buyerId: data.buyerId,
            supplierId: data.supplierId,
            publicationId: data.publicationId,
          })
        : await this.conversationsCollection().findOne(
            this.buildGenericConversationFilter(data.buyerId, data.supplierId),
          );

    if (!conversation) {
      return null;
    }

    return this.mapConversationSummary(conversation, data.viewerId);
  }

  async createConversation(data: {
    viewerId: string;
    toUserId: string;
    publicationId?: string | null;
  }) {
    const viewer = await this.usersService.requireActiveUser(data.viewerId);
    const target = await this.usersService.requireActiveUser(data.toUserId);

    if (viewer.role === UserRole.ADMIN || target.role === UserRole.ADMIN) {
      throw new BadRequestException('El administrador no puede participar en este tipo de conversacion');
    }

    const viewerIsBuyerLike = this.usersService.isBuyerLikeRole(viewer.role);
    const targetIsBuyerLike = this.usersService.isBuyerLikeRole(target.role);

    const { conversation, isNew } =
      viewerIsBuyerLike !== targetIsBuyerLike
        ? await this.ensureConversation({
            buyerId: viewerIsBuyerLike ? viewer.id : target.id,
            supplierId: viewer.role === UserRole.SUPPLIER ? viewer.id : target.id,
            publicationId: data.publicationId,
          })
        : await this.ensureGenericConversation({
            participantIds: [viewer.id, target.id],
          });

    if (isNew) {
      const targetNotificationRole = this.toNotificationRole(target.role);
      if (targetNotificationRole) {
        this.notificationsService.create({
          icon: 'MessageCircle',
          type: 'NEW_CONVERSATION',
          title: `${viewer.fullName} de ${viewer.company} quiere contactarte`,
          body: 'Inicio una conversacion contigo',
          entityType: 'message',
          entityId: conversation.id,
          fromUserId: viewer.id,
          role: targetNotificationRole,
          userId: target.id,
          url: `/mensajes?conversationId=${conversation.id}`,
          time: 'Ahora',
        });
      }
    }

    return this.mapConversationSummary(conversation, data.viewerId, { isNew });
  }

  async listConversations(viewerId: string) {
    const viewer = await this.usersService.requireActiveUser(viewerId);
    const filter =
      viewer.role === UserRole.ADMIN
        ? null
        : {
            $or: [
              { buyerId: viewer.id },
              { supplierId: viewer.id },
              { participantIds: viewer.id },
            ],
          };

    if (!filter) {
      return [];
    }

    const conversations = await this.conversationsCollection()
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();

    return Promise.all(conversations.map((item) => this.mapConversationSummary(item, viewerId)));
  }

  async listConversationMessages(conversationId: string, viewerId: string) {
    const conversation = await this.requireConversationAccess(conversationId, viewerId);
    await this.collection().updateMany(
      {
        conversationId: conversation.id,
        senderId: { $ne: viewerId },
        $or: [
          { readBy: { $exists: false } },
          { readBy: { $ne: viewerId } },
        ],
      },
      { $addToSet: { readBy: viewerId } },
    );
    const messages = await this.collection()
      .find({ conversationId: conversation.id })
      .sort({ createdAt: 1 })
      .toArray();

    return messages.map((message) => ({
      id: message.id,
      conversationId: conversation.id,
      senderId: message.senderId,
      text: message.message,
      attachments: message.attachments ?? [],
      isOwn: message.senderId === viewerId,
      isRead: (message.readBy ?? []).includes(viewerId),
      createdAt: message.createdAt.toISOString(),
    }));
  }

  async sendConversationMessage(data: {
    conversationId: string;
    viewerId: string;
    message: string;
    attachments?: MessageAttachment[];
  }) {
    const conversation = await this.requireConversationAccess(data.conversationId, data.viewerId);

    if (conversation.participantIds?.length) {
      return this.createGenericConversationMessage({
        conversation,
        senderId: data.viewerId,
        message: data.message,
        attachments: data.attachments,
      });
    }

    return this.create({
      senderId: data.viewerId,
      supplierId: conversation.supplierId,
      buyerId: conversation.buyerId,
      publicationId: conversation.publicationId ?? undefined,
      message: data.message,
      attachments: data.attachments,
    });
  }

  private async ensureConversation(data: {
    buyerId: string;
    supplierId: string;
    publicationId?: string | null;
  }): Promise<{ conversation: ConversationRecord; isNew: boolean }> {
    const existing = data.publicationId
      ? await this.conversationsCollection().findOne({
          buyerId: data.buyerId,
          supplierId: data.supplierId,
          publicationId: data.publicationId,
        })
      : await this.conversationsCollection().findOne(
          this.buildGenericConversationFilter(data.buyerId, data.supplierId),
        );

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

  private async ensureGenericConversation(data: {
    participantIds: string[];
  }): Promise<{ conversation: ConversationRecord; isNew: boolean }> {
    const participantIds = Array.from(new Set(data.participantIds)).sort();
    const [firstParticipantId, secondParticipantId] = participantIds;

    const existing = await this.conversationsCollection().findOne({
      $or: [
        { participantIds: { $all: participantIds, $size: participantIds.length } },
        this.buildGenericConversationFilter(firstParticipantId, secondParticipantId),
        this.buildGenericConversationFilter(secondParticipantId, firstParticipantId),
      ],
    });

    if (existing) {
      if (!existing.participantIds?.length) {
        await this.conversationsCollection().updateOne(
          { id: existing.id },
          { $set: { participantIds } },
        );
        existing.participantIds = participantIds;
      }

      return { conversation: existing, isNew: false };
    }

    const now = new Date();
    const conversation: ConversationRecord = {
      id: crypto.randomUUID(),
      buyerId: participantIds[0],
      supplierId: participantIds[1],
      participantIds,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.conversationsCollection().insertOne(conversation);
      return { conversation, isNew: true };
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) {
        throw error;
      }

      const fallbackConversation = await this.conversationsCollection().findOne({
        $or: [
          { participantIds: { $all: participantIds, $size: participantIds.length } },
          this.buildGenericConversationFilter(firstParticipantId, secondParticipantId),
          this.buildGenericConversationFilter(secondParticipantId, firstParticipantId),
        ],
      });

      if (!fallbackConversation) {
        throw error;
      }

      if (!fallbackConversation.participantIds?.length) {
        await this.conversationsCollection().updateOne(
          { id: fallbackConversation.id },
          { $set: { participantIds } },
        );
        fallbackConversation.participantIds = participantIds;
      }

      return { conversation: fallbackConversation, isNew: false };
    }
  }

  private async requireConversationAccess(conversationId: string, viewerId: string) {
    const conversation = await this.conversationsCollection().findOne({ id: conversationId });
    if (!conversation) {
      throw new NotFoundException('Conversacion no encontrada');
    }

    const hasGenericAccess = conversation.participantIds?.includes(viewerId);

    if (!hasGenericAccess && conversation.buyerId !== viewerId && conversation.supplierId !== viewerId) {
      throw new ForbiddenException('No autorizado para acceder a esta conversacion');
    }

    return conversation;
  }

  private buildGenericConversationFilter(buyerId: string, supplierId: string): Record<string, unknown> {
    return {
      buyerId,
      supplierId,
      $or: [
        { publicationId: { $exists: false } },
        { publicationId: { $in: [null] } },
      ],
    };
  }

  private async mapConversationSummary(
    conversation: ConversationRecord,
    viewerId: string,
    options?: { isNew?: boolean },
  ) {
    const isGenericConversation = Boolean(conversation.participantIds?.length);
    const participantIds = conversation.participantIds ?? [conversation.buyerId, conversation.supplierId];
    const users = await this.usersService.findManyByIds(participantIds);
    const usersMap = new Map(users.map((user) => [user.id, user]));
    const buyer =
      usersMap.get(conversation.buyerId) ??
      (conversation.buyerId ? await this.usersService.findById(conversation.buyerId) : null);
    const supplier =
      usersMap.get(conversation.supplierId) ??
      (conversation.supplierId ? await this.usersService.findById(conversation.supplierId) : null);
    const otherUser = isGenericConversation
      ? users.find((user) => user.id !== viewerId) ?? null
      : viewerId === conversation.buyerId
        ? supplier
        : buyer;
    const lastMessage = await this.collection()
      .find({ conversationId: conversation.id })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    const unreadCount = await this.collection().countDocuments({
      conversationId: conversation.id,
      senderId: { $ne: viewerId },
      readBy: { $ne: viewerId },
    });

    return {
      id: conversation.id,
      buyerId: conversation.buyerId,
      supplierId: conversation.supplierId,
      participantIds: conversation.participantIds,
      isNew: options?.isNew ?? false,
      publicationId: conversation.publicationId ?? undefined,
      buyerName: buyer?.fullName ?? 'Comprador',
      buyerCompany: buyer?.company ?? 'Empresa',
      supplierName: supplier?.fullName ?? 'Proveedor',
      supplierCompany: supplier?.company ?? 'Empresa',
      supplierSector: supplier?.sector ?? 'General',
      otherUserId: otherUser?.id,
      otherUserName: otherUser?.fullName,
      otherUserCompany: otherUser?.company,
      otherUserRole: otherUser?.role,
      lastMessage:
        lastMessage[0]?.message ||
        (lastMessage[0]?.attachments?.[0]
          ? this.getAttachmentPreview(lastMessage[0].attachments[0])
          : ''),
      unreadCount,
      updatedAt: conversation.updatedAt.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
    };
  }

  private getAttachmentPreview(attachment: MessageAttachment): string {
    if (attachment.kind === 'image') {
      return 'Foto enviada';
    }

    if (attachment.kind === 'location') {
      return 'Ubicacion compartida';
    }

    if (attachment.kind === 'publication') {
      return `Publicacion: ${attachment.name}`;
    }

    if (attachment.kind === 'profile') {
      return `Perfil: ${attachment.name}`;
    }

    return `Archivo: ${attachment.name}`;
  }

  private async createGenericConversationMessage(data: {
    conversation: ConversationRecord;
    senderId: string;
    message: string;
    attachments?: MessageAttachment[];
  }) {
    const sender = await this.usersService.requireActiveUser(data.senderId);
    const attachments = (data.attachments ?? []).filter((attachment) => Boolean(attachment.kind && attachment.name));
    const messageText = data.message?.trim();

    if (!messageText && attachments.length === 0) {
      throw new BadRequestException('El mensaje no puede estar vacio');
    }

    const participants = data.conversation.participantIds ?? [data.conversation.buyerId, data.conversation.supplierId];
    const recipientId = participants.find((participantId) => participantId !== sender.id);

    if (!recipientId) {
      throw new BadRequestException('No se encontro un destinatario valido para la conversacion');
    }

    const record: MessageRecord = {
      id: crypto.randomUUID(),
      conversationId: data.conversation.id,
      senderId: sender.id,
      buyerId: data.conversation.buyerId,
      supplierId: data.conversation.supplierId,
      participantIds: participants,
      publicationId: data.conversation.publicationId ?? undefined,
      postId: data.conversation.publicationId ?? undefined,
      message: messageText,
      attachments,
      readBy: [sender.id],
      createdAt: new Date(),
    };

    await this.collection().insertOne(record);
    await this.conversationsCollection().updateOne(
      { id: data.conversation.id },
      { $set: { updatedAt: new Date() } },
    );

    const recipient = await this.usersService.findById(recipientId);
    const recipientNotificationRole = recipient ? this.toNotificationRole(recipient.role) : null;

    if (recipient && recipientNotificationRole) {
      this.notificationsService.create({
        icon: 'MessageCircle',
        type: 'MESSAGE_REPLY',
        title: `${sender.fullName} te envio un mensaje`,
        body: messageText?.slice(0, 80) || 'Nuevo mensaje recibido',
        entityType: 'message',
        entityId: data.conversation.id,
        fromUserId: sender.id,
        role: recipientNotificationRole,
        userId: recipient.id,
        url: `/mensajes?conversationId=${data.conversation.id}`,
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
      attachments: record.attachments ?? [],
      createdAt: record.createdAt.toISOString(),
    };
  }

  private toNotificationRole(role: UserRole) {
    if (role === UserRole.SUPPLIER) {
      return UserRole.SUPPLIER;
    }

    if (role === UserRole.BUYER || role === UserRole.EXPERT) {
      return UserRole.BUYER;
    }

    return null;
  }

  private collection() {
    return this.databaseService.collection<MessageRecord>('messages');
  }

  private conversationsCollection() {
    return this.databaseService.collection<ConversationRecord>('conversations');
  }
}
