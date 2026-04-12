import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateSurveillanceCaseDto } from './dto/create-surveillance-case.dto';
import { ListSurveillanceAlertsQueryDto } from './dto/list-surveillance-alerts-query.dto';
import { ListSurveillanceCasesQueryDto } from './dto/list-surveillance-cases-query.dto';
import { UpdateSurveillanceCaseDto } from './dto/update-surveillance-case.dto';
import { SurveillanceService } from './surveillance.service';

@Roles(UserRole.ADMIN)
@Controller('admin/surveillance')
export class SurveillanceController {
  constructor(private readonly surveillanceService: SurveillanceService) {}

  @Permissions('alerts.view')
  @Get('alerts')
  listAlerts(@Query() query: ListSurveillanceAlertsQueryDto) {
    return this.surveillanceService.listAlerts(query);
  }

  @Permissions('alerts.view')
  @Get('alerts/:id')
  getAlert(@Param('id') id: string) {
    return this.surveillanceService.getAlert(id);
  }

  @Permissions('alerts.manage')
  @Post('alerts/:id/acknowledge')
  acknowledge(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.surveillanceService.acknowledgeAlert(id, admin.id);
  }

  @Permissions('alerts.manage')
  @Post('alerts/:id/close')
  close(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.surveillanceService.closeAlert(id, admin.id);
  }

  @Permissions('alerts.view')
  @Get('cases')
  listCases(@Query() query: ListSurveillanceCasesQueryDto) {
    return this.surveillanceService.listCases(query);
  }

  @Permissions('alerts.manage')
  @Post('cases')
  createCase(
    @Body() dto: CreateSurveillanceCaseDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.surveillanceService.createCase(dto, admin.id);
  }

  @Permissions('alerts.manage')
  @Patch('cases/:id')
  updateCase(
    @Param('id') caseId: string,
    @Body() dto: UpdateSurveillanceCaseDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.surveillanceService.updateCase(caseId, dto, admin.id);
  }
}
