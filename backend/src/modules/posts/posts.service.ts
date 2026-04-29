import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/domain/user.model';
import { UserRole } from '../users/domain/user-role.enum';
import { UserStatus } from '../users/domain/user-status.enum';
import { UsersService } from '../users/users.service';

type PostType = 'educational' | 'community' | 'liquidation';
type LearningRouteId = 'ruta-1' | 'ruta-2' | 'ruta-3' | 'ruta-4';
type LearningRouteAlias = 'ruta_1' | 'ruta_2' | 'ruta_3' | 'ruta_4';

const learningRouteIds: LearningRouteId[] = ['ruta-1', 'ruta-2', 'ruta-3', 'ruta-4'];
const learningRouteAliases: Record<LearningRouteAlias, LearningRouteId> = {
  ruta_1: 'ruta-1',
  ruta_2: 'ruta-2',
  ruta_3: 'ruta-3',
  ruta_4: 'ruta-4',
};

function normalizeLearningRoute(value?: string): LearningRouteId | undefined {
  if (learningRouteIds.includes(value as LearningRouteId)) {
    return value as LearningRouteId;
  }

  return value ? learningRouteAliases[value as LearningRouteAlias] : undefined;
}

function getLearningRouteStorageValues(value?: string): Array<LearningRouteId | LearningRouteAlias> {
  const normalized = normalizeLearningRoute(value);
  return normalized ? [normalized, normalized.replace('-', '_') as LearningRouteAlias] : [];
}

type PostCategory = {
  id: string;
  name: string;
  slug: string;
};

type PostRecord = {
  id: string;
  authorId: string;
  categoryId: string;
  title: string;
  description: string;
  learningRoute?: LearningRouteId | LearningRouteAlias;
  type: PostType;
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  thumbnailUrl?: string;
  resources?: Array<{
    id: string;
    type: 'image' | 'file' | 'link';
    name: string;
    url: string;
  }>;
  shares: number;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
};

type CommentRecord = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
};

type LessonProgressRecord = {
  id: string;
  postId: string;
  userId: string;
  progress: number;
  duration: string;
};

type EducationalContentViewRecord = {
  id: string;
  contentId: string;
  userId: string;
  viewedAt: Date;
  month: string;
};

type MessageRecord = {
  id: string;
  senderId: string;
  supplierId: string;
  buyerId?: string;
  publicationId?: string;
  postId?: string;
  message: string;
  createdAt: Date;
};

type ListPostsFilters = {
  search?: string;
  type?: PostType;
  categoryId?: string;
  viewerId?: string;
};

type CreatePostData = {
  title: string;
  description: string;
  categoryId: string;
  type?: PostType;
  learningRoute?: string;
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  thumbnailUrl?: string;
  resources?: Array<{
    id: string;
    type: 'image' | 'file' | 'link';
    name: string;
    url: string;
  }>;
  authorId: string;
  isAdmin: boolean;
};

type CreateCommentData = {
  content: string;
  authorId: string;
  parentId?: string;
};

type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  company: string;
  commercialName?: string;
  position: string;
  phone?: string;
  ruc?: string;
  sector?: string;
  location?: string;
  description?: string;
  role: string;
  status: string;
  points: number;
  avatarUrl?: string;
  employeeCount?: string;
  digitalPresence?: User['digitalPresence'];
  buyerProfile?: User['buyerProfile'];
  supplierProfile?: User['supplierProfile'];
  createdAt: string;
};

type PostResponse = {
  id: string;
  author: PublicUser;
  category: PostCategory;
  title: string;
  description: string;
  learningRoute?: LearningRouteId;
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  thumbnailUrl?: string;
  resources?: Array<{
    id: string;
    type: 'image' | 'file' | 'link';
    name: string;
    url: string;
  }>;
  type: PostType;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  createdAt: string;
};

type CommentResponse = {
  id: string;
  postId: string;
  user: PublicUser;
  content: string;
  likes: number;
  isLiked: boolean;
  replies: CommentResponse[];
  createdAt: string;
};

type LessonResponse = {
  id: string;
  postId: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  progress: number;
  author: PublicUser;
};

type HomeActivityPoint = {
  date: string;
  posts: number;
};

type PublicationMessageResponse = {
  id: string;
  publicationId: string;
  supplierId: string;
  buyerId: string;
  buyerName: string;
  buyerCompany: string;
  content: string;
  reply?: string;
  status: 'pending' | 'replied';
  createdAt: string;
};

