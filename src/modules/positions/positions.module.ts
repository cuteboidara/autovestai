import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuditModule } from '../audit/audit.module';
import { CopyTradingModule } from '../copy-trading/copy-trading.module';
import { DealingDeskModule } from '../dealing-desk/dealing-desk.module';
import { PricingModule } from '../pricing/pricing.module';
import { RiskModule } from '../risk/risk.module';
import { SurveillanceModule } from '../surveillance/surveillance.module';
import { TradingModule } from '../trading/trading.module';
import { PnlEngineService } from './pnl-engine.service';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AccountsModule),
    AuditModule,
    forwardRef(() => CopyTradingModule),
    DealingDeskModule,
    PricingModule,
    RiskModule,
    SurveillanceModule,
    TradingModule,
  ],
  controllers: [PositionsController],
  providers: [PositionsService, PnlEngineService],
  exports: [PositionsService],
})
export class PositionsModule {}
