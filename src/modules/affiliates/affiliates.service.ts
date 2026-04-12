import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  AffiliateCommissionStatus,
  AffiliateStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber } from '../../common/utils/decimal';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { AuditService } from '../audit/audit.service';
import { KycService } from '../kyc/kyc.service';
import { RebatesService } from '../rebates/rebates.service';
import { ApplyAffiliateDto } from './dto/apply-affiliate.dto';
import { AssignParentAffiliateDto } from './dto/assign-parent-affiliate.dto';

interface AffiliateTreeNode {
  id: string;
  userId: string;
  referralCode: string;
  parentAffiliateId: string | null;
  level: number;
  status: AffiliateStatus;
  createdAt: Date;
  updatedAt: Date;
  children: AffiliateTreeNode[];
}

@Injectable()
export class AffiliatesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly rebatesService: RebatesService,
    private readonly auditService: AuditService,
    private readonly kycService: KycService,
  ) {}

  async apply(userId: string, dto: ApplyAffiliateDto) {
    await this.kycService.assertPlatformAccessApproved(userId);

    if (!this.brokerSettingsService.isAffiliateProgramEnabled()) {
      throw new BadRequestException('Affiliate program is temporarily disabled');
    }

    const existing = await this.prismaService.affiliate.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    const referral = await this.prismaService.affiliateReferral.findUnique({
      where: { referredUserId: userId },
      include: { affiliate: true },
    });
    const parentAffiliateId = referral?.affiliateId ?? null;
    const level = referral?.affiliate ? Math.min(referral.affiliate.level + 1, 3) : 1;

    return this.prismaService.affiliate.create({
      data: {
        userId,
        referralCode: await this.generateUniqueReferralCode(dto.referralCodePrefix),
        parentAffiliateId,
        level,
        status: AffiliateStatus.ACTIVE,
      },
    });
  }

  async getMe(userId: string) {
    const affiliate = await this.prismaService.affiliate.findUnique({
      where: { userId },
      include: {
        parentAffiliate: true,
        referrals: true,
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!affiliate) {
      return null;
    }

    const totals = await this.prismaService.affiliateCommission.aggregate({
      where: { affiliateId: affiliate.id },
      _sum: { commissionAmount: true },
    });

    return {
      ...affiliate,
      totalCommission: toNumber(totals._sum.commissionAmount) ?? 0,
    };
  }

  async getTree(userId: string) {
    const affiliate = await this.prismaService.affiliate.findUnique({
      where: { userId },
    });

    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }

    const affiliates = await this.prismaService.affiliate.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const byParent = new Map<string | null, typeof affiliates>();

    for (const node of affiliates) {
      const bucket = byParent.get(node.parentAffiliateId) ?? [];
      bucket.push(node);
      byParent.set(node.parentAffiliateId, bucket);
    }

    const buildTree = (rootId: string): AffiliateTreeNode | null => {
      const node = affiliates.find((item) => item.id === rootId);

      if (!node) {
        return null;
      }

      return {
        ...node,
        children: (byParent.get(rootId) ?? [])
          .map((child) => buildTree(child.id))
          .filter((value): value is NonNullable<typeof value> => value !== null),
      };
    };

    return buildTree(affiliate.id);
  }

  async getCommissions(userId: string) {
    const affiliate = await this.prismaService.affiliate.findUnique({
      where: { userId },
    });

    if (!affiliate) {
      return [];
    }

    return this.prismaService.affiliateCommission.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReferrals(userId: string) {
    const affiliate = await this.prismaService.affiliate.findUnique({
      where: { userId },
    });

    if (!affiliate) {
      return [];
    }

    return this.prismaService.affiliateReferral.findMany({
      where: { affiliateId: affiliate.id },
      include: {
        referredUser: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignParent(
    affiliateId: string,
    dto: AssignParentAffiliateDto,
    adminUserId?: string,
  ) {
    const affiliate = await this.prismaService.affiliate.findUnique({
      where: { id: affiliateId },
    });

    if (!affiliate) {
      throw new NotFoundException('Affiliate not found');
    }

    const parent = await this.prismaService.affiliate.findUnique({
      where: { id: dto.parentAffiliateId },
    });

    if (!parent) {
      throw new NotFoundException('Parent affiliate not found');
    }

    if (affiliate.id === parent.id) {
      throw new BadRequestException('Affiliate cannot be parent of itself');
    }

    await this.assertNoAffiliateHierarchyCycle(affiliate.id, parent.id);

    const updated = await this.prismaService.affiliate.update({
      where: { id: affiliateId },
      data: {
        parentAffiliateId: parent.id,
        level: Math.min(parent.level + 1, 3),
      },
    });

    await this.auditService.log({
      actorUserId: adminUserId ?? null,
      actorRole: 'admin',
      action: 'AFFILIATE_PARENT_ASSIGNED',
      entityType: 'affiliate',
      entityId: updated.id,
      targetUserId: updated.userId,
      metadataJson: {
        parentAffiliateId: parent.id,
      },
    });

    return updated;
  }

  async approveCommission(commissionId: string, adminUserId?: string) {
    const updated = await this.transitionCommissionStatus(
      commissionId,
      [AffiliateCommissionStatus.PENDING],
      AffiliateCommissionStatus.APPROVED,
    );

    await this.auditService.log({
      actorUserId: adminUserId ?? null,
      actorRole: 'admin',
      action: 'AFFILIATE_COMMISSION_APPROVED',
      entityType: 'affiliate_commission',
      entityId: updated.id,
      targetUserId: updated.referredUserId,
      metadataJson: {
        affiliateId: updated.affiliateId,
      },
    });

    return updated;
  }

  async payCommission(commissionId: string, adminUserId?: string) {
    if (!this.brokerSettingsService.areAffiliatePayoutsEnabled()) {
      throw new BadRequestException('Affiliate payouts are temporarily disabled');
    }

    const commission = await this.prismaService.affiliateCommission.findUnique({
      where: { id: commissionId },
      include: { affiliate: true },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    if (commission.status !== AffiliateCommissionStatus.APPROVED) {
      throw new BadRequestException('Commission must be approved before payout');
    }

    const paidCommission = await this.prismaService.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: commission.affiliate.userId },
      });
      const account = await tx.account.findFirst({
        where: {
          userId: commission.affiliate.userId,
          status: AccountStatus.ACTIVE,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });

      if (!wallet) {
        throw new NotFoundException('Affiliate wallet not found');
      }

      if (!account) {
        throw new NotFoundException('Affiliate trading account not found');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: commission.commissionAmount,
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId: commission.affiliate.userId,
          walletId: wallet.id,
          accountId: account.id,
          type: TransactionType.DEPOSIT,
          amount: commission.commissionAmount,
          status: TransactionStatus.COMPLETED,
          asset: 'USDT',
          reference: `affiliate_commission:${commission.id}`,
          metadata: {
            source: 'AFFILIATE_COMMISSION',
            commissionId: commission.id,
          },
        },
      });

      return tx.affiliateCommission.update({
        where: { id: commissionId },
        data: {
          status: AffiliateCommissionStatus.PAID,
        },
      });
    });

    await this.auditService.log({
      actorUserId: adminUserId ?? null,
      actorRole: 'admin',
      action: 'AFFILIATE_COMMISSION_PAID',
      entityType: 'affiliate_commission',
      entityId: paidCommission.id,
      targetUserId: paidCommission.referredUserId,
      metadataJson: {
        affiliateId: paidCommission.affiliateId,
      },
    });

    return paidCommission;
  }

  async registerReferralForUser(userId: string, referralCode?: string) {
    if (!this.brokerSettingsService.isAffiliateProgramEnabled()) {
      return null;
    }

    if (!referralCode) {
      return null;
    }

    const existing = await this.prismaService.affiliateReferral.findUnique({
      where: { referredUserId: userId },
    });

    if (existing) {
      return existing;
    }

    const affiliate = await this.prismaService.affiliate.findFirst({
      where: {
        referralCode: referralCode.toUpperCase(),
        status: AffiliateStatus.ACTIVE,
      },
    });

    if (!affiliate) {
      return null;
    }

    return this.prismaService.affiliateReferral.create({
      data: {
        affiliateId: affiliate.id,
        referredUserId: userId,
      },
    });
  }

  async processExecutedOrder(params: {
    userId: string;
    orderId: string;
    symbol: string;
    volume: number;
    tradeNotional: number;
    spreadMarkupRevenue: number;
    commissionRevenue: number;
  }) {
    if (!this.brokerSettingsService.isAffiliateProgramEnabled()) {
      return [];
    }

    const existing = await this.prismaService.affiliateCommission.count({
      where: { orderId: params.orderId },
    });

    if (existing > 0) {
      return [];
    }

    const upline = await this.resolveUplineAffiliatesForUser(params.userId);

    if (upline.length === 0) {
      return [];
    }

    const levelRates = this.brokerSettingsService.getAffiliateLevelRates();
    const levelPercentMap = {
      1: levelRates.level1Percent,
      2: levelRates.level2Percent,
      3: levelRates.level3Percent,
    } as const;

    const commissionRows = upline.map((entry) => {
      const rebate = this.rebatesService.calculateAffiliateRebate({
        tradeNotional: params.tradeNotional,
        spreadMarkupRevenue: params.spreadMarkupRevenue,
        commissionRevenue: params.commissionRevenue,
        rebateConfig: levelPercentMap[entry.level as 1 | 2 | 3] ?? 0,
        hierarchyLevel: entry.level,
      });

      return {
        affiliateId: entry.affiliate.id,
        referredUserId: params.userId,
        orderId: params.orderId,
        symbol: params.symbol,
        volume: toDecimal(params.volume),
        commissionAmount: toDecimal(rebate.rebateAmount),
        level: entry.level,
        status: AffiliateCommissionStatus.PENDING,
      };
    });

    if (commissionRows.length === 0) {
      return [];
    }

    return this.prismaService.affiliateCommission.createMany({
      data: commissionRows,
      skipDuplicates: true,
    });
  }

  private async resolveUplineAffiliatesForUser(userId: string) {
    const referral = await this.prismaService.affiliateReferral.findUnique({
      where: { referredUserId: userId },
      include: { affiliate: true },
    });

    if (!referral || referral.affiliate.status !== AffiliateStatus.ACTIVE) {
      return [];
    }

    const result: Array<{
      level: number;
      affiliate: NonNullable<typeof referral.affiliate>;
    }> = [];
    let currentAffiliate: NonNullable<typeof referral.affiliate> | null = referral.affiliate;
    let level = 1;

    while (currentAffiliate && level <= 3) {
      result.push({
        level,
        affiliate: currentAffiliate,
      });

      currentAffiliate = currentAffiliate.parentAffiliateId
        ? await this.prismaService.affiliate.findUnique({
            where: { id: currentAffiliate.parentAffiliateId },
          })
        : null;

      if (currentAffiliate && currentAffiliate.status !== AffiliateStatus.ACTIVE) {
        currentAffiliate = null;
      }

      level += 1;
    }

    return result;
  }

  private async transitionCommissionStatus(
    commissionId: string,
    allowedStatuses: AffiliateCommissionStatus[],
    targetStatus: AffiliateCommissionStatus,
  ) {
    const commission = await this.prismaService.affiliateCommission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    if (!allowedStatuses.includes(commission.status)) {
      throw new BadRequestException('Commission status transition is not allowed');
    }

    return this.prismaService.affiliateCommission.update({
      where: { id: commissionId },
      data: {
        status: targetStatus,
      },
    });
  }

  private async assertNoAffiliateHierarchyCycle(
    affiliateId: string,
    candidateParentId: string,
  ) {
    let currentAffiliateId: string | null = candidateParentId;

    while (currentAffiliateId) {
      if (currentAffiliateId === affiliateId) {
        throw new BadRequestException(
          'Affiliate parent assignment would create a hierarchy cycle',
        );
      }

      const parentRow: { parentAffiliateId: string | null } | null =
        await this.prismaService.affiliate.findUnique({
        where: { id: currentAffiliateId },
        select: { parentAffiliateId: true },
        });
      currentAffiliateId = parentRow?.parentAffiliateId ?? null;
    }
  }

  private async generateUniqueReferralCode(prefix?: string): Promise<string> {
    const normalizedPrefix = prefix
      ? prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
      : '';

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomBytes(4).toString('hex').toUpperCase();
      const code = `${normalizedPrefix}${suffix}`.slice(0, 12);

      const existing = await this.prismaService.affiliate.findUnique({
        where: { referralCode: code },
      });

      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException('Failed to generate unique referral code');
  }
}
