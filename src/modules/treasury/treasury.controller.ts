import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateTreasuryBalanceSnapshotDto } from './dto/create-treasury-balance-snapshot.dto';
import { ListTreasuryBalanceSnapshotsQueryDto } from './dto/list-treasury-balance-snapshots-query.dto';
import { ListTreasuryMovementsQueryDto } from './dto/list-treasury-movements-query.dto';
import { TreasuryService } from './treasury.service';

@Roles(UserRole.ADMIN)
@Controller('admin/treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Permissions('treasury.view')
  @Get('summary')
  getSummary() {
    return this.treasuryService.getSummary();
  }

  @Permissions('treasury.view')
  @Get('balance-snapshots')
  listBalanceSnapshots(@Query() query: ListTreasuryBalanceSnapshotsQueryDto) {
    return this.treasuryService.listBalanceSnapshots(query);
  }

  @Permissions('treasury.manage')
  @RateLimit({
    keyPrefix: 'treasury-balance-snapshot',
    limit: 30,
    ttlSeconds: 300,
  })
  @Post('balance-snapshots')
  createBalanceSnapshot(
    @Body() dto: CreateTreasuryBalanceSnapshotDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.treasuryService.createBalanceSnapshot(dto, admin);
  }

  @Permissions('treasury.view')
  @Get('movements')
  listMovements(@Query() query: ListTreasuryMovementsQueryDto) {
    return this.treasuryService.listMovements(query);
  }

  @Permissions('treasury.view')
  @Get('reconciliation')
  getReconciliation() {
    return this.treasuryService.getReconciliationReport();
  }

  @Permissions('treasury.view')
  @Get('liabilities-breakdown')
  getLiabilitiesBreakdown() {
    return this.treasuryService.getLiabilitiesBreakdown();
  }
}
