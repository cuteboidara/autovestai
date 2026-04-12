import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DepositStatus,
  Network,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { ResponseCacheService } from '../../common/cache/response-cache.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { toDecimal } from '../../common/utils/decimal';
import { AccountsService } from '../accounts/accounts.service';
import { AdminChatService } from '../admin-chat/admin-chat.service';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../crm/crm.service';
import {
  ETH_USDT_CONTRACT,
  NETWORK_CONFIRMATIONS_REQUIRED,
  NETWORK_EXPLORER_BASES,
  TRON_USDT_CONTRACT,
} from './wallet.constants';

interface DepositDetection {
  txHash: string;
  network: Network;
  amount: number;
  fromAddress: string;
  toAddress: string;
  confirmations: number;
  detectedAt: Date;
}

@Injectable()
export class BlockchainMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainMonitorService.name);
  private intervalRef?: NodeJS.Timeout;
  private isRunning = false;
  private readonly tronApiUrl: string;
  private readonly tronApiKey: string;
  private readonly etherscanApiKey: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly responseCacheService: ResponseCacheService,
    private readonly auditService: AuditService,
    private readonly adminChatService: AdminChatService,
    private readonly crmService: CrmService,
    private readonly redisService: RedisService,
    configService: ConfigService,
  ) {
    this.tronApiUrl = configService.get<string>('wallet.tronApiUrl') ?? 'https://api.trongrid.io';
    this.tronApiKey = configService.get<string>('wallet.tronApiKey') ?? '';
    this.etherscanApiKey = configService.get<string>('wallet.etherscanApiKey') ?? '';
  }

  onModuleInit(): void {
    void this.monitorDeposits();
    this.intervalRef = setInterval(() => {
      void this.monitorDeposits();
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }

  async monitorDeposits(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await Promise.all([this.checkTRC20Deposits(), this.checkERC20Deposits()]);
    } catch (error) {
      this.logger.warn(
        `Deposit monitor cycle failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async checkTRC20Deposits() {
    const addresses = await this.prismaService.depositAddress.findMany({
      where: { network: Network.TRC20 },
      select: {
        id: true,
        userId: true,
        accountId: true,
        address: true,
        network: true,
      },
    });

    for (const entry of addresses) {
      // Minimum 500ms delay between address scans to avoid TRON rate limiting
      await this.delay(500);

      const url = new URL(
        `${this.tronApiUrl.replace(/\/$/, '')}/v1/accounts/${entry.address}/transactions/trc20`,
      );
      url.searchParams.set('limit', '20');
      url.searchParams.set('contract_address', TRON_USDT_CONTRACT);

      const maxAttempts = 3;
      let success = false;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const response = await fetch(url.toString(), {
            headers: this.tronApiKey
              ? {
                  'TRON-PRO-API-KEY': this.tronApiKey,
                }
              : undefined,
          });

          if (response.status === 429) {
            const backoffMs = Math.min(Math.pow(2, attempt) * 1000, 60_000);
            this.logger.warn(
              `TRON API rate limited for ${entry.address}. Backing off ${backoffMs}ms (attempt ${attempt + 1}/${maxAttempts}).`,
            );
            await this.delay(backoffMs);
            continue;
          }

          if (!response.ok) {
            throw new Error(`TRON API ${response.status}`);
          }

          const data = (await response.json()) as {
            data?: Array<{
              transaction_id?: string;
              from?: string;
              to?: string;
              type?: string;
              value?: string;
              block_timestamp?: number;
            }>;
          };

          for (const tx of data.data ?? []) {
            if (!tx.transaction_id || !tx.to || tx.to !== entry.address) {
              continue;
            }

            const amount = Number(tx.value ?? '0') / 1_000_000;

            if (!Number.isFinite(amount) || amount <= 0) {
              continue;
            }

            await this.processDeposit(entry, {
              txHash: tx.transaction_id,
              network: Network.TRC20,
              amount,
              fromAddress: tx.from ?? '',
              toAddress: entry.address,
              confirmations: NETWORK_CONFIRMATIONS_REQUIRED.TRC20,
              detectedAt: new Date(tx.block_timestamp ?? Date.now()),
            });
          }

          // Cache the scan timestamp so on restart we don't re-scan from scratch
          await this.setLastScannedBlock(entry.address, Date.now());
          success = true;
          break;
        } catch (error) {
          if (attempt === maxAttempts - 1) {
            this.logger.warn(
              `TRC20 deposit scan failed for ${entry.address}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          } else {
            const backoffMs = Math.min(Math.pow(2, attempt) * 1000, 60_000);
            await this.delay(backoffMs);
          }
        }
      }

      if (!success) {
        this.logger.warn(`TRC20 deposit scan gave up for ${entry.address} after ${maxAttempts} attempts`);
      }
    }
  }

  async checkERC20Deposits() {
    const addresses = await this.prismaService.depositAddress.findMany({
      where: { network: Network.ERC20 },
      select: {
        id: true,
        userId: true,
        accountId: true,
        address: true,
        network: true,
      },
    });

    for (const entry of addresses) {
      const url = new URL('https://api.etherscan.io/api');
      url.searchParams.set('module', 'account');
      url.searchParams.set('action', 'tokentx');
      url.searchParams.set('contractaddress', ETH_USDT_CONTRACT);
      url.searchParams.set('address', entry.address);
      url.searchParams.set('sort', 'desc');

      if (this.etherscanApiKey) {
        url.searchParams.set('apikey', this.etherscanApiKey);
      }

      try {
        const response = await fetch(url.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Etherscan API ${response.status}`);
        }

        const data = (await response.json()) as {
          result?: Array<{
            hash?: string;
            from?: string;
            to?: string;
            value?: string;
            tokenDecimal?: string;
            confirmations?: string;
            timeStamp?: string;
          }>;
        };

        for (const tx of data.result ?? []) {
          if (!tx.hash || !tx.to || tx.to.toLowerCase() !== entry.address.toLowerCase()) {
            continue;
          }

          const decimals = Number(tx.tokenDecimal ?? '6');
          const amount = Number(tx.value ?? '0') / 10 ** decimals;
          const confirmations = Number(tx.confirmations ?? '0');

          if (!Number.isFinite(amount) || amount <= 0) {
            continue;
          }

          await this.processDeposit(entry, {
            txHash: tx.hash,
            network: Network.ERC20,
            amount,
            fromAddress: tx.from ?? '',
            toAddress: entry.address,
            confirmations,
            detectedAt: new Date(Number(tx.timeStamp ?? '0') * 1000 || Date.now()),
          });
        }
      } catch (error) {
        this.logger.warn(
          `ERC20 deposit scan failed for ${entry.address}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  private async processDeposit(
    addressRecord: {
      userId: string;
      accountId: string;
      address: string;
      network: Network;
    },
    detection: DepositDetection,
  ) {
    const existing = await this.prismaService.deposit.findUnique({
      where: { txHash: detection.txHash },
    });

    const confirmationsRequired = NETWORK_CONFIRMATIONS_REQUIRED[detection.network];
    const nextStatus =
      detection.confirmations >= confirmationsRequired
        ? DepositStatus.COMPLETED
        : detection.confirmations > 0
          ? DepositStatus.CONFIRMING
          : DepositStatus.PENDING;

    if (existing?.creditedAt) {
      if (existing.confirmations !== detection.confirmations) {
        await this.prismaService.deposit.update({
          where: { id: existing.id },
          data: {
            confirmations: detection.confirmations,
          },
        });
      }

      return;
    }

    if (nextStatus !== DepositStatus.COMPLETED) {
      if (!existing) {
        await this.prismaService.deposit.create({
          data: {
            userId: addressRecord.userId,
            accountId: addressRecord.accountId,
            txHash: detection.txHash,
            network: detection.network,
            amount: toDecimal(detection.amount),
            usdtAmount: toDecimal(detection.amount),
            fromAddress: detection.fromAddress,
            toAddress: detection.toAddress,
            confirmations: detection.confirmations,
            status: nextStatus,
            creditedAt: null,
            createdAt: detection.detectedAt,
          },
        });
      } else {
        await this.prismaService.deposit.update({
          where: { id: existing.id },
          data: {
            confirmations: detection.confirmations,
            status: nextStatus,
            creditedAt: null,
          },
        });
      }

      return;
    }

    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId: addressRecord.userId },
      select: { id: true },
    });

    let didCredit = false;

    await this.prismaService.$transaction(async (tx) => {
      if (existing) {
        await tx.deposit.update({
          where: { id: existing.id },
          data: {
            confirmations: detection.confirmations,
            status: DepositStatus.COMPLETED,
            creditedAt: new Date(),
          },
        });
      } else {
        await tx.deposit.create({
          data: {
            userId: addressRecord.userId,
            accountId: addressRecord.accountId,
            txHash: detection.txHash,
            network: detection.network,
            amount: toDecimal(detection.amount),
            usdtAmount: toDecimal(detection.amount),
            fromAddress: detection.fromAddress,
            toAddress: detection.toAddress,
            confirmations: detection.confirmations,
            status: DepositStatus.COMPLETED,
            creditedAt: new Date(),
            createdAt: detection.detectedAt,
          },
        });
      }

      const existingLedger = await tx.transaction.findFirst({
        where: {
          userId: addressRecord.userId,
          accountId: addressRecord.accountId,
          type: TransactionType.DEPOSIT,
          reference: detection.txHash,
        },
      });

      if (!existingLedger || existingLedger.status !== TransactionStatus.COMPLETED) {
        didCredit = true;

        await tx.account.update({
          where: { id: addressRecord.accountId },
          data: {
            balance: {
              increment: toDecimal(detection.amount),
            },
            equity: {
              increment: toDecimal(detection.amount),
            },
          },
        });
      }

      if (existingLedger) {
        await tx.transaction.update({
          where: { id: existingLedger.id },
          data: {
            walletId: wallet?.id ?? existingLedger.walletId,
            status: TransactionStatus.COMPLETED,
            reference: detection.txHash,
            metadata: {
              ...(existingLedger.metadata &&
              typeof existingLedger.metadata === 'object' &&
              !Array.isArray(existingLedger.metadata)
                ? (existingLedger.metadata as Prisma.JsonObject)
                : {}),
              network: detection.network,
              blockchainTxId: detection.txHash,
              fromAddress: detection.fromAddress,
              toAddress: detection.toAddress,
              confirmations: detection.confirmations,
              autoDetected: true,
              explorerUrl: `${NETWORK_EXPLORER_BASES[detection.network]}${detection.txHash}`,
            } as Prisma.InputJsonObject,
          },
        });
      } else {
        await tx.transaction.create({
          data: {
            userId: addressRecord.userId,
            walletId: wallet?.id ?? null,
            accountId: addressRecord.accountId,
            type: TransactionType.DEPOSIT,
            amount: toDecimal(detection.amount),
            asset: 'USDT',
            status: TransactionStatus.COMPLETED,
            reference: detection.txHash,
            metadata: {
              network: detection.network,
              blockchainTxId: detection.txHash,
              fromAddress: detection.fromAddress,
              toAddress: detection.toAddress,
              confirmations: detection.confirmations,
              autoDetected: true,
              explorerUrl: `${NETWORK_EXPLORER_BASES[detection.network]}${detection.txHash}`,
            } as Prisma.InputJsonObject,
          },
        });
      }
    });

    if (!didCredit) {
      return;
    }

    await this.auditService.log({
      actorRole: 'system',
      action: 'WALLET_DEPOSIT_AUTO_APPROVED',
      entityType: 'deposit',
      entityId: detection.txHash,
      targetUserId: addressRecord.userId,
      metadataJson: {
        txHash: detection.txHash,
        network: detection.network,
        amount: detection.amount,
      },
    });

    await this.accountsService.syncLegacyWalletSnapshot(
      addressRecord.userId,
      addressRecord.accountId,
    );
    await this.responseCacheService.invalidateUserResources(addressRecord.userId, [
      'transactions',
      'accounts',
      'positions',
    ]);

    await this.sendDepositEmail(addressRecord.userId, detection.amount, detection.txHash);
    await this.adminChatService.postSystemAlert(
      'general',
      `New deposit credited: ${detection.amount.toLocaleString('en-US')} USDT via ${detection.network} for ${addressRecord.userId}`,
    );
    this.logger.log(
      `Deposit credited for ${addressRecord.userId}: ${detection.amount} USDT (${detection.network})`,
    );
  }

  private async findLedgerTransactionByTxHash(
    userId: string,
    accountId: string,
    txHash: string,
  ) {
    const transactions = await this.prismaService.transaction.findMany({
      where: {
        userId,
        accountId,
        type: TransactionType.DEPOSIT,
      },
      select: {
        id: true,
        reference: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return transactions.find((entry) => {
      if (entry.reference === txHash) {
        return true;
      }

      const metadata =
        entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
          ? (entry.metadata as Record<string, unknown>)
          : {};

      return metadata.blockchainTxId === txHash;
    });
  }

  private async getLastScannedBlock(address: string): Promise<number> {
    try {
      const key = `blockchain:lastBlock:${address}`;
      const cached = await this.redisService.getClient().get(key);
      return cached ? Number(cached) : 0;
    } catch {
      return 0;
    }
  }

  private async setLastScannedBlock(address: string, blockNumber: number): Promise<void> {
    try {
      const key = `blockchain:lastBlock:${address}`;
      // Cache for 7 days
      await this.redisService.getClient().set(key, String(blockNumber), 'EX', 7 * 24 * 60 * 60);
    } catch {
      // Non-fatal
    }
  }

  private async sendDepositEmail(userId: string, amount: number, txHash: string) {
    try {
      await this.crmService.sendDirectEmailToUser({
        toUserId: userId,
        sentById: userId,
        subject: 'Your AutovestAI deposit has been credited',
        body: `
          <p>Your deposit has been credited to your trading account.</p>
          <p><strong>Amount:</strong> ${amount.toFixed(2)} USDT</p>
          <p><strong>Transaction hash:</strong> ${txHash}</p>
        `,
      });
    } catch {
      return;
    }
  }
}
