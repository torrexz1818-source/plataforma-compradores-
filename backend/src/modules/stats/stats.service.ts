import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/domain/user.model';
import { UserRole } from '../users/domain/user-role.enum';

type PostRecord = {
  id: string;
  authorId: string;
  type: 'educational' | 'community';
  title: string;
  description: string;
  likedBy: string[];
  createdAt: Date;
};

type CommentRecord = {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
};

type MessageRecord = {
  id: string;
  senderId: string;
  supplierId: string;
  buyerId?: string;
  conversationId?: string;
  createdAt: Date;
};

type ConversationRecord = {
  id: string;
  buyerId: string;
  supplierId: string;
  updatedAt: Date;
};

type SupplierReviewRecord = {
  id: string;
  supplierId: string;
  buyerId: string;
  rating: number;
  comment: string;
  createdAt: Date;
};

type EducationalContentViewRecord = {
  id: string;
  contentId: string;
  userId: string;
  viewedAt: Date;
  month: string;
};

type SectorBreakdownItem = {
  sector: string;
  count: number;
};

type LatestUserItem = {
  id: string;
  name: string;
  company: string;
  sector: string;
  role: UserRole.BUYER | UserRole.SUPPLIER;
};

@Injectable()
export class StatsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getStats() {
    const roleFilter = { role: { $in: [UserRole.BUYER, UserRole.SUPPLIER] } };

    const [buyers, suppliers, sectorBreakdownRaw, latestUsersRaw] = await Promise.all([
      this.usersCollection().countDocuments({ role: UserRole.BUYER }),
      this.usersCollection().countDocuments({ role: UserRole.SUPPLIER }),
      this.usersCollection()
        .aggregate<{ _id: string; count: number }>([
          { $match: roleFilter },
          {
            $group: {
              _id: {
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
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1, _id: 1 } },
        ])
        .toArray(),
      this.usersCollection()
        .find(roleFilter)
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    const sectorBreakdown: SectorBreakdownItem[] = sectorBreakdownRaw.map((item) => ({
      sector: item._id,
      count: item.count,
    }));

    const latestUsers: LatestUserItem[] = latestUsersRaw.map((user) => ({
      id: user.id,
      name: user.fullName,
      company: user.company,
      sector: user.sector?.trim() ? user.sector : 'General',
      role: user.role as UserRole.BUYER | UserRole.SUPPLIER,
    }));

    return {
      totalUsers: buyers + suppliers,
      buyers,
      suppliers,
      sectorBreakdown,
      latestUsers,
    };
  }

  async getMonthlyReport(
    userId: string,
    role: UserRole.BUYER | UserRole.SUPPLIER,
    month?: string,
  ) {
    const monthValue = this.normalizeMonth(month);
    const [start, end] = this.getMonthRange(monthValue);
    const previousMonth = this.getPreviousMonth(monthValue);
    const [prevStart, prevEnd] = this.getMonthRange(previousMonth);

    if (role === UserRole.SUPPLIER) {
      const [supplier, posts, comments, messages, reviews, topEducational] = await Promise.all([
        this.usersCollection().findOne({ id: userId }),
        this.postsCollection().find({ authorId: userId, createdAt: { $gte: start, $lt: end } }).toArray(),
        this.commentsCollection().find({ createdAt: { $gte: start, $lt: end } }).toArray(),
        this.messagesCollection().find({ supplierId: userId, createdAt: { $gte: start, $lt: end } }).toArray(),
        this.supplierReviewsCollection().find({ supplierId: userId, createdAt: { $gte: start, $lt: end } }).toArray(),
        this.topEducationalContent(monthValue, 3),
      ]);

      const previousMessagesCount = await this.messagesCollection().countDocuments({
        supplierId: userId,
        createdAt: { $gte: prevStart, $lt: prevEnd },
      });
      const currentMessagesCount = messages.length;
      const variation = this.percentVariation(currentMessagesCount, previousMessagesCount);

      const postIds = posts.map((post) => post.id);
      const topPublications = posts
        .map((post) => {
          const postComments = comments.filter((comment) => comment.postId === post.id).length;
          return {
            id: post.id,
            title: post.title,
            engagement: post.likedBy.length + postComments,
            likes: post.likedBy.length,
            comments: postComments,
          };
        })
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 3);

      const buyerInteractions = new Map<string, number>();
      messages.forEach((message) => {
        if (message.buyerId) {
          buyerInteractions.set(message.buyerId, (buyerInteractions.get(message.buyerId) ?? 0) + 1);
        }
      });
      const topBuyerIds = Array.from(buyerInteractions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);
      const topBuyersRaw = await this.usersCollection().find({ id: { $in: topBuyerIds } }).toArray();
      const topBuyersMap = new Map(topBuyersRaw.map((item) => [item.id, item]));
      const topBuyers = topBuyerIds.map((buyerId) => {
        const buyer = topBuyersMap.get(buyerId);
        return {
          id: buyerId,
          name: buyer?.fullName ?? 'Comprador',
          company: buyer?.company ?? 'Empresa',
          interactions: buyerInteractions.get(buyerId) ?? 0,
        };
      });

      const reportPayload = {
        month: monthValue,
        role: UserRole.SUPPLIER,
        metrics: {
          profileViews: 0,
          likes: posts.reduce((acc, post) => acc + post.likedBy.length, 0),
          messages: currentMessagesCount,
          newBuyers: new Set(messages.map((message) => message.buyerId).filter(Boolean)).size,
          variationVsPreviousMonth: variation,
        },
        topPublications,
        topBuyers,
        reviews: {
          average:
            reviews.length > 0
              ? Number((reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length).toFixed(1))
              : 0,
          latest: reviews.slice(0, 3).map((review) => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt.toISOString(),
          })),
        },
        educationalTop: topEducational,
        company: supplier?.company ?? 'Proveedor',
        publicationIds: postIds,
      };

      this.createMonthlyReportNotification({
        userId,
        role,
        month: monthValue,
        body: `${reportPayload.metrics.profileViews} vistas · ${reportPayload.metrics.likes} likes · ${reportPayload.metrics.messages} mensajes · ${reportPayload.metrics.variationVsPreviousMonth}% vs mes anterior`,
      });

      return reportPayload;
    }

