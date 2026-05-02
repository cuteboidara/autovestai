import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CrmModule } from '../crm/crm.module';
import { TotpService } from '../auth/totp.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, CrmModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, TotpService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
