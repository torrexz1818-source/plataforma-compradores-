import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Collection, Db, MongoClient } from 'mongodb';
import { seedCategories, seedComments, seedLessonProgress, seedPosts, seedUsers } from './seed.data';
import { UserRole } from '../users/domain/user-role.enum';
import { UserStatus } from '../users/domain/user-status.enum';

type UserDocument = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  company: string;
  position: string;
  sector?: string;
  location?: string;
  description?: string;
  role: UserRole;
  status: UserStatus;
  points: number;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryDocument = {
  id: string;
  name: string;
  slug: string;
};

type PostDocument = {
  id: string;
  authorId: string;
  categoryId: string;
  title: string;
  description: string;
  type: 'educational' | 'community';
  videoUrl?: string;
  thumbnailUrl?: string;
  shares: number;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
};

type CommentDocument = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
};

type LessonProgressDocument = {
  id: string;
  postId: string;
  userId: string;
  progress: number;
  duration: string;
};

type PasswordResetOtpDocument = {
  id: string;
  email: string;
  userId: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
  verifiedAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  consumedAt?: Date;
};

type PasswordResetRateLimitDocument = {
  key: string;
  count: number;
  windowStartedAt: Date;
  updatedAt: Date;
};

type MessageDocument = {
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

type ConversationDocument = {
  id: string;
  buyerId: string;
  supplierId: string;
  publicationId?: string;
  createdAt: Date;
  updatedAt: Date;
};

type SupplierReviewDocument = {
  id: string;
  supplierId: string;
  buyerId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
};

type EducationalContentViewDocument = {
  id: string;
  contentId: string;
  userId: string;
  viewedAt: Date;
  month: string;
};

type ProfileViewNotificationDocument = {
  id: string;
  viewerId: string;
  targetUserId: string;
  notifiedAt: Date;
};

type MembershipDocument = {
  userId: string;
  userRole: UserRole;
  plan: string;
  status: 'pending' | 'active' | 'expired' | 'suspended';
  adminApproved: boolean;
  approvedAt?: Date;
  approvedBy?: string;
  expiresAt?: Date;
  createdAt: Date;
};

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly client = new MongoClient(
    process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
  );

  private db?: Db;

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DB_NAME ?? 'supplyconnect');
    await this.ensureIndexes();
    await this.seedDefaults();
    this.logger.log('MongoDB connection ready');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  collection<T extends object>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('Database connection is not initialized');
    }

    return this.db.collection<T>(name);
  }

  private async ensureIndexes(): Promise<void> {
    const users = this.collection<UserDocument>('users');
    const categories = this.collection<CategoryDocument>('categories');
    const posts = this.collection<PostDocument>('posts');
    const comments = this.collection<CommentDocument>('comments');
    const lessonProgress = this.collection<LessonProgressDocument>('lessonProgress');
    const passwordResetOtps =
      this.collection<PasswordResetOtpDocument>('passwordResetOtps');
    const passwordResetRateLimits = this.collection<PasswordResetRateLimitDocument>(
      'passwordResetRateLimits',
    );
    const messages = this.collection<MessageDocument>('messages');
    const conversations = this.collection<ConversationDocument>('conversations');
    const supplierReviews = this.collection<SupplierReviewDocument>('supplierReviews');
    const educationalContentViews =
      this.collection<EducationalContentViewDocument>('educationalContentViews');
    const profileViewNotifications =
      this.collection<ProfileViewNotificationDocument>('profileViewNotifications');
    const memberships = this.collection<MembershipDocument>('memberships');

    await Promise.all([
      users.createIndex({ id: 1 }, { unique: true }),
      users.createIndex({ email: 1 }, { unique: true }),
      users.createIndex(
        { role: 1 },
        {
          unique: true,
          partialFilterExpression: { role: UserRole.ADMIN },
        },
      ),
      categories.createIndex({ id: 1 }, { unique: true }),
      categories.createIndex({ slug: 1 }, { unique: true }),
      posts.createIndex({ id: 1 }, { unique: true }),
      posts.createIndex({ type: 1, createdAt: -1 }),
      comments.createIndex({ id: 1 }, { unique: true }),
      comments.createIndex({ postId: 1, createdAt: 1 }),
      comments.createIndex({ parentId: 1 }),
      lessonProgress.createIndex({ id: 1 }, { unique: true }),
      lessonProgress.createIndex({ postId: 1, userId: 1 }, { unique: true }),
      passwordResetOtps.createIndex({ id: 1 }, { unique: true }),
      passwordResetOtps.createIndex({ email: 1, createdAt: -1 }),
      passwordResetOtps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      passwordResetRateLimits.createIndex({ key: 1 }, { unique: true }),
      passwordResetRateLimits.createIndex(
        { updatedAt: 1 },
        { expireAfterSeconds: 24 * 60 * 60 },
      ),
      messages.createIndex({ id: 1 }, { unique: true }),
      messages.createIndex({ conversationId: 1, createdAt: 1 }),
      messages.createIndex({ buyerId: 1, createdAt: -1 }),
      messages.createIndex({ supplierId: 1, createdAt: -1 }),
      messages.createIndex({ supplierId: 1, publicationId: 1, createdAt: -1 }),
      conversations.createIndex({ id: 1 }, { unique: true }),
      conversations.createIndex({ buyerId: 1, updatedAt: -1 }),
      conversations.createIndex({ supplierId: 1, updatedAt: -1 }),
      conversations.createIndex({ buyerId: 1, supplierId: 1 }, { unique: true }),
      supplierReviews.createIndex({ id: 1 }, { unique: true }),
      supplierReviews.createIndex({ supplierId: 1, createdAt: -1 }),
      supplierReviews.createIndex({ supplierId: 1, buyerId: 1 }, { unique: true }),
      educationalContentViews.createIndex({ id: 1 }, { unique: true }),
      educationalContentViews.createIndex({ month: 1, contentId: 1 }),
      educationalContentViews.createIndex({ userId: 1, viewedAt: -1 }),
      profileViewNotifications.createIndex({ id: 1 }, { unique: true }),
      profileViewNotifications.createIndex({ viewerId: 1, targetUserId: 1, notifiedAt: -1 }),
      memberships.createIndex({ userId: 1 }, { unique: true }),
      memberships.createIndex({ status: 1, adminApproved: 1 }),
    ]);
  }

  private async seedDefaults(): Promise<void> {
    const users = this.collection<UserDocument>('users');
    const categories = this.collection<CategoryDocument>('categories');
    const posts = this.collection<PostDocument>('posts');
    const comments = this.collection<CommentDocument>('comments');
    const lessonProgress = this.collection<LessonProgressDocument>('lessonProgress');

    if ((await users.countDocuments()) === 0) {
      const docs = await Promise.all(
        seedUsers.map(async (user) => ({
          id: user.id,
          email: user.email.toLowerCase(),
          passwordHash: await bcrypt.hash(user.password, 10),
          fullName: user.fullName,
          company: user.company,
          position: user.position,
          sector: user.sector,
          location: user.location,
          description: user.description,
          role: user.role,
          status: user.status,
          points: user.points,
          avatarUrl: user.avatarUrl,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
        })),
      );

      await users.insertMany(docs);
    }

    if ((await categories.countDocuments()) === 0) {
      await categories.insertMany(seedCategories);
    }

    if ((await posts.countDocuments()) === 0) {
      await posts.insertMany(
        seedPosts.map((post) => ({
          ...post,
          createdAt: new Date(post.createdAt),
          updatedAt: new Date(post.updatedAt),
        })),
      );
    }

    if ((await comments.countDocuments()) === 0) {
      await comments.insertMany(
        seedComments.map((comment) => ({
          ...comment,
          createdAt: new Date(comment.createdAt),
          updatedAt: new Date(comment.updatedAt),
        })),
      );
    }

    if ((await lessonProgress.countDocuments()) === 0) {
      await lessonProgress.insertMany(seedLessonProgress);
    }

    await this.ensurePrincipalAdminAccount();
  }

  private async ensurePrincipalAdminAccount(): Promise<void> {
    const users = this.collection<UserDocument>('users');
    const adminEmail = 'admin@supplyconnect.com';

    const principalAdmin = await users.findOne({ email: adminEmail });
    if (!principalAdmin) {
      return;
    }

    // Keep a single principal admin account in the system.
    await users.updateMany(
      {
        role: UserRole.ADMIN,
        email: { $ne: adminEmail },
      },
      {
        $set: {
          role: UserRole.BUYER,
          updatedAt: new Date(),
        },
      },
    );

    await users.updateOne(
      { email: adminEmail },
      {
        $set: {
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          updatedAt: new Date(),
        },
      },
    );
  }
}
