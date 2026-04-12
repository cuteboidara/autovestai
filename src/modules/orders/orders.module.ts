import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { QueueModule } from '../../common/queue/queue.module';
import { RedisModule } from '../../common/redis/redis.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { AuditModule } from '../audit/audit.module';
import { CopyTradingModule } from '../copy-trading/copy-trading.module';
import { DealingDeskModule } from '../dealing-desk/dealing-desk.module';
import { PricingModule } from '../pricing/pricing.module';
import { RebatesModule } from '../rebates/rebates.module';
import { RiskModule } from '../risk/risk.module';
import { SurveillanceModule } from '../surveillance/surveillance.module';
import { TradingModule } from '../trading/trading.module';
import { KycModule } from '../kyc/kyc.module';
import { OrderWorkerService } from './order-worker.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    RedisModule,
    forwardRef(() => AccountsModule),
    AffiliatesModule,
    AuditModule,
    BrokerSettingsModule,
    forwardRef(() => CopyTradingModule),
    DealingDeskModule,
    PricingModule,
    RebatesModule,
    RiskModule,
    SurveillanceModule,
    TradingModule,
    KycModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderWorkerService],
  exports: [OrdersService],
})
export class OrdersModule {}
