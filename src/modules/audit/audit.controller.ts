import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditService } from './audit.service';

@Roles(UserRole.ADMIN)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Permissions('audit.view')
  @Get()
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.list(query);
  }

  @Permissions('audit.view')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.auditService.getById(id);
  }
}
