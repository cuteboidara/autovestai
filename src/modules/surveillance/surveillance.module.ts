import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { AuditModule } from '../audit/audit.module';
import { SurveillanceController } from './surveillance.controller';
import { SurveillanceService } from './surveillance.service';

@Module({
  imports: [PrismaModule, BrokerSettingsModule, AuditModule],
  controllers: [SurveillanceController],
  providers: [SurveillanceService],
  exports: [SurveillanceService],
})
export class SurveillanceModule {}
