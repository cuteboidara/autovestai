import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  CopyTradeStatus,
  Prisma,
  SurveillanceAlertStatus,
  SurveillanceCaseStatus,
  SurveillanceSeverity,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toNumber } from '../../common/utils/decimal';
import { AuditService } from '../audit/audit.service';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { CreateSurveillanceCaseDto } from './dto/create-surveillance-case.dto';
import { ListSurveillanceAlertsQueryDto } from './dto/list-surveillance-alerts-query.dto';
import { ListSurveillanceCasesQueryDto } from './dto/list-surveillance-cases-query.dto';
import { UpdateSurveillanceCaseDto } from './dto/update-surveillance-case.dto';

@Injectable()
export class SurveillanceService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runPeriodicChecks();
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  listAlerts(query: ListSurveillanceAlertsQueryDto) {
    return this.prismaService.surveillanceAlert.findMany({
      where: {
        status: query.status,
        severity: query.severity,
        userId: query.userId,
        symbol: query.symbol,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        acknowledgedByUser: {
          select: {
            id: true,
            email: true,
          },
        },
        closedByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async getAlert(id: string) {
    const alert = await this.prismaService.surveillanceAlert.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        cases: true,
      },
    });

    if (!alert) {
      throw new NotFoundException('Surveillance alert not found');
    }

    return alert;
  }

  async acknowledgeAlert(id: string, adminUserId: string) {
    const alert = await this.prismaService.surveillanceAlert.update({
      where: { id },
      data: {
        status: SurveillanceAlertStatus.ACKNOWLEDGED,
        acknowledgedByUserId: adminUserId,
      },
    });

    await this.auditService.log({
      actorUserId: adminUserId,
      actorRole: 'admin',
      action: 'SURVEILLANCE_ALERT_ACKNOWLEDGED',
      entityType: 'surveillance_alert',
      entityId: alert.id,
      targetUserId: alert.userId,
      metadataJson: {
        alertType: alert.alertType,
        severity: alert.severity,
      },
    });

    return alert;
  }

  async closeAlert(id: string, adminUserId: string) {
    const alert = await this.prismaService.surveillanceAlert.update({
      where: { id },
      data: {
        status: SurveillanceAlertStatus.CLOSED,
        closedByUserId: adminUserId,
      },
    });

    await this.auditService.log({
      actorUserId: adminUserId,
      actorRole: 'admin',
      action: 'SURVEILLANCE_ALERT_CLOSED',
      entityType: 'surveillance_alert',
      entityId: alert.id,
      targetUserId: alert.userId,
      metadataJson: {
        alertType: alert.alertType,
        severity: alert.severity,
      },
    });

    return alert;
  }

  listCases(query: ListSurveillanceCasesQueryDto) {
    return this.prismaService.surveillanceCase.findMany({
      where: {
        status: query.status,
        assignedToUserId: query.assignedToUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        assignedToUser: {
          select: {
            id: true,
            email: true,
          },
        },
        alert: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async createCase(dto: CreateSurveillanceCaseDto, actorUserId: string) {
    const created = await this.prismaService.surveillanceCase.create({
      data: {
        userId: dto.userId,
        alertId: dto.alertId,
        assignedToUserId: dto.assignedToUserId,
        notesJson: dto.notesJson as Prisma.InputJsonValue,
      },
      include: {
        alert: true,
      },
    });

    await this.auditService.log({
      actorUserId,
      actorRole: 'admin',
      action: 'SURVEILLANCE_CASE_CREATED',
      entityType: 'surveillance_case',
      entityId: created.id,
      targetUserId: created.userId,
      metadataJson: {
        alertId: created.alertId,
        assignedToUserId: created.assignedToUserId,
      },
    });

    return created;
  }

  async updateCase(
    caseId: string,
    dto: UpdateSurveillanceCaseDto,
    actorUserId: string,
  ) {
    const existing = await this.prismaService.surveillanceCase.findUnique({
      where: { id: caseId },
    });

    if (!existing) {
      throw new NotFoundException('Surveillance case not found');
    }

    const updated = await this.prismaService.surveillanceCase.update({
      where: { id: caseId },
      data: {
        status: dto.status ?? existing.status,
        assignedToUserId: dto.assignedToUserId ?? existing.assignedToUserId,
        notesJson:
          dto.notesJson !== undefined
            ? (dto.notesJson as Prisma.InputJsonValue)
            : existing.notesJson === null
              ? Prisma.JsonNull
              : (existing.notesJson as Prisma.InputJsonValue),
      },
    });

    await this.auditService.log({
      actorUserId,
      actorRole: 'admin',
      action: 'SURVEILLANCE_CASE_UPDATED',
      entityType: 'surveillance_case',
      entityId: updated.id,
      targetUserId: updated.userId,
      metadataJson: {
        status: updated.status,
        assignedToUserId: updated.assignedToUserId,
      },
    });

    return updated;
  }

  async evaluateLogin(userId: string) {
    const sessions = await this.prismaService.userSession.findMany({
      where: {
        userId: { not: userId },
      },
    });
    const latestUserSession = await this.prismaService.userSession.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestUserSession) {
      return null;
    }

    const linkedSessions = sessions.filter(
      (session) =>
        session.deviceFingerprint === latestUserSession.deviceFingerprint ||
        (session.ipAddress !== null &&
          latestUserSession.ipAddress !== null &&
          session.ipAddress === latestUserSession.ipAddress),
    );

    if (linkedSessions.length > 0) {
      return this.createAlertIfNeeded({
        userId,
        alertType: 'multiple_accounts_linked',
        severity: SurveillanceSeverity.HIGH,
        title: 'Multiple accounts linked by device or IP',
        description:
          'Login activity indicates the same device fingerprint or IP is linked to multiple accounts.',
        metadataJson: {
          linkedSessionCount: linkedSessions.length,
          deviceFingerprint: latestUserSession.deviceFingerprint,
          ipAddress: latestUserSession.ipAddress,
        },
      });
    }

    return null;
  }

  async evaluateOrderPlaced(params: {
    userId: string;
    orderId: string;
    symbol: string;
  }) {
    const windowStart = new Date(Date.now() - 5 * 60_000);
    const recentOrders = await this.prismaService.order.count({
      where: {
        userId: params.userId,
        createdAt: {
          gte: windowStart,
        },
      },
    });

    if (recentOrders >= 15) {
      await this.createAlertIfNeeded({
        userId: params.userId,
        symbol: params.symbol,
        alertType: 'too_many_orders_short_period',
        severity: SurveillanceSeverity.MEDIUM,
        title: 'High order burst detected',
        description: 'The account submitted an unusually high number of orders in a short period.',
        metadataJson: {
          recentOrders,
          windowMinutes: 5,
          orderId: params.orderId,
        },
      });
    }

    const openPositions = await this.prismaService.position.findMany({
      where: {
        userId: params.userId,
        symbol: params.symbol,
        status: 'OPEN',
      },
    });
    const concentration = openPositions.reduce(
      (sum, position) => sum + (toNumber(position.volume) ?? 0),
      0,
    );
    const threshold = this.brokerSettingsService.getSymbolConfig(params.symbol).maxExposureThreshold;

    if (concentration > threshold * 0.5) {
      await this.createAlertIfNeeded({
        userId: params.userId,
        symbol: params.symbol,
        alertType: 'symbol_concentration',
        severity: SurveillanceSeverity.MEDIUM,
        title: 'High client symbol concentration',
        description:
          'Open positions indicate unusually concentrated exposure on a single symbol.',
        metadataJson: {
          concentration,
          threshold,
        },
      });
    }
  }

  async evaluateOrderRejected(params: {
    userId: string;
    orderId: string;
    symbol: string;
    reason: string;
  }) {
    const recentRejected = await this.prismaService.order.count({
      where: {
        userId: params.userId,
        status: 'REJECTED',
        updatedAt: {
          gte: new Date(Date.now() - 15 * 60_000),
        },
      },
    });

    if (recentRejected >= 5) {
      await this.createAlertIfNeeded({
        userId: params.userId,
        symbol: params.symbol,
        alertType: 'repeated_rejected_orders',
        severity: SurveillanceSeverity.HIGH,
        title: 'Repeated rejected orders',
        description: 'The account has generated repeated rejected orders within 15 minutes.',
        metadataJson: {
          recentRejected,
          reason: params.reason,
          orderId: params.orderId,
        },
      });
    }
  }

  async evaluatePositionClose(params: {
    userId: string;
    positionId: string;
    symbol: string;
    reason:
      | 'MANUAL'
      | 'LIQUIDATION'
      | 'COPY_MASTER_CLOSE'
      | 'DEMO_RESET'
      | 'STOP_LOSS'
      | 'TAKE_PROFIT';
  }) {
    const closedTradeCount = await this.prismaService.tradeExecution.count({
      where: {
        userId: params.userId,
        metadata: {
          path: ['action'],
          equals: 'CLOSE_POSITION',
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 60_000),
        },
      },
    });

    if (closedTradeCount >= 10) {
      await this.createAlertIfNeeded({
        userId: params.userId,
        symbol: params.symbol,
        alertType: 'excessive_open_close_churn',
        severity: SurveillanceSeverity.MEDIUM,
        title: 'Excessive position churn',
        description: 'The account is opening and closing positions at an unusually high rate.',
        metadataJson: {
          closedTradeCount,
          windowMinutes: 30,
        },
      });
    }

    if (params.reason === 'LIQUIDATION') {
      const liquidationCount = await this.prismaService.auditLog.count({
        where: {
          targetUserId: params.userId,
          action: 'POSITION_LIQUIDATED',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60_000),
          },
        },
      });

      if (liquidationCount >= 3) {
        await this.createAlertIfNeeded({
          userId: params.userId,
          symbol: params.symbol,
          alertType: 'repeated_liquidations',
          severity: SurveillanceSeverity.HIGH,
          title: 'Repeated liquidations',
          description:
            'The account has reached stop-out thresholds repeatedly in the last seven days.',
          metadataJson: {
            liquidationCount,
            positionId: params.positionId,
          },
        });
      }
    }
  }

  async evaluateCopyTradeResult(params: {
    masterId: string;
    followerUserId: string;
    status: CopyTradeStatus;
    reason?: string | null;
  }) {
    if (
      params.status === CopyTradeStatus.SKIPPED &&
      params.reason?.toLowerCase().includes('slippage')
    ) {
      const slippageSkips = await this.prismaService.copyTrade.count({
        where: {
          followerUserId: params.followerUserId,
          status: CopyTradeStatus.SKIPPED,
          reason: {
            contains: 'slippage',
            mode: 'insensitive',
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60_000),
          },
        },
      });

      if (slippageSkips >= 3) {
        await this.createAlertIfNeeded({
          userId: params.followerUserId,
          alertType: 'high_slippage_incidents',
          severity: SurveillanceSeverity.MEDIUM,
          title: 'Repeated slippage incidents',
          description:
            'Copy-trading activity has generated repeated slippage-related skips in the last 24 hours.',
          metadataJson: {
            masterId: params.masterId,
            slippageSkips,
          },
        });
      }
    }
  }

  async evaluateDepositRequest(userId: string) {
    const kyc = await this.prismaService.kycSubmission.findUnique({
      where: { userId },
    });

    if (kyc?.status === 'REJECTED') {
      await this.createAlertIfNeeded({
        userId,
        alertType: 'rejected_kyc_funding_attempt',
        severity: SurveillanceSeverity.HIGH,
        title: 'Funding attempt after KYC rejection',
        description:
          'The user attempted to fund the account after KYC was rejected.',
        metadataJson: {
          kycStatus: kyc.status,
        },
      });
    }
  }

  async evaluateWithdrawalRequest(params: {
    userId: string;
    amount: number;
  }) {
    const kyc = await this.prismaService.kycSubmission.findUnique({
      where: { userId: params.userId },
    });

    if (kyc?.status === 'REJECTED') {
      await this.createAlertIfNeeded({
        userId: params.userId,
        alertType: 'rejected_kyc_funding_attempt',
        severity: SurveillanceSeverity.HIGH,
        title: 'Withdrawal attempt after KYC rejection',
        description:
          'The user attempted to withdraw after KYC was rejected.',
        metadataJson: {
          amount: params.amount,
        },
      });
    }

    const recentDeposit = await this.prismaService.transaction.findFirst({
      where: {
        userId: params.userId,
        type: TransactionType.DEPOSIT,
        status: {
          in: [TransactionStatus.APPROVED, TransactionStatus.COMPLETED],
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60_000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentDeposit || (toNumber(recentDeposit.amount) ?? 0) < 1000) {
      return;
    }

    const tradeCountSinceDeposit = await this.prismaService.transaction.count({
      where: {
        userId: params.userId,
        type: TransactionType.TRADE,
        createdAt: {
          gte: recentDeposit.createdAt,
        },
      },
    });

    if (tradeCountSinceDeposit === 0) {
      await this.createAlertIfNeeded({
        userId: params.userId,
        alertType: 'withdrawal_after_large_deposit_without_trading',
        severity: SurveillanceSeverity.CRITICAL,
        title: 'Withdrawal after large deposit without trading',
        description:
          'The user requested a withdrawal shortly after a large deposit without trading activity.',
        metadataJson: {
          depositAmount: toNumber(recentDeposit.amount),
          withdrawalAmount: params.amount,
          depositCreatedAt: recentDeposit.createdAt.toISOString(),
        },
      });
    }
  }

  async runPeriodicChecks() {
    await Promise.all([
      this.detectAffiliateLinkedBehavior(),
      this.detectAbnormalCopyMasterLoss(),
    ]);
  }

  async getAlertCounts() {
    const grouped = await this.prismaService.surveillanceAlert.groupBy({
      by: ['status'],
      _count: true,
    });

    return grouped.reduce<Record<string, number>>((accumulator, entry) => {
      accumulator[entry.status] = entry._count;
      return accumulator;
    }, {});
  }

  private async detectAffiliateLinkedBehavior() {
    const referrals = await this.prismaService.affiliateReferral.findMany({
      include: {
        affiliate: true,
      },
    });

    for (const referral of referrals) {
      const [affiliateSessions, referredSessions] = await Promise.all([
        this.prismaService.userSession.findMany({
          where: { userId: referral.affiliate.userId },
        }),
        this.prismaService.userSession.findMany({
          where: { userId: referral.referredUserId },
        }),
      ]);

      const linked = referredSessions.some((session) =>
        affiliateSessions.some(
          (affiliateSession) =>
            affiliateSession.deviceFingerprint === session.deviceFingerprint ||
            (affiliateSession.ipAddress !== null &&
              session.ipAddress !== null &&
              affiliateSession.ipAddress === session.ipAddress),
        ),
      );

      if (!linked) {
        continue;
      }

      await this.createAlertIfNeeded({
        userId: referral.referredUserId,
        alertType: 'suspicious_affiliate_linked_behavior',
        severity: SurveillanceSeverity.HIGH,
        title: 'Affiliate-linked device or IP overlap',
        description:
          'Referred user and affiliate activity share device or IP fingerprints.',
        metadataJson: {
          affiliateId: referral.affiliateId,
        },
      });
    }
  }

  private async detectAbnormalCopyMasterLoss() {
    const masters = await this.prismaService.copyMaster.findMany({
      where: { status: 'APPROVED' },
    });

    for (const master of masters) {
      const linkedTrades = await this.prismaService.copyTrade.findMany({
        where: {
          masterId: master.id,
          followerPositionId: { not: null },
        },
        include: {
          followerPosition: true,
        },
      });

      const closedFollowerPositions = linkedTrades.filter(
        (trade) => trade.followerPosition?.status === 'CLOSED',
      );

      if (closedFollowerPositions.length < 5) {
        continue;
      }

      const losingCount = closedFollowerPositions.filter(
        (trade) => (toNumber(trade.followerPosition?.pnl) ?? 0) < 0,
      ).length;
      const lossRatio = losingCount / closedFollowerPositions.length;

      if (lossRatio < 0.8) {
        continue;
      }

      await this.createAlertIfNeeded({
        userId: master.userId,
        alertType: 'copy_master_abnormal_follower_loss',
        severity: SurveillanceSeverity.CRITICAL,
        title: 'Copy master abnormal follower losses',
        description:
          'Follower positions linked to this master are closing with abnormally high loss rates.',
        metadataJson: {
          masterId: master.id,
          lossRatio,
          losingCount,
          totalClosedFollowerPositions: closedFollowerPositions.length,
        },
      });
    }
  }

  private async createAlertIfNeeded(params: {
    userId?: string | null;
    symbol?: string | null;
    alertType: string;
    severity: SurveillanceSeverity;
    title: string;
    description: string;
    metadataJson?: Prisma.InputJsonValue;
  }) {
    // FIX: Keep one unresolved alert per user/symbol/type so compliance queues do not fill with duplicate reminders.
    const existing = await this.prismaService.surveillanceAlert.findFirst({
      where: {
        userId: params.userId ?? null,
        symbol: params.symbol ?? null,
        alertType: params.alertType,
        status: {
          in: [
            SurveillanceAlertStatus.OPEN,
            SurveillanceAlertStatus.ACKNOWLEDGED,
          ],
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prismaService.surveillanceAlert.create({
      data: {
        userId: params.userId ?? null,
        symbol: params.symbol ?? null,
        alertType: params.alertType,
        severity: params.severity,
        title: params.title,
        description: params.description,
        metadataJson: params.metadataJson,
      },
    });
  }
}
