import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Account,
  AccountStatus,
  CopyStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
} from '@prisma/client';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderQueueService } from '../../common/queue/order-queue.service';
import { toNumber } from '../../common/utils/decimal';
import { serializeAccount, serializeTransaction } from '../../common/utils/serializers';
import { AccountsService } from '../accounts/accounts.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { AuditService } from '../audit/audit.service';
import { PricingService } from '../pricing/pricing.service';
import { BrokerSettingsService } from './broker-settings.service';
import { AdminCopyTradesQueryDto } from './dto/admin-copy-trades-query.dto';
import { CreateDepositWalletDto, UpdateDepositWalletDto } from './dto/deposit-wallet.dto';
import { CreditUserDto } from './dto/credit-user.dto';
import { AdminSessionViewDto } from './dto/admin-session-view.dto';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import { UpdateSymbolConfigDto } from './dto/update-symbol-config.dto';
import { DealingDeskService } from '../dealing-desk/dealing-desk.service';
import { EmailService } from '../email/email.service';
import { KycService } from '../kyc/kyc.service';
import { AdminPolicyService } from '../rbac/admin-policy.service';
import { SymbolsService } from '../symbols/symbols.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly orderQueueService: OrderQueueService,
    private readonly accountsService: AccountsService,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly kycService: KycService,
    private readonly dealingDeskService: DealingDeskService,
    private readonly affiliatesService: AffiliatesService,
    private readonly adminPolicyService: AdminPolicyService,
    private readonly auditService: AuditService,
    private readonly symbolsService: SymbolsService,
    private readonly pricingService: PricingService,
    private readonly emailService: EmailService,
  ) {}

  listPendingTransactions() {
    return this.walletService.listPendingTransactions();
  }

  async approveTransaction(
    transactionId: string,
    admin: AuthenticatedUser,
    reason?: string,
  ) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return this.walletService.decideTransaction(transactionId, admin.id, true, reason);
    }

    this.adminPolicyService.assertWalletTransactionAction(
      admin,
      transaction.type,
      true,
    );

    return this.walletService.decideTransaction(transactionId, admin.id, true, reason);
  }

  async rejectTransaction(
    transactionId: string,
    admin: AuthenticatedUser,
    reason?: string,
  ) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return this.walletService.decideTransaction(transactionId, admin.id, false, reason);
    }

    this.adminPolicyService.assertWalletTransactionAction(
      admin,
      transaction.type,
      false,
    );

    return this.walletService.decideTransaction(transactionId, admin.id, false, reason);
  }

  getSettings() {
    return this.brokerSettingsService.getSettingsSummary();
  }

  async updateSettings(admin: AuthenticatedUser, dto: UpdateAdminSettingsDto) {
    this.adminPolicyService.assertSettingsChange(admin);
    const before = await this.brokerSettingsService.getSettingsSummary();
    const after = await this.brokerSettingsService.updateSettings(dto);

    await this.auditService.log({
      actorUserId: admin.id,
      actorRole: admin.role.toLowerCase(),
      action: 'ADMIN_SETTINGS_UPDATED',
      entityType: 'broker_settings',
      entityId: 'global',
      metadataJson: {
        before,
        after,
      } as unknown as Prisma.InputJsonValue,
    });

    return after;
  }

  getSymbolConfigs() {
    return this.brokerSettingsService.getAllSymbolConfigs();
  }

  async listSymbols() {
    return Promise.all(
      this.symbolsService.listSymbols().map((instrument) => this.buildAdminSymbolRecord(instrument.symbol)),
    );
  }

  async updateSymbolConfig(
    admin: AuthenticatedUser,
    symbol: string,
    dto: UpdateSymbolConfigDto,
  ) {
    this.adminPolicyService.assertSymbolConfigChange(admin);
    const before = this.brokerSettingsService.getSymbolConfig(symbol);
    const after = await this.brokerSettingsService.updateSymbolConfig(symbol, dto);

    await this.auditService.log({
      actorUserId: admin.id,
      actorRole: admin.role.toLowerCase(),
      action: 'SYMBOL_CONFIG_UPDATED',
      entityType: 'symbol_config',
      entityId: symbol.toUpperCase(),
      metadataJson: {
        before,
        after,
      } as unknown as Prisma.InputJsonValue,
    });

    return after;
  }

  async updateSymbol(
    admin: AuthenticatedUser,
    symbol: string,
    dto: UpdateSymbolConfigDto,
  ) {
    this.adminPolicyService.assertSymbolConfigChange(admin);
    const instrument = this.symbolsService.getSymbolOrThrow(symbol);
    const before = await this.buildAdminSymbolRecord(instrument.symbol);

    if (dto.isActive !== undefined) {
      await this.symbolsService.updateSymbol(instrument.symbol, {
        isActive: dto.isActive,
      });
    }

    const symbolConfigUpdate: UpdateSymbolConfigDto = {};

    if (dto.maxLeverage !== undefined) {
      symbolConfigUpdate.maxLeverage = dto.maxLeverage;
    }

    if (dto.spreadMarkup !== undefined) {
      symbolConfigUpdate.spreadMarkup = dto.spreadMarkup;
    }

    if (dto.tradingEnabled !== undefined) {
      symbolConfigUpdate.tradingEnabled = dto.tradingEnabled;
    }

    if (dto.maxExposureThreshold !== undefined) {
      symbolConfigUpdate.maxExposureThreshold = dto.maxExposureThreshold;
    }

    if (Object.keys(symbolConfigUpdate).length > 0) {
      await this.brokerSettingsService.updateSymbolConfig(instrument.symbol, symbolConfigUpdate);
    }

    const after = await this.buildAdminSymbolRecord(instrument.symbol);

    await this.auditService.log({
      actorUserId: admin.id,
      actorRole: admin.role.toLowerCase(),
      action: 'ADMIN_SYMBOL_UPDATED',
      entityType: 'symbol',
      entityId: instrument.symbol,
      metadataJson: {
        before,
        after,
      } as unknown as Prisma.InputJsonValue,
    });

    return after;
  }

  async getOverview() {
    const treasuryWalletSettings = this.brokerSettingsService.getTreasuryWalletSettings();
    const [
      totalUsers,
      totalBalances,
      openPositions,
      pendingDeposits,
      pendingWithdrawals,
      pendingKyc,
      activeUsers,
      exposure,
      hedgeActions,
      providerCount,
      activeCopyRelations,
      mirroredTrades,
      affiliateCommissions,
      pendingWithdrawalAmount,
    ] = await Promise.all([
      this.prismaService.user.count(),
      this.prismaService.account.aggregate({
        where: {
          status: {
            not: AccountStatus.CLOSED,
          },
        },
        _sum: { balance: true },
      }),
      this.prismaService.position.count({
        where: { status: 'OPEN' },
      }),
      this.prismaService.transaction.count({
        where: {
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
        },
      }),
      this.prismaService.transaction.count({
        where: {
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.PENDING,
        },
      }),
      this.prismaService.kycSubmission.count({
        where: { status: 'PENDING' },
      }),
      this.prismaService.user.count({
        where: {
          positions: {
            some: {
              status: 'OPEN',
            },
          },
        },
      }),
      this.dealingDeskService.getExposureOverview(),
      this.prismaService.hedgeAction.findMany({
        select: {
          id: true,
          symbol: true,
          actionType: true,
          volume: true,
          reason: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prismaService.signalProvider.count(),
      this.prismaService.copyRelation.count({
        where: {
          status: {
            in: [CopyStatus.ACTIVE, CopyStatus.PAUSED],
          },
        },
      }),
      this.prismaService.position.count({
        where: {
          copiedFromTradeId: {
            not: null,
          },
        },
      }),
      this.prismaService.affiliateCommission.groupBy({
        by: ['status'],
        _sum: {
          commissionAmount: true,
        },
      }),
      this.prismaService.withdrawalRequest.aggregate({
        where: {
          status: {
            in: [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED],
          },
        },
        _sum: {
          netAmount: true,
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalBalances: toNumber(totalBalances._sum.balance) ?? 0,
      openPositions,
      pendingDeposits,
      pendingWithdrawals,
      pendingKyc,
      exposure,
      hedgeActions,
      copyTrading: {
        masters: providerCount,
        followers: activeCopyRelations,
        trades: mirroredTrades,
      },
      affiliateCommissions,
      treasury: {
        masterWalletTrc20: treasuryWalletSettings.masterWalletTrc20,
        masterWalletErc20: treasuryWalletSettings.masterWalletErc20,
        pendingWithdrawalAmount: toNumber(pendingWithdrawalAmount._sum.netAmount) ?? 0,
      },
    };
  }

  listFailedQueueJobs() {
    return this.orderQueueService.listFailedJobs();
  }

  retryAllFailedQueueJobs() {
    return this.orderQueueService.retryAllFailedJobs();
  }

  async listUsers(query: AdminUserListQueryDto) {
    const users = await this.prismaService.user.findMany({
      where: query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { id: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        accounts: {
          where: {
            status: {
              not: AccountStatus.CLOSED,
            },
          },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        positions: {
          where: { status: 'OPEN' },
        },
        affiliate: true,
        signalProvider: true,
        kycSubmission: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      kycStatus: user.kycSubmission?.status ?? 'NOT_SUBMITTED',
      walletBalance: user.accounts.reduce(
        (sum, account) => sum + (toNumber(account.balance) ?? 0),
        0,
      ),
      openPositions: user.positions.length,
      accountStatus: this.summarizeAccountStatus(user.accounts),
      totalAccounts: user.accounts.length,
      affiliateStatus: user.affiliate?.status ?? null,
      signalProviderStatus: this.getSignalProviderStatus(user.signalProvider),
      createdAt: user.createdAt,
    }));
  }

  async getUserDetail(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        accounts: {
          where: {
            status: {
              not: AccountStatus.CLOSED,
            },
          },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        positions: {
          orderBy: { openedAt: 'desc' },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        affiliate: true,
        signalProvider: true,
        kycSubmission: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            deviceFingerprint: true,
            ipAddress: true,
            userAgent: true,
            lastSeenAt: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const accounts = await Promise.all(
      user.accounts.map(async (account) => {
        const metrics = await this.accountsService.getAccountMetrics(account);

        return serializeAccount(account, metrics);
      }),
    );

    const primaryAccount =
      accounts.find((account) => account.isDefault) ?? accounts[0] ?? null;

    return {
      ...user,
      wallet: primaryAccount,
      accounts,
      signalProvider: user.signalProvider
        ? {
            id: user.signalProvider.id,
            displayName: user.signalProvider.displayName,
            status: this.getSignalProviderStatus(user.signalProvider),
            isPublic: user.signalProvider.isPublic,
            isAccepting: user.signalProvider.isAccepting,
            accountId: user.signalProvider.accountId,
          }
        : null,
      sessions: user.sessions.map((session) => this.toAdminSessionView(session)),
    };
  }

  listWalletTransactions(filters: {
    status?: TransactionStatus;
    type?: TransactionType;
    userId?: string;
  }) {
    return this.walletService.listAdminTransactions(filters);
  }

  listDepositAddresses() {
    return this.walletService.listDepositAddresses();
  }

  listIncomingTransactions() {
    return this.walletService.listIncomingTransactions();
  }

  listWithdrawals(status?: WithdrawalStatus) {
    return this.walletService.listWithdrawalRequests(status);
  }

  async approveWithdrawal(
    withdrawalId: string,
    admin: AuthenticatedUser,
    reason?: string,
  ) {
    this.adminPolicyService.assertWalletTransactionAction(
      admin,
      TransactionType.WITHDRAW,
      true,
    );

    return this.walletService.approveWithdrawalRequest(withdrawalId, admin.id, reason);
  }

  async rejectWithdrawal(
    withdrawalId: string,
    admin: AuthenticatedUser,
    reason: string,
  ) {
    this.adminPolicyService.assertWalletTransactionAction(
      admin,
      TransactionType.WITHDRAW,
      false,
    );

    return this.walletService.rejectWithdrawalRequest(withdrawalId, admin.id, reason);
  }

  async markWithdrawalAsSent(
    withdrawalId: string,
    admin: AuthenticatedUser,
    txHash: string,
    adminNote?: string,
  ) {
    this.adminPolicyService.assertWalletTransactionAction(
      admin,
      TransactionType.WITHDRAW,
      true,
    );

    return this.walletService.markWithdrawalRequestAsSent(
      withdrawalId,
      admin.id,
      txHash,
      adminNote,
    );
  }

  async listCopyMasters() {
    const providers = await this.prismaService.signalProvider.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        account: {
          select: {
            id: true,
            name: true,
            accountNo: true,
            type: true,
            status: true,
            balance: true,
            equity: true,
          },
        },
        copiers: {
          where: {
            status: {
              in: [CopyStatus.ACTIVE, CopyStatus.PAUSED],
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return providers.map((provider) => ({
      id: provider.id,
      userId: provider.userId,
      displayName: provider.displayName,
      bio: provider.bio,
      strategy: provider.strategy,
      totalReturn: toNumber(provider.totalReturn) ?? 0,
      monthlyReturn: toNumber(provider.monthlyReturn) ?? 0,
      winRate: toNumber(provider.winRate) ?? 0,
      maxDrawdown: toNumber(provider.maxDrawdown) ?? 0,
      totalTrades: provider.totalTrades,
      activeCopiers: provider.activeCopiers,
      minCopyAmount: toNumber(provider.minCopyAmount) ?? 0,
      feePercent: toNumber(provider.feePercent) ?? 0,
      isPublic: provider.isPublic,
      isAccepting: provider.isAccepting,
      status: this.getSignalProviderStatus(provider),
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      followerCount: provider.copiers.length,
      user: provider.user,
      account: {
        ...provider.account,
        balance: toNumber(provider.account.balance) ?? 0,
        equity: toNumber(provider.account.equity) ?? 0,
      },
    }));
  }

  async listCopyTrades(query: AdminCopyTradesQueryDto) {
    const mirroredPositions = await this.prismaService.position.findMany({
      where: {
        copiedFromTradeId: {
          not: null,
        },
        status:
          query.status === 'OPEN'
            ? 'OPEN'
            : query.status === 'CLOSED'
              ? 'CLOSED'
              : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        account: {
          select: {
            id: true,
            name: true,
            accountNo: true,
            type: true,
          },
        },
        copiedFromTrade: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
            account: {
              select: {
                id: true,
                name: true,
                accountNo: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    return mirroredPositions.map((position) => ({
      id: position.id,
      masterId: position.copiedFromTrade?.userId ?? null,
      masterPositionId: position.copiedFromTradeId,
      followerUserId: position.userId,
      followerPositionId: position.id,
      status: position.status,
      reason: null,
      symbol: position.symbol,
      side: position.side,
      volume: toNumber(position.volume) ?? 0,
      pnl: toNumber(position.pnl) ?? 0,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
      openedAt: position.openedAt,
      closedAt: position.closedAt,
      master: position.copiedFromTrade
        ? {
            id: position.copiedFromTrade.userId,
            displayName: position.copiedFromTrade.user.email,
            accountNo: position.copiedFromTrade.account.accountNo,
          }
        : null,
      follower: {
        id: position.user.id,
        email: position.user.email,
      },
      account: position.account,
    }));
  }

  async listOpenPositions() {
    const positions = await this.prismaService.position.findMany({
      where: {
        status: 'OPEN',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        account: {
          select: {
            id: true,
            name: true,
            accountNo: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 200,
    });

    return positions.map((position) => ({
      id: position.id,
      userId: position.userId,
      email: position.user.email,
      accountId: position.accountId,
      accountName: position.account.name,
      accountNo: position.account.accountNo,
      accountType: position.account.type,
      accountStatus: position.account.status,
      symbol: position.symbol,
      side: position.side,
      volume: toNumber(position.volume) ?? 0,
      entryPrice: toNumber(position.entryPrice) ?? 0,
      pnl: toNumber(position.pnl) ?? 0,
      openedAt: position.openedAt,
      copiedFromTradeId: position.copiedFromTradeId,
    }));
  }

  async listOrders() {
    const orders = await this.prismaService.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        account: {
          select: {
            id: true,
            name: true,
            accountNo: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });

    return orders.map((order) => ({
      id: order.id,
      userId: order.userId,
      email: order.user.email,
      accountId: order.accountId,
      accountName: order.account.name,
      accountNo: order.account.accountNo,
      accountType: order.account.type,
      accountStatus: order.account.status,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: order.status,
      volume: toNumber(order.volume) ?? 0,
      requestedPrice: toNumber(order.requestedPrice),
      executionPrice: toNumber(order.executionPrice),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
  }

  async suspendUser(userId: string, admin: AuthenticatedUser) {
    this.adminPolicyService.assertRoleAssignment(admin);

    return this.setUserAccountStatus(userId, AccountStatus.SUSPENDED, admin);
  }

  async activateUser(userId: string, admin: AuthenticatedUser) {
    this.adminPolicyService.assertRoleAssignment(admin);

    return this.setUserAccountStatus(userId, AccountStatus.ACTIVE, admin);
  }

  async listAffiliates() {
    const affiliates = await this.prismaService.affiliate.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        referrals: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return affiliates.map((affiliate) => ({
      ...affiliate,
      referralCount: affiliate.referrals.length,
    }));
  }

  listAffiliateCommissions() {
    return this.prismaService.affiliateCommission.findMany({
      include: {
        affiliate: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        referredUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async creditUser(userId: string, dto: CreditUserDto, admin: AuthenticatedUser) {
    this.adminPolicyService.assertCreditUser(admin);

    const user = await this.prismaService.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let account;

    if (dto.accountId) {
      account = await this.prismaService.account.findFirst({
        where: { id: dto.accountId, userId },
      });
    } else {
      account = await this.prismaService.account.findFirst({
        where: { userId, type: 'LIVE', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const amount = new Prisma.Decimal(dto.amount);

    const transaction = await this.prismaService.$transaction(async (tx) => {
      const createdTransaction = await tx.transaction.create({
        data: {
          userId,
          walletId: null,
          accountId: account.id,
          type: TransactionType.DEPOSIT,
          amount,
          asset: 'USDT',
          status: TransactionStatus.APPROVED,
          approvedById: admin.id,
          approvedAt: new Date(),
          reference: null,
          metadata: {
            creditedByAdmin: true,
            reason: dto.reason ?? null,
          },
        },
      });

      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: { increment: amount },
          equity: { increment: amount },
        },
      });

      return createdTransaction;
    });

    await this.auditService.log({
      actorUserId: admin.id,
      actorRole: admin.role.toLowerCase(),
      action: 'ADMIN_USER_CREDITED',
      entityType: 'transaction',
      entityId: transaction.id,
      targetUserId: userId,
      metadataJson: {
        amount: dto.amount,
        accountId: account.id,
        reason: dto.reason ?? null,
      },
    });

    return serializeTransaction(transaction);
  }

  private async buildAdminSymbolRecord(symbol: string) {
    const instrument = this.symbolsService.getSymbolOrThrow(symbol);
    const symbolConfig = this.brokerSettingsService.getSymbolConfig(instrument.symbol);
    const health = this.pricingService.getSymbolHealth(instrument.symbol);
    const quote = await this.pricingService.getLatestQuote(instrument.symbol).catch(() => null);

    return {
      ...this.symbolsService.toAdminRecord(instrument),
      maxLeverage: symbolConfig.maxLeverage,
      spreadMarkup: symbolConfig.spreadMarkup,
      tradingEnabled: symbolConfig.tradingEnabled,
      maxExposureThreshold: symbolConfig.maxExposureThreshold,
      bid: quote?.bid ?? null,
      ask: quote?.ask ?? null,
      lastPrice: quote?.lastPrice ?? quote?.rawPrice ?? null,
      marketState: quote?.marketState ?? 'STALE',
      quoteTimestamp: quote?.lastUpdated ?? null,
      healthStatus: health.status,
      healthReason: health.reason,
      tradingAvailable: health.tradingAvailable,
    };
  }

  private summarizeAccountStatus(accounts: Array<Pick<Account, 'status'>>) {
    if (accounts.length === 0) {
      return 'NONE';
    }

    const statuses = new Set(accounts.map((account) => account.status));

    if (statuses.size === 1) {
      return accounts[0].status;
    }

    return 'MIXED';
  }

  private getSignalProviderStatus(
    provider:
      | {
          isPublic: boolean;
          isAccepting: boolean;
        }
      | null
      | undefined,
  ) {
    if (!provider) {
      return null;
    }

    if (!provider.isPublic) {
      return 'HIDDEN';
    }

    return provider.isAccepting ? 'ACTIVE' : 'PAUSED';
  }

  private async setUserAccountStatus(
    userId: string,
    nextStatus: AccountStatus,
    admin: AuthenticatedUser,
  ) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          where: {
            status: {
              not: AccountStatus.CLOSED,
            },
          },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prismaService.account.updateMany({
      where: {
        userId,
        status: {
          not: AccountStatus.CLOSED,
        },
      },
      data: {
        status: nextStatus,
      },
    });

    await this.auditService.log({
      actorUserId: admin.id,
      actorRole: admin.role.toLowerCase(),
      action:
        nextStatus === AccountStatus.SUSPENDED
          ? 'ADMIN_USER_ACCOUNTS_SUSPENDED'
          : 'ADMIN_USER_ACCOUNTS_ACTIVATED',
      entityType: 'user',
      entityId: user.id,
      targetUserId: user.id,
      metadataJson: {
        nextStatus,
        accountIds: user.accounts.map((account) => account.id),
      },
    });

    if (nextStatus === AccountStatus.SUSPENDED) {
      this.emailService.sendAccountSuspended(user.id).catch(() => {});
    } else if (nextStatus === AccountStatus.ACTIVE) {
      this.emailService.sendAccountActivated(user.id).catch(() => {});
    }

    const defaultAccount = user.accounts.find((account) => account.isDefault) ?? user.accounts[0];

    if (defaultAccount) {
      await this.accountsService.syncLegacyWalletSnapshot(user.id, defaultAccount.id);
    }

    return this.getUserDetail(user.id);
  }

  private toAdminSessionView(session: {
    id: string;
    deviceFingerprint: string;
    ipAddress: string | null;
    userAgent: string | null;
    lastSeenAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
  }): AdminSessionViewDto {
    return {
      id: session.id,
      deviceFingerprintMasked: this.maskValue(session.deviceFingerprint, 6, 4),
      ipAddressMasked: this.maskIpAddress(session.ipAddress),
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      createdAt: session.createdAt,
    };
  }

  private maskValue(value: string, prefixLength: number, suffixLength: number): string {
    if (!value) {
      return 'hidden';
    }

    if (value.length <= prefixLength + suffixLength) {
      return `${value.slice(0, Math.max(1, prefixLength))}...`;
    }

    return suffixLength > 0
      ? `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`
      : `${value.slice(0, prefixLength)}...`;
  }

  private maskIpAddress(ipAddress: string | null): string | null {
    if (!ipAddress) {
      return null;
    }

    if (ipAddress.includes('.')) {
      const parts = ipAddress.split('.');

      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
      }
    }

    if (ipAddress.includes(':')) {
      const parts = ipAddress.split(':').filter(Boolean);

      if (parts.length > 0) {
        return `${parts.slice(0, 3).join(':')}:*`;
      }
    }

    return this.maskValue(ipAddress, 4, 0);
  }

  // ── Deposit Wallets ──────────────────────────────────────────────────────────

  listDepositWallets() {
    return this.prismaService.depositWallet.findMany({
      orderBy: [{ isActive: 'desc' }, { network: 'asc' }, { coin: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createDepositWallet(admin: AuthenticatedUser, dto: CreateDepositWalletDto) {
    try {
      const created = await this.prismaService.depositWallet.create({
        data: {
          network: dto.network.trim().toUpperCase(),
          coin: this.normalizeDepositWalletValue(dto.coin) ?? 'USDT',
          address: dto.address.trim(),
          label: dto.label?.trim() || null,
          isActive: dto.isActive ?? true,
          minDeposit: dto.minDeposit ?? 10,
        },
      });

      await this.auditService.log({
        actorUserId: admin.id,
        actorRole: admin.role.toLowerCase(),
        action: 'ADMIN_DEPOSIT_WALLET_CREATED',
        entityType: 'deposit_wallet',
        entityId: created.id,
        metadataJson: this.serializeDepositWalletAuditRecord(
          created,
        ) as unknown as Prisma.InputJsonValue,
      });

      return created;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new BadRequestException('A wallet already exists for this network and coin');
      }

      throw error;
    }
  }

  async updateDepositWallet(
    id: string,
    dto: UpdateDepositWalletDto,
    admin: AuthenticatedUser,
  ) {
    const existing = await this.prismaService.depositWallet.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Deposit wallet not found');
    }

    const updated = await this.prismaService.depositWallet.update({
      where: { id },
      data: {
        ...(dto.address !== undefined && { address: dto.address.trim() }),
        ...(dto.label !== undefined && { label: dto.label.trim() || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.minDeposit !== undefined && { minDeposit: dto.minDeposit }),
      },
    });

    await this.auditService.log({
      actorUserId: admin.id,
      actorRole: admin.role.toLowerCase(),
      action: 'ADMIN_DEPOSIT_WALLET_UPDATED',
      entityType: 'deposit_wallet',
      entityId: updated.id,
      metadataJson: {
        before: this.serializeDepositWalletAuditRecord(existing),
        after: this.serializeDepositWalletAuditRecord(updated),
      } as unknown as Prisma.InputJsonValue,
    });

    return updated;
  }

  async deleteDepositWallet(id: string, admin: AuthenticatedUser) {
    const existing = await this.prismaService.depositWallet.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Deposit wallet not found');
    }

    const deleted = await this.prismaService.depositWallet.delete({ where: { id } });

    await this.auditService.log({
      actorUserId: admin.id,
      actorRole: admin.role.toLowerCase(),
      action: 'ADMIN_DEPOSIT_WALLET_DELETED',
      entityType: 'deposit_wallet',
      entityId: deleted.id,
      metadataJson: this.serializeDepositWalletAuditRecord(
        deleted,
      ) as unknown as Prisma.InputJsonValue,
    });

    return deleted;
  }

  private normalizeDepositWalletValue(value?: string | null): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  private serializeDepositWalletAuditRecord(wallet: {
    id: string;
    network: string;
    coin: string;
    address: string;
    label: string | null;
    isActive: boolean;
    minDeposit: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: wallet.id,
      network: wallet.network,
      coin: wallet.coin,
      address: wallet.address,
      label: wallet.label,
      isActive: wallet.isActive,
      minDeposit: wallet.minDeposit,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }
}
