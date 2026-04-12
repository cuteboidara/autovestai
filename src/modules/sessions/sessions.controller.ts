import { Controller, Delete, Get, Param } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.listSessions(user.id, user.sessionId);
  }

  @Delete(':id')
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ) {
    return this.sessionsService.revokeSession(user.id, sessionId);
  }
}
