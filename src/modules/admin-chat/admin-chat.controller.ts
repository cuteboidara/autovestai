import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateAdminMessageDto } from './dto/create-admin-message.dto';
import { AdminChatGateway } from './admin-chat.gateway';
import { AdminChatService } from './admin-chat.service';

@Roles(UserRole.ADMIN)
@Controller('admin/chat')
export class AdminChatController {
  constructor(
    private readonly adminChatService: AdminChatService,
    private readonly adminChatGateway: AdminChatGateway,
  ) {}

  @Permissions('chat.view')
  @Get('unread-counts')
  listUnreadCounts(@CurrentUser() admin: AuthenticatedUser) {
    return this.adminChatService.listUnreadCounts(admin.id);
  }

  @Permissions('chat.view')
  @Get('online-admins')
  listOnlineAdmins() {
    return this.adminChatService.listOnlineAdmins(
      this.adminChatGateway.getOnlineAdminIds(),
    );
  }

  @Permissions('chat.view')
  @Get(':channel')
  listMessages(
    @Param('channel') channel: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminChatService.listMessages(channel, admin.id);
  }

  @Permissions('chat.view')
  @Post(':channel')
  async postMessage(
    @Param('channel') channel: string,
    @Body() dto: CreateAdminMessageDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    const message = await this.adminChatService.postMessage(channel, admin.id, dto.content);
    this.adminChatGateway.broadcastMessage(message);
    return message;
  }
}
