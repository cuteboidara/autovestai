import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { TreasuryController } from './treasury.controller';
import { ExplorerTreasuryBalanceProvider } from './providers/explorer-treasury-balance.provider';
import { ManualTreasuryBalanceProvider } from './providers/manual-treasury-balance.provider';
import { TreasuryService } from './treasury.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TreasuryController],
  providers: [
    TreasuryService,
    ManualTreasuryBalanceProvider,
    ExplorerTreasuryBalanceProvider,
  ],
  exports: [TreasuryService],
})
export class TreasuryModule {}
