import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { BalanceLedgerService } from './balance-ledger.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [BalanceLedgerService],
  exports: [BalanceLedgerService],
})
export class BalanceLedgerModule {}
