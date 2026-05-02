import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AmlScreeningResult, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AmlDataLoaderService } from './aml-data-loader.service';

export interface ScreeningOutcome {
  status: AmlScreeningResult;
  reason?: string;
  riskScore: number;
  matchedName?: string;
  matchedCountry?: string;
}

@Injectable()
export class AmlScreeningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmlScreeningService.name);
  // Re-screening cron: quarterly (every 90 days), checked daily
  private rescreenTimer?: NodeJS.Timeout;
  private readonly rescreenIntervalMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
    private readonly amlDataLoaderService: AmlDataLoaderService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Seed countries + attempt OFAC CSV load in background
    this.amlDataLoaderService.seedHighRiskCountries().catch((err: Error) => {
      this.logger.error(`Failed to seed high-risk countries: ${err.message}`);
    });

    this.amlDataLoaderService.loadOfacCsv().catch((err: Error) => {
      this.logger.error(`Failed to load OFAC CSV: ${err.message}`);
    });

    // Daily re-screening check
    this.rescreenTimer = setInterval(() => {
      void this.reScreenOverdueUsers();
    }, this.rescreenIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.rescreenTimer) {
      clearInterval(this.rescreenTimer);
    }
  }

  async screenUser(params: {
    userId: string;
    fullName: string;
    country: string;
  }): Promise<ScreeningOutcome> {
    const [nameResult, countryResult] = await Promise.all([
      this.screenOfacName(params.fullName),
      this.screenCountry(params.country),
    ]);

    let status: AmlScreeningResult = AmlScreeningResult.PASS;
    const reasons: string[] = [];
    let riskScore = 0;

    if (nameResult.matched) {
      status = AmlScreeningResult.FAIL;
      reasons.push(`OFAC sanctions name match: ${nameResult.matchedName}`);
      riskScore = 100;
    }

    if (countryResult.isHighRisk && status === AmlScreeningResult.PASS) {
      status = AmlScreeningResult.MANUAL_REVIEW;
      reasons.push(`High-risk country: ${params.country} (${countryResult.reason})`);
      riskScore = Math.max(riskScore, 75);
    } else if (countryResult.isMediumRisk && status === AmlScreeningResult.PASS) {
      status = AmlScreeningResult.MANUAL_REVIEW;
      reasons.push(`Medium-risk country: ${params.country} (${countryResult.reason})`);
      riskScore = Math.max(riskScore, 50);
    }

    const screeningData: Prisma.InputJsonObject = {
      nameMatch: nameResult,
      countryRisk: countryResult,
      params: { fullName: params.fullName, country: params.country },
    };

    const nextScreeningDue = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await this.prismaService.amlScreening.create({
      data: {
        userId: params.userId,
        screeningType: 'kyc_submission',
        resultStatus: status,
        matchedName: nameResult.matchedName ?? null,
        matchedCountry: countryResult.isHighRisk || countryResult.isMediumRisk ? params.country : null,
        riskScore,
        screeningData,
        nextScreeningDue,
      },
    });

    if (status === AmlScreeningResult.FAIL) {
      this.auditService
        .log({
          actorUserId: params.userId,
          actorRole: 'system',
          action: 'AML_SCREENING_BLOCKED',
          entityType: 'user',
          entityId: params.userId,
          targetUserId: params.userId,
          metadataJson: {
            reason: reasons.join('; '),
            matchedName: nameResult.matchedName ?? null,
          } as Prisma.InputJsonObject,
        })
        .catch((err: Error) => {
          this.logger.warn(`Failed to log AML audit: ${err.message}`);
        });
    }

    return {
      status,
      reason: reasons.join('; ') || undefined,
      riskScore,
      matchedName: nameResult.matchedName,
      matchedCountry: countryResult.isHighRisk || countryResult.isMediumRisk ? params.country : undefined,
    };
  }

  private async screenOfacName(
    fullName: string,
  ): Promise<{ matched: boolean; matchedName?: string; confidence: number }> {
    if (!fullName || fullName.trim().length < 3) {
      return { matched: false, confidence: 0 };
    }

    const fragments = this.amlDataLoaderService.extractNameFragments(fullName);
    if (fragments.length === 0) {
      return { matched: false, confidence: 0 };
    }

    try {
      const dbCount = await this.prismaService.ofacSdn.count();
      if (dbCount === 0) {
        // DB empty — use in-memory fallback
        return this.screenNameInMemory(fullName);
      }

      const candidates = await this.prismaService.ofacSdn.findMany({
        where: { nameFragments: { hasSome: fragments } },
        take: 10,
      });

      for (const candidate of candidates) {
        const similarity = this.levenshteinSimilarity(
          fullName.toUpperCase(),
          candidate.name.toUpperCase(),
        );
        if (similarity >= 0.82) {
          return { matched: true, matchedName: candidate.name, confidence: similarity };
        }
      }

      return { matched: false, confidence: 0 };
    } catch (err) {
      this.logger.error(`OFAC DB screening failed: ${(err as Error).message}`);
      return this.screenNameInMemory(fullName);
    }
  }

  // Fallback in-memory list when DB is empty
  private screenNameInMemory(
    fullName: string,
  ): { matched: boolean; matchedName?: string; confidence: number } {
    const KNOWN_FRAGMENTS = [
      'PUTIN VLADIMIR', 'LUKASHENKO ALEXANDER', 'AL-ASSAD BASHAR',
      'KIM JONG UN', 'MADURO NICOLAS', 'KHAMENEI ALI',
      'BIN LADEN OSAMA', 'AL-ZAWAHIRI AYMAN', 'AL-BAGHDADI ABU',
    ];
    const normalized = fullName.toUpperCase().replace(/[^A-Z ]/g, ' ').trim();
    for (const entry of KNOWN_FRAGMENTS) {
      const parts = entry.split(' ');
      if (parts.every((p) => normalized.includes(p))) {
        return { matched: true, matchedName: entry, confidence: 0.9 };
      }
    }
    return { matched: false, confidence: 0 };
  }

  private async screenCountry(country: string): Promise<{
    isHighRisk: boolean;
    isMediumRisk: boolean;
    riskLevel?: string;
    reason?: string;
  }> {
    const countryUpper = country.toUpperCase();
    const record = await this.prismaService.highRiskCountry.findUnique({
      where: { countryCode: countryUpper },
    });

    if (!record) return { isHighRisk: false, isMediumRisk: false };

    return {
      isHighRisk: record.riskLevel === 'high',
      isMediumRisk: record.riskLevel === 'medium',
      riskLevel: record.riskLevel,
      reason: record.reason,
    };
  }

  private async reScreenOverdueUsers(): Promise<void> {
    try {
      const overdue = await this.prismaService.amlScreening.findMany({
        where: { nextScreeningDue: { lte: new Date() } },
        distinct: ['userId'],
        select: { userId: true },
        take: 100,
      });

      if (overdue.length === 0) return;

      this.logger.log(`Re-screening ${overdue.length} users overdue for quarterly AML check`);

      for (const { userId } of overdue) {
        const kyc = await this.prismaService.kycSubmission.findUnique({
          where: { userId },
          select: { fullName: true, country: true, status: true },
        });

        if (!kyc || kyc.status !== 'APPROVED') continue;

        const result = await this.screenUser({
          userId,
          fullName: kyc.fullName,
          country: kyc.country,
        });

        if (result.status === AmlScreeningResult.FAIL) {
          this.logger.warn(
            `Quarterly re-screen: AML FAIL for user ${userId} — ${result.reason}`,
          );
          // Suspend the account
          await this.prismaService.account.updateMany({
            where: { userId },
            data: { status: 'SUSPENDED' },
          });
        }
      }
    } catch (err) {
      this.logger.error(`Re-screening job failed: ${(err as Error).message}`);
    }
  }

  private levenshteinSimilarity(s1: string, s2: string): number {
    const longer = s1.length >= s2.length ? s1 : s2;
    const shorter = s1.length >= s2.length ? s2 : s1;
    if (longer.length === 0) return 1.0;
    const dist = this.editDistance(longer, shorter);
    return (longer.length - dist) / longer.length;
  }

  private editDistance(s1: string, s2: string): number {
    const dp: number[] = Array.from({ length: s2.length + 1 }, (_, i) => i);
    for (let i = 1; i <= s1.length; i++) {
      let prev = i;
      for (let j = 1; j <= s2.length; j++) {
        const val =
          s1[i - 1] === s2[j - 1]
            ? dp[j - 1]
            : Math.min(dp[j - 1], dp[j], prev) + 1;
        dp[j - 1] = prev;
        prev = val;
      }
      dp[s2.length] = prev;
    }
    return dp[s2.length];
  }
}
