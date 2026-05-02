import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { WebhookService } from './webhook.service';

@Roles(UserRole.USER)
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { url: string; events: string[] },
  ) {
    return this.webhookService.registerWebhook(user.id, body.url, body.events);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.webhookService.listWebhooks(user.id);
  }

  @Get(':id')
  stats(@Param('id') webhookId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.webhookService.getWebhookStats(webhookId, user.id);
  }

  @Get(':id/deliveries')
  deliveries(@Param('id') webhookId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.webhookService.getDeliveryHistory(webhookId, user.id);
  }

  @Post(':id/test')
  test(@Param('id') webhookId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.webhookService.testWebhook(webhookId, user.id);
  }

  @Delete(':id')
  remove(@Param('id') webhookId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.webhookService.deleteWebhook(webhookId, user.id);
  }
}
