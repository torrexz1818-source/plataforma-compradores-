import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Collection, Db, Document, MongoClient } from 'mongodb';
import {
  seedEmployabilityJobs,
  seedEmployabilityTalentProfiles,
  seedAgents,
  seedCategories,
  seedComments,
  seedLessonProgress,
  seedPosts,
  seedUsers,
} from './seed.data';
import { UserRole } from '../users/domain/user-role.enum';
import { UserStatus } from '../users/domain/user-status.enum';

type UserDocument = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  company: string;
  commercialName?: string;
  position: string;
  phone?: string;
  ruc?: string;
  sector?: string;
  location?: string;
  description?: string;
  employeeCount?: string;
  digitalPresence?: {
    linkedin?: string;
    website?: string;
    whatsapp?: string;
    instagram?: string;
  };
  buyerProfile?: {
    interestCategories?: string[];
    purchaseVolume?: string;
    isCompanyDigitalized?: string;
    usesGenerativeAI?: string;
  };
  supplierProfile?: {
    supplierType?: string;
    productsOrServices?: string[];
    hasDigitalCatalog?: string;
    isCompanyDigitalized?: string;
    usesGenerativeAI?: string;
    coverage?: string;
    province?: string;
    district?: string;
    yearsInMarket?: string;
    onboarding?: {
      sessionId?: string;
      shareCount?: number;
      requiredShares?: number;
      completedAt?: Date;
    };
  };
  expertProfile?: {
    weeklyAvailability?: Array<{
      day: string;
      enabled: boolean;
      slots: Array<{
        id: string;
        startTime: string;
        endTime: string;
      }>;
    }>;
    currentProfessionalProfile?: string;
    industry?: string;
    specialty?: string;
    experience?: string;
    skills?: string[];
    biography?: string;
    companies?: string;
    education?: string;
    achievements?: string;
    photo?: string;
    service?: string;
    availabilityDays?: string[];
    googleCalendarConnected?: boolean;
  };
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
  type: 'educational' | 'community' | 'liquidation';
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
  supplierId?: string;
  buyerId?: string;
  participantIds?: string[];
  publicationId?: string;
  postId?: string;
  message: string;
  attachments?: Array<{
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
  }>;
  readBy: string[];
  createdAt: Date;
};

type ConversationDocument = {
  id: string;
  buyerId: string;
  supplierId: string;
  participantIds?: string[];
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

type SupplierOnboardingSessionDocument = {
  id: string;
  shareCount: number;
  requiredShares: number;
  status: 'draft' | 'completed' | 'consumed';
  shareEvents: {
    id: string;
    method: 'copy' | 'native';
    occurredAt: Date;
  }[];
  completedAt?: Date;
  consumedAt?: Date;
  consumedByUserId?: string;
  consumedByEmail?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

type NotificationDocument = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  fromUserId?: string;
  icon: string;
  time: string;
  isRead: boolean;
  role: UserRole.BUYER | UserRole.SUPPLIER;
  url?: string;
  createdAt: Date;
};

type NewsPostDocument = {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
  authorId: string;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
};

type ExpertAppointmentDocument = {
  id: string;
  buyerId: string;
  expertId: string;
  startsAt: Date;
  endsAt: Date;
  topic: string;
  status: 'scheduled' | 'cancelled';
  buyerEmail: string;
  expertEmail: string;
  expertName: string;
  buyerName: string;
  googleCalendarEventId?: string;
  googleCalendarHtmlLink?: string;
  buyerGoogleCalendarEventId?: string;
  buyerGoogleCalendarHtmlLink?: string;
  googleMeetLink?: string;
  emailSent: boolean;
  emailError?: string;
  createdAt: Date;
  updatedAt: Date;
};

type UserCalendarConnectionDocument = {
  id: string;
  userId: string;
  role: UserRole;
  googleEmail?: string;
  calendarId: string;
  calendarName?: string;
  timezone?: string;
  refreshToken: string;
  connectedAt: Date;
  updatedAt: Date;
};

type AgentDocument = {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  automationType: string;
  useCase: string;
  functionalities: string[];
  benefits: string[];
  inputs: string[];
  outputs: string[];
  isActive: boolean;
  accentColor: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
};

type AgentExecutionDocument = {
  id: string;
  agentId: string;
  userId: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  executedAt: Date;
};

type EmployabilityJobDocument = {
  id: string;
  authorId: string;
  title: string;
  description: string;
  skillsRequired: string[];
  experienceRequired: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
};

type EmployabilityTalentProfileDocument = {
  id: string;
  userId: string;
  description: string;
  skills: string[];
  experience: string;
  certifications: string[];
  availability: string;
  createdAt: Date;
  updatedAt: Date;
};

type EmployabilityApplicationDocument = {
  id: string;
  jobId: string;
  applicantId: string;
  createdAt: Date;
  updatedAt: Date;
};

type NewsCommentDocument = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
};

