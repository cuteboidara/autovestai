import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { AuditModule } from '../audit/audit.module';
import { KycModule } from '../kyc/kyc.module';
import { RebatesModule } from '../rebates/rebates.module';
import { AffiliatesController } from './affiliates.controller';
import { AffiliatesService } from './affiliates.service';

@Module({
  imports: [
    PrismaModule,
    BrokerSettingsModule,
    AuditModule,
    KycModule,
    RebatesModule,
  ],
  controllers: [AffiliatesController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
