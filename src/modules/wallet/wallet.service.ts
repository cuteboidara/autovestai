import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DepositStatus,
  Network,
  PositionStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal } from '../../common/utils/decimal';
import {
  serializeTransaction,
  serializeAccountAsWallet,
} from '../../common/utils/serializers';
import { AccountsService } from '../accounts/accounts.service';
import { PricingService } from '../pricing/pricing.service';
import { RiskService } from '../risk/risk.service';
import { AuditService } from '../audit/audit.service';
import { AdminChatService } from '../admin-chat/admin-chat.service';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { KycService } from '../kyc/kyc.service';
import { SurveillanceService } from '../surveillance/surveillance.service';
import { TradingEventsService } from '../trading/trading-events.service';
import { EmailService } from '../email/email.service';
import { AddressGeneratorService } from './address-generator.service';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { ListDepositsQueryDto } from './dto/list-deposits-query.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { RequestDepositDto } from './dto/request-deposit.dto';
import { RequestWithdrawDto } from './dto/request-withdraw.dto';
import {
  ALPHA_WALLET_ASSET,
  AlphaWalletNetwork,
  NETWORK_ASSET_MAP,
  NETWORK_DISPLAY_NAME_MAP,
  SUPPORTED_ALPHA_WALLET_NETWORKS,
  normalizeWalletNetwork,
} from './wallet.constants';
import { ResponseCacheService } from '../../common/cache/response-cache.service';
import { transactionSelect } from '../../common/prisma/selects';
import { WithdrawalsService } from './withdrawals.service';

