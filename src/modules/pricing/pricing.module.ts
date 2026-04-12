import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { QueueModule } from '../../common/queue/queue.module';
import { RedisModule } from '../../common/redis/redis.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { TradingModule } from '../trading/trading.module';
import { CandleService } from './candle.service';
import { PricingService } from './pricing.service';
import { BinanceProvider } from './providers/binance.provider';
import { ForexProvider } from './providers/forex.provider';
import { RateLimitedFetcher } from './providers/rate-limited-fetcher';
import { YahooProvider } from './providers/yahoo.provider';
import { StooqPricingAdapter } from './stooq.adapter';
import { TwelveDataAdapter } from './twelve-data.adapter';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueueModule,
    RedisModule,
    BrokerSettingsModule,
    TradingModule,
  ],
  providers: [
    PricingService,
    CandleService,
    StooqPricingAdapter,
    TwelveDataAdapter,
    RateLimitedFetcher,
    BinanceProvider,
    ForexProvider,
    YahooProvider,
  ],
  exports: [PricingService, CandleService],
})
export class PricingModule {}
