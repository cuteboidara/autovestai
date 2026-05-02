import { Injectable, Logger } from '@nestjs/common';
import { ConsentType } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UserConsentService {
  private readonly logger = new Logger(UserConsentService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async record(params: {
    userId: string;
    type: ConsentType;
    version: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prismaService.userConsent.create({
      data: {
        userId: params.userId,
        type: params.type,
        version: params.version,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
    this.logger.log(`Consent recorded: ${params.type} v${params.version} for user ${params.userId}`);
  }

  async hasConsented(userId: string, type: ConsentType, version: string): Promise<boolean> {
    const record = await this.prismaService.userConsent.findFirst({
      where: { userId, type, version },
      select: { id: true },
    });
    return record !== null;
  }

  async listForUser(userId: string) {
    return this.prismaService.userConsent.findMany({
      where: { userId },
      orderBy: { consentedAt: 'desc' },
    });
  }

  async getLatestForType(userId: string, type: ConsentType) {
    return this.prismaService.userConsent.findFirst({
      where: { userId, type },
      orderBy: { consentedAt: 'desc' },
    });
  }
}