    const [buyer, conversations, viewedContents, topEducational, suppliers] = await Promise.all([
      this.usersCollection().findOne({ id: userId }),
      this.conversationsCollection().find({ buyerId: userId, updatedAt: { $gte: start, $lt: end } }).toArray(),
      this.educationalViewsCollection().find({ userId, month: monthValue }).toArray(),
      this.topEducationalContent(monthValue, 3),
      this.usersCollection().find({ role: UserRole.SUPPLIER }).toArray(),
    ]);

    const visitedSupplierIds = Array.from(new Set(conversations.map((conversation) => conversation.supplierId)));
    const recommended = suppliers
      .filter((supplier) => !visitedSupplierIds.includes(supplier.id))
      .slice(0, 3)
      .map((supplier) => ({
        id: supplier.id,
        name: supplier.fullName,
        company: supplier.company,
        sector: supplier.sector ?? 'General',
        stars: 4,
        matchReasons: [
          supplier.sector && buyer?.sector && supplier.sector === buyer.sector
            ? `Mismo sector: ${supplier.sector}`
            : 'Proveedor activo en la plataforma',
        ],
      }));

    const visitedSuppliers = suppliers
      .filter((supplier) => visitedSupplierIds.includes(supplier.id))
      .slice(0, 5)
      .map((supplier) => ({
        id: supplier.id,
        name: supplier.fullName,
        company: supplier.company,
      }));

    const reportPayload = {
      month: monthValue,
      role: UserRole.BUYER,
      metrics: {
        suppliersVisited: visitedSupplierIds.length,
        messagesSent: conversations.length,
        contentsViewed: viewedContents.length,
        newSuppliersInMyCategories: suppliers.filter(
          (supplier) =>
            supplier.sector?.trim().toLowerCase() === buyer?.sector?.trim().toLowerCase(),
        ).length,
      },
      topEducational,
      recommendedSuppliers: recommended,
      visitedSuppliers,
    };

