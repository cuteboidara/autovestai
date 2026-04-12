import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AdminRoleGuard } from './common/guards/admin-role.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { SecretAdminPathGuard } from './common/guards/secret-admin-path.guard';
import { StructuredLoggerService } from './common/logging/structured-logger.service';
import { ResponseCacheModule } from './common/cache/response-cache.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { QueueModule } from './common/queue/queue.module';
import { RequestContextModule } from './common/request-context/request-context.module';
import { BrokerSettingsModule } from './modules/admin/broker-settings.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { RiskModule } from './modules/risk/risk.module';
import { TradingModule } from './modules/trading/trading.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PositionsModule } from './modules/positions/positions.module';
import { AdminModule } from './modules/admin/admin.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { RebatesModule } from './modules/rebates/rebates.module';
import { AffiliatesModule } from './modules/affiliates/affiliates.module';
import { CopyTradingModule } from './modules/copy-trading/copy-trading.module';
import { DealingDeskModule } from './modules/dealing-desk/dealing-desk.module';
import { HealthModule } from './modules/health/health.module';
import { KycModule } from './modules/kyc/kyc.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SymbolsModule } from './modules/symbols/symbols.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { SurveillanceModule } from './modules/surveillance/surveillance.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { CrmModule } from './modules/crm/crm.module';
import { EmailModule } from './modules/email/email.module';
import { AdminChatModule } from './modules/admin-chat/admin-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    ResponseCacheModule,
    QueueModule,
    RequestContextModule,
    AuditModule,
    SessionsModule,
    SymbolsModule,
    SurveillanceModule,
    TreasuryModule,
    ReconciliationModule,
    HealthModule,
    BrokerSettingsModule,
    AccountsModule,
    AdminUsersModule,
    RebatesModule,
    AffiliatesModule,
    AuthModule,
    UsersModule,
    WalletModule,
    RiskModule,
    TradingModule,
    PricingModule,
    MarketDataModule,
    CopyTradingModule,
    DealingDeskModule,
    KycModule,
    CrmModule,
    EmailModule,
    AdminChatModule,
    OrdersModule,
    PositionsModule,
    AdminModule,
  ],
  providers: [
    StructuredLoggerService,
    {
      provide: APP_GUARD,
      useClass: SecretAdminPathGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminRoleGuard,
    },
  ],
})
export class AppModule {}
