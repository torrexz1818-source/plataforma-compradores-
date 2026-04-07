import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PostsService } from './posts.service';

type UpdatePublicationBody = {
  title?: string;
  content?: string;
  image?: string;
  url?: string;
};

@Controller('publications')
@UseGuards(AuthenticatedGuard)
export class PublicationsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async listMine(
    @Query('supplierId') supplierId: string | undefined,
    @CurrentUser() user: { sub: string },
  ) {
    if (supplierId && supplierId !== 'me') {
      throw new BadRequestException('supplierId solo acepta el valor "me"');
    }

    return {
      items: await this.postsService.listSupplierPublications(user.sub),
    };
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return {
      publication: await this.postsService.getSupplierPublicationById(id, user.sub),
    };
  }

  @Patch(':id')
  async patchById(
    @Param('id') id: string,
    @Body() body: UpdatePublicationBody,
    @CurrentUser() user: { sub: string },
  ) {
    return {
      publication: await this.postsService.updateSupplierPublication(id, user.sub, {
        title: body.title,
        content: body.content,
        image: body.image,
        url: body.url,
      }),
    };
  }
}
