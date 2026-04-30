import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/domain/user.model';
import { UserRole } from '../users/domain/user-role.enum';

type NewsPostRecord = {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
  pdfUrl?: string;
  resourceUrl?: string;
  authorId: string;
  likedBy: string[];
  createdAt: Date;
  updatedAt: Date;
};

type NewsCommentRecord = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
};

type PublicCommentUser = {
  id: string;
  fullName: string;
  company: string;
  role: string;
};

type NewsCommentResponse = {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  user: PublicCommentUser;
  replies: NewsCommentResponse[];
};

type NewsPostResponse = {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
  pdfUrl?: string;
  resourceUrl?: string;
  timestamp: string;
  likes: number;
  isLiked: boolean;
  commentsCount: number;
  comments: NewsCommentResponse[];
};

@Injectable()
export class NewsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listPosts(viewerId?: string): Promise<{ items: NewsPostResponse[] }> {
    const posts = await this.postsCollection().find().sort({ createdAt: -1 }).toArray();

    if (!posts.length) {
      return { items: [] };
    }

    const comments = await this.commentsCollection()
      .find({ postId: { $in: posts.map((post) => post.id) } })
      .sort({ createdAt: 1 })
      .toArray();

    const usersMap = await this.createUsersMap([
      ...posts.map((post) => post.authorId),
      ...comments.map((comment) => comment.userId),
    ]);

    return {
      items: posts.map((post) => this.mapPost(post, comments, usersMap, viewerId)),
    };
  }

  async createPost(data: {
    title: string;
    body?: string;
    imageUrl?: string;
    pdfUrl?: string;
    resourceUrl?: string;
    authorId: string;
  }): Promise<{ post: NewsPostResponse }> {
    const author = await this.usersService.requireActiveUser(data.authorId);

    if (author.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo admins pueden publicar novedades');
    }

    const now = new Date();
    const post: NewsPostRecord = {
      id: crypto.randomUUID(),
      title: data.title.trim(),
      body: data.body?.trim() || undefined,
      imageUrl: data.imageUrl?.trim() || undefined,
      pdfUrl: data.pdfUrl?.trim() || undefined,
      resourceUrl: data.resourceUrl?.trim() || undefined,
      authorId: author.id,
      likedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.postsCollection().insertOne(post);

    return {
      post: {
        id: post.id,
        title: post.title,
        body: post.body,
        imageUrl: post.imageUrl,
        pdfUrl: post.pdfUrl,
        resourceUrl: post.resourceUrl,
        timestamp: post.createdAt.toISOString(),
        likes: 0,
        isLiked: false,
        commentsCount: 0,
        comments: [],
      },
    };
  }

  async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likes: number }> {
    await this.usersService.requireActiveUser(userId);
    const post = await this.findPost(postId);
    const liked = !post.likedBy.includes(userId);
    const likedBy = liked
      ? [...post.likedBy, userId]
      : post.likedBy.filter((item) => item !== userId);

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
      liked,
      likes: likedBy.length,
    };
  }

  async addComment(
    postId: string,
    data: { content: string; authorId: string; parentId?: string },
  ): Promise<{ comment: NewsCommentResponse }> {
    const author = await this.usersService.requireActiveUser(data.authorId);
    const post = await this.findPost(postId);
    const parentComment = data.parentId
      ? await this.commentsCollection().findOne({ id: data.parentId, postId })
      : null;

    if (data.parentId && !parentComment) {
      throw new NotFoundException('Comentario padre no encontrado');
    }

    const now = new Date();
    const comment: NewsCommentRecord = {
      id: crypto.randomUUID(),
      postId,
      userId: author.id,
      content: data.content.trim(),
      parentId: data.parentId,
      createdAt: now,
      updatedAt: now,
    };

    await this.commentsCollection().insertOne(comment);

    if (parentComment && parentComment.userId !== author.id) {
      const parentAuthor = await this.usersService.findById(parentComment.userId);

      if (parentAuthor && (parentAuthor.role === UserRole.BUYER || parentAuthor.role === UserRole.SUPPLIER)) {
        this.notificationsService.create({
          icon: 'MessageCircle',
          type: 'COMMENT_PUBLICATION',
          title: `Respondieron tu comentario en "${post.title}"`,
          body: comment.content.slice(0, 80),
          entityType: 'publication',
          entityId: post.id,
          fromUserId: author.id,
          role: parentAuthor.role,
          userId: parentAuthor.id,
          url: `/novedades?post=${post.id}`,
          time: 'Ahora',
        });
      }
    }

    return {
      comment: {
        id: comment.id,
        postId: comment.postId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        user: this.mapCommentUser(author),
        replies: [],
      },
    };
  }

  private async findPost(id: string): Promise<NewsPostRecord> {
    const post = await this.postsCollection().findOne({ id });

    if (!post) {
      throw new NotFoundException('Novedad no encontrada');
    }

    return post;
  }

  private mapPost(
    post: NewsPostRecord,
    comments: NewsCommentRecord[],
    usersMap: Map<string, User>,
    viewerId?: string,
  ): NewsPostResponse {
    const postComments = comments.filter((comment) => comment.postId === post.id);

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      imageUrl: post.imageUrl,
      pdfUrl: post.pdfUrl,
      resourceUrl: post.resourceUrl,
      timestamp: post.createdAt.toISOString(),
      likes: post.likedBy.length,
      isLiked: viewerId ? post.likedBy.includes(viewerId) : false,
      commentsCount: postComments.length,
      comments: this.mapCommentsTree(postComments, usersMap),
    };
  }

  private mapCommentsTree(
    comments: NewsCommentRecord[],
    usersMap: Map<string, User>,
  ): NewsCommentResponse[] {
    const byParent = new Map<string | undefined, NewsCommentRecord[]>();

    comments.forEach((comment) => {
      const items = byParent.get(comment.parentId) ?? [];
      items.push(comment);
      byParent.set(comment.parentId, items);
    });

    const buildTree = (parentId?: string): NewsCommentResponse[] =>
      (byParent.get(parentId) ?? []).map((comment) => {
        const user = usersMap.get(comment.userId);

        if (!user) {
          throw new NotFoundException('Usuario no encontrado');
        }

        return {
          id: comment.id,
          postId: comment.postId,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          user: this.mapCommentUser(user),
          replies: buildTree(comment.id),
        };
      });

    return buildTree(undefined);
  }

  private async createUsersMap(userIds: string[]): Promise<Map<string, User>> {
    const users = await this.usersService.findManyByIds(userIds);
    return new Map(users.map((user) => [user.id, user]));
  }

  private mapCommentUser(user: User): PublicCommentUser {
    return {
      id: user.id,
      fullName: user.fullName,
      company: user.company,
      role: user.role,
    };
  }

  private postsCollection() {
    return this.databaseService.collection<NewsPostRecord>('newsPosts');
  }

  private commentsCollection() {
    return this.databaseService.collection<NewsCommentRecord>('newsComments');
  }
}
