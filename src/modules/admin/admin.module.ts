import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { AuditModule } from '../audit/audit.module';
import { BrokerSettingsModule } from './broker-settings.module';
import { DealingDeskModule } from '../dealing-desk/dealing-desk.module';
import { KycModule } from '../kyc/kyc.module';
import { PricingModule } from '../pricing/pricing.module';
import { RbacModule } from '../rbac/rbac.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    PrismaModule,
    AccountsModule,
    AffiliatesModule,
    AuditModule,
    BrokerSettingsModule,
    DealingDeskModule,
    KycModule,
    PricingModule,
    RbacModule,
    WalletModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
