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
  senderId: string;
  supplierId: string;
  buyerId?: string;
  postId?: string;
  message: string;
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

    const adminCount = await users.countDocuments({ role: UserRole.ADMIN });
    if (adminCount > 1) {
      throw new Error('Only one administrator is allowed for this application');
    }

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
      messages.createIndex({ buyerId: 1, createdAt: -1 }),
      messages.createIndex({ supplierId: 1, createdAt: -1 }),
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
  }
}
