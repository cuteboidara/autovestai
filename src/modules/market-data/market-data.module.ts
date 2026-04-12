import { Module } from '@nestjs/common';

import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { PricingModule } from '../pricing/pricing.module';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';

@Module({
  imports: [PricingModule, BrokerSettingsModule],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
