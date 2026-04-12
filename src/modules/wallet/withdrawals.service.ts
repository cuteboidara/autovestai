import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Network,
  Prisma,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
} from '@prisma/client';

import { ResponseCacheService } from '../../common/cache/response-cache.service';
import { transactionSelect } from '../../common/prisma/selects';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber } from '../../common/utils/decimal';
import { serializeTransaction } from '../../common/utils/serializers';
import { AccountsService } from '../accounts/accounts.service';
import { AdminChatService } from '../admin-chat/admin-chat.service';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import { KycService } from '../kyc/kyc.service';
import { SurveillanceService } from '../surveillance/surveillance.service';
import {
  NETWORK_DISPLAY_NAME_MAP,
  NETWORK_WITHDRAWAL_FEE,
  WalletNetwork,
} from './wallet.constants';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly auditService: AuditService,
    private readonly adminChatService: AdminChatService,
    private readonly kycService: KycService,
    private readonly surveillanceService: SurveillanceService,
    private readonly responseCacheService: ResponseCacheService,
    private readonly crmService: CrmService,
  ) {}

  async listUserWithdrawals(userId: string, accountId?: string | null) {
    const account = await this.accountsService.resolveAccountForUser(userId, accountId);
    const withdrawals = await this.prismaService.withdrawalRequest.findMany({
      where: {
        userId,
        accountId: account.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return withdrawals.map((item) => this.serializeWithdrawal(item));
  }

  async listAdminWithdrawals(status?: WithdrawalStatus) {
    const withdrawals = await this.prismaService.withdrawalRequest.findMany({
      where: {
        status,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
        account: {
          select: {
            id: true,
            accountNo: true,
            name: true,
            type: true,
          },
        },
      },
      take: 250,
    });

    return withdrawals.map((item) => ({
      ...this.serializeWithdrawal(item),
      user: item.user,
      account: item.account,
    }));
  }

  async requestWithdrawal(
    userId: string,
    params: {
      amount: number;
      network: WalletNetwork;
      toAddress: string;
    },
  ) {
    if (!this.brokerSettingsService.areWithdrawalsEnabled()) {
      throw new BadRequestException('Withdrawals are temporarily disabled');
    }

    await this.kycService.assertPlatformAccessApproved(userId);

    if (params.amount < 10) {
      throw new BadRequestException('Minimum withdrawal is 10 USDT');
    }

    const account = await this.accountsService.resolveLiveAccountForUser(userId);
    const metrics = await this.accountsService.getAccountMetrics(account);
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (metrics.freeMargin < params.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    const fee = NETWORK_WITHDRAWAL_FEE[params.network];
    const netAmount = Number((params.amount - fee).toFixed(8));

    if (netAmount <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than the fee');
    }

    const { withdrawal, ledgerTransaction } = await this.prismaService.$transaction(
      async (tx) => {
        await tx.account.update({
          where: { id: account.id },
          data: {
            balance: {
              decrement: toDecimal(params.amount),
            },
            equity: {
              decrement: toDecimal(params.amount),
            },
          },
        });

        const withdrawal = await tx.withdrawalRequest.create({
          data: {
            userId,
            accountId: account.id,
            amount: toDecimal(params.amount),
            fee: toDecimal(fee),
            netAmount: toDecimal(netAmount),
            network: params.network as Network,
            toAddress: params.toAddress.trim(),
            status: WithdrawalStatus.PENDING,
          },
        });

        const ledgerTransaction = await tx.transaction.create({
          data: {
            userId,
            walletId: wallet?.id ?? null,
            accountId: account.id,
            type: TransactionType.WITHDRAW,
            amount: toDecimal(params.amount),
            asset: 'USDT',
            status: TransactionStatus.PENDING,
            metadata: {
              network: params.network,
              networkLabel: NETWORK_DISPLAY_NAME_MAP[params.network],
              toAddress: params.toAddress.trim(),
              fee,
              netAmount,
              withdrawalRequestId: withdrawal.id,
            } as Prisma.InputJsonObject,
          },
          select: transactionSelect,
        });

        return {
          withdrawal,
          ledgerTransaction,
        };
      },
    );

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'WALLET_WITHDRAWAL_REQUESTED',
      entityType: 'withdrawal_request',
      entityId: withdrawal.id,
      targetUserId: userId,
      metadataJson: {
        amount: params.amount,
        fee,
        netAmount,
        network: params.network,
        toAddress: params.toAddress.trim(),
      },
    });

    await this.surveillanceService.evaluateWithdrawalRequest({
      userId,
      amount: params.amount,
    });

    await this.adminChatService.postSystemAlert(
      'general',
      `Withdrawal request: ${params.amount.toLocaleString('en-US')} USDT (${params.network}) from ${userId} to ${params.toAddress.trim()}`,
    );

    await this.accountsService.syncLegacyWalletSnapshot(userId, account.id);
    await this.responseCacheService.invalidateUserResources(userId, [
      'transactions',
      'accounts',
      'positions',
    ]);

    return {
      withdrawal: this.serializeWithdrawal(withdrawal),
      transaction: serializeTransaction(ledgerTransaction),
    };
  }

  async approveWithdrawal(withdrawalId: string, adminId: string, reason?: string) {
    const updated = await this.prismaService.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
      });

      if (!withdrawal) {
        throw new NotFoundException('Withdrawal request not found');
      }

      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        throw new ConflictException('Withdrawal already processed');
      }

      const account = await tx.account.findUnique({
        where: { id: withdrawal.accountId },
        select: { balance: true },
      });

      if (!account || account.balance.lt(withdrawal.amount)) {
        throw new BadRequestException('Insufficient funds at time of approval');
      }

      return tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.APPROVED,
          adminNote: reason?.trim() || null,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });
    });

    await this.syncLedgerTransaction(updated, {
      status: TransactionStatus.APPROVED,
      approvedById: adminId,
      approvedAt: new Date(),
      metadata: {
        decisionReason: reason?.trim() || null,
        approvedAt: new Date().toISOString(),
      },
    });

    await this.auditService.log({
      actorUserId: adminId,
      actorRole: 'admin',
      action: 'WALLET_WITHDRAWAL_APPROVED',
      entityType: 'withdrawal_request',
      entityId: updated.id,
      targetUserId: updated.userId,
      metadataJson: {
        reason: reason?.trim() || null,
      },
    });

    await this.accountsService.syncLegacyWalletSnapshot(updated.userId, updated.accountId);
    await this.responseCacheService.invalidateUserResources(updated.userId, [
      'transactions',
      'accounts',
      'positions',
    ]);

    return this.serializeWithdrawal(updated);
  }

  async rejectWithdrawal(withdrawalId: string, adminId: string, reason: string) {
    const withdrawal = await this.prismaService.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (
      withdrawal.status !== WithdrawalStatus.PENDING &&
      withdrawal.status !== WithdrawalStatus.APPROVED
    ) {
      throw new BadRequestException('Withdrawal request cannot be rejected');
    }

    const now = new Date();

    const updated = await this.prismaService.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: withdrawal.accountId },
        data: {
          balance: {
            increment: withdrawal.amount,
          },
          equity: {
            increment: withdrawal.amount,
          },
        },
      });

      return tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.REJECTED,
          adminNote: reason.trim(),
          reviewedById: adminId,
          reviewedAt: now,
        },
      });
    });

    await this.syncLedgerTransaction(updated, {
      status: TransactionStatus.REJECTED,
      approvedById: adminId,
      approvedAt: now,
      metadata: {
        decisionReason: reason.trim(),
        rejectedAt: now.toISOString(),
      },
    });

    await this.auditService.log({
      actorUserId: adminId,
      actorRole: 'admin',
      action: 'WALLET_WITHDRAWAL_REJECTED',
      entityType: 'withdrawal_request',
      entityId: updated.id,
      targetUserId: updated.userId,
      metadataJson: {
        reason: reason.trim(),
      },
    });

    await this.accountsService.syncLegacyWalletSnapshot(updated.userId, updated.accountId);
    await this.responseCacheService.invalidateUserResources(updated.userId, [
      'transactions',
      'accounts',
      'positions',
    ]);

    return this.serializeWithdrawal(updated);
  }

  async markAsSent(
    withdrawalId: string,
    adminId: string,
    txHash: string,
    adminNote?: string,
  ) {
    const withdrawal = await this.prismaService.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException('Withdrawal must be approved before it can be sent');
    }

    const now = new Date();
    const updated = await this.prismaService.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.SENT,
        txHash: txHash.trim(),
        adminNote: adminNote?.trim() || withdrawal.adminNote || null,
        reviewedById: adminId,
        reviewedAt: now,
      },
    });

    await this.syncLedgerTransaction(updated, {
      status: TransactionStatus.COMPLETED,
      approvedById: adminId,
      approvedAt: now,
      reference: txHash.trim(),
      metadata: {
        txHash: txHash.trim(),
        sentAt: now.toISOString(),
        adminNote: adminNote?.trim() || withdrawal.adminNote || null,
      },
    });

    await this.auditService.log({
      actorUserId: adminId,
      actorRole: 'admin',
      action: 'WALLET_WITHDRAWAL_SENT',
      entityType: 'withdrawal_request',
      entityId: updated.id,
      targetUserId: updated.userId,
      metadataJson: {
        txHash: txHash.trim(),
      },
    });

    await this.sendWithdrawalSentEmail(updated.userId, updated.network, updated.netAmount, txHash);
    await this.accountsService.syncLegacyWalletSnapshot(updated.userId, updated.accountId);
    await this.responseCacheService.invalidateUserResources(updated.userId, [
      'transactions',
      'accounts',
      'positions',
    ]);

    return this.serializeWithdrawal(updated);
  }

  private async sendWithdrawalSentEmail(
    userId: string,
    network: Network,
    netAmount: Prisma.Decimal,
    txHash: string,
  ) {
    try {
      await this.crmService.sendDirectEmailToUser({
        toUserId: userId,
        sentById: userId,
        subject: 'Your AutovestAI withdrawal has been sent',
        body: `
          <p>Your withdrawal has been processed.</p>
          <p><strong>Amount:</strong> ${toNumber(netAmount)?.toFixed(2) ?? '0.00'} USDT</p>
          <p><strong>Network:</strong> ${network}</p>
          <p><strong>Transaction hash:</strong> ${txHash}</p>
        `,
      });
    } catch {
      return;
    }
  }

  private async syncLedgerTransaction(
    withdrawal: {
      id: string;
      userId: string;
      accountId: string;
      amount: Prisma.Decimal;
      network: Network;
      toAddress: string;
      fee: Prisma.Decimal;
      netAmount: Prisma.Decimal;
    },
    update: {
      status: TransactionStatus;
      approvedById?: string | null;
      approvedAt?: Date | null;
      reference?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
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

    const linked = transactions.find((entry) => {
      const metadata =
        entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
          ? (entry.metadata as Record<string, unknown>)
          : {};

      return metadata.withdrawalRequestId === withdrawal.id;
    });

    if (!linked) {
      return null;
    }

    const existingMetadata =
      linked.metadata && typeof linked.metadata === 'object' && !Array.isArray(linked.metadata)
        ? (linked.metadata as Prisma.JsonObject)
        : {};

    return this.prismaService.transaction.update({
      where: { id: linked.id },
      data: {
        status: update.status,
        approvedById: update.approvedById ?? linked.approvedById,
        approvedAt: update.approvedAt ?? linked.approvedAt,
        reference: update.reference ?? linked.reference,
        metadata: {
          ...existingMetadata,
          ...update.metadata,
        } as Prisma.InputJsonObject,
      },
    });
  }

  private serializeWithdrawal(
    withdrawal: {
      id: string;
      userId: string;
      accountId: string;
      amount: Prisma.Decimal;
      fee: Prisma.Decimal;
      netAmount: Prisma.Decimal;
      network: Network;
      toAddress: string;
      status: WithdrawalStatus;
      adminNote: string | null;
      txHash?: string | null;
      reviewedById?: string | null;
      reviewedAt?: Date | null;
      createdAt: Date;
      updatedAt?: Date;
    },
  ) {
    return {
      id: withdrawal.id,
      userId: withdrawal.userId,
      accountId: withdrawal.accountId,
      amount: toNumber(withdrawal.amount) ?? 0,
      fee: toNumber(withdrawal.fee) ?? 0,
      netAmount: toNumber(withdrawal.netAmount) ?? 0,
      network: withdrawal.network,
      toAddress: withdrawal.toAddress,
      status: withdrawal.status,
      adminNote: withdrawal.adminNote,
      txHash: withdrawal.txHash ?? null,
      reviewedById: withdrawal.reviewedById ?? null,
      reviewedAt: withdrawal.reviewedAt ?? null,
      createdAt: withdrawal.createdAt,
      updatedAt: withdrawal.updatedAt ?? withdrawal.createdAt,
    };
  }
}