function sanitizeEnv(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
}

function withDefaultMongoAuthSource(uri: string): string {
  if (!uri.startsWith('mongodb+srv://') || /[?&]authSource=/i.test(uri)) {
    return uri;
  }

  const separator = uri.includes('?') ? '&' : '?';
  return `${uri}${separator}authSource=admin`;
}

function buildMongoUri(): string {
  const directUri =
    sanitizeEnv(process.env.MONGODB_URI) ??
    sanitizeEnv(process.env.MONGO_URL) ??
    sanitizeEnv(process.env.DATABASE_URL);

  if (directUri) {
    return withDefaultMongoAuthSource(directUri);
  }

  const username = sanitizeEnv(process.env.MONGODB_USERNAME);
  const password = sanitizeEnv(process.env.MONGODB_PASSWORD);
  const host = sanitizeEnv(process.env.MONGODB_HOST);
  const dbName = sanitizeEnv(process.env.MONGODB_DB_NAME) ?? 'supplynexu';

  if (!host) {
    if (isProductionRuntime()) {
      throw new Error(
        'Missing MongoDB configuration. Set MONGODB_URI in Render, or set MONGODB_USERNAME, MONGODB_PASSWORD, and MONGODB_HOST.',
      );
    }

    return 'mongodb://127.0.0.1:27017';
  }

  if (isProductionRuntime() && (!username || !password)) {
    throw new Error(
      'Incomplete MongoDB configuration. Set MONGODB_URI in Render, or provide both MONGODB_USERNAME and MONGODB_PASSWORD with MONGODB_HOST.',
    );
  }

  const credentials =
    username && password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : '';

  const protocol =
    host.startsWith('mongodb://') || host.startsWith('mongodb+srv://')
      ? ''
      : 'mongodb+srv://';
  const normalizedHost = host.replace(/^mongodb(\+srv)?:\/\//, '');

  return withDefaultMongoAuthSource(
    `${protocol}${credentials}${normalizedHost}/${encodeURIComponent(dbName)}?retryWrites=true&w=majority`,
  );
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly mongoUri = buildMongoUri();
  private readonly client = new MongoClient(this.mongoUri);

  private db?: Db;

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      const maskedUri = this.mongoUri.replace(
        /\/\/([^:@]+):([^@]+)@/,
        '//$1:***@',
      );
      this.logger.error(
        `MongoDB authentication failed. Verify Render env vars MONGODB_URI or MONGODB_USERNAME/MONGODB_PASSWORD/MONGODB_HOST. Current target: ${maskedUri}`,
      );
      throw error;
    }

    const configuredDbName = sanitizeEnv(process.env.MONGODB_DB_NAME);
    this.db = configuredDbName ? this.client.db(configuredDbName) : undefined;
    this.db ??= this.client.db();
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

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database connection is not initialized');
    }

    return this.db;
  }

  private async ensureIndexes(): Promise<void> {
    const users = this.collection<UserDocument>('users');
    const categories = this.collection<CategoryDocument>('categories');
    const posts = this.collection<PostDocument>('posts');
    const comments = this.collection<CommentDocument>('comments');
    const lessonProgress =
      this.collection<LessonProgressDocument>('lessonProgress');
    const passwordResetOtps =
      this.collection<PasswordResetOtpDocument>('passwordResetOtps');
    const passwordResetRateLimits =
      this.collection<PasswordResetRateLimitDocument>(
        'passwordResetRateLimits',
      );
    const messages = this.collection<MessageDocument>('messages');
    const conversations =
      this.collection<ConversationDocument>('conversations');
    const supplierReviews =
      this.collection<SupplierReviewDocument>('supplierReviews');
    const educationalContentViews =
      this.collection<EducationalContentViewDocument>(
        'educationalContentViews',
      );
    const profileViewNotifications =
      this.collection<ProfileViewNotificationDocument>(
        'profileViewNotifications',
      );
    const memberships = this.collection<MembershipDocument>('memberships');
    const supplierOnboardingSessions =
      this.collection<SupplierOnboardingSessionDocument>(
        'supplierOnboardingSessions',
      );
    const notifications =
      this.collection<NotificationDocument>('notifications');
    const newsPosts = this.collection<NewsPostDocument>('newsPosts');
    const newsComments = this.collection<NewsCommentDocument>('newsComments');
    const expertAppointments =
      this.collection<ExpertAppointmentDocument>('expertAppointments');
    const userCalendarConnections =
      this.collection<UserCalendarConnectionDocument>(
        'userCalendarConnections',
      );
    const agents = this.collection<AgentDocument>('agents');
    const agentExecutions =
      this.collection<AgentExecutionDocument>('agentExecutions');
    const employabilityJobs =
      this.collection<EmployabilityJobDocument>('employabilityJobs');
    const employabilityTalentProfiles =
      this.collection<EmployabilityTalentProfileDocument>(
        'employabilityTalentProfiles',
      );
    const employabilityApplications =
      this.collection<EmployabilityApplicationDocument>(
        'employabilityApplications',
      );

    await this.dropLegacySingleAdminIndex(users);
    await this.dropLegacyConversationPairIndex(conversations);
    await this.dropLegacySingleSlotExpertAppointmentIndex(expertAppointments);

    await Promise.all([
      users.createIndex({ id: 1 }, { unique: true }),
      users.createIndex({ email: 1 }, { unique: true }),
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
      passwordResetOtps.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      ),
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
      messages.createIndex({ participantIds: 1, createdAt: -1 }),
      conversations.createIndex({ id: 1 }, { unique: true }),
      conversations.createIndex({ buyerId: 1, updatedAt: -1 }),
      conversations.createIndex({ supplierId: 1, updatedAt: -1 }),
      conversations.createIndex({ participantIds: 1, updatedAt: -1 }),
      conversations.createIndex(
        { buyerId: 1, supplierId: 1, publicationId: 1 },
        { unique: true },
      ),
      supplierReviews.createIndex({ id: 1 }, { unique: true }),
      supplierReviews.createIndex({ supplierId: 1, createdAt: -1 }),
      supplierReviews.createIndex(
        { supplierId: 1, buyerId: 1 },
        { unique: true },
      ),
      educationalContentViews.createIndex({ id: 1 }, { unique: true }),
      educationalContentViews.createIndex({ month: 1, contentId: 1 }),
      educationalContentViews.createIndex({ userId: 1, viewedAt: -1 }),
      profileViewNotifications.createIndex({ id: 1 }, { unique: true }),
      profileViewNotifications.createIndex({
        viewerId: 1,
        targetUserId: 1,
        notifiedAt: -1,
      }),
      memberships.createIndex({ userId: 1 }, { unique: true }),
      memberships.createIndex({ status: 1, adminApproved: 1 }),
      supplierOnboardingSessions.createIndex({ id: 1 }, { unique: true }),
      supplierOnboardingSessions.createIndex({ status: 1, updatedAt: -1 }),
      supplierOnboardingSessions.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      ),
      notifications.createIndex({ id: 1 }, { unique: true }),
      notifications.createIndex({ userId: 1, createdAt: -1 }),
      notifications.createIndex({ userId: 1, isRead: 1, createdAt: -1 }),
      notifications.createIndex({ userId: 1, type: 1, entityId: 1 }),
      newsPosts.createIndex({ id: 1 }, { unique: true }),
      newsPosts.createIndex({ createdAt: -1 }),
      newsComments.createIndex({ id: 1 }, { unique: true }),
      newsComments.createIndex({ postId: 1, createdAt: 1 }),
      newsComments.createIndex({ parentId: 1 }),
      expertAppointments.createIndex({ id: 1 }, { unique: true }),
      expertAppointments.createIndex({ buyerId: 1, startsAt: -1 }),
      expertAppointments.createIndex({ expertId: 1, startsAt: -1 }),
      userCalendarConnections.createIndex({ id: 1 }, { unique: true }),
      userCalendarConnections.createIndex({ userId: 1 }, { unique: true }),
      userCalendarConnections.createIndex({ role: 1, updatedAt: -1 }),
      userCalendarConnections.createIndex({ googleEmail: 1 }),
      agents.createIndex({ id: 1 }, { unique: true }),
      agents.createIndex({ slug: 1 }, { unique: true }),
      agents.createIndex({ category: 1, automationType: 1, isActive: 1 }),
      agentExecutions.createIndex({ id: 1 }, { unique: true }),
      agentExecutions.createIndex({ userId: 1, executedAt: -1 }),
      agentExecutions.createIndex({ agentId: 1, executedAt: -1 }),
      employabilityJobs.createIndex({ id: 1 }, { unique: true }),
      employabilityJobs.createIndex({ authorId: 1, createdAt: -1 }),
      employabilityTalentProfiles.createIndex({ id: 1 }, { unique: true }),
      employabilityTalentProfiles.createIndex({ userId: 1 }, { unique: true }),
      employabilityApplications.createIndex({ id: 1 }, { unique: true }),
      employabilityApplications.createIndex({ jobId: 1, createdAt: -1 }),
      employabilityApplications.createIndex({ applicantId: 1, createdAt: -1 }),
      employabilityApplications.createIndex(
        { jobId: 1, applicantId: 1 },
        { unique: true },
      ),
      expertAppointments.createIndex({ expertId: 1, startsAt: 1, status: 1 }),
      expertAppointments.createIndex(
        { expertId: 1, buyerId: 1, startsAt: 1, status: 1 },
        { unique: true, partialFilterExpression: { status: 'scheduled' } },
      ),
    ]);
  }

  private async dropLegacySingleAdminIndex(
    users: Collection<UserDocument>,
  ): Promise<void> {
    const indexes = await this.getExistingIndexes(users);
    const legacyAdminIndex = indexes.find(
      (index) =>
        index.unique === true &&
        index.partialFilterExpression?.role === UserRole.ADMIN &&
        index.key?.role === 1,
    );

    if (!legacyAdminIndex?.name) {
      return;
    }

    await users.dropIndex(legacyAdminIndex.name);
  }

  private async dropLegacyConversationPairIndex(
    conversations: Collection<ConversationDocument>,
  ): Promise<void> {
    const indexes = await this.getExistingIndexes(conversations);
    const legacyPairIndex = indexes.find(
      (index) =>
        index.unique === true &&
        index.key?.buyerId === 1 &&
        index.key?.supplierId === 1 &&
        index.key?.publicationId !== 1,
    );

    if (!legacyPairIndex?.name) {
      return;
    }

    await conversations.dropIndex(legacyPairIndex.name);
  }

  private async dropLegacySingleSlotExpertAppointmentIndex(
    expertAppointments: Collection<ExpertAppointmentDocument>,
  ): Promise<void> {
    const indexes = await this.getExistingIndexes(expertAppointments);
    const legacySlotIndex = indexes.find(
      (index) =>
        index.unique === true &&
        index.partialFilterExpression?.status === 'scheduled' &&
        index.key?.expertId === 1 &&
        index.key?.startsAt === 1 &&
        index.key?.status === 1 &&
        index.key?.buyerId !== 1,
    );

    if (!legacySlotIndex?.name) {
      return;
    }

    await expertAppointments.dropIndex(legacySlotIndex.name);
  }

  private async getExistingIndexes<T extends Document>(
    collection: Collection<T>,
  ): Promise<Awaited<ReturnType<Collection<T>['indexes']>>> {
    try {
      return await collection.indexes();
    } catch (error) {
      if (
        error instanceof Error &&
        /ns does not exist|NamespaceNotFound/i.test(error.message)
      ) {
        return [];
      }

      throw error;
    }
  }

  private async seedDefaults(): Promise<void> {
    const users = this.collection<UserDocument>('users');
    const categories = this.collection<CategoryDocument>('categories');
    const posts = this.collection<PostDocument>('posts');
    const comments = this.collection<CommentDocument>('comments');
    const lessonProgress =
      this.collection<LessonProgressDocument>('lessonProgress');
    const agents = this.collection<AgentDocument>('agents');
    const employabilityJobs =
      this.collection<EmployabilityJobDocument>('employabilityJobs');
    const employabilityTalentProfiles =
      this.collection<EmployabilityTalentProfileDocument>(
        'employabilityTalentProfiles',
      );

    await Promise.all(
      seedCategories.map((category) =>
        categories.updateOne(
          { id: category.id },
          { $setOnInsert: category },
          { upsert: true },
        ),
      ),
    );

    await Promise.all(
      seedPosts.map((post) =>
        posts.updateOne(
          { id: post.id },
          {
            $setOnInsert: {
              ...post,
              createdAt: new Date(post.createdAt),
              updatedAt: new Date(post.updatedAt),
            },
          },
          { upsert: true },
        ),
      ),
    );

    await Promise.all(
      seedComments.map((comment) =>
        comments.updateOne(
          { id: comment.id },
          {
            $setOnInsert: {
              ...comment,
              createdAt: new Date(comment.createdAt),
              updatedAt: new Date(comment.updatedAt),
            },
          },
          { upsert: true },
        ),
      ),
    );

    await Promise.all(
      seedLessonProgress.map((lesson) =>
        lessonProgress.updateOne(
          { id: lesson.id },
          { $setOnInsert: lesson },
          { upsert: true },
        ),
      ),
    );

    const agentSeedTasks = seedAgents.map((agent) =>
      agents.updateOne(
        { id: agent.id },
        {
          $setOnInsert: {
            ...agent,
            createdAt: new Date(agent.createdAt),
            updatedAt: new Date(agent.updatedAt),
          },
        },
        { upsert: true },
      ),
    );
    const employabilityJobSeedTasks = seedEmployabilityJobs.map((job) =>
      employabilityJobs.updateOne(
        { id: job.id },
        {
          $setOnInsert: {
            ...job,
            createdAt: new Date(job.createdAt),
            updatedAt: new Date(job.updatedAt),
          },
        },
        { upsert: true },
      ),
    );
    const employabilityTalentSeedTasks = seedEmployabilityTalentProfiles.map(
      (profile) =>
        employabilityTalentProfiles.updateOne(
          { id: profile.id },
          {
            $setOnInsert: {
              ...profile,
              createdAt: new Date(profile.createdAt),
              updatedAt: new Date(profile.updatedAt),
            },
          },
          { upsert: true },
        ),
    );

    await Promise.all([
      ...agentSeedTasks,
      ...employabilityJobSeedTasks,
      ...employabilityTalentSeedTasks,
    ]);

    await this.ensureAdminAccounts();
  }

  private async ensureAdminAccounts(): Promise<void> {
    const users = this.collection<UserDocument>('users');
    const adminSeeds = seedUsers.filter((user) => user.role === UserRole.ADMIN);

    await Promise.all(
      adminSeeds.map(async (admin) => {
        const now = new Date();
        const normalizedEmail = admin.email.toLowerCase();
        const passwordHash = await bcrypt.hash(admin.password, 10);
        const existingUser =
          (await users.findOne({ email: normalizedEmail })) ??
          (await users.findOne({ id: admin.id }));

        if (existingUser) {
          await users.updateOne(
            { id: existingUser.id },
            {
              $set: {
                passwordHash,
                fullName: admin.fullName,
                company: admin.company,
                commercialName: admin.commercialName,
                position: admin.position,
                phone: admin.phone,
                ruc: admin.ruc,
                sector: admin.sector,
                location: admin.location,
                description: admin.description,
                employeeCount: admin.employeeCount,
                digitalPresence: admin.digitalPresence,
                buyerProfile: admin.buyerProfile,
                supplierProfile: admin.supplierProfile,
                expertProfile: admin.expertProfile,
                role: UserRole.ADMIN,
                status: UserStatus.ACTIVE,
                points: admin.points,
                avatarUrl: admin.avatarUrl,
                updatedAt: now,
              },
            },
          );
          return;
        }

        await users.insertOne({
          id: admin.id,
          email: normalizedEmail,
          passwordHash,
          fullName: admin.fullName,
          company: admin.company,
          commercialName: admin.commercialName,
          position: admin.position,
          phone: admin.phone,
          ruc: admin.ruc,
          sector: admin.sector,
          location: admin.location,
          description: admin.description,
          employeeCount: admin.employeeCount,
          digitalPresence: admin.digitalPresence,
          buyerProfile: admin.buyerProfile,
          supplierProfile: admin.supplierProfile,
          expertProfile: admin.expertProfile,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          points: admin.points,
          avatarUrl: admin.avatarUrl,
          createdAt: new Date(admin.createdAt),
          updatedAt: now,
        });
      }),
    );
  }
}