type PublicationResponse = {
  id: string;
  title: string;
  content: string;
  image?: string;
  url?: string;
  createdAt: string;
  supplierId: string;
  messages: PublicationMessageResponse[];
};

@Injectable()
export class PostsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getHomeFeed(viewerId?: string) {
    const educationalPosts = (await this.listPosts({ type: 'educational', viewerId })).items;
    const progressRecords = await this.lessonProgressCollection()
      .find(viewerId ? { userId: viewerId, progress: { $gt: 0 } } : { progress: { $gt: 0 } })
      .sort({ progress: -1 })
      .toArray();

    const continueWatching = await this.mapLessons(progressRecords);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [communityPostsCount, commentsLast7Days, activityByDay] = await Promise.all([
      this.postsCollection().countDocuments({ type: 'community' }),
      this.commentsCollection().countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      this.buildCommunityActivityByDay(sevenDaysAgo),
    ]);

    const averageLessonProgress =
      continueWatching.length > 0
        ? Math.round(
            continueWatching.reduce((total, lesson) => total + lesson.progress, 0) /
              continueWatching.length,
          )
        : 0;

    const topEducationalPosts = educationalPosts
      .map((post) => ({
        id: post.id,
        title: post.title,
        engagement: post.likes + post.comments + post.shares,
        likes: post.likes,
        comments: post.comments,
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 3);

    return {
      stats: [
        { label: 'Cursos disponibles', value: String(educationalPosts.length), icon: 'book' },
        { label: 'Posts esta semana', value: String(communityPostsCount), icon: 'message' },
      ],
      dashboard: {
        summary: {
          averageLessonProgress,
          commentsLast7Days,
          educationalPostsCount: educationalPosts.length,
        },
        activityByDay,
        topEducationalPosts,
      },
      educationalPosts,
      continueWatching,
    };
  }

  async getAdminDashboard() {
    const [users, posts, comments, categories] = await Promise.all([
      this.usersService.list(),
      this.postsCollection().find().sort({ createdAt: -1 }).toArray(),
      this.commentsCollection().find().sort({ createdAt: -1 }).toArray(),
      this.listCategories(),
    ]);

    const postMap = new Map(posts.map((post) => [post.id, post]));
    const usersMap = await this.createUsersMap([
      ...posts.map((post) => post.authorId),
      ...comments.map((comment) => comment.userId),
    ]);

    return {
      overview: {
        totalUsers: users.length,
        activeUsers: users.filter((user) => user.status === UserStatus.ACTIVE).length,
        totalPosts: posts.length,
        educationalPosts: posts.filter((post) => post.type === 'educational').length,
        totalComments: comments.length,
      },
      categories,
      users: users.map((user) => this.mapUser(user)),
      posts: await this.mapPosts(posts),
      comments: comments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        postTitle: postMap.get(comment.postId)?.title ?? 'Post eliminado',
        user: this.mapUserFromMap(usersMap, comment.userId),
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        repliesCount: comments.filter((item) => item.parentId === comment.id).length,
      })),
    };
  }

  listCategories(): Promise<PostCategory[]> {
    return this.categoriesCollection()
      .find()
      .toArray()
      .then((categories) => this.sortCategories(categories));
  }

  async listPosts(filters: ListPostsFilters) {
    const query: Record<string, unknown> = {};
    const search = filters.search?.trim();

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.categoryId) {
      query.categoryId = filters.categoryId;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const posts = await this.postsCollection().find(query).sort({ createdAt: -1 }).toArray();

    return {
      items: await this.mapPosts(posts, filters.viewerId),
    };
  }

  async getPostDetail(id: string, viewerId?: string) {
    const post = await this.findPost(id);
    const postLearningRoute = normalizeLearningRoute(post.learningRoute) ?? 'ruta-1';
    const postLearningRouteValues = getLearningRouteStorageValues(postLearningRoute);
    const relatedPostsQuery =
      post.type === 'educational'
        ? {
            type: post.type,
            id: { $ne: post.id },
            learningRoute: { $in: postLearningRouteValues },
          }
        : {
            type: post.type,
            id: { $ne: post.id },
          };

    const [relatedPosts, comments, lesson] = await Promise.all([
      this.postsCollection()
        .find(relatedPostsQuery)
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray(),
      this.commentsCollection().find({ postId: post.id }).sort({ createdAt: 1 }).toArray(),
      this.mapLessonByPost(post.id, viewerId),
    ]);

    const allPosts = [post, ...relatedPosts];
    const usersMap = await this.createUsersMap([
      ...allPosts.map((item) => item.authorId),
      ...comments.map((comment) => comment.userId),
    ]);
    const categoriesMap = await this.createCategoriesMap(allPosts.map((item) => item.categoryId));
    const commentsCountMap = await this.createCommentsCountMap(allPosts.map((item) => item.id));

    return {
      post: this.mapPostFromMaps(post, viewerId, usersMap, categoriesMap, commentsCountMap),
      comments: this.mapCommentsTree(comments, viewerId, usersMap),
      relatedPosts: relatedPosts.map((item) =>
        this.mapPostFromMaps(item, viewerId, usersMap, categoriesMap, commentsCountMap),
      ),
      lesson,
    };
  }

  async createPost(data: CreatePostData): Promise<{ post: PostResponse }> {
    const author = await this.usersService.requireActiveUser(data.authorId);
    const type = data.type ?? 'community';

    if (type === 'educational' && !data.isAdmin) {
      throw new ForbiddenException('Only the administrator can publish educational videos');
    }
    const learningRoute = type === 'educational'
      ? normalizeLearningRoute(data.learningRoute)
      : undefined;

    if (type === 'educational' && !learningRoute) {
      throw new BadRequestException('Selecciona una ruta tematica para publicar contenido educativo.');
    }

    const category = await this.ensureCategoryExists(data.categoryId);

    if (
      type === 'community' &&
      this.usersService.isBuyerLikeRole(author.role) &&
      !['tips', 'pregunta', 'recomendacion', 'experiencia'].includes(category.slug)
    ) {
      throw new ForbiddenException(
        'En Comunidad solo se permiten tips, preguntas, recomendaciones y experiencias.',
      );
    }

    const now = new Date();
    const post: PostRecord = {
      id: crypto.randomUUID(),
      authorId: author.id,
      categoryId: data.categoryId,
      title: data.title.trim(),
      description: data.description.trim(),
      learningRoute,
      type,
      mediaType: data.mediaType ?? (data.videoUrl ? 'video' : data.thumbnailUrl ? 'image' : undefined),
      videoUrl: data.videoUrl?.trim() || undefined,
      thumbnailUrl: data.thumbnailUrl?.trim() || undefined,
      resources: data.resources?.filter((item) => item.url?.trim() && item.name?.trim()).map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name.trim(),
        url: item.url.trim(),
      })),
      shares: 0,
      likedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.postsCollection().insertOne(post);

    await this.notifyNewPostToAllUsers(post, author);

    const categoriesMap = await this.createCategoriesMap([post.categoryId]);
    const usersMap = new Map([[author.id, author]]);
    const commentsCountMap = new Map<string, number>([[post.id, 0]]);

    return {
      post: this.mapPostFromMaps(post, author.id, usersMap, categoriesMap, commentsCountMap),
    };
  }

  async deletePost(id: string): Promise<{ deleted: true }> {
    await this.findPost(id);

    await Promise.all([
      this.postsCollection().deleteOne({ id }),
      this.commentsCollection().deleteMany({ postId: id }),
      this.lessonProgressCollection().deleteMany({ postId: id }),
    ]);

    return { deleted: true };
  }

  async addComment(postId: string, data: CreateCommentData): Promise<{ comment: CommentResponse }> {
    const post = await this.findPost(postId);
    const author = await this.usersService.requireActiveUser(data.authorId);
    const postAuthor = await this.usersService.findById(post.authorId);
    const parentComment = data.parentId
      ? await this.commentsCollection().findOne({ id: data.parentId, postId })
      : null;
    const parentCommentAuthor = parentComment
      ? await this.usersService.findById(parentComment.userId)
      : null;

    if (post.type === 'community' && author.role === UserRole.ADMIN) {
      throw new ForbiddenException('Solo compradores y proveedores pueden comentar en Comunidad');
    }

    if (data.parentId) {
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const now = new Date();
    const comment: CommentRecord = {
      id: crypto.randomUUID(),
      postId,
      userId: author.id,
      content: data.content.trim(),
      parentId: data.parentId,
      likedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.commentsCollection().insertOne(comment);

    if (
      postAuthor &&
      postAuthor.id !== author.id &&
      (postAuthor.role === UserRole.BUYER || postAuthor.role === UserRole.SUPPLIER)
    ) {
      this.notificationsService.create({
        icon: 'MessageCircle',
        type: 'COMMENT_PUBLICATION',
        title: `${author.fullName} de ${author.company} comento tu publicacion "${post.title}"`,
        body: comment.content.slice(0, 80),
        entityType: 'publication',
        entityId: post.id,
        fromUserId: author.id,
        role: postAuthor.role,
        userId: postAuthor.id,
        url: this.getPostNotificationUrl(post),
        time: 'Ahora',
      });
    }

    if (
      parentComment &&
      parentCommentAuthor &&
      parentCommentAuthor.id !== author.id &&
      parentCommentAuthor.id !== postAuthor?.id &&
      (parentCommentAuthor.role === UserRole.BUYER || parentCommentAuthor.role === UserRole.SUPPLIER)
    ) {
      this.notificationsService.create({
        icon: 'MessageCircle',
        type: 'COMMENT_PUBLICATION',
        title: `${author.fullName} respondio tu comentario en "${post.title}"`,
        body: comment.content.slice(0, 80),
        entityType: 'publication',
        entityId: post.id,
        fromUserId: author.id,
        role: parentCommentAuthor.role,
        userId: parentCommentAuthor.id,
        url: this.getPostNotificationUrl(post),
        time: 'Ahora',
      });
    }

    return {
      comment: {
        id: comment.id,
        postId: comment.postId,
        user: this.mapUser(author),
        content: comment.content,
        likes: 0,
        isLiked: false,
        replies: [],
        createdAt: comment.createdAt.toISOString(),
      },
    };
  }

  async deleteComment(id: string): Promise<{ deleted: true; removedCount: number }> {
    const comment = await this.commentsCollection().findOne({ id });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const allComments = await this.commentsCollection().find({ postId: comment.postId }).toArray();
    const idsToDelete = new Set<string>([id]);
    const queue = [id];

    while (queue.length > 0) {
      const current = queue.shift();

      allComments
        .filter((item) => item.parentId === current)
        .forEach((reply) => {
          if (!idsToDelete.has(reply.id)) {
            idsToDelete.add(reply.id);
            queue.push(reply.id);
          }
        });
    }

    const result = await this.commentsCollection().deleteMany({
      id: { $in: Array.from(idsToDelete) },
    });

    return { deleted: true, removedCount: result.deletedCount ?? 0 };
  }

  async toggleLike(postId: string, userId: string) {
    const actor = await this.usersService.requireActiveUser(userId);
    const post = await this.findPost(postId);
    const wasLiked = post.likedBy.includes(userId);
    const likedBy = wasLiked
      ? post.likedBy.filter((item) => item !== userId)
      : [...post.likedBy, userId];

    await this.postsCollection().updateOne(
      { id: postId },
      {
        $set: {
          likedBy,
          updatedAt: new Date(),
        },
      },
    );

    if (!wasLiked && actor.id !== post.authorId) {
      const postAuthor = await this.usersService.findById(post.authorId);
      if (postAuthor && (postAuthor.role === UserRole.SUPPLIER || postAuthor.role === UserRole.BUYER)) {
        this.notificationsService.create({
          icon: 'Star',
          type: 'LIKE_PUBLICATION',
          title: `${actor.fullName} dio me gusta a tu publicacion "${post.title}"`,
          body: post.description.slice(0, 80),
          entityType: 'publication',
          entityId: post.id,
          fromUserId: actor.id,
          role: postAuthor.role,
          userId: postAuthor.id,
          url: `/publicaciones?highlight=${post.id}`,
          time: 'Ahora',
        });
      }
    }

    return {
      liked: !wasLiked,
      likes: likedBy.length,
    };
  }

  async toggleCommentLike(postId: string, commentId: string, userId: string) {
    const actor = await this.usersService.requireActiveUser(userId);
    const [post, comment] = await Promise.all([
      this.findPost(postId),
      this.commentsCollection().findOne({ id: commentId, postId }),
    ]);

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (post.type === 'community' && actor.role === UserRole.ADMIN) {
      throw new ForbiddenException('Solo compradores y proveedores pueden interactuar en Comunidad');
    }

    const wasLiked = comment.likedBy.includes(userId);
    const likedBy = wasLiked
      ? comment.likedBy.filter((item) => item !== userId)
      : [...comment.likedBy, userId];

    await this.commentsCollection().updateOne(
      { id: commentId, postId },
      {
        $set: {
          likedBy,
          updatedAt: new Date(),
        },
      },
    );

    return {
      liked: !wasLiked,
      likes: likedBy.length,
    };
  }

  async listSupplierPublications(supplierId: string): Promise<PublicationResponse[]> {
    const supplier = await this.usersService.requireActiveUser(supplierId);
    const isAdmin = supplier.role === UserRole.ADMIN;
    if (!isAdmin && supplier.role !== UserRole.SUPPLIER) {
      throw new ForbiddenException('Solo proveedores pueden ver publicaciones');
    }

    const [posts, messages] = await Promise.all([
      isAdmin
        ? this.postsCollection().find({ type: 'liquidation' }).sort({ createdAt: -1 }).toArray()
        : this.postsCollection().find({ authorId: supplierId, type: 'liquidation' }).sort({ createdAt: -1 }).toArray(),
      isAdmin
        ? this.messagesCollection().find({}).sort({ createdAt: 1 }).toArray()
        : this.messagesCollection().find({ supplierId }).sort({ createdAt: 1 }).toArray(),
    ]);

    const authorIds = Array.from(new Set(posts.map((post) => post.authorId)));
    const postAuthors = await this.usersService.findManyByIds(authorIds);
    const supplierAuthorIds = new Set(
      postAuthors.filter((author) => author.role === UserRole.SUPPLIER).map((author) => author.id),
    );
    const scopedPosts = isAdmin
      ? posts.filter((post) => supplierAuthorIds.has(post.authorId))
      : posts;

    const incomingMessages = messages.filter(
      (message) =>
        message.buyerId &&
        (!isAdmin
          ? message.senderId !== supplierId
          : message.senderId !== message.supplierId),
    );
    const outgoingMessages = messages.filter(
      (message) =>
        message.buyerId &&
        (!isAdmin
          ? message.senderId === supplierId
          : message.senderId === message.supplierId),
    );
    const buyerIds = Array.from(
      new Set(
        incomingMessages
          .map((message) => message.buyerId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const buyers = await this.usersService.findManyByIds(buyerIds);
    const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer]));

    return scopedPosts.map((post) => {
      if (!isAdmin && post.authorId !== supplierId) {
        throw new ForbiddenException('No autorizado para ver los mensajes de esta publicacion');
      }

      const publicationMessages: PublicationMessageResponse[] = incomingMessages
        .filter((message) => this.getMessagePublicationId(message) === post.id)
        .map((message) => {
          const buyerId = message.buyerId as string;
          const buyer = buyerMap.get(buyerId);
          const reply = outgoingMessages
            .filter(
              (item) =>
                item.buyerId === buyerId &&
                this.getMessagePublicationId(item) === post.id &&
                item.createdAt.getTime() >= message.createdAt.getTime(),
            )
            .slice(-1)[0];
          const status: PublicationMessageResponse['status'] = reply ? 'replied' : 'pending';

          return {
            id: message.id,
            publicationId: post.id,
            supplierId,
            buyerId,
            buyerName: buyer?.fullName ?? 'Comprador',
            buyerCompany: buyer?.company ?? 'Empresa',
            content: message.message,
            reply: reply?.message,
            status,
            createdAt: message.createdAt.toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        id: post.id,
        title: post.title,
        content: post.description,
        image: post.thumbnailUrl,
        url: post.videoUrl,
        createdAt: post.createdAt.toISOString(),
        supplierId: post.authorId,
        messages: publicationMessages,
      };
    });
  }

  async getSupplierPublicationById(
    publicationId: string,
    supplierId: string,
  ): Promise<PublicationResponse> {
    const publications = await this.listSupplierPublications(supplierId);
    const publication = publications.find((item) => item.id === publicationId);

    if (!publication) {
      throw new NotFoundException('Publicacion no encontrada');
    }

    const requester = await this.usersService.requireActiveUser(supplierId);
    if (requester.role !== UserRole.ADMIN && publication.supplierId !== supplierId) {
      throw new ForbiddenException('No autorizado para acceder a esta publicacion');
    }

    return publication;
  }

  async updateSupplierPublication(
    publicationId: string,
    supplierId: string,
    data: { title?: string; content?: string; image?: string; url?: string },
  ): Promise<PublicationResponse> {
    const post = await this.findPost(publicationId);
    const requester = await this.usersService.requireActiveUser(supplierId);

    if (requester.role !== UserRole.ADMIN && post.authorId !== supplierId) {
      throw new ForbiddenException('No autorizado para editar esta publicacion');
    }

    const updates: Partial<PostRecord> = {};

    if (typeof data.title === 'string') {
      updates.title = data.title.trim();
    }

    if (typeof data.content === 'string') {
      updates.description = data.content.trim();
    }

    if (typeof data.image === 'string') {
      updates.thumbnailUrl = data.image.trim() || undefined;
    }

    if (typeof data.url === 'string') {
      updates.videoUrl = data.url.trim() || undefined;
    }

    if (Object.keys(updates).length === 0) {
      return this.getSupplierPublicationById(publicationId, supplierId);
    }

    updates.updatedAt = new Date();

    await this.postsCollection().updateOne({ id: publicationId }, { $set: updates });

    return this.getSupplierPublicationById(publicationId, supplierId);
  }

  async registerEducationalContentView(contentId: string, userId: string) {
    const content = await this.postsCollection().findOne({
      id: contentId,
      type: 'educational',
    });

    if (!content) {
      throw new NotFoundException('Contenido educativo no encontrado');
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await this.educationalViewsCollection().insertOne({
      id: crypto.randomUUID(),
      contentId,
      userId,
      viewedAt: now,
      month,
    });

    return {
      success: true,
      contentId,
    };
  }

  async getTopEducationalContent(month: string, limit = 3) {
    const normalizedMonth = this.normalizeMonth(month);
    const viewCounts = await this.educationalViewsCollection()
      .aggregate<{ _id: string; viewCount: number }>([
        { $match: { month: normalizedMonth } },
        { $group: { _id: '$contentId', viewCount: { $sum: 1 } } },
        { $sort: { viewCount: -1 } },
        { $limit: Math.max(1, limit) },
      ])
      .toArray();

    if (!viewCounts.length) {
      return [];
    }

    const posts = await this.postsCollection()
      .find({
        id: { $in: viewCounts.map((item) => item._id) },
        type: 'educational',
      })
      .toArray();
    const postMap = new Map(posts.map((post) => [post.id, post]));

    return viewCounts.flatMap((item) => {
      const post = postMap.get(item._id);
      if (!post) {
        return [];
      }

      return [
        {
          id: post.id,
          title: post.title,
          description: post.description,
          viewCount: item.viewCount,
        },
      ];
    });
  }

  async getRecommendedEducationalContent(buyerId: string, limit = 3) {
    const buyer = await this.usersService.requireActiveUser(buyerId);
    const keywords = [
      buyer.sector ?? '',
      ...(buyer.description ?? '').split(','),
    ]
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    const educationalPosts = await this.postsCollection()
      .find({ type: 'educational' })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const scored = educationalPosts.map((post) => {
      let score = 0;
      const haystack = `${post.title} ${post.description}`.toLowerCase();
      keywords.forEach((keyword) => {
        if (haystack.includes(keyword)) {
          score += 2;
        }
      });
      return {
        id: post.id,
        title: post.title,
        description: post.description,
        score,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit));
  }

  private async mapPosts(posts: PostRecord[], viewerId?: string): Promise<PostResponse[]> {
    const usersMap = await this.createUsersMap(posts.map((post) => post.authorId));
    const categoriesMap = await this.createCategoriesMap(posts.map((post) => post.categoryId));
    const commentsCountMap = await this.createCommentsCountMap(posts.map((post) => post.id));

    return posts.flatMap((post) => {
      const mapped = this.tryMapPostFromMaps(
        post,
        viewerId,
        usersMap,
        categoriesMap,
        commentsCountMap,
      );

      return mapped ? [mapped] : [];
    });
  }

  private mapPostFromMaps(
    post: PostRecord,
    viewerId: string | undefined,
    usersMap: Map<string, User>,
    categoriesMap: Map<string, PostCategory>,
    commentsCountMap: Map<string, number>,
  ): PostResponse {
    return {
      id: post.id,
      author: this.mapUserFromMap(usersMap, post.authorId),
      category: this.getRequiredCategoryFromMap(categoriesMap, post.categoryId),
      title: post.title,
      description: post.description,
      learningRoute: normalizeLearningRoute(post.learningRoute),
      mediaType: post.mediaType,
      videoUrl: post.videoUrl,
      thumbnailUrl: post.thumbnailUrl,
      resources: post.resources ?? [],
      type: post.type,
      likes: post.likedBy.length,
      comments: commentsCountMap.get(post.id) ?? 0,
      shares: post.shares,
      isLiked: viewerId ? post.likedBy.includes(viewerId) : false,
      createdAt: post.createdAt.toISOString(),
    };
  }

  private mapCommentsTree(
    comments: CommentRecord[],
    viewerId: string | undefined,
    usersMap: Map<string, User>,
  ): CommentResponse[] {
    const byParent = new Map<string | undefined, CommentRecord[]>();

    comments.forEach((comment) => {
      const key = comment.parentId ?? undefined;
      const items = byParent.get(key) ?? [];
      items.push(comment);
      byParent.set(key, items);
    });

    const buildTree = (parentId?: string): CommentResponse[] =>
      (byParent.get(parentId) ?? []).map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        user: this.mapUserFromMap(usersMap, comment.userId),
        content: comment.content,
        likes: comment.likedBy.length,
        isLiked: viewerId ? comment.likedBy.includes(viewerId) : false,
        replies: buildTree(comment.id),
        createdAt: comment.createdAt.toISOString(),
      }));

    return buildTree(undefined);
  }

  private async mapLessonByPost(
    postId: string,
    viewerId?: string,
  ): Promise<LessonResponse | null> {
    const lesson = await this.lessonProgressCollection().findOne(
      viewerId ? { postId, userId: viewerId } : { postId },
    );

    if (!lesson) {
      return null;
    }

    const items = await this.mapLessons([lesson]);
    return items[0] ?? null;
  }

  private async mapLessons(progressRecords: LessonProgressRecord[]): Promise<LessonResponse[]> {
    if (progressRecords.length === 0) {
      return [];
    }

    const posts = await this.postsCollection()
      .find({ id: { $in: progressRecords.map((item) => item.postId) } })
      .toArray();
    const postsMap = new Map(posts.map((post) => [post.id, post]));
    const authorMap = await this.createUsersMap(posts.map((post) => post.authorId));

    return progressRecords.flatMap((lesson) => {
      const post = postsMap.get(lesson.postId);

      if (!post?.videoUrl) {
        return [];
      }

      const author = authorMap.get(post.authorId);

      if (!author) {
        return [];
      }

      return [
        {
          id: lesson.id,
          postId: post.id,
          title: post.title,
          description: post.description,
          videoUrl: post.videoUrl,
          thumbnailUrl: post.thumbnailUrl ?? '',
          duration: lesson.duration,
          progress: lesson.progress,
          author: this.mapUser(author),
        },
      ];
    });
  }

  private tryMapPostFromMaps(
    post: PostRecord,
    viewerId: string | undefined,
    usersMap: Map<string, User>,
    categoriesMap: Map<string, PostCategory>,
    commentsCountMap: Map<string, number>,
  ): PostResponse | null {
    const author = usersMap.get(post.authorId);
    const category = categoriesMap.get(post.categoryId);

    if (!author || !category) {
      return null;
    }

    return {
      id: post.id,
      author: this.mapUser(author),
      category,
      title: post.title,
      description: post.description,
      learningRoute: normalizeLearningRoute(post.learningRoute),
      mediaType: post.mediaType,
      videoUrl: post.videoUrl,
      thumbnailUrl: post.thumbnailUrl,
      resources: post.resources ?? [],
      type: post.type,
      likes: post.likedBy.length,
      comments: commentsCountMap.get(post.id) ?? 0,
      shares: post.shares,
      isLiked: viewerId ? post.likedBy.includes(viewerId) : false,
      createdAt: post.createdAt.toISOString(),
    };
  }

  private getPostNotificationUrl(post: PostRecord): string {
    if (post.type === 'community') {
      return `/buyer/community/post/${post.id}`;
    }

    if (post.type === 'educational') {
      return `/post/${post.id}`;
    }

    return `/publicaciones?highlight=${post.id}&expand=messages`;
  }

  private async notifyNewPostToAllUsers(post: PostRecord, author: User): Promise<void> {
    const [buyerRecipients, supplierRecipients] = await Promise.all([
      this.usersService.listActiveUserIdsByRoles([UserRole.BUYER, UserRole.EXPERT], author.id),
      this.usersService.listActiveUserIdsByRole(UserRole.SUPPLIER, author.id),
    ]);

    const isEducational = post.type === 'educational';
    const notificationType = isEducational ? 'NEW_EDUCATIONAL_CONTENT' : 'NEW_PUBLICATION';
    const titleByType: Record<PostType, string> = {
      community: 'Nueva publicacion en Comunidad',
      educational: `Nuevo contenido educativo: "${post.title}"`,
      liquidation: 'Nueva publicacion de proveedor',
    };
    const url = this.getPostNotificationUrl(post);

    await Promise.all([
      this.notificationsService.createForUsers({
        icon: 'FileText',
        type: notificationType,
        title: titleByType[post.type],
        body: `${author.company} publico: "${post.title}".`,
        entityType: isEducational ? 'content' : 'publication',
        entityId: post.id,
        fromUserId: author.id,
        role: UserRole.BUYER,
        userIds: buyerRecipients,
        url,
        time: 'Ahora',
      }),
      this.notificationsService.createForUsers({
        icon: 'FileText',
        type: notificationType,
        title: titleByType[post.type],
        body: `${author.company} publico: "${post.title}".`,
        entityType: isEducational ? 'content' : 'publication',
        entityId: post.id,
        fromUserId: author.id,
        role: UserRole.SUPPLIER,
        userIds: supplierRecipients,
        url,
        time: 'Ahora',
      }),
    ]);
  }

  private async buildCommunityActivityByDay(startDate: Date): Promise<HomeActivityPoint[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activityCounts = await this.postsCollection()
      .aggregate<{ _id: string; total: number }>([
        { $match: { type: 'community', createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
              },
            },
            total: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const countsMap = new Map(activityCounts.map((item) => [item._id, item.total]));

    return Array.from({ length: 7 }, (_, index) => {
      const pointDate = new Date(startDate);
      pointDate.setDate(startDate.getDate() + index);
      pointDate.setHours(0, 0, 0, 0);

      if (pointDate > today) {
        return {
          date: pointDate.toISOString().slice(0, 10),
          posts: 0,
        };
      }

      const key = pointDate.toISOString().slice(0, 10);

      return {
        date: key,
        posts: countsMap.get(key) ?? 0,
      };
    });
  }

  private async findPost(id: string): Promise<PostRecord> {
    const post = await this.postsCollection().findOne({ id });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  private async ensureCategoryExists(categoryId: string): Promise<PostCategory> {
    const category = await this.categoriesCollection().findOne({ id: categoryId });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private async createUsersMap(userIds: string[]): Promise<Map<string, User>> {
    const users = await this.usersService.findManyByIds(userIds);
    return new Map(users.map((user) => [user.id, user]));
  }

  private async createCategoriesMap(categoryIds: string[]): Promise<Map<string, PostCategory>> {
    if (categoryIds.length === 0) {
      return new Map();
    }

    const categories = await this.categoriesCollection()
      .find({ id: { $in: Array.from(new Set(categoryIds)) } })
      .toArray();

    return new Map(categories.map((category) => [category.id, category]));
  }

  private async createCommentsCountMap(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const counts = await this.commentsCollection()
      .aggregate<{ _id: string; total: number }>([
        { $match: { postId: { $in: Array.from(new Set(postIds)) } } },
        { $group: { _id: '$postId', total: { $sum: 1 } } },
      ])
      .toArray();

    return new Map(counts.map((item) => [item._id, item.total]));
  }

  private mapUser(user: User): PublicUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      company: user.company,
      commercialName: user.commercialName,
      position: user.position,
      phone: user.phone,
      ruc: user.ruc,
      sector: user.sector,
      location: user.location,
      description: user.description,
      role: user.role,
      status: user.status,
      points: user.points,
      avatarUrl: user.avatarUrl,
      employeeCount: user.employeeCount,
      digitalPresence: user.digitalPresence,
      buyerProfile: user.buyerProfile,
      supplierProfile: user.supplierProfile,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private mapUserFromMap(usersMap: Map<string, User>, userId: string): PublicUser {
    const user = usersMap.get(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapUser(user);
  }

  private getRequiredCategoryFromMap(
    categoriesMap: Map<string, PostCategory>,
    categoryId: string,
  ): PostCategory {
    const category = categoriesMap.get(categoryId);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private getMessagePublicationId(message: MessageRecord): string | undefined {
    return message.publicationId ?? message.postId;
  }

  private usersCollection() {
    return this.databaseService.collection<User>('users');
  }

  private categoriesCollection() {
    return this.databaseService.collection<PostCategory>('categories');
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

  private lessonProgressCollection() {
    return this.databaseService.collection<LessonProgressRecord>('lessonProgress');
  }

  private educationalViewsCollection() {
    return this.databaseService.collection<EducationalContentViewRecord>('educationalContentViews');
  }

  private normalizeMonth(value?: string): string {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      return value;
    }

    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private sortCategories(categories: PostCategory[]): PostCategory[] {
    const preferredOrder = ['cat-1', 'cat-5', 'cat-2', 'cat-3', 'cat-6', 'cat-7', 'cat-4'];

    return [...categories].sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left.id);
      const rightIndex = preferredOrder.indexOf(right.id);

      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }

      return left.name.localeCompare(right.name);
    });
  }
}
