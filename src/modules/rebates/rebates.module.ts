import { Global, Module } from '@nestjs/common';

import { RebatesService } from './rebates.service';

@Global()
@Module({
  providers: [RebatesService],
  exports: [RebatesService],
})
export class RebatesModule {}
