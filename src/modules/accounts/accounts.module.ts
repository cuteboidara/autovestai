import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PositionsModule } from '../positions/positions.module';
import { PricingModule } from '../pricing/pricing.module';
import { TradingModule } from '../trading/trading.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    PricingModule,
    TradingModule,
    forwardRef(() => PositionsModule),
  ],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
