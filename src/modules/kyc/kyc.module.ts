import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminChatModule } from '../admin-chat/admin-chat.module';
import { AuditModule } from '../audit/audit.module';
import { CrmModule } from '../crm/crm.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [PrismaModule, AuditModule, CrmModule, AdminChatModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