const QRCode = require('qrcode') as {
  toDataURL(
    value: string,
    options?: Record<string, unknown>,
  ): Promise<string>;
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly riskService: RiskService,
    private readonly pricingService: PricingService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly auditService: AuditService,
    private readonly adminChatService: AdminChatService,
    private readonly kycService: KycService,
    private readonly surveillanceService: SurveillanceService,
    private readonly tradingEventsService: TradingEventsService,
    private readonly addressGeneratorService: AddressGeneratorService,
    private readonly withdrawalsService: WithdrawalsService,
    private readonly responseCacheService: ResponseCacheService,
    private readonly emailService: EmailService,
  ) {}

  async getWallet(userId: string) {
    const account = await this.accountsService.getDefaultAccountOrThrow(userId);
    const [metrics, transactions] = await Promise.all([
      this.accountsService.getAccountMetrics(account),
      this.prismaService.transaction.findMany({
        where: {
          userId,
          accountId: account.id,
        },
        select: transactionSelect,
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    return {
      wallet: serializeAccountAsWallet(account, {
        unrealizedPnl: metrics.unrealizedPnl,
        equity: metrics.equity,
        freeMargin: metrics.freeMargin,
        usedMargin: metrics.usedMargin,
        marginLevel: metrics.marginLevel,
      }),
      transactions: transactions.map(serializeTransaction),
      activeAccountId: account.id,
    };
  }

  async listTransactions(userId: string, query: ListTransactionsQueryDto = {}) {
    const account = await this.accountsService.resolveAccountForUser(
      userId,
      query.accountId,
    );
    const transactions = await this.prismaService.transaction.findMany({
      where: {
        userId,
        accountId: account.id,
        status: query.status,
        type: query.type,
      },
      select: transactionSelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return transactions.map(serializeTransaction);
  }

  async listDeposits(userId: string, query: ListDepositsQueryDto = {}) {
    const account = await this.accountsService.resolveAccountForUser(
      userId,
      query.accountId,
    );
    const [deposits, transactions] = await Promise.all([
      this.prismaService.deposit.findMany({
        where: {
          userId,
          accountId: account.id,
          status: query.status,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prismaService.transaction.findMany({
        where: {
          userId,
          accountId: account.id,
          type: TransactionType.DEPOSIT,
        },
        select: transactionSelect,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    const onChainTxHashes = new Set(deposits.map((d) => d.txHash));

    const manualDeposits = transactions
      .filter((tx) => {
        const meta = tx.metadata as Record<string, unknown> | null;
        const txHash = (meta?.['transactionHash'] as string | undefined)?.trim();
        return !txHash || !onChainTxHashes.has(txHash);
      })
      .map((tx) => {
        const meta = tx.metadata as Record<string, unknown> | null;
        const network = (meta?.['network'] as string | undefined) ?? null;
        return {
          id: tx.id,
          userId: tx.userId,
          accountId: tx.accountId,
          txHash: null as string | null,
          network: (network as Network | null) ?? null,
          amount: tx.amount.toNumber(),
          usdtAmount: tx.amount.toNumber(),
          fromAddress: null as string | null,
          toAddress: null as string | null,
          confirmations: 0,
          status: 'PENDING' as const,
          creditedAt: null as Date | null,
          approvalStatus: tx.status,
          createdAt: tx.createdAt,
        };
      });

    const onChainResults = deposits.map((deposit) => {
      const linkedTransaction = this.findLinkedTransactionByHash(
        transactions,
        deposit.txHash,
      );

      return {
        id: deposit.id,
        userId: deposit.userId,
        accountId: deposit.accountId,
        txHash: deposit.txHash as string | null,
        network: deposit.network as Network | null,
        amount: deposit.amount.toNumber(),
        usdtAmount: deposit.usdtAmount.toNumber(),
        fromAddress: deposit.fromAddress as string | null,
        toAddress: deposit.toAddress as string | null,
        confirmations: deposit.confirmations,
        status: deposit.status,
        creditedAt: deposit.creditedAt,
        approvalStatus:
          linkedTransaction?.status ??
          (deposit.creditedAt ? TransactionStatus.APPROVED : TransactionStatus.PENDING),
        createdAt: deposit.createdAt,
      };
    });

    return [...manualDeposits, ...onChainResults].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async listWithdrawals(userId: string, query: ListWithdrawalsQueryDto = {}) {
    const withdrawals = await this.withdrawalsService.listUserWithdrawals(
      userId,
      query.accountId,
    );

    if (!query.status) {
      return withdrawals;
    }

    return withdrawals.filter((item) => item.status === query.status);
  }

  async requestDeposit(userId: string, dto: RequestDepositDto) {
    await this.kycService.assertPlatformAccessApproved(userId);

    const operation = this.normalizeAlphaWalletOperation(dto.asset, dto.network);
    const normalizedTransactionHash = dto.transactionHash?.trim() || undefined;

    const account = await this.accountsService.resolveLiveAccountForUser(userId);
    const wallet = await this.getWalletEntity(userId);
    const transaction = await this.prismaService.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        accountId: account.id,
        type: TransactionType.DEPOSIT,
        amount: toDecimal(dto.amount),
        asset: operation.asset,
        status: TransactionStatus.PENDING,
        reference: normalizedTransactionHash ?? null,
        metadata: this.mergeMetadata(null, {
          network: operation.network ?? null,
          ...(normalizedTransactionHash
            ? { transactionHash: normalizedTransactionHash }
            : { declaredByClient: true }),
        }),
      },
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'WALLET_DEPOSIT_REQUESTED',
      entityType: 'transaction',
      entityId: transaction.id,
      targetUserId: userId,
      metadataJson: {
        amount: dto.amount,
        asset: operation.asset,
        network: operation.network ?? null,
      },
    });
    await this.surveillanceService.evaluateDepositRequest(userId);
    await this.responseCacheService.invalidateUserResources(userId, [
      'transactions',
      'accounts',
    ]);

    this.emailService
      .sendDepositPending(userId, dto.amount.toFixed(2))
      .catch(() => {});

    return serializeTransaction(transaction);
  }

  async requestWithdrawal(userId: string, dto: RequestWithdrawDto) {
    const operation = this.normalizeAlphaWalletOperation(dto.asset, dto.network);
    const response = await this.withdrawalsService.requestWithdrawal(userId, {
      amount: dto.amount,
      network: operation.network,
      toAddress: dto.address,
    });

    return response.transaction;
  }

  async getDepositAddress(userId: string, network: string) {
    await this.kycService.assertPlatformAccessApproved(userId);
    const account = await this.accountsService.resolveLiveAccountForUser(userId);
    const normalizedNetwork = this.normalizeCanonicalNetwork(network);
    const address = await this.addressGeneratorService.getOrCreateAddress(
      userId,
      account.id,
      normalizedNetwork,
    );

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'WALLET_DEPOSIT_ADDRESS_ACCESSED',
      entityType: 'deposit_address',
      entityId: address.id,
      targetUserId: userId,
      metadataJson: {
        network: normalizedNetwork,
        address: address.address,
      },
    });

    return this.buildDepositAddressResponse(address.address, normalizedNetwork);
  }

  async getDepositAddresses(userId: string, accountId?: string | null) {
    const account = await this.accountsService.resolveLiveAccountForUser(
      userId,
      accountId,
    );
    const addresses = await this.addressGeneratorService.getOrCreateAddresses(
      userId,
      account.id,
    );

    return Promise.all(
      addresses.map((entry) => this.buildDepositAddressResponse(entry.address, entry.network)),
    );
  }

  async listPendingTransactions() {
    const transactions = await this.prismaService.transaction.findMany({
      where: {
        status: TransactionStatus.PENDING,
      },
      select: transactionSelect,
      orderBy: { createdAt: 'asc' },
    });

    return transactions.map(serializeTransaction);
  }

  async listAdminTransactions(query: ListTransactionsQueryDto) {
    const transactions = await this.prismaService.transaction.findMany({
      where: {
        userId: query.userId,
        accountId: query.accountId,
        status: query.status,
        type: query.type,
      },
      select: transactionSelect,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return transactions.map(serializeTransaction);
  }

  async listDepositAddresses() {
    const addresses = await this.prismaService.depositAddress.findMany({
      select: {
        id: true,
        userId: true,
        network: true,
        address: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return addresses.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      network: entry.network,
      address: entry.address,
      createdAt: entry.createdAt,
      user: entry.user,
    }));
  }

  async listIncomingTransactions() {
    const deposits = await this.prismaService.deposit.findMany({
      select: {
        id: true,
        userId: true,
        accountId: true,
        txHash: true,
        network: true,
        amount: true,
        status: true,
        confirmations: true,
        fromAddress: true,
        toAddress: true,
        creditedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
    const transactions = deposits.length
      ? await this.prismaService.transaction.findMany({
          where: {
            userId: {
              in: [...new Set(deposits.map((deposit) => deposit.userId))],
            },
            accountId: {
              in: [...new Set(deposits.map((deposit) => deposit.accountId))],
            },
            type: TransactionType.DEPOSIT,
          },
          select: transactionSelect,
          orderBy: { createdAt: 'desc' },
          take: 500,
        })
      : [];

    return deposits.map((deposit) => {
      const linkedTransaction = this.findLinkedTransactionByHash(
        transactions,
        deposit.txHash,
      );

      return {
        id: deposit.id,
        userId: deposit.userId,
        walletId: linkedTransaction?.walletId ?? null,
        accountId: deposit.accountId,
        type: TransactionType.DEPOSIT,
        amount: deposit.amount.toNumber(),
        asset: 'USDT',
        status:
          linkedTransaction?.status ??
          (deposit.status === DepositStatus.FAILED
            ? TransactionStatus.REJECTED
            : deposit.creditedAt
              ? TransactionStatus.APPROVED
              : TransactionStatus.PENDING),
        reference: deposit.txHash,
        metadata: {
          ...(linkedTransaction?.metadata &&
          typeof linkedTransaction.metadata === 'object' &&
          !Array.isArray(linkedTransaction.metadata)
            ? linkedTransaction.metadata
            : {}),
          network: deposit.network,
          blockchainTxId: deposit.txHash,
          confirmations: deposit.confirmations,
          fromAddress: deposit.fromAddress,
          toAddress: deposit.toAddress,
        },
        approvedById: linkedTransaction?.approvedById ?? null,
        approvedAt: linkedTransaction?.approvedAt ?? null,
        createdAt: deposit.createdAt,
        updatedAt: linkedTransaction?.updatedAt ?? deposit.createdAt,
        user: deposit.user,
      };
    });
  }

  listWithdrawalRequests(status?: WithdrawalStatus) {
    return this.withdrawalsService.listAdminWithdrawals(status);
  }

  async approveWithdrawalRequest(
    withdrawalId: string,
    adminId: string,
    reason?: string,
  ) {
    const linkedTransaction = await this.findLinkedWithdrawalTransaction(withdrawalId);

    if (linkedTransaction) {
      await this.decideTransaction(linkedTransaction.id, adminId, true, reason);
      return this.withdrawalsService.getWithdrawalById(withdrawalId);
    }

    return this.withdrawalsService.approveWithdrawal(withdrawalId, adminId, reason);
  }

  async rejectWithdrawalRequest(withdrawalId: string, adminId: string, reason: string) {
    const linkedTransaction = await this.findLinkedWithdrawalTransaction(withdrawalId);

    if (linkedTransaction) {
      await this.decideTransaction(linkedTransaction.id, adminId, false, reason);
      return this.withdrawalsService.getWithdrawalById(withdrawalId);
    }

    return this.withdrawalsService.rejectWithdrawal(withdrawalId, adminId, reason);
  }

  markWithdrawalRequestAsSent(
    withdrawalId: string,
    adminId: string,
    txHash: string,
    adminNote?: string,
  ) {
    return this.withdrawalsService.markAsSent(withdrawalId, adminId, txHash, adminNote);
  }

  async decideTransaction(
    transactionId: string,
    adminId: string | null,
    approve: boolean,
    reason?: string,
    extraMetadata?: Record<string, unknown>,
    actorRole: 'admin' | 'system' = 'admin',
  ) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const linkedWithdrawalRequestId = this.getLinkedWithdrawalRequestId(
      transaction.type,
      transaction.metadata,
    );

    if (linkedWithdrawalRequestId) {
      if (!adminId) {
        throw new BadRequestException(
          'Admin approval is required for withdrawal transactions',
        );
      }

      if (
        approve &&
        transaction.status !== TransactionStatus.PENDING
      ) {
        throw new BadRequestException('Transaction has already been processed');
      }

      if (
        !approve &&
        transaction.status !== TransactionStatus.PENDING &&
        transaction.status !== TransactionStatus.APPROVED
      ) {
        throw new BadRequestException('Transaction has already been processed');
      }

      if (approve) {
        await this.withdrawalsService.approveWithdrawal(
          linkedWithdrawalRequestId,
          adminId,
          reason,
        );
      } else {
        await this.withdrawalsService.rejectWithdrawal(
          linkedWithdrawalRequestId,
          adminId,
          reason ?? 'Rejected by admin',
        );
      }

      const updatedLinkedTransaction = await this.prismaService.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!updatedLinkedTransaction) {
        throw new NotFoundException('Transaction not found');
      }

      return serializeTransaction(updatedLinkedTransaction);
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction has already been processed');
    }

    if (!approve) {
      const rejected = await this.prismaService.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.REJECTED,
          approvedById: adminId ?? null,
          approvedAt: new Date(),
          metadata: this.mergeMetadata(transaction.metadata, {
            decisionReason: reason ?? 'Rejected by admin',
            ...extraMetadata,
          }),
        },
      });

      await this.auditService.log({
        actorUserId: adminId ?? null,
        actorRole,
        action:
          transaction.type === TransactionType.DEPOSIT
            ? 'WALLET_DEPOSIT_REJECTED'
            : 'WALLET_WITHDRAWAL_REJECTED',
        entityType: 'transaction',
        entityId: rejected.id,
        targetUserId: rejected.userId,
        metadataJson: {
          reason: reason ?? 'Rejected by admin',
          type: rejected.type,
        },
      });

      if (transaction.type === TransactionType.DEPOSIT) {
        this.emailService
          .sendDepositRejected(
            rejected.userId,
            rejected.amount.toNumber().toFixed(2),
            reason ?? 'Rejected by admin',
          )
          .catch(() => {});
      }

      return serializeTransaction(rejected);
    }

    const updatedTransaction = await this.prismaService.$transaction(async (tx) => {
      const pendingTransaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!pendingTransaction || pendingTransaction.status !== TransactionStatus.PENDING) {
        throw new BadRequestException('Transaction is no longer pending');
      }

      this.assertAlphaWalletTransaction(pendingTransaction);

      if (pendingTransaction.type === TransactionType.DEPOSIT) {
        await this.assertDepositReadyForApproval(tx, pendingTransaction);
      }

      const account = await tx.account.findUnique({
        where: { id: pendingTransaction.accountId },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      if (pendingTransaction.type === TransactionType.WITHDRAW) {
        if (!this.brokerSettingsService.areWithdrawalsEnabled()) {
          throw new BadRequestException('Withdrawals are temporarily disabled');
        }

        const openPositions = await tx.position.findMany({
          where: {
            accountId: pendingTransaction.accountId,
            status: PositionStatus.OPEN,
          },
        });

        const pnlValues = await Promise.all(
          openPositions.map(async (position) => {
            const snapshot = await this.pricingService.getLatestQuote(position.symbol);
            return this.riskService.calculatePositionPnl(position, snapshot);
          }),
        );

        const unrealizedPnl = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
        const freeMargin =
          account.balance.toNumber() +
          unrealizedPnl -
          openPositions.reduce((sum, position) => sum + position.marginUsed.toNumber(), 0);

        if (freeMargin < pendingTransaction.amount.toNumber()) {
          throw new BadRequestException('Insufficient free margin to approve withdrawal');
        }

        await tx.account.update({
          where: { id: account.id },
          data: {
            balance: {
              decrement: pendingTransaction.amount,
            },
            equity: {
              decrement: pendingTransaction.amount,
            },
          },
        });
      }

      if (pendingTransaction.type === TransactionType.DEPOSIT) {
        await tx.account.update({
          where: { id: account.id },
          data: {
            balance: {
              increment: pendingTransaction.amount,
            },
            equity: {
              increment: pendingTransaction.amount,
            },
          },
        });
      }

      return tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.APPROVED,
          approvedById: adminId ?? null,
          approvedAt: new Date(),
          metadata: this.mergeMetadata(pendingTransaction.metadata, {
            decisionReason: reason ?? null,
            ...extraMetadata,
          }),
        },
      });
    });

    this.logger.log(
      `Transaction ${transactionId} approved by admin ${adminId} (${updatedTransaction.type})`,
    );

    if (updatedTransaction.type === TransactionType.DEPOSIT) {
      await this.markDepositAsCredited(updatedTransaction);
    }

    await this.auditService.log({
      actorUserId: adminId ?? null,
      actorRole,
      action:
        updatedTransaction.type === TransactionType.DEPOSIT
          ? 'WALLET_DEPOSIT_APPROVED'
          : 'WALLET_WITHDRAWAL_APPROVED',
      entityType: 'transaction',
      entityId: updatedTransaction.id,
      targetUserId: updatedTransaction.userId,
      metadataJson: {
        reason: reason ?? null,
        type: updatedTransaction.type,
      },
    });

    if (updatedTransaction.type === TransactionType.DEPOSIT) {
      this.emailService
        .sendDepositApproved(
          updatedTransaction.userId,
          updatedTransaction.amount.toNumber().toFixed(2),
        )
        .catch(() => {});
    }

    if (
      updatedTransaction.type === TransactionType.DEPOSIT &&
      updatedTransaction.amount.toNumber() >= 10_000
    ) {
      const user = await this.prismaService.user.findUnique({
        where: { id: updatedTransaction.userId },
        select: {
          accountNumber: true,
        },
      });

      if (user) {
        await this.adminChatService.postSystemAlert(
          'general',
          `${user.accountNumber} deposited $${updatedTransaction.amount.toNumber().toLocaleString('en-US')} USDT`,
        );
      }
    }

    await this.accountsService.syncLegacyWalletSnapshot(updatedTransaction.userId);
    await this.responseCacheService.invalidateUserResources(updatedTransaction.userId, [
      'transactions',
      'accounts',
      'positions',
    ]);
    return serializeTransaction(updatedTransaction);
  }

  private async assertWithdrawalRequestAllowed(userId: string) {
    if (!this.brokerSettingsService.areWithdrawalsEnabled()) {
      throw new BadRequestException('Withdrawals are temporarily disabled');
    }

    await this.kycService.assertPlatformAccessApproved(userId);
  }

  async publishWalletSnapshot(userId: string): Promise<void> {
    const snapshot = await this.getWallet(userId);
    this.tradingEventsService.emitWalletUpdate(userId, snapshot);
  }

  private async getWalletEntity(userId: string) {
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  private async buildDepositAddressResponse(
    address: string,
    network: Network,
  ) {
    return {
      address,
      asset: NETWORK_ASSET_MAP[network],
      network,
      displayNetwork: NETWORK_DISPLAY_NAME_MAP[network],
      memo: null,
      qrCode: await QRCode.toDataURL(address, {
        width: 400,
        margin: 1,
      }),
    };
  }

  private readMetadata(metadata: Prisma.JsonValue | null): Record<string, unknown> {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  }

  private mergeMetadata(
    metadata: Prisma.JsonValue | null,
    extra: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const existing =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Prisma.JsonObject)
        : {};

    return {
      ...existing,
      ...extra,
    } as Prisma.InputJsonObject;
  }

  private getLinkedWithdrawalRequestId(
    type: TransactionType,
    metadata: Prisma.JsonValue | null,
  ): string | null {
    if (type !== TransactionType.WITHDRAW) {
      return null;
    }

    const parsedMetadata = this.readMetadata(metadata);
    const withdrawalRequestId = parsedMetadata.withdrawalRequestId;

    return typeof withdrawalRequestId === 'string' && withdrawalRequestId.trim()
      ? withdrawalRequestId
      : null;
  }

  private async findLinkedWithdrawalTransaction(withdrawalId: string) {
    const withdrawal = await this.prismaService.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      select: {
        userId: true,
        accountId: true,
      },
    });

    if (!withdrawal) {
      return null;
    }

    const transactions = await this.prismaService.transaction.findMany({
      where: {
        userId: withdrawal.userId,
        accountId: withdrawal.accountId,
        type: TransactionType.WITHDRAW,
      },
      select: transactionSelect,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return (
      transactions.find(
        (transaction) =>
          this.getLinkedWithdrawalRequestId(transaction.type, transaction.metadata) ===
          withdrawalId,
      ) ?? null
    );
  }

  private extractTransactionHash(transaction: {
    reference: string | null;
    metadata: Prisma.JsonValue | null;
  }): string | null {
    const metadata = this.readMetadata(transaction.metadata);
    const candidates = [
      metadata.blockchainTxId,
      metadata.transactionHash,
      metadata.txHash,
      transaction.reference,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return null;
  }

  private findLinkedTransactionByHash<
    T extends {
      reference: string | null;
      metadata: Prisma.JsonValue | null;
    },
  >(transactions: T[], txHash: string): T | null {
    const normalizedHash = txHash.trim().toLowerCase();

    return (
      transactions.find((transaction) => {
        const linkedHash = this.extractTransactionHash(transaction);
        return linkedHash?.toLowerCase() === normalizedHash;
      }) ?? null
    );
  }

  private async markDepositAsCredited(transaction: {
    userId: string;
    accountId: string;
    reference: string | null;
    metadata: Prisma.JsonValue | null;
    approvedAt: Date | null;
  }) {
    const txHash = this.extractTransactionHash(transaction);

    if (!txHash) {
      return;
    }

    await this.prismaService.deposit.updateMany({
      where: {
        userId: transaction.userId,
        accountId: transaction.accountId,
        txHash,
      },
      data: {
        creditedAt: transaction.approvedAt ?? new Date(),
      },
    });
  }

  private async assertDepositReadyForApproval(
    tx: Prisma.TransactionClient,
    transaction: {
      userId: string;
      accountId: string;
      reference: string | null;
      metadata: Prisma.JsonValue | null;
    },
  ) {
    const txHash = this.extractTransactionHash(transaction);

    if (!txHash) {
      throw new BadRequestException(
        'Deposit must have a detected blockchain transaction before it can be approved',
      );
    }

    const linkedDeposit = await tx.deposit.findFirst({
      where: {
        userId: transaction.userId,
        accountId: transaction.accountId,
        txHash: {
          equals: txHash,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        status: true,
        creditedAt: true,
      },
    });

    if (!linkedDeposit) {
      throw new BadRequestException(
        'Deposit must be detected on-chain before it can be approved',
      );
    }

    if (linkedDeposit.status !== DepositStatus.COMPLETED) {
      throw new BadRequestException(
        'Deposit confirmations must complete before manual approval',
      );
    }

    if (linkedDeposit.creditedAt) {
      throw new BadRequestException('Deposit has already been credited');
    }
  }

  private normalizeAlphaWalletOperation(
    asset?: string,
    network?: string,
  ): {
    asset: typeof ALPHA_WALLET_ASSET;
    network: AlphaWalletNetwork;
  } {
    const normalizedAsset = (asset ?? ALPHA_WALLET_ASSET).trim().toUpperCase();

    if (normalizedAsset !== ALPHA_WALLET_ASSET) {
      throw new BadRequestException(
        'Only USDT wallet operations are supported in private alpha',
      );
    }

    const normalizedNetwork = network
      ? this.normalizeCanonicalNetwork(network)
      : Network.TRC20;

    return {
      asset: ALPHA_WALLET_ASSET,
      network: normalizedNetwork as AlphaWalletNetwork,
    };
  }

  private normalizeCanonicalNetwork(network: string): Network {
    try {
      const normalized = normalizeWalletNetwork(network);

      if (!SUPPORTED_ALPHA_WALLET_NETWORKS.includes(normalized as AlphaWalletNetwork)) {
        throw new Error('Unsupported network');
      }

      return normalized as Network;
    } catch {
      throw new BadRequestException(
        'Only TRC20 and ERC20 USDT wallet operations are supported',
      );
    }
  }

  private assertAlphaWalletTransaction(transaction: {
    asset: string;
    metadata: Prisma.JsonValue | null;
  }): void {
    const operation = this.normalizeAlphaWalletOperation(
      transaction.asset,
      (() => {
        const metadata = this.readMetadata(transaction.metadata);
        return typeof metadata.network === 'string' ? metadata.network : undefined;
      })(),
    );

    if (operation.asset !== ALPHA_WALLET_ASSET) {
      throw new BadRequestException(
        'Only USDT wallet transactions can be approved in private alpha',
      );
    }
  }
}
