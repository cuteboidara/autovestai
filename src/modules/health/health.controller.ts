import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('platform/status')
  getPlatformStatus() {
    return this.healthService.getPublicPlatformStatus();
  }

  @Public()
  @Get('health')
  getHealth() {
    return this.healthService.getHealth();
  }

  @Public()
  @Get('health/ready')
  getReady() {
    return this.healthService.getReady();
  }

  @Public()
  @Get('health/live')
  getLive() {
    return this.healthService.getLive();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('health.view')
  @Get('admin/metrics')
  getOperationalMetrics() {
    return this.healthService.getOperationalMetrics();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('readiness.view')
  @Get('admin/readiness')
  getReadinessChecklist() {
    return this.healthService.getReadinessChecklist();
  }
}
