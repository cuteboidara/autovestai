import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  Account,
  AccountStatus,
  AccountType,
  CopyRelation,
  CopyStatus,
  OrderSourceType,
  OrderStatus,
  Position,
  PositionStatus,
  SignalProvider,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { ResponseCacheService } from '../../common/cache/response-cache.service';
import { accountSelect, positionSelect } from '../../common/prisma/selects';
import { PrismaService } from '../../common/prisma/prisma.service';
import { roundTo, toDecimal, toNumber } from '../../common/utils/decimal';
import { AccountsService } from '../accounts/accounts.service';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { AuditService } from '../audit/audit.service';
import { KycService } from '../kyc/kyc.service';
import { CopyExecutionService } from './copy-execution.service';
import { CopyTradingQueueService } from './copy-trading-queue.service';
import {
  ListSignalProvidersQueryDto,
  ProviderSortBy,
} from './dto/list-signal-providers-query.dto';
import { RegisterSignalProviderDto } from './dto/register-signal-provider.dto';
import { StartCopyDto } from './dto/start-copy.dto';
import { UpdateCopyRelationDto } from './dto/update-copy-relation.dto';
import { UpdateSignalProviderDto } from './dto/update-signal-provider.dto';

type ProviderRecord = SignalProvider & { account: Account };
type CopyRelationRecord = CopyRelation & {
  provider: SignalProvider;
  copyAccount: Account;
};

const providerSelect = {
  id: true,
  userId: true,
  accountId: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  strategy: true,
  minCopyAmount: true,
  feePercent: true,
  isPublic: true,
  isAccepting: true,
  totalReturn: true,
  monthlyReturn: true,
  winRate: true,
  maxDrawdown: true,
  totalTrades: true,
  activeCopiers: true,
  createdAt: true,
  updatedAt: true,
  account: {
    select: accountSelect,
  },
} as const;

interface MonthlyReturnPoint {
  label: string;
  month: string;
  value: number;
}

interface EquityCurvePoint {
  timestamp: string;
  label: string;
  value: number;
}

interface ProviderAnalytics {
  totalReturn: number;
  monthlyReturn: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  activeCopiers: number;
  avgTradeDurationHours: number;
  profitableTrades: number;
  totalClosedPnl: number;
  currentBalance: number;
  currentEquity: number;
  monthlyReturns: MonthlyReturnPoint[];
  equityCurve: EquityCurvePoint[];
  recentTrades: Array<{
    id: string;
    symbol: string;
    side: string;
    openedAt: string;
    closedAt: string | null;
    pnl: number;
    pnlPercent: number;
    volume: number;
    durationHours: number;
  }>;
  currentCopiers: Array<{
    id: string;
    alias: string;
    status: CopyStatus;
    allocatedAmount: number;
    copyRatio: number;
    totalCopiedPnl: number;
    feesPaid: number;
    startedAt: string;
    stoppedAt: string | null;
    account: {
      id: string;
      name: string;
      type: AccountType;
    };
  }>;
}

