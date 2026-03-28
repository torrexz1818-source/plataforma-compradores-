import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MessagesService } from './messages.service';

type CreateMessageBody = {
  supplierId?: string;
  buyerId?: string;
  postId?: string;
  message?: string;
};

@Controller('messages')
@UseGuards(AuthenticatedGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(
    @Body() body: CreateMessageBody,
    @CurrentUser() user: { sub: string },
  ): Promise<unknown> {
    return this.messagesService.create({
      senderId: user.sub,
      supplierId: body.supplierId ?? '',
      buyerId: body.buyerId,
      postId: body.postId,
      message: body.message ?? '',
    });
  }
}
