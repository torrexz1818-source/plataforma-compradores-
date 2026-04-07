import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PostsService } from './posts.service';

@Controller('educational-content')
@UseGuards(AuthenticatedGuard)
export class EducationalContentController {
  constructor(private readonly postsService: PostsService) {}

  @Post(':id/view')
  registerView(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.postsService.registerEducationalContentView(id, user.sub);
  }

  @Get('top')
  getTop(
    @Query('month') month: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    return this.postsService.getTopEducationalContent(month ?? '', limit ? Number(limit) : 3);
  }

  @Get('recommended')
  getRecommended(
    @Query('buyerId') buyerId: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: { sub: string },
  ) {
    return this.postsService.getRecommendedEducationalContent(
      buyerId || user.sub,
      limit ? Number(limit) : 3,
    );
  }
}
