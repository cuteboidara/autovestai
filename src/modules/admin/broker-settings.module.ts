import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { SymbolsModule } from '../symbols/symbols.module';
import { BrokerSettingsService } from './broker-settings.service';

@Global()
@Module({
  imports: [PrismaModule, SymbolsModule],
  providers: [BrokerSettingsService],
  exports: [BrokerSettingsService],
})
export class BrokerSettingsModule {}
