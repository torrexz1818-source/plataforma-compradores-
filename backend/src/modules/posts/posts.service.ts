import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User } from '../users/domain/user.model';
import { UserStatus } from '../users/domain/user-status.enum';
import { UsersService } from '../users/users.service';

type PostType = 'educational' | 'community';

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
  type: PostType;
  videoUrl?: string;
  thumbnailUrl?: string;
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
  videoUrl?: string;
  thumbnailUrl?: string;
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
  position: string;
  role: string;
  status: string;
  points: number;
  avatarUrl?: string;
  createdAt: string;
};

type PostResponse = {
  id: string;
  author: PublicUser;
  category: PostCategory;
  title: string;
  description: string;
  videoUrl?: string;
  thumbnailUrl?: string;
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

@Injectable()
export class PostsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly databaseService: DatabaseService,
  ) {}

  async getHomeFeed(viewerId?: string) {
    const educationalPosts = (await this.listPosts({ type: 'educational', viewerId })).items;
    const progressRecords = await this.lessonProgressCollection()
      .find(viewerId ? { userId: viewerId, progress: { $gt: 0 } } : { progress: { $gt: 0 } })
      .sort({ progress: -1 })
      .toArray();

    const continueWatching = await this.mapLessons(progressRecords);
    const [activeUsers, communityPostsCount] = await Promise.all([
      this.usersCollection().countDocuments({ status: UserStatus.ACTIVE }),
      this.postsCollection().countDocuments({ type: 'community' }),
    ]);

    return {
      stats: [
        { label: 'Compradores activos', value: `${activeUsers}+`, icon: 'users' },
        { label: 'Cursos disponibles', value: String(educationalPosts.length), icon: 'book' },
        { label: 'Posts esta semana', value: String(communityPostsCount), icon: 'message' },
        { label: 'Puntos otorgados', value: '34K', icon: 'trophy' },
      ],
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
    return this.categoriesCollection().find().sort({ name: 1 }).toArray();
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
    const [relatedPosts, comments, lesson] = await Promise.all([
      this.postsCollection()
        .find({ type: post.type, id: { $ne: post.id } })
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

    await this.ensureCategoryExists(data.categoryId);

    const now = new Date();
    const post: PostRecord = {
      id: crypto.randomUUID(),
      authorId: author.id,
      categoryId: data.categoryId,
      title: data.title.trim(),
      description: data.description.trim(),
      type,
      videoUrl: data.videoUrl?.trim() || undefined,
      thumbnailUrl: data.thumbnailUrl?.trim() || undefined,
      shares: 0,
      likedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.postsCollection().insertOne(post);

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
    await this.findPost(postId);
    const author = await this.usersService.requireActiveUser(data.authorId);

    if (data.parentId) {
      const parent = await this.commentsCollection().findOne({ id: data.parentId, postId });

      if (!parent) {
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
    await this.usersService.requireActiveUser(userId);
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

    return {
      liked: !wasLiked,
      likes: likedBy.length,
    };
  }

  private async mapPosts(posts: PostRecord[], viewerId?: string): Promise<PostResponse[]> {
    const usersMap = await this.createUsersMap(posts.map((post) => post.authorId));
    const categoriesMap = await this.createCategoriesMap(posts.map((post) => post.categoryId));
    const commentsCountMap = await this.createCommentsCountMap(posts.map((post) => post.id));

    return posts.map((post) =>
      this.mapPostFromMaps(post, viewerId, usersMap, categoriesMap, commentsCountMap),
    );
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
      videoUrl: post.videoUrl,
      thumbnailUrl: post.thumbnailUrl,
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
      const key = comment.parentId;
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
          author: this.mapUserFromMap(authorMap, post.authorId),
        },
      ];
    });
  }

  private async findPost(id: string): Promise<PostRecord> {
    const post = await this.postsCollection().findOne({ id });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  private async ensureCategoryExists(categoryId: string): Promise<void> {
    const category = await this.categoriesCollection().findOne({ id: categoryId });

    if (!category) {
      throw new NotFoundException('Category not found');
    }
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
      position: user.position,
      role: user.role,
      status: user.status,
      points: user.points,
      avatarUrl: user.avatarUrl,
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

  private lessonProgressCollection() {
    return this.databaseService.collection<LessonProgressRecord>('lessonProgress');
  }
}
