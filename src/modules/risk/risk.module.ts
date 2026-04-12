import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { PricingModule } from '../pricing/pricing.module';
import { RiskService } from './risk.service';

@Module({
  imports: [ConfigModule, PrismaModule, BrokerSettingsModule, PricingModule],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
