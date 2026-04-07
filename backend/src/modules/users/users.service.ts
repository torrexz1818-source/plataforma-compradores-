import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from './domain/user.model';
import { UserRole } from './domain/user-role.enum';
import { UserStatus } from './domain/user-status.enum';

type CreateUserData = Pick<
  User,
  'email' | 'passwordHash' | 'fullName' | 'company' | 'position'
> & {
  role?: UserRole;
  phone?: string;
  ruc?: string;
  sector?: string;
  location?: string;
  description?: string;
};

type SupplierReviewRecord = {
  id: string;
  supplierId: string;
  buyerId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
};

type MessageRecord = {
  id: string;
  senderId: string;
  supplierId: string;
  buyerId?: string;
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

export type MembershipStatus = 'pending' | 'active' | 'expired' | 'suspended';

export type MembershipRecord = {
  userId: string;
  userRole: UserRole;
  plan: string;
  status: MembershipStatus;
  adminApproved: boolean;
  approvedAt?: Date;
  approvedBy?: string;
  expiresAt?: Date;
  createdAt: Date;
};

type ProfileViewNotificationRecord = {
  id: string;
  viewerId: string;
  targetUserId: string;
  notifiedAt: Date;
};


@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createUser(data: CreateUserData): Promise<User> {
    const existingUser = await this.findByEmail(data.email);

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const now = new Date();
    const user: User = {
      id: crypto.randomUUID(),
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      company: data.company,
      position: data.position,
      phone: data.phone,
      ruc: data.ruc,
      sector: data.sector,
      location: data.location,
      description: data.description,
      role:
        data.role === UserRole.SUPPLIER ? UserRole.SUPPLIER : UserRole.BUYER,
      status: UserStatus.ACTIVE,
      points: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.collection().insertOne(user);
    await this.ensureMembershipRecord(user);
    return user;
  }

  async ensureMembershipRecord(user: User): Promise<void> {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    const existing = await this.membershipsCollection().findOne({ userId: user.id });
    if (existing) {
      return;
    }

    await this.membershipsCollection().insertOne({
      userId: user.id,
      userRole: user.role,
      plan: 'basic',
      status: 'pending',
      adminApproved: false,
      createdAt: new Date(),
    });
  }

  async getMembershipByUserId(userId: string): Promise<MembershipRecord | null> {
    return this.membershipsCollection().findOne({ userId });
  }

  async hasSensitiveAccess(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) {
      return false;
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const membership = await this.getMembershipByUserId(userId);
    return Boolean(
      membership &&
      membership.status === 'active' &&
      membership.adminApproved,
    );
  }

  async listMemberships(): Promise<MembershipRecord[]> {
    return this.membershipsCollection().find().sort({ createdAt: -1 }).toArray();
  }

  async upsertMembershipByAdmin(data: {
    userId: string;
    plan?: string;
    status?: MembershipStatus;
    adminApproved?: boolean;
    expiresAt?: string;
    approvedBy: string;
  }): Promise<MembershipRecord> {
    const user = await this.findById(data.userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('El admin no depende de membresia');
    }

    const existing = await this.getMembershipByUserId(data.userId);
    const now = new Date();
    const nextStatus = data.status ?? existing?.status ?? 'pending';
    const nextApproved = data.adminApproved ?? existing?.adminApproved ?? false;

    const next: MembershipRecord = {
      userId: data.userId,
      userRole: user.role,
      plan: data.plan ?? existing?.plan ?? 'basic',
      status: nextStatus,
      adminApproved: nextApproved,
      approvedAt:
        nextApproved
          ? (existing?.approvedAt ?? now)
          : undefined,
      approvedBy:
        nextApproved
          ? (existing?.approvedBy ?? data.approvedBy)
          : undefined,
      expiresAt: data.expiresAt
        ? new Date(data.expiresAt)
        : existing?.expiresAt,
      createdAt: existing?.createdAt ?? now,
    };

    await this.membershipsCollection().updateOne(
      { userId: data.userId },
      { $set: next },
      { upsert: true },
    );

    return next;
  }

  maskField(value: string, type: 'name' | 'email' | 'phone' | 'ruc') {
    const text = (value ?? '').trim();
    if (!text) {
      return '';
    }

    if (type === 'name') {
      return text
        .split(' ')
        .filter(Boolean)
        .map((part) => `${part[0]}${'*'.repeat(Math.max(1, part.length - 1))}`)
        .join(' ');
    }

    if (type === 'email') {
      const [local, domain] = text.split('@');
      if (!local || !domain) {
        return '***';
      }
      const domainParts = domain.split('.');
      const ext = domainParts.pop() ?? '';
      return `${local[0]}***@******.${ext || 'com'}`;
    }

    if (type === 'phone') {
      return '+51 9** *** ***';
    }

    return text.length > 4
      ? `${text.slice(0, 2)}${'*'.repeat(Math.max(1, text.length - 4))}${text.slice(-2)}`
      : '*'.repeat(text.length);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.collection().findOne({
      email: email.trim().toLowerCase(),
    });
  }

  findById(id: string): Promise<User | null> {
    return this.collection().findOne({ id });
  }

  async findManyByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.collection()
      .find({ id: { $in: Array.from(new Set(ids)) } })
      .toArray();
  }

  async getBuyerSectors(): Promise<Array<{ sector: string; count: number }>> {
    const rows = await this.collection()
      .aggregate<{ sector?: string; count: number }>([
        {
          $match: {
            role: UserRole.BUYER,
            status: UserStatus.ACTIVE,
          },
        },
        {
          $group: {
            _id: {
              $ifNull: [
                {
                  $let: {
                    vars: {
                      normalizedSector: {
                        $trim: {
                          input: { $ifNull: ['$sector', ''] },
                        },
                      },
                    },
                    in: {
                      $cond: [
                        { $eq: ['$$normalizedSector', ''] },
                        'General',
                        '$$normalizedSector',
                      ],
                    },
                  },
                },
                'General',
              ],
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            sector: '$_id',
            count: 1,
          },
        },
        {
          $sort: {
            count: -1,
            sector: 1,
          },
        },
      ])
      .toArray();

    return rows.map((row) => ({
      sector: row.sector ?? 'General',
      count: row.count,
    }));
  }

  async getSupplierSectors(): Promise<Array<{ sector: string; count: number }>> {
    const rows = await this.collection()
      .aggregate<{ sector?: string; count: number }>([
        {
          $match: {
            role: UserRole.SUPPLIER,
            status: UserStatus.ACTIVE,
          },
        },
        {
          $group: {
            _id: {
              $ifNull: [
                {
                  $let: {
                    vars: {
                      normalizedSector: {
                        $trim: {
                          input: { $ifNull: ['$sector', ''] },
                        },
                      },
                    },
                    in: {
                      $cond: [
                        { $eq: ['$$normalizedSector', ''] },
                        'General',
                        '$$normalizedSector',
                      ],
                    },
                  },
                },
                'General',
              ],
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            sector: '$_id',
            count: 1,
          },
        },
        {
          $sort: {
            count: -1,
            sector: 1,
          },
        },
      ])
      .toArray();

    return rows.map((row) => ({
      sector: row.sector ?? 'General',
      count: row.count,
    }));
  }

  async listBuyersBySector(sector: string): Promise<User[]> {
    const normalizedSector = sector.trim();
    const isGeneral = normalizedSector.toLowerCase() === 'general';
    const baseFilter = {
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
    };

    if (isGeneral) {
      return this.collection()
        .find({
          ...baseFilter,
          $or: [
            { sector: { $exists: false } },
            { sector: '' },
            { sector: { $regex: /^\s+$/ } },
          ],
        })
        .sort({ createdAt: -1 })
        .toArray();
    }

    return this.collection()
      .find({
        ...baseFilter,
        sector: { $regex: new RegExp(`^${this.escapeRegExp(normalizedSector)}$`, 'i') },
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async listSuppliersBySector(sector: string): Promise<User[]> {
    const normalizedSector = sector.trim();
    const isGeneral = normalizedSector.toLowerCase() === 'general';
    const baseFilter = {
      role: UserRole.SUPPLIER,
      status: UserStatus.ACTIVE,
    };

    if (isGeneral) {
      return this.collection()
        .find({
          ...baseFilter,
          $or: [
            { sector: { $exists: false } },
            { sector: '' },
            { sector: { $regex: /^\s+$/ } },
          ],
        })
        .sort({ createdAt: -1 })
        .toArray();
    }

    return this.collection()
      .find({
        ...baseFilter,
        sector: { $regex: new RegExp(`^${this.escapeRegExp(normalizedSector)}$`, 'i') },
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findBuyerById(id: string): Promise<User | null> {
    return this.collection().findOne({
      id,
      role: UserRole.BUYER,
      status: UserStatus.ACTIVE,
    });
  }

  async findSupplierById(id: string): Promise<User | null> {
    return this.collection().findOne({
      id,
      role: UserRole.SUPPLIER,
      status: UserStatus.ACTIVE,
    });
  }

  async hasBuyerContactedSupplier(buyerId: string, supplierId: string): Promise<boolean> {
    const message = await this.messagesCollection().findOne({
      buyerId,
      supplierId,
    });

    return Boolean(message);
  }

  async listSupplierReviews(supplierId: string): Promise<
    Array<{
      id: string;
      rating: number;
      comment: string;
      createdAt: string;
      buyer: {
        id: string;
        name: string;
        company: string;
      };
    }>
  > {
    const reviews = await this.supplierReviewsCollection()
      .find({ supplierId })
      .sort({ createdAt: -1 })
      .toArray();

    const buyers = await this.findManyByIds(reviews.map((review) => review.buyerId));
    const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer]));

    return reviews.map((review) => {
      const buyer = buyerMap.get(review.buyerId);
      return {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        buyer: {
          id: review.buyerId,
          name: buyer?.fullName ?? 'Comprador',
          company: buyer?.company ?? 'Empresa',
        },
      };
    });
  }

  async createOrUpdateSupplierReview(data: {
    supplierId: string;
    buyerId: string;
    rating: number;
    comment: string;
  }): Promise<{
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    buyer: {
      id: string;
      name: string;
      company: string;
    };
  }> {
    const buyer = await this.requireActiveUser(data.buyerId);
    if (buyer.role !== UserRole.BUYER) {
      throw new ForbiddenException('Solo compradores pueden calificar proveedores');
    }

    const supplier = await this.findSupplierById(data.supplierId);
    if (!supplier) {
      throw new NotFoundException('Proveedor no encontrado');
    }

    const hasContact = await this.hasBuyerContactedSupplier(data.buyerId, data.supplierId);
    if (!hasContact) {
      throw new ForbiddenException('Debes contactar al proveedor antes de dejar una resena');
    }

    const now = new Date();
    const existing = await this.supplierReviewsCollection().findOne({
      supplierId: data.supplierId,
      buyerId: data.buyerId,
    });

    if (existing) {
      await this.supplierReviewsCollection().updateOne(
        { id: existing.id },
        {
          $set: {
            rating: data.rating,
            comment: data.comment.trim(),
            updatedAt: now,
          },
        },
      );

      this.notificationsService.create({
        icon: 'Star',
        type: 'REVIEW_RECEIVED',
        title: `${buyer.fullName} dejo una valoracion de ${data.rating} estrellas en tu perfil`,
        body: data.comment.trim().slice(0, 80),
        entityType: 'review',
        entityId: existing.id,
        fromUserId: buyer.id,
        role: UserRole.SUPPLIER,
        userId: supplier.id,
        url: '/perfil?section=reviews',
        time: 'Ahora',
      });

      return {
        id: existing.id,
        rating: data.rating,
        comment: data.comment.trim(),
        createdAt: existing.createdAt.toISOString(),
        buyer: {
          id: buyer.id,
          name: buyer.fullName,
          company: buyer.company,
        },
      };
    }

    const created: SupplierReviewRecord = {
      id: crypto.randomUUID(),
      supplierId: data.supplierId,
      buyerId: data.buyerId,
      rating: data.rating,
      comment: data.comment.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await this.supplierReviewsCollection().insertOne(created);

    this.notificationsService.create({
      icon: 'Star',
      type: 'REVIEW_RECEIVED',
      title: `${buyer.fullName} dejo una valoracion de ${created.rating} estrellas en tu perfil`,
      body: created.comment.slice(0, 80),
      entityType: 'review',
      entityId: created.id,
      fromUserId: buyer.id,
      role: UserRole.SUPPLIER,
      userId: supplier.id,
      url: '/perfil?section=reviews',
      time: 'Ahora',
    });

    return {
      id: created.id,
      rating: created.rating,
      comment: created.comment,
      createdAt: created.createdAt.toISOString(),
      buyer: {
        id: buyer.id,
        name: buyer.fullName,
        company: buyer.company,
      },
    };
  }

  list(): Promise<User[]> {
    return this.collection().find().sort({ createdAt: -1 }).toArray();
  }

  async listActiveUserIdsByRole(role: UserRole, excludeUserId?: string): Promise<string[]> {
    const filter: Record<string, unknown> = {
      role,
      status: UserStatus.ACTIVE,
    };

    if (excludeUserId) {
      filter.id = { $ne: excludeUserId };
    }

    const users = await this.collection()
      .find(filter, { projection: { id: 1 } })
      .toArray();

    return users.map((user) => user.id);
  }

  async notifyProfileInteraction(data: {
    viewerId: string;
    viewerRole: UserRole.BUYER | UserRole.SUPPLIER;
    targetUserId: string;
    targetRole: UserRole.BUYER | UserRole.SUPPLIER;
  }): Promise<void> {
    if (data.viewerId === data.targetUserId) {
      return;
    }

    const viewer = await this.findById(data.viewerId);
    if (!viewer || viewer.status !== UserStatus.ACTIVE) {
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const alreadyNotifiedToday = await this.profileViewsCollection().findOne({
      viewerId: data.viewerId,
      targetUserId: data.targetUserId,
      notifiedAt: { $gte: startOfDay },
    });

    if (alreadyNotifiedToday) {
      return;
    }

    await this.profileViewsCollection().insertOne({
      id: crypto.randomUUID(),
      viewerId: data.viewerId,
      targetUserId: data.targetUserId,
      notifiedAt: new Date(),
    });

    this.notificationsService.create({
      icon: 'Building2',
      type: 'PROFILE_VIEW',
      title: `${viewer.fullName} de ${viewer.company} visito tu perfil`,
      body: `${viewer.sector ?? 'General'} · ${viewer.location ?? 'Sin ubicacion'}`,
      entityType: 'user',
      entityId: data.targetUserId,
      fromUserId: viewer.id,
      role: data.targetRole,
      userId: data.targetUserId,
      url: `/perfil/${viewer.id}`,
      time: 'Ahora',
    });
  }

  async listRecommendedSuppliers(
    buyerId: string,
    limit = 3,
  ): Promise<
    Array<{
      id: string;
      name: string;
      company: string;
      sector: string;
      averageRating: number;
      matchReasons: string[];
      score: number;
    }>
  > {
    const buyer = await this.findBuyerById(buyerId);
    if (!buyer) {
      throw new NotFoundException('Comprador no encontrado');
    }

    const suppliers = await this.collection()
      .find({
        role: UserRole.SUPPLIER,
        status: UserStatus.ACTIVE,
      })
      .toArray();

    if (!suppliers.length) {
      return [];
    }

    const ratings = await this.supplierReviewsCollection()
      .aggregate<{ _id: string; averageRating: number }>([
        {
          $group: {
            _id: '$supplierId',
            averageRating: { $avg: '$rating' },
          },
        },
      ])
      .toArray();
    const ratingMap = new Map(ratings.map((item) => [item._id, Number(item.averageRating.toFixed(1))]));

    const activeConversations = await this.conversationsCollection()
      .find({ buyerId })
      .toArray();
    const conversationSupplierIds = new Set(activeConversations.map((item) => item.supplierId));

    const buyerCategories = (buyer.description ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const recommended = suppliers.map((supplier) => {
      let score = 0;
      const matchReasons: string[] = [];

      if (
        buyer.sector?.trim() &&
        supplier.sector?.trim() &&
        buyer.sector.trim().toLowerCase() === supplier.sector.trim().toLowerCase()
      ) {
        score += 3;
        matchReasons.push(`Mismo sector: ${supplier.sector}`);
      }

      const supplierText = `${supplier.description ?? ''} ${supplier.company}`.toLowerCase();
      buyerCategories.forEach((category) => {
        if (supplierText.includes(category)) {
          score += 2;
          matchReasons.push(`Ofrece: ${category}`);
        }
      });

      const averageRating = ratingMap.get(supplier.id) ?? 0;
      score += averageRating;
      if (averageRating > 0) {
        matchReasons.push(`Valoracion promedio: ${averageRating.toFixed(1)} estrellas`);
      }

      if (conversationSupplierIds.has(supplier.id)) {
        score -= 5;
      }

      return {
        id: supplier.id,
        name: supplier.fullName,
        company: supplier.company,
        sector: supplier.sector ?? 'General',
        averageRating,
        matchReasons: Array.from(new Set(matchReasons)).slice(0, 3),
        score,
      };
    });

    return recommended.sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit));
  }

  async requireActiveUser(id: string): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException('User is disabled');
    }

    return user;
  }

  async updateStatus(
    targetUserId: string,
    status: UserStatus,
    actorUserId: string,
  ): Promise<{ user: Omit<User, 'passwordHash'> }> {
    const targetUser = await this.findById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.role === UserRole.ADMIN) {
      throw new ForbiddenException('The only administrator cannot be modified');
    }

    if (targetUser.id === actorUserId) {
      throw new ForbiddenException('You cannot change your own status');
    }

    const updatedUser: User = {
      ...targetUser,
      status,
      updatedAt: new Date(),
    };

    await this.collection().updateOne(
      { id: targetUserId },
      {
        $set: {
          status: updatedUser.status,
          updatedAt: updatedUser.updatedAt,
        },
      },
    );

    return {
      user: this.toSafeUser(updatedUser),
    };
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const result = await this.collection().updateOne(
      { id: userId },
      {
        $set: {
          passwordHash,
          updatedAt: new Date(),
        },
      },
    );

    if (!result.matchedCount) {
      throw new NotFoundException('User not found');
    }
  }

  toSafeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private collection() {
    return this.databaseService.collection<User>('users');
  }

  private messagesCollection() {
    return this.databaseService.collection<MessageRecord>('messages');
  }

  private supplierReviewsCollection() {
    return this.databaseService.collection<SupplierReviewRecord>('supplierReviews');
  }

  private membershipsCollection() {
    return this.databaseService.collection<MembershipRecord>('memberships');
  }

  private profileViewsCollection() {
    return this.databaseService.collection<ProfileViewNotificationRecord>('profileViewNotifications');
  }

  private conversationsCollection() {
    return this.databaseService.collection<ConversationRecord>('conversations');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
