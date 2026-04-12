import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { RiskModule } from '../risk/risk.module';
import { SurveillanceModule } from '../surveillance/surveillance.module';
import { TradingModule } from '../trading/trading.module';
import { AccountsModule } from '../accounts/accounts.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { AdminChatModule } from '../admin-chat/admin-chat.module';
import { AuditModule } from '../audit/audit.module';
import { CrmModule } from '../crm/crm.module';
import { KycModule } from '../kyc/kyc.module';
import { AddressGeneratorService } from './address-generator.service';
import { BlockchainMonitorService } from './blockchain-monitor.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [
    PrismaModule,
    AdminChatModule,
    BrokerSettingsModule,
    AuditModule,
    CrmModule,
    KycModule,
    AccountsModule,
    PricingModule,
    RiskModule,
    SurveillanceModule,
    TradingModule,
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    AddressGeneratorService,
    WithdrawalsService,
    BlockchainMonitorService,
  ],
  exports: [WalletService],
})
export class WalletModule {}
