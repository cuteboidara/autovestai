import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApplyAffiliateDto } from './dto/apply-affiliate.dto';
import { AssignParentAffiliateDto } from './dto/assign-parent-affiliate.dto';
import { AffiliatesService } from './affiliates.service';

@Controller('affiliates')
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  @Post('apply')
  applyAffiliate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyAffiliateDto,
  ) {
    return this.affiliatesService.apply(user.id, dto);
  }

  @Get('me')
  getMyAffiliate(@CurrentUser() user: AuthenticatedUser) {
    return this.affiliatesService.getMe(user.id);
  }

  @Get('tree')
  getAffiliateTree(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.affiliatesService.getTree(user.id);
  }

  @Get('commissions')
  getCommissions(@CurrentUser() user: AuthenticatedUser) {
    return this.affiliatesService.getCommissions(user.id);
  }

  @Get('referrals')
  getReferrals(@CurrentUser() user: AuthenticatedUser) {
    return this.affiliatesService.getReferrals(user.id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('affiliate.manage')
  @Post(':id/assign-parent')
  assignParent(
    @Param('id') affiliateId: string,
    @Body() dto: AssignParentAffiliateDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.affiliatesService.assignParent(affiliateId, dto, admin.id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('affiliate.manage')
  @Post('commission/:id/approve')
  approveCommission(
    @Param('id') commissionId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.affiliatesService.approveCommission(commissionId, admin.id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('affiliate.manage')
  @Post('commission/:id/pay')
  payCommission(
    @Param('id') commissionId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.affiliatesService.payCommission(commissionId, admin.id);
  }
}
