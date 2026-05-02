import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class WithdrawalOtpService {
  private readonly logger = new Logger(WithdrawalOtpService.name);
  private readonly OTP_TTL_MINUTES = 10;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generates a 6-digit OTP, stores the hash in DB, and emails it to the user.
   * Returns the token ID that the client must include in the withdrawal request.
   */
  async generateAndSend(userId: string): Promise<{ tokenId: string }> {
    // Invalidate any existing unused tokens for this user
    await this.prismaService.withdrawalOtpToken.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });

    const otp = this.generateOtp();
    const tokenHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + this.OTP_TTL_MINUTES * 60 * 1000);

    const token = await this.prismaService.withdrawalOtpToken.create({
      data: { userId, tokenHash, expiresAt },
      select: { id: true },
    });

    this.emailService.sendWithdrawalOtp(userId, otp, this.OTP_TTL_MINUTES).catch((err: Error) => {
      this.logger.warn(`Failed to send withdrawal OTP email to ${userId}: ${err.message}`);
    });

    return { tokenId: token.id };
  }

  /**
   * Verifies the OTP and marks the token as used.
   * Throws BadRequestException if invalid or expired.
   */
  async verify(userId: string, tokenId: string, otp: string): Promise<void> {
    const token = await this.prismaService.withdrawalOtpToken.findFirst({
      where: {
        id: tokenId,
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!token) {
      throw new BadRequestException('Invalid or expired withdrawal verification code');
    }

    const isValid = await bcrypt.compare(otp, token.tokenHash);
    if (!isValid) {
      throw new BadRequestException('Invalid withdrawal verification code');
    }

    await this.prismaService.withdrawalOtpToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
  }

  private generateOtp(): string {
    // Cryptographically random 6-digit code
    const bytes = crypto.randomBytes(4);
    const num = bytes.readUInt32BE(0) % 1_000_000;
    return num.toString().padStart(6, '0');
  }
}
