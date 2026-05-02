import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { BalanceLedgerModule } from '../balance-ledger/balance-ledger.module';
import { DataIntegrityService } from './data-integrity.service';

@Module({
  imports: [PrismaModule, BalanceLedgerModule],
  providers: [DataIntegrityService],
  exports: [DataIntegrityService],
})
export class DataIntegrityModule {}
