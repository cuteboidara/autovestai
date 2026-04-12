import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { HedgeActionDecisionDto } from './dto/hedge-action-decision.dto';
import { DealingDeskService } from './dealing-desk.service';

@Roles(UserRole.ADMIN)
@Controller('dealing-desk')
export class DealingDeskController {
  constructor(private readonly dealingDeskService: DealingDeskService) {}

  @Permissions('risk.view')
  @Get('exposure')
  getExposure() {
    return this.dealingDeskService.getExposureOverview();
  }

  @Permissions('risk.view')
  @Get('exposure/:symbol')
  getExposureBySymbol(@Param('symbol') symbol: string) {
    return this.dealingDeskService.getExposureBySymbol(symbol);
  }

  @Permissions('risk.view')
  @Get('hedge-actions')
  listHedgeActions() {
    return this.dealingDeskService.listHedgeActions();
  }

  @Permissions('dealingdesk.manage')
  @RateLimit({
    keyPrefix: 'hedge-approve',
    limit: 60,
    ttlSeconds: 300,
  })
  @Post('hedge-actions/:id/approve')
  approveHedgeAction(
    @Param('id') actionId: string,
    @Body() dto: HedgeActionDecisionDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.dealingDeskService.approveHedgeAction(actionId, admin, dto.reason);
  }

  @Permissions('dealingdesk.manage')
  @RateLimit({
    keyPrefix: 'hedge-reject',
    limit: 60,
    ttlSeconds: 300,
  })
  @Post('hedge-actions/:id/reject')
  rejectHedgeAction(
    @Param('id') actionId: string,
    @Body() dto: HedgeActionDecisionDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.dealingDeskService.rejectHedgeAction(actionId, admin, dto.reason);
  }
}