    this.createMonthlyReportNotification({
      userId,
      role,
      month: monthValue,
      body: `${reportPayload.metrics.suppliersVisited} proveedores visitados · ${reportPayload.metrics.contentsViewed} contenidos vistos`,
    });

    return reportPayload;
  }

  async getAdminMonthlyReport(month?: string) {
    const monthValue = this.normalizeMonth(month);
    const [start, end] = this.getMonthRange(monthValue);

    const [buyers, suppliers, posts, comments, messages] = await Promise.all([
      this.usersCollection().countDocuments({ role: UserRole.BUYER }),
      this.usersCollection().countDocuments({ role: UserRole.SUPPLIER }),
      this.postsCollection().countDocuments({ createdAt: { $gte: start, $lt: end } }),
      this.commentsCollection().countDocuments({ createdAt: { $gte: start, $lt: end } }),
      this.messagesCollection().countDocuments({ createdAt: { $gte: start, $lt: end } }),
    ]);

    return {
      month: monthValue,
      role: UserRole.ADMIN,
      metrics: {
        buyers,
        suppliers,
        posts,
        comments,
        messages,
      },
    };
  }

  async topEducationalContent(month: string, limit = 3) {
    const normalizedMonth = this.normalizeMonth(month);
    const rows = await this.educationalViewsCollection()
      .aggregate<{ _id: string; views: number }>([
        { $match: { month: normalizedMonth } },
        { $group: { _id: '$contentId', views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: Math.max(1, limit) },
      ])
      .toArray();

    if (!rows.length) {
      return [];
    }

    const posts = await this.postsCollection().find({ id: { $in: rows.map((row) => row._id) } }).toArray();
    const postMap = new Map(posts.map((item) => [item.id, item]));

    return rows.flatMap((row) => {
      const post = postMap.get(row._id);
      if (!post) {
        return [];
      }

      return [{
        id: post.id,
        title: post.title,
        description: post.description,
        views: row.views,
      }];
    });
  }

  private usersCollection() {
    return this.databaseService.collection<User>('users');
  }

  private postsCollection() {
    return this.databaseService.collection<PostRecord>('posts');
  }

  private commentsCollection() {
    return this.databaseService.collection<CommentRecord>('comments');
  }

  private messagesCollection() {
    return this.databaseService.collection<MessageRecord>('messages');
  }

  private conversationsCollection() {
    return this.databaseService.collection<ConversationRecord>('conversations');
  }

  private supplierReviewsCollection() {
    return this.databaseService.collection<SupplierReviewRecord>('supplierReviews');
  }

  private educationalViewsCollection() {
    return this.databaseService.collection<EducationalContentViewRecord>('educationalContentViews');
  }

  private normalizeMonth(month?: string) {
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      return month;
    }

    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getMonthRange(month: string): [Date, Date] {
    const [year, monthPart] = month.split('-').map(Number);
    const start = new Date(year, monthPart - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, monthPart, 1, 0, 0, 0, 0);
    return [start, end];
  }

  private getPreviousMonth(month: string): string {
    const [year, monthPart] = month.split('-').map(Number);
    const date = new Date(year, monthPart - 1, 1);
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private percentVariation(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }

    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  private createMonthlyReportNotification(data: {
    userId: string;
    role: UserRole.BUYER | UserRole.SUPPLIER;
    month: string;
    body: string;
  }) {
    if (
      this.notificationsService.exists({
        userId: data.userId,
        type: 'MONTHLY_REPORT',
        entityId: data.month,
      })
    ) {
      return;
    }

    this.notificationsService.create({
      userId: data.userId,
      role: data.role,
      icon: 'FileText',
      type: 'MONTHLY_REPORT',
      title: `Tu reporte mensual de ${data.month} esta listo`,
      body: data.body,
      entityType: 'report',
      entityId: data.month,
      time: 'Ahora',
      url: `/reportes?month=${data.month}`,
    });
  }
}
