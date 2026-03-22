import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PostsService } from './posts.service';

type CreatePostBody = {
  title: string;
  description: string;
  categoryId: string;
  type?: 'educational' | 'community';
  videoUrl?: string;
  thumbnailUrl?: string;
};

type CreateCommentBody = {
  content: string;
  parentId?: string;
};

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('home')
  getHome(@Req() request: Request): Promise<unknown> {
    return this.postsService.getHomeFeed(this.getViewerId(request));
  }

  @Get('categories')
  async listCategories(): Promise<unknown> {
    return { items: await this.postsService.listCategories() };
  }

  @UseGuards(AuthenticatedGuard)
  @Post()
  createPost(
    @Body() body: CreatePostBody,
    @CurrentUser() user: { sub: string },
  ): Promise<unknown> {
    return this.postsService.createPost({
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      type: body.type,
      videoUrl: body.videoUrl,
      thumbnailUrl: body.thumbnailUrl,
      authorId: user.sub,
      isAdmin: false,
    });
  }

  @Get()
  listPosts(
    @Query('search') search: string | undefined,
    @Query('type') type: 'educational' | 'community' | undefined,
    @Query('categoryId') categoryId: string | undefined,
    @Req() request: Request,
  ): Promise<unknown> {
    return this.postsService.listPosts({
      search,
      type,
      categoryId,
      viewerId: this.getViewerId(request),
    });
  }

  @Get(':id')
  getPost(@Param('id') id: string, @Req() request: Request): Promise<unknown> {
    return this.postsService.getPostDetail(id, this.getViewerId(request));
  }

  @UseGuards(AuthenticatedGuard)
  @Post(':id/comments')
  createComment(
    @Param('id') id: string,
    @Body() body: CreateCommentBody,
    @CurrentUser() user: { sub: string },
  ): Promise<unknown> {
    return this.postsService.addComment(id, {
      content: body.content,
      authorId: user.sub,
      parentId: body.parentId,
    });
  }

  @UseGuards(AuthenticatedGuard)
  @Post(':id/like')
  toggleLike(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ): Promise<unknown> {
    return this.postsService.toggleLike(id, user.sub);
  }

  private getViewerId(request: Request): string | undefined {
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }

    try {
      const payload = this.jwtService.verify<{ sub?: string }>(header.slice(7).trim());
      return payload.sub;
    } catch {
      return undefined;
    }
  }
}
