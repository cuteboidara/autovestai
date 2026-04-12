import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';
import { TradingModule } from '../trading/trading.module';
import { DealingDeskController } from './dealing-desk.controller';
import { DealingDeskMonitorService } from './dealing-desk-monitor.service';
import { DealingDeskService } from './dealing-desk.service';

@Module({
  imports: [
    PrismaModule,
    BrokerSettingsModule,
    AuditModule,
    RbacModule,
    TradingModule,
  ],
  controllers: [DealingDeskController],
  providers: [DealingDeskService, DealingDeskMonitorService],
  exports: [DealingDeskService],
})
export class DealingDeskModule {}
