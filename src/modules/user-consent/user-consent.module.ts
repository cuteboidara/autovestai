import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { UserConsentService } from './user-consent.service';

@Module({
  imports: [PrismaModule],
  providers: [UserConsentService],
  exports: [UserConsentService],
})
export class UserConsentModule {}
