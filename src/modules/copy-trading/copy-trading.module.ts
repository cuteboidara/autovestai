import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';
import { PositionsModule } from '../positions/positions.module';
import { PricingModule } from '../pricing/pricing.module';
import { RiskModule } from '../risk/risk.module';
import { KycModule } from '../kyc/kyc.module';
import { SymbolsModule } from '../symbols/symbols.module';
import { CopiersController } from './copiers.controller';
import { CopyExecutionService } from './copy-execution.service';
import { CopyTradingQueueService } from './copy-trading-queue.service';
import { CopyTradingService } from './copy-trading.service';
import { CopyTradingWorkerService } from './copy-trading-worker.service';
import { ProvidersController } from './providers.controller';
import { CopyTradingStatsCron } from './stats.cron';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BrokerSettingsModule,
    forwardRef(() => AccountsModule),
    AuditModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => PositionsModule),
    PricingModule,
    RiskModule,
    KycModule,
    SymbolsModule,
  ],
  controllers: [ProvidersController, CopiersController],
  providers: [
    CopyTradingService,
    CopyExecutionService,
    CopyTradingQueueService,
    CopyTradingWorkerService,
    CopyTradingStatsCron,
  ],
  exports: [CopyTradingService, CopyTradingQueueService],
})
export class CopyTradingModule {}
