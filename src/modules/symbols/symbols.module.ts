import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { SymbolsService } from './symbols.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SymbolsService],
  exports: [SymbolsService],
})
export class SymbolsModule {}
