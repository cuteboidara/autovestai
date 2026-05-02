import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AmlDataLoaderService } from './aml-data-loader.service';
import { AmlScreeningService } from './aml-screening.service';

@Module({
  imports: [PrismaModule],
  providers: [AmlScreeningService, AmlDataLoaderService],
  exports: [AmlScreeningService, AmlDataLoaderService],
})
export class AmlModule {}
