import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ListReconciliationRunsQueryDto } from './dto/list-reconciliation-runs-query.dto';
import { ReconciliationService } from './reconciliation.service';

@Roles(UserRole.ADMIN)
@Controller('admin/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Permissions('treasury.manage')
  @RateLimit({
    keyPrefix: 'reconciliation-run',
    limit: 30,
    ttlSeconds: 300,
  })
  @Post('run')
  runNow(@CurrentUser() admin: AuthenticatedUser) {
    return this.reconciliationService.runReconciliation({
      initiatedBy: admin,
    });
  }

  @Permissions('treasury.view')
  @Get('latest')
  getLatest() {
    return this.reconciliationService.getLatestRun();
  }

  @Permissions('treasury.view')
  @Get('runs')
  listRuns(@Query() query: ListReconciliationRunsQueryDto) {
    return this.reconciliationService.listRuns(query);
  }

  @Permissions('treasury.view')
  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.reconciliationService.getRunById(id);
  }
}
