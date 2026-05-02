import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { WithdrawalOtpService } from './withdrawal-otp.service';

@Module({
  imports: [PrismaModule, EmailModule],
  providers: [WithdrawalOtpService],
  exports: [WithdrawalOtpService],
})
export class WithdrawalOtpModule {}
