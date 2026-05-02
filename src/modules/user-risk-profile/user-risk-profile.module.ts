import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { UserRiskProfileService } from './user-risk-profile.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [UserRiskProfileService],
  exports: [UserRiskProfileService],
})
export class UserRiskProfileModule {}
