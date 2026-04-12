import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RequestContextModule } from '../../common/request-context/request-context.module';
import { AuditModule } from '../audit/audit.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, RequestContextModule, AuditModule],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
