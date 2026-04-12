import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { QueueModule } from '../../common/queue/queue.module';
import { RedisModule } from '../../common/redis/redis.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { CopyTradingModule } from '../copy-trading/copy-trading.module';
import { PricingModule } from '../pricing/pricing.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { TradingModule } from '../trading/trading.module';
import { SurveillanceModule } from '../surveillance/surveillance.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueueModule,
    RedisModule,
    BrokerSettingsModule,
    CopyTradingModule,
    PricingModule,
    ReconciliationModule,
    TradingModule,
    SurveillanceModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
