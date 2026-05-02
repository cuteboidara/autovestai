import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RiskTier } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toNumber } from '../../common/utils/decimal';

// ISO 3166-1 alpha-2 country codes considered sanctioned or very high-risk
const SANCTIONED_COUNTRIES = new Set([
  'IR', // Iran
  'KP', // North Korea
  'CU', // Cuba
  'SY', // Syria
  'RU', // Russia
  'BY', // Belarus
  'SD', // Sudan
  'MM', // Myanmar (Burma)
  'SS', // South Sudan
  'YE', // Yemen
  'LY', // Libya
  'SO', // Somalia
  'AF', // Afghanistan
  'VE', // Venezuela
]);

// Countries that require enhanced due diligence (PEP-heavy, AML-flagged)
const HIGH_RISK_COUNTRIES = new Set([
  'PK', // Pakistan
  'NG', // Nigeria
  'GH', // Ghana
  'KE', // Kenya
  'TZ', // Tanzania
  'UG', // Uganda
  'ET', // Ethiopia
  'ZW', // Zimbabwe
  'CD', // Congo (DRC)
  'MZ', // Mozambique
  'ML', // Mali
  'SN', // Senegal
  'CM', // Cameroon
]);

// Partial OFAC-style sanctions list — update regularly from:
// https://home.treasury.gov/policy-issues/financial-sanctions/specially-designated-nationals-list-data-formats-data-schemas
// These are normalized uppercase "LASTNAME FIRSTNAME" patterns
const SANCTIONS_NAME_FRAGMENTS = new Set([
  'PUTIN VLADIMIR',
  'LUKASHENKO ALEXANDER',
  'AL-ASSAD BASHAR',
  'KIM JONG',
  'MADURO NICOLAS',
  'KHAMENEI ALI',
]);

interface EnforceOrderParams {
  leverage: number;
  notional: number;
  openPositionCount: number;
}

const TIER_DEFAULTS: Record<RiskTier, { maxLeverage: number; maxNotional: number; maxOpenPositions: number }> = {
  STARTER: { maxLeverage: 10, maxNotional: 10_000, maxOpenPositions: 5 },
  INTERMEDIATE: { maxLeverage: 50, maxNotional: 50_000, maxOpenPositions: 15 },
  PROFESSIONAL: { maxLeverage: 100, maxNotional: 200_000, maxOpenPositions: 50 },
  INSTITUTIONAL: { maxLeverage: 500, maxNotional: 1_000_000, maxOpenPositions: 200 },
};

@Injectable()
export class UserRiskProfileService {
  private readonly logger = new Logger(UserRiskProfileService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async getOrCreate(userId: string) {
    const existing = await this.prismaService.userRiskProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.prismaService.userRiskProfile.create({
      data: {
        userId,
        tier: RiskTier.STARTER,
        maxLeverage: TIER_DEFAULTS.STARTER.maxLeverage,
        maxNotional: TIER_DEFAULTS.STARTER.maxNotional,
        maxOpenPositions: TIER_DEFAULTS.STARTER.maxOpenPositions,
      },
    });
  }

  async assignTierFromKyc(params: {
    userId: string;
    countryCode: string;
    isPep?: boolean;
  }): Promise<void> {
    const countryUpper = params.countryCode.toUpperCase();
    const isHighRiskCountry = HIGH_RISK_COUNTRIES.has(countryUpper);
    const tier = isHighRiskCountry ? RiskTier.STARTER : RiskTier.INTERMEDIATE;
    const defaults = TIER_DEFAULTS[tier];

    await this.prismaService.userRiskProfile.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        tier,
        maxLeverage: defaults.maxLeverage,
        maxNotional: defaults.maxNotional,
        maxOpenPositions: defaults.maxOpenPositions,
        countryCode: countryUpper,
        isPep: params.isPep ?? false,
        isHighRiskCountry,
      },
      update: {
        tier,
        maxLeverage: defaults.maxLeverage,
        maxNotional: defaults.maxNotional,
        maxOpenPositions: defaults.maxOpenPositions,
        countryCode: countryUpper,
        isPep: params.isPep ?? false,
        isHighRiskCountry,
      },
    });

    this.logger.log(
      `Risk profile updated for user ${params.userId}: tier=${tier}, country=${countryUpper}, highRisk=${isHighRiskCountry}`,
    );
  }

  isSanctionedCountry(countryCode: string): boolean {
    return SANCTIONED_COUNTRIES.has(countryCode.toUpperCase());
  }

  isHighRiskCountry(countryCode: string): boolean {
    return HIGH_RISK_COUNTRIES.has(countryCode.toUpperCase());
  }

  /**
   * Returns true if the full name partially matches a known sanctions entry.
   * This is a lightweight heuristic — not a substitute for a full OFAC API integration.
   * Returns the matched fragment for audit logging.
   */
  screenName(fullName: string): { matched: boolean; fragment?: string } {
    const normalized = fullName.toUpperCase().replace(/[^A-Z ]/g, ' ').trim();
    for (const fragment of SANCTIONS_NAME_FRAGMENTS) {
      const parts = fragment.split(' ');
      if (parts.every((part) => normalized.includes(part))) {
        return { matched: true, fragment };
      }
    }
    return { matched: false };
  }

  async enforceOrderLimits(userId: string, params: EnforceOrderParams): Promise<void> {
    const profile = await this.getOrCreate(userId);

    if (params.leverage > profile.maxLeverage) {
      throw new BadRequestException(
        `Leverage ${params.leverage}x exceeds your account limit of ${profile.maxLeverage}x`,
      );
    }

    const maxNotional = toNumber(profile.maxNotional) ?? TIER_DEFAULTS.STARTER.maxNotional;
    if (params.notional > maxNotional) {
      throw new BadRequestException(
        `Order notional $${params.notional.toFixed(2)} exceeds your account limit of $${maxNotional.toFixed(2)}`,
      );
    }

    if (params.openPositionCount >= profile.maxOpenPositions) {
      throw new BadRequestException(
        `You have reached the maximum of ${profile.maxOpenPositions} open positions`,
      );
    }
  }
}
