import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RequestContextModule } from '../../common/request-context/request-context.module';

@Global()
@Module({
  imports: [PrismaModule, RequestContextModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
