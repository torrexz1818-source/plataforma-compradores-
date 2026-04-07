import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/auth/admin.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { PostsService } from '../posts/posts.service';
import { UserStatus } from '../users/domain/user-status.enum';
import { MembershipStatus } from '../users/users.service';
import { UsersService } from '../users/users.service';

type CreateManagedPostBody = {
  title: string;
  description: string;
  categoryId: string;
  type: 'educational' | 'community';
  videoUrl?: string;
  thumbnailUrl?: string;
};

type UpdateUserStatusBody = {
  status: UserStatus;
};

type UpdateMembershipBody = {
  plan?: string;
  status?: MembershipStatus;
  adminApproved?: boolean;
  expiresAt?: string;
};

@Controller('admin')
@UseGuards(AuthenticatedGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly postsService: PostsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('dashboard')
  getDashboard() {
    return this.postsService.getAdminDashboard();
  }

  @Post('posts')
  createManagedPost(
    @Body() body: CreateManagedPostBody,
    @CurrentUser() user: { sub: string },
  ) {
    return this.postsService.createPost({
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      type: body.type,
      videoUrl: body.videoUrl,
      thumbnailUrl: body.thumbnailUrl,
      authorId: user.sub,
      isAdmin: true,
    });
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.postsService.deletePost(id);
  }

  @Delete('comments/:id')
  deleteComment(@Param('id') id: string) {
    return this.postsService.deleteComment(id);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusBody,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.updateStatus(id, body.status, user.sub);
  }

  @Get('memberships')
  listMemberships() {
    return this.usersService.listMemberships();
  }

  @Patch('memberships/:userId')
  updateMembership(
    @Param('userId') userId: string,
    @Body() body: UpdateMembershipBody,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.upsertMembershipByAdmin({
      userId,
      plan: body.plan,
      status: body.status,
      adminApproved: body.adminApproved,
      expiresAt: body.expiresAt,
      approvedBy: user.sub,
    });
  }
}
