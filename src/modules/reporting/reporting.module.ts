import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RegulatoryReportingService } from './regulatory-reporting.service';

@Module({
  imports: [PrismaModule],
  providers: [RegulatoryReportingService],
  exports: [RegulatoryReportingService],
})
export class ReportingModule {}