@Injectable()
export class CopyTradingService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly auditService: AuditService,
    private readonly kycService: KycService,
    private readonly responseCacheService: ResponseCacheService,
    @Inject(forwardRef(() => AccountsService))
    private readonly accountsService: AccountsService,
    private readonly copyTradingQueueService: CopyTradingQueueService,
    private readonly copyExecutionService: CopyExecutionService,
  ) {}

  async listProviders(query: ListSignalProvidersQueryDto) {
    const providers = await this.prismaService.signalProvider.findMany({
      where: {
        isPublic: true,
      },
      select: providerSelect,
      orderBy: { createdAt: 'desc' },
    });

    const summaries = await Promise.all(
      providers.map(async (provider) => {
        const analytics = await this.buildProviderAnalytics(provider);
        return this.buildProviderSummary(provider, analytics);
      }),
    );

    const filtered = summaries.filter((provider) => {
      if (
        query.minReturn !== undefined &&
        provider.totalReturn < query.minReturn
      ) {
        return false;
      }

      if (
        query.maxDrawdown !== undefined &&
        provider.maxDrawdown > query.maxDrawdown
      ) {
        return false;
      }

      return true;
    });

    return this.sortProviderSummaries(filtered, query.sortBy);
  }

  async getProviderProfile(providerId: string) {
    const provider = await this.prismaService.signalProvider.findFirst({
      where: {
        id: providerId,
        isPublic: true,
      },
      select: providerSelect,
    });

    if (!provider) {
      throw new NotFoundException('Signal provider not found');
    }

    const analytics = await this.buildProviderAnalytics(provider);

    return {
      ...this.buildProviderSummary(provider, analytics),
      stats: {
        totalReturn: analytics.totalReturn,
        monthlyReturn: analytics.monthlyReturn,
        winRate: analytics.winRate,
        maxDrawdown: analytics.maxDrawdown,
        totalTrades: analytics.totalTrades,
        activeCopiers: analytics.activeCopiers,
        avgTradeDurationHours: analytics.avgTradeDurationHours,
        profitableTrades: analytics.profitableTrades,
        totalClosedPnl: analytics.totalClosedPnl,
        currentBalance: analytics.currentBalance,
        currentEquity: analytics.currentEquity,
      },
      monthlyReturns: analytics.monthlyReturns,
      equityCurve: analytics.equityCurve,
      recentTrades: analytics.recentTrades,
      currentCopiers: analytics.currentCopiers,
    };
  }

  async getMyProvider(userId: string) {
    const provider = await this.prismaService.signalProvider.findUnique({
      where: { userId },
      select: providerSelect,
    });

    if (!provider) {
      return null;
    }

    const analytics = await this.buildProviderAnalytics(provider);
    return this.buildProviderSummary(provider, analytics);
  }

  async registerProvider(userId: string, dto: RegisterSignalProviderDto) {
    await this.kycService.assertPlatformAccessApproved(userId);
    this.assertCopyTradingEnabled();

    const existing = await this.prismaService.signalProvider.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new BadRequestException('Signal provider profile already exists');
    }

    const account = await this.getOwnedAccount(userId, dto.accountId);

    if (account.type !== AccountType.LIVE) {
      throw new BadRequestException('Only LIVE accounts can be published as signal accounts');
    }

    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Only active LIVE accounts can be published as signal accounts');
    }

    const accountInUse = await this.prismaService.signalProvider.findFirst({
      where: { accountId: account.id },
    });

    if (accountInUse) {
      throw new BadRequestException('This account is already linked to a signal provider');
    }

    const provider = await this.prismaService.signalProvider.create({
      data: {
        userId,
        accountId: account.id,
        displayName: this.requireDisplayName(dto.displayName),
        bio: this.normalizeOptionalText(dto.bio),
        avatarUrl: this.normalizeOptionalText(dto.avatarUrl),
        strategy: this.normalizeOptionalText(dto.strategy),
        minCopyAmount: toDecimal(dto.minCopyAmount),
        feePercent: toDecimal(dto.feePercent),
        isPublic: dto.isPublic ?? true,
        isAccepting: dto.isAccepting ?? true,
      },
      select: providerSelect,
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'SIGNAL_PROVIDER_REGISTERED',
      entityType: 'signal_provider',
      entityId: provider.id,
      targetUserId: userId,
      metadataJson: {
        accountId: provider.accountId,
        displayName: provider.displayName,
      },
    });

    await this.refreshProviderStats(provider.id);
    await this.responseCacheService.invalidatePublicResource('copy-trading-providers');
    return this.getMyProvider(userId);
  }

  async updateMyProvider(userId: string, dto: UpdateSignalProviderDto) {
    await this.kycService.assertPlatformAccessApproved(userId);
    this.assertCopyTradingEnabled();

    const provider = await this.prismaService.signalProvider.findUnique({
      where: { userId },
      select: providerSelect,
    });

    if (!provider) {
      throw new NotFoundException('Signal provider profile not found');
    }

    let accountId = provider.accountId;

    if (dto.accountId) {
      const account = await this.getOwnedAccount(userId, dto.accountId);

      if (account.type !== AccountType.LIVE) {
        throw new BadRequestException('Only LIVE accounts can be used as signal accounts');
      }

      if (account.status !== AccountStatus.ACTIVE) {
        throw new BadRequestException('Only active LIVE accounts can be used as signal accounts');
      }

      const accountInUse = await this.prismaService.signalProvider.findFirst({
        where: {
          accountId: account.id,
          id: {
            not: provider.id,
          },
        },
      });

      if (accountInUse) {
        throw new BadRequestException('This account is already linked to another signal provider');
      }

      accountId = account.id;
    }

    await this.prismaService.signalProvider.update({
      where: { id: provider.id },
      data: {
        accountId,
        displayName:
          dto.displayName !== undefined
            ? this.requireDisplayName(dto.displayName)
            : undefined,
        bio:
          dto.bio !== undefined ? this.normalizeOptionalText(dto.bio) : undefined,
        avatarUrl:
          dto.avatarUrl !== undefined
            ? this.normalizeOptionalText(dto.avatarUrl)
            : undefined,
        strategy:
          dto.strategy !== undefined
            ? this.normalizeOptionalText(dto.strategy)
            : undefined,
        minCopyAmount:
          dto.minCopyAmount !== undefined
            ? toDecimal(dto.minCopyAmount)
            : undefined,
        feePercent:
          dto.feePercent !== undefined ? toDecimal(dto.feePercent) : undefined,
        isPublic: dto.isPublic,
        isAccepting: dto.isAccepting,
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'SIGNAL_PROVIDER_UPDATED',
      entityType: 'signal_provider',
      entityId: provider.id,
      targetUserId: userId,
      metadataJson: {
        accountId,
      },
    });

    await this.refreshProviderStats(provider.id);
    await this.responseCacheService.invalidatePublicResource('copy-trading-providers');
    return this.getMyProvider(userId);
  }

  async startCopying(userId: string, providerId: string, dto: StartCopyDto) {
    await this.kycService.assertPlatformAccessApproved(userId);
    this.assertCopyTradingEnabled();

    const provider = await this.prismaService.signalProvider.findFirst({
      where: {
        id: providerId,
        isPublic: true,
      },
    });

    if (!provider) {
      throw new NotFoundException('Signal provider not found');
    }

    if (!provider.isAccepting) {
      throw new BadRequestException('This signal provider is not accepting new copiers');
    }

    if (provider.userId === userId) {
      throw new BadRequestException('You cannot copy your own signal account');
    }

    const copyAccount = await this.getOwnedAccount(userId, dto.copyAccountId);

    if (copyAccount.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Copy destination account must be active');
    }

    const minCopyAmount = toNumber(provider.minCopyAmount) ?? 0;

    if (dto.allocatedAmount < minCopyAmount) {
      throw new BadRequestException(
        `Minimum allocation for this provider is ${minCopyAmount} USDT`,
      );
    }

    const existing = await this.prismaService.copyRelation.findFirst({
      where: {
        copierId: userId,
        providerId: provider.id,
        copyAccountId: copyAccount.id,
      },
    });

    const status: CopyStatus = dto.status ?? CopyStatus.ACTIVE;

    const relation = existing
      ? await this.prismaService.copyRelation.update({
          where: { id: existing.id },
          data: {
            allocatedAmount: toDecimal(dto.allocatedAmount),
            copyRatio: toDecimal(dto.copyRatio ?? 1),
            status,
            stoppedAt: status === CopyStatus.STOPPED ? new Date() : null,
            startedAt:
              existing.status === CopyStatus.STOPPED ? new Date() : existing.startedAt,
          },
        })
      : await this.prismaService.copyRelation.create({
          data: {
            copierId: userId,
            copyAccountId: copyAccount.id,
            providerId: provider.id,
            allocatedAmount: toDecimal(dto.allocatedAmount),
            copyRatio: toDecimal(dto.copyRatio ?? 1),
            status,
          },
        });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'COPY_RELATION_STARTED',
      entityType: 'copy_relation',
      entityId: relation.id,
      targetUserId: userId,
      metadataJson: {
        providerId: provider.id,
        copyAccountId: copyAccount.id,
        allocatedAmount: dto.allocatedAmount,
        copyRatio: dto.copyRatio ?? 1,
        status,
      },
    });

    await this.refreshProviderStats(provider.id);
    return this.getCopyRelationById(userId, relation.id);
  }

  async updateCopyRelation(
    userId: string,
    relationId: string,
    dto: UpdateCopyRelationDto,
  ) {
    await this.kycService.assertPlatformAccessApproved(userId);
    this.assertCopyTradingEnabled();

    const existing = await this.prismaService.copyRelation.findFirst({
      where: {
        id: relationId,
        copierId: userId,
      },
      include: {
        provider: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Copy relation not found');
    }

    const minCopyAmount = toNumber(existing.provider.minCopyAmount) ?? 0;

    if (
      dto.allocatedAmount !== undefined &&
      dto.allocatedAmount < minCopyAmount
    ) {
      throw new BadRequestException(
        `Minimum allocation for this provider is ${minCopyAmount} USDT`,
      );
    }

    const status = dto.status ?? existing.status;
    const updated = await this.prismaService.copyRelation.update({
      where: { id: existing.id },
      data: {
        allocatedAmount:
          dto.allocatedAmount !== undefined
            ? toDecimal(dto.allocatedAmount)
            : undefined,
        copyRatio:
          dto.copyRatio !== undefined ? toDecimal(dto.copyRatio) : undefined,
        status,
        stoppedAt:
          status === CopyStatus.STOPPED
            ? new Date()
            : status === CopyStatus.ACTIVE
            ? null
            : existing.stoppedAt,
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'COPY_RELATION_UPDATED',
      entityType: 'copy_relation',
      entityId: updated.id,
      targetUserId: userId,
      metadataJson: {
        allocatedAmount:
          dto.allocatedAmount !== undefined ? dto.allocatedAmount : null,
        copyRatio: dto.copyRatio !== undefined ? dto.copyRatio : null,
        status,
      },
    });

    await this.refreshProviderStats(existing.providerId);
    return this.getCopyRelationById(userId, updated.id);
  }

  async stopCopying(userId: string, relationId: string) {
    const existing = await this.prismaService.copyRelation.findFirst({
      where: {
        id: relationId,
        copierId: userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Copy relation not found');
    }

    await this.prismaService.copyRelation.update({
      where: { id: existing.id },
      data: {
        status: CopyStatus.STOPPED,
        stoppedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'COPY_RELATION_STOPPED',
      entityType: 'copy_relation',
      entityId: existing.id,
      targetUserId: userId,
      metadataJson: {
        providerId: existing.providerId,
      },
    });

    await this.refreshProviderStats(existing.providerId);
    return { success: true };
  }

  async listMyCopies(userId: string) {
    const relations = await this.prismaService.copyRelation.findMany({
      where: {
        copierId: userId,
      },
      include: {
        provider: true,
        copyAccount: true,
      },
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    });

    return relations.map((relation) => this.serializeCopyRelation(relation));
  }

  async handleExecutedOrder(orderId: string) {
    if (!this.brokerSettingsService.isCopyTradingEnabled()) {
      return;
    }

    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        accountId: true,
        sourceType: true,
        status: true,
      },
    });

    if (
      !order ||
      order.sourceType === OrderSourceType.COPY ||
      order.status !== OrderStatus.EXECUTED
    ) {
      return;
    }

    const provider = await this.prismaService.signalProvider.findFirst({
      where: {
        userId: order.userId,
        accountId: order.accountId,
      },
      select: { id: true },
    });

    if (!provider) {
      return;
    }

    const position = await this.prismaService.position.findUnique({
      where: { orderId: order.id },
    });

    if (!position) {
      return;
    }

    await this.copyTradingQueueService.enqueueMasterOpen(position.id);
  }

  async handlePositionClosed(positionId: string) {
    if (!this.brokerSettingsService.isCopyTradingEnabled()) {
      return;
    }

    const position = await this.prismaService.position.findUnique({
      where: { id: positionId },
      include: {
        order: true,
      },
    });

    if (
      !position ||
      position.order.sourceType === OrderSourceType.COPY ||
      position.status !== PositionStatus.CLOSED
    ) {
      return;
    }

    const provider = await this.prismaService.signalProvider.findFirst({
      where: {
        userId: position.userId,
        accountId: position.accountId,
      },
      select: { id: true },
    });

    if (!provider) {
      return;
    }

    await this.copyTradingQueueService.enqueueMasterClose(position.id);
  }

  async processProviderOpen(positionId: string) {
    const providerTrade = await this.prismaService.position.findUnique({
      where: { id: positionId },
      include: {
        order: true,
      },
    });

    if (
      !providerTrade ||
      providerTrade.order.sourceType === OrderSourceType.COPY ||
      providerTrade.status !== PositionStatus.OPEN
    ) {
      return;
    }

    const provider = await this.prismaService.signalProvider.findFirst({
      where: {
        userId: providerTrade.userId,
        accountId: providerTrade.accountId,
      },
    });

    if (!provider) {
      return;
    }

    await this.copyExecutionService.onProviderTrade(provider, providerTrade);
  }

  async processProviderClose(positionId: string) {
    const providerTrade = await this.prismaService.position.findUnique({
      where: { id: positionId },
      include: {
        order: true,
      },
    });

    if (
      !providerTrade ||
      providerTrade.order.sourceType === OrderSourceType.COPY ||
      providerTrade.status !== PositionStatus.CLOSED
    ) {
      return;
    }

    const provider = await this.prismaService.signalProvider.findFirst({
      where: {
        userId: providerTrade.userId,
        accountId: providerTrade.accountId,
      },
    });

    if (!provider) {
      return;
    }

    await this.copyExecutionService.onProviderClose(provider, providerTrade);
    await this.refreshProviderStats(provider.id);
  }

  async processMasterOpen(positionId: string) {
    await this.processProviderOpen(positionId);
  }

  async processMasterClose(positionId: string) {
    await this.processProviderClose(positionId);
  }

  async refreshAllProviderStats() {
    const providers = await this.prismaService.signalProvider.findMany({
      select: { id: true },
    });

    for (const provider of providers) {
      await this.refreshProviderStats(provider.id);
    }
  }

  async refreshProviderStats(providerId: string) {
    const provider = await this.prismaService.signalProvider.findUnique({
      where: { id: providerId },
      include: {
        account: true,
      },
    });

    if (!provider) {
      return null;
    }

    const analytics = await this.buildProviderAnalytics(provider);

    return this.prismaService.signalProvider.update({
      where: { id: providerId },
      data: {
        totalReturn: toDecimal(analytics.totalReturn),
        monthlyReturn: toDecimal(analytics.monthlyReturn),
        winRate: toDecimal(analytics.winRate),
        maxDrawdown: toDecimal(analytics.maxDrawdown),
        totalTrades: analytics.totalTrades,
        activeCopiers: analytics.activeCopiers,
      },
    });
  }

  private async getOwnedAccount(userId: string, accountId: string) {
    const account = await this.prismaService.account.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  private async getCopyRelationById(userId: string, relationId: string) {
    const relation = await this.prismaService.copyRelation.findFirst({
      where: {
        id: relationId,
        copierId: userId,
      },
      include: {
        provider: true,
        copyAccount: true,
      },
    });

    if (!relation) {
      throw new NotFoundException('Copy relation not found');
    }

    return this.serializeCopyRelation(relation);
  }

  private async buildProviderAnalytics(
    provider: ProviderRecord,
  ): Promise<ProviderAnalytics> {
    const [accountMetrics, positions, deposits, withdrawals, copierRelations] =
      await Promise.all([
        this.accountsService.getAccountMetrics(provider.account.id),
        this.prismaService.position.findMany({
          where: {
            userId: provider.userId,
            accountId: provider.accountId,
          },
          select: positionSelect,
          orderBy: { openedAt: 'asc' },
        }),
        this.prismaService.transaction.aggregate({
          where: {
            accountId: provider.accountId,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.COMPLETED,
          },
          _sum: {
            amount: true,
          },
        }),
        this.prismaService.transaction.aggregate({
          where: {
            accountId: provider.accountId,
            type: TransactionType.WITHDRAW,
            status: TransactionStatus.COMPLETED,
          },
          _sum: {
            amount: true,
          },
        }),
        this.prismaService.copyRelation.findMany({
          where: {
            providerId: provider.id,
            status: {
              in: [CopyStatus.ACTIVE, CopyStatus.PAUSED],
            },
          },
          include: {
            copier: {
              select: {
                id: true,
              },
            },
            copyAccount: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
          orderBy: { startedAt: 'desc' },
        }),
      ]);

    const closedPositions = positions
      .filter((position) => position.status === PositionStatus.CLOSED && position.closedAt)
      .sort(
        (left, right) =>
          (left.closedAt?.getTime() ?? 0) - (right.closedAt?.getTime() ?? 0),
      );
    const totalClosedPnl = closedPositions.reduce(
      (sum, position) => sum + (toNumber(position.pnl) ?? 0),
      0,
    );
    const profitableTrades = closedPositions.filter(
      (position) => (toNumber(position.pnl) ?? 0) > 0,
    ).length;
    const capitalBase = this.resolveCapitalBase({
      currentBalance: accountMetrics.balance,
      totalClosedPnl,
      totalDeposits: toNumber(deposits._sum.amount) ?? 0,
      totalWithdrawals: toNumber(withdrawals._sum.amount) ?? 0,
    });
    const totalReturn =
      capitalBase <= 0 ? 0 : roundTo((totalClosedPnl / capitalBase) * 100, 4);
    const monthStart = this.startOfMonth(new Date());
    const monthlyPnl = closedPositions.reduce((sum, position) => {
      if (position.closedAt && position.closedAt >= monthStart) {
        return sum + (toNumber(position.pnl) ?? 0);
      }

      return sum;
    }, 0);
    const monthlyReturn =
      capitalBase <= 0 ? 0 : roundTo((monthlyPnl / capitalBase) * 100, 4);
    const winRate =
      closedPositions.length === 0
        ? 0
        : roundTo((profitableTrades / closedPositions.length) * 100, 2);
    const avgTradeDurationHours =
      closedPositions.length === 0
        ? 0
        : roundTo(
            closedPositions.reduce((sum, position) => {
              const closedAt = position.closedAt?.getTime() ?? position.openedAt.getTime();
              return sum + (closedAt - position.openedAt.getTime()) / (60 * 60 * 1000);
            }, 0) / closedPositions.length,
            2,
          );
    const monthlyReturns = this.buildMonthlyReturnSeries(closedPositions, capitalBase);
    const equityCurve = this.buildEquityCurve(closedPositions, capitalBase);
    const maxDrawdown = this.calculateMaxDrawdown(equityCurve);
    const activeCopiers = copierRelations.filter(
      (relation) => relation.status === CopyStatus.ACTIVE,
    ).length;

    return {
      totalReturn,
      monthlyReturn,
      winRate,
      maxDrawdown,
      totalTrades: closedPositions.length,
      activeCopiers,
      avgTradeDurationHours,
      profitableTrades,
      totalClosedPnl: roundTo(totalClosedPnl, 8),
      currentBalance: roundTo(accountMetrics.balance, 8),
      currentEquity: roundTo(accountMetrics.equity, 8),
      monthlyReturns,
      equityCurve,
      recentTrades: closedPositions
        .slice()
        .reverse()
        .slice(0, 12)
        .map((position) => {
          const pnl = toNumber(position.pnl) ?? 0;
          const marginUsed = toNumber(position.marginUsed) ?? 0;

          return {
            id: position.id,
            symbol: position.symbol,
            side: position.side,
            openedAt: position.openedAt.toISOString(),
            closedAt: position.closedAt?.toISOString() ?? null,
            pnl: roundTo(pnl, 8),
            pnlPercent:
              marginUsed <= 0 ? 0 : roundTo((pnl / marginUsed) * 100, 2),
            volume: roundTo(toNumber(position.volume) ?? 0, 8),
            durationHours: roundTo(
              ((position.closedAt?.getTime() ?? position.openedAt.getTime()) -
                position.openedAt.getTime()) /
                (60 * 60 * 1000),
              2,
            ),
          };
        }),
      currentCopiers: copierRelations.map((relation) => ({
        id: relation.id,
        alias: this.buildCopierAlias(relation.copier.id),
        status: relation.status,
        allocatedAmount: roundTo(toNumber(relation.allocatedAmount) ?? 0, 8),
        copyRatio: roundTo(toNumber(relation.copyRatio) ?? 0, 2),
        totalCopiedPnl: roundTo(toNumber(relation.totalCopiedPnl) ?? 0, 8),
        feesPaid: roundTo(toNumber(relation.feesPaid) ?? 0, 8),
        startedAt: relation.startedAt.toISOString(),
        stoppedAt: relation.stoppedAt?.toISOString() ?? null,
        account: {
          id: relation.copyAccount.id,
          name: relation.copyAccount.name,
          type: relation.copyAccount.type,
        },
      })),
    };
  }

  private buildProviderSummary(
    provider: ProviderRecord,
    analytics: ProviderAnalytics,
  ) {
    return {
      id: provider.id,
      userId: provider.userId,
      displayName: provider.displayName,
      bio: provider.bio,
      avatarUrl: provider.avatarUrl,
      strategy: provider.strategy,
      accountId: provider.accountId,
      totalReturn: analytics.totalReturn,
      monthlyReturn: analytics.monthlyReturn,
      winRate: analytics.winRate,
      maxDrawdown: analytics.maxDrawdown,
      totalTrades: analytics.totalTrades,
      activeCopiers: analytics.activeCopiers,
      minCopyAmount: roundTo(toNumber(provider.minCopyAmount) ?? 0, 8),
      feePercent: roundTo(toNumber(provider.feePercent) ?? 0, 2),
      isPublic: provider.isPublic,
      isAccepting: provider.isAccepting,
      createdAt: provider.createdAt.toISOString(),
      updatedAt: provider.updatedAt.toISOString(),
      account: {
        id: provider.account.id,
        name: provider.account.name,
        type: provider.account.type,
        currency: provider.account.currency,
        balance: analytics.currentBalance,
        equity: analytics.currentEquity,
        isDefault: provider.account.isDefault,
      },
      monthlyReturns: analytics.monthlyReturns,
    };
  }

  private serializeCopyRelation(relation: CopyRelationRecord) {
    return {
      id: relation.id,
      copierId: relation.copierId,
      copyAccountId: relation.copyAccountId,
      providerId: relation.providerId,
      allocatedAmount: roundTo(toNumber(relation.allocatedAmount) ?? 0, 8),
      copyRatio: roundTo(toNumber(relation.copyRatio) ?? 0, 2),
      status: relation.status,
      totalCopiedPnl: roundTo(toNumber(relation.totalCopiedPnl) ?? 0, 8),
      feesPaid: roundTo(toNumber(relation.feesPaid) ?? 0, 8),
      startedAt: relation.startedAt.toISOString(),
      stoppedAt: relation.stoppedAt?.toISOString() ?? null,
      createdAt: relation.createdAt.toISOString(),
      updatedAt: relation.updatedAt.toISOString(),
      netCopiedPnl: roundTo(
        (toNumber(relation.totalCopiedPnl) ?? 0) - (toNumber(relation.feesPaid) ?? 0),
        8,
      ),
      provider: {
        id: relation.provider.id,
        displayName: relation.provider.displayName,
        avatarUrl: relation.provider.avatarUrl,
        strategy: relation.provider.strategy,
        totalReturn: roundTo(toNumber(relation.provider.totalReturn) ?? 0, 4),
        monthlyReturn: roundTo(toNumber(relation.provider.monthlyReturn) ?? 0, 4),
        winRate: roundTo(toNumber(relation.provider.winRate) ?? 0, 2),
        maxDrawdown: roundTo(toNumber(relation.provider.maxDrawdown) ?? 0, 2),
        activeCopiers: relation.provider.activeCopiers,
        minCopyAmount: roundTo(toNumber(relation.provider.minCopyAmount) ?? 0, 8),
        feePercent: roundTo(toNumber(relation.provider.feePercent) ?? 0, 2),
        isAccepting: relation.provider.isAccepting,
      },
      copyAccount: {
        id: relation.copyAccount.id,
        name: relation.copyAccount.name,
        type: relation.copyAccount.type,
        currency: relation.copyAccount.currency,
        balance: roundTo(toNumber(relation.copyAccount.balance) ?? 0, 8),
        equity: roundTo(toNumber(relation.copyAccount.equity) ?? 0, 8),
        isDefault: relation.copyAccount.isDefault,
      },
    };
  }

  private buildMonthlyReturnSeries(
    closedPositions: Position[],
    capitalBase: number,
  ): MonthlyReturnPoint[] {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) =>
      this.startOfMonth(this.addMonths(now, index - 5)),
    );
    const pnlByMonth = new Map<string, number>();

    for (const position of closedPositions) {
      if (!position.closedAt) {
        continue;
      }

      const monthKey = this.buildMonthKey(position.closedAt);
      pnlByMonth.set(
        monthKey,
        (pnlByMonth.get(monthKey) ?? 0) + (toNumber(position.pnl) ?? 0),
      );
    }

    return months.map((monthDate) => {
      const monthKey = this.buildMonthKey(monthDate);
      const pnl = pnlByMonth.get(monthKey) ?? 0;

      return {
        label: new Intl.DateTimeFormat('en-US', {
          month: 'short',
        }).format(monthDate),
        month: monthKey,
        value:
          capitalBase <= 0 ? 0 : roundTo((pnl / capitalBase) * 100, 4),
      };
    });
  }

  private buildEquityCurve(
    closedPositions: Position[],
    capitalBase: number,
  ): EquityCurvePoint[] {
    const points: EquityCurvePoint[] = [];
    let runningEquity = capitalBase;

    if (closedPositions.length === 0) {
      return [
        {
          timestamp: new Date().toISOString(),
          label: new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: '2-digit',
          }).format(new Date()),
          value: roundTo(capitalBase, 8),
        },
      ];
    }

    points.push({
      timestamp: closedPositions[0].openedAt.toISOString(),
      label: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
      }).format(closedPositions[0].openedAt),
      value: roundTo(capitalBase, 8),
    });

    for (const position of closedPositions) {
      runningEquity += toNumber(position.pnl) ?? 0;
      const timestamp = position.closedAt ?? position.openedAt;

      points.push({
        timestamp: timestamp.toISOString(),
        label: new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: '2-digit',
        }).format(timestamp),
        value: roundTo(runningEquity, 8),
      });
    }

    return points;
  }

  private calculateMaxDrawdown(points: EquityCurvePoint[]) {
    let peak = 0;
    let maxDrawdown = 0;

    for (const point of points) {
      peak = Math.max(peak, point.value);

      if (peak <= 0) {
        continue;
      }

      const drawdown = ((peak - point.value) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return roundTo(maxDrawdown, 2);
  }

  private resolveCapitalBase(params: {
    currentBalance: number;
    totalClosedPnl: number;
    totalDeposits: number;
    totalWithdrawals: number;
  }) {
    const fundedCapital = params.totalDeposits - params.totalWithdrawals;

    if (fundedCapital > 0) {
      return roundTo(fundedCapital, 8);
    }

    const reconstructedBalance = params.currentBalance - params.totalClosedPnl;

    if (reconstructedBalance > 0) {
      return roundTo(reconstructedBalance, 8);
    }

    return params.currentBalance > 0 ? roundTo(params.currentBalance, 8) : 1;
  }

  private sortProviderSummaries(
    providers: ReturnType<CopyTradingService['buildProviderSummary']>[],
    sortBy: ProviderSortBy = ProviderSortBy.BEST_RETURN,
  ) {
    return [...providers].sort((left, right) => {
      if (sortBy === ProviderSortBy.MOST_COPIERS) {
        return right.activeCopiers - left.activeCopiers;
      }

      if (sortBy === ProviderSortBy.LOWEST_DRAWDOWN) {
        return left.maxDrawdown - right.maxDrawdown;
      }

      if (sortBy === ProviderSortBy.NEWEST) {
        return (
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        );
      }

      return right.totalReturn - left.totalReturn;
    });
  }

  private assertCopyTradingEnabled() {
    if (!this.brokerSettingsService.isCopyTradingEnabled()) {
      throw new BadRequestException('Copy trading is temporarily disabled');
    }
  }

  private normalizeOptionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private requireDisplayName(value: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException('Display name is required');
    }

    return normalized;
  }

  private startOfMonth(value: Date) {
    return new Date(value.getFullYear(), value.getMonth(), 1);
  }

  private addMonths(value: Date, months: number) {
    return new Date(value.getFullYear(), value.getMonth() + months, 1);
  }

  private buildMonthKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  private buildCopierAlias(userId: string) {
    return `Trader_${userId.slice(-4).toUpperCase()}`;
  }
}
