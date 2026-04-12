import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TradingGateway } from './trading.gateway';
import { TradingEventsService } from './trading-events.service';

@Module({
  imports: [AuthModule],
  providers: [TradingGateway, TradingEventsService],
  exports: [TradingEventsService, TradingGateway],
})
export class TradingModule {}
