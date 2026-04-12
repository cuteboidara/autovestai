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

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ERC20_USDT_DECIMALS = 6;
const ETHEREUM_AVERAGE_BLOCK_TIME_MS = 12_000;
const ETHEREUM_LOG_SCAN_CHUNK_SIZE = 50_000;
const INITIAL_ERC20_SCAN_BUFFER_BLOCKS = 7_200;
const ETHEREUM_RPC_FALLBACK_URL = 'https://ethereum.publicnode.com';

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
  private readonly ethRpcUrls: string[];
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
    this.ethRpcUrls = [
      configService.get<string>('wallet.ethRpcUrl') ?? 'https://eth.llamarpc.com',
      ETHEREUM_RPC_FALLBACK_URL,
    ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
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
        createdAt: true,
      },
    });

    for (const entry of addresses) {
      try {
        const detections = await this.fetchERC20Detections(entry.address, entry.createdAt);

        for (const detection of detections) {
          await this.processDeposit(entry, detection);
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
    const wallet = await this.prismaService.wallet.findUnique({
      where: { userId: addressRecord.userId },
      select: { id: true },
    });
    let shouldNotifyPendingReview = false;
    let shouldRefreshWalletView = false;
    let depositRecordId = existing?.id ?? detection.txHash;

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

    await this.prismaService.$transaction(async (tx) => {
      const depositRecord = existing
        ? await tx.deposit.update({
            where: { id: existing.id },
            data: {
              confirmations: detection.confirmations,
              status: nextStatus,
              creditedAt: null,
            },
          })
        : await tx.deposit.create({
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

      depositRecordId = depositRecord.id;
      shouldRefreshWalletView =
        shouldRefreshWalletView ||
        !existing ||
        existing.status !== nextStatus ||
        existing.confirmations !== detection.confirmations;

      const recentLedgerTransactions = await tx.transaction.findMany({
        where: {
          userId: addressRecord.userId,
          accountId: addressRecord.accountId,
          type: TransactionType.DEPOSIT,
        },
        select: {
          id: true,
          walletId: true,
          amount: true,
          status: true,
          reference: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const linkedLedger = this.findMatchingDepositLedgerTransaction(
        recentLedgerTransactions,
        detection,
      );

      if (linkedLedger) {
        const currentHash = this.extractTransactionHash(linkedLedger);
        const txHashChanged =
          currentHash?.toLowerCase() !== detection.txHash.trim().toLowerCase();
        const metadata = this.readMetadata(linkedLedger.metadata);
        const nextLedgerStatus = this.resolveDetectedDepositLedgerStatus(linkedLedger.status);

        shouldNotifyPendingReview =
          nextStatus === DepositStatus.COMPLETED &&
          nextLedgerStatus === TransactionStatus.PENDING &&
          (txHashChanged || !existing || existing.status !== DepositStatus.COMPLETED);
        shouldRefreshWalletView =
          shouldRefreshWalletView ||
          txHashChanged ||
          linkedLedger.status !== nextLedgerStatus ||
          linkedLedger.walletId !== (wallet?.id ?? linkedLedger.walletId) ||
          metadata.confirmations !== detection.confirmations ||
          metadata.depositStatus !== nextStatus;

        await tx.transaction.update({
          where: { id: linkedLedger.id },
          data: {
            walletId: wallet?.id ?? linkedLedger.walletId,
            status: nextLedgerStatus,
            reference: detection.txHash,
            metadata: {
              ...metadata,
              network: detection.network,
              blockchainTxId: detection.txHash,
              fromAddress: detection.fromAddress,
              toAddress: detection.toAddress,
              confirmations: detection.confirmations,
              confirmationsRequired,
              autoDetected: true,
              depositId: depositRecord.id,
              depositStatus: nextStatus,
              explorerUrl: `${NETWORK_EXPLORER_BASES[detection.network]}${detection.txHash}`,
            } as Prisma.InputJsonObject,
          },
        });
      } else {
        shouldNotifyPendingReview = nextStatus === DepositStatus.COMPLETED;
        shouldRefreshWalletView = true;

        await tx.transaction.create({
          data: {
            userId: addressRecord.userId,
            walletId: wallet?.id ?? null,
            accountId: addressRecord.accountId,
            type: TransactionType.DEPOSIT,
            amount: toDecimal(detection.amount),
            asset: 'USDT',
            status: TransactionStatus.PENDING,
            reference: detection.txHash,
            metadata: {
              network: detection.network,
              blockchainTxId: detection.txHash,
              fromAddress: detection.fromAddress,
              toAddress: detection.toAddress,
              confirmations: detection.confirmations,
              confirmationsRequired,
              autoDetected: true,
              depositId: depositRecord.id,
              depositStatus: nextStatus,
              explorerUrl: `${NETWORK_EXPLORER_BASES[detection.network]}${detection.txHash}`,
            } as Prisma.InputJsonObject,
          },
        });
      }
    });

    if (shouldRefreshWalletView) {
      await this.accountsService.syncLegacyWalletSnapshot(
        addressRecord.userId,
        addressRecord.accountId,
      );
      await this.responseCacheService.invalidateUserResources(addressRecord.userId, [
        'transactions',
        'accounts',
        'positions',
      ]);
    }

    if (nextStatus !== DepositStatus.COMPLETED || !shouldNotifyPendingReview) {
      return;
    }

    await this.auditService.log({
      actorRole: 'system',
      action: 'WALLET_DEPOSIT_PENDING_REVIEW',
      entityType: 'deposit',
      entityId: depositRecordId,
      targetUserId: addressRecord.userId,
      metadataJson: {
        txHash: detection.txHash,
        network: detection.network,
        amount: detection.amount,
      },
    });

    await this.sendDepositPendingReviewEmail(
      addressRecord.userId,
      detection.amount,
      detection.txHash,
      detection.network,
    );
    await this.adminChatService.postSystemAlert(
      'general',
      `Deposit pending review: ${detection.amount.toLocaleString('en-US')} USDT via ${detection.network} for ${addressRecord.userId}`,
    );
    this.logger.log(
      `Deposit pending review for ${addressRecord.userId}: ${detection.amount} USDT (${detection.network})`,
    );
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

  private findMatchingDepositLedgerTransaction(
    transactions: Array<{
      id: string;
      walletId: string | null;
      amount: Prisma.Decimal;
      status: TransactionStatus;
      reference: string | null;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
    }>,
    detection: DepositDetection,
  ) {
    const exactMatch = transactions.find((entry) => {
      const txHash = this.extractTransactionHash(entry);
      return txHash?.toLowerCase() === detection.txHash.trim().toLowerCase();
    });

    if (exactMatch) {
      return exactMatch;
    }

    return (
      transactions.find((entry) =>
        this.isPendingDepositCandidateMatch(entry, detection),
      ) ?? null
    );
  }

  private isPendingDepositCandidateMatch(
    transaction: {
      amount: Prisma.Decimal;
      status: TransactionStatus;
      reference: string | null;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
    },
    detection: DepositDetection,
  ) {
    if (transaction.status !== TransactionStatus.PENDING) {
      return false;
    }

    if (this.extractTransactionHash(transaction)) {
      return false;
    }

    const metadata = this.readMetadata(transaction.metadata);
    const networkMatches = metadata.network === detection.network;
    const amountMatches =
      Math.abs(transaction.amount.toNumber() - detection.amount) <= 0.00000001;
    const withinReviewWindow =
      Math.abs(transaction.createdAt.getTime() - detection.detectedAt.getTime()) <=
      7 * 24 * 60 * 60 * 1000;

    return networkMatches && amountMatches && withinReviewWindow;
  }

  private resolveDetectedDepositLedgerStatus(status: TransactionStatus) {
    if (
      status === TransactionStatus.APPROVED ||
      status === TransactionStatus.COMPLETED ||
      status === TransactionStatus.REJECTED
    ) {
      return status;
    }

    return TransactionStatus.PENDING;
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

  private readMetadata(metadata: Prisma.JsonValue | null): Record<string, unknown> {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  }

  private async sendDepositPendingReviewEmail(
    userId: string,
    amount: number,
    txHash: string,
    network: Network,
  ) {
    try {
      await this.crmService.sendDirectEmailToUser({
        toUserId: userId,
        sentById: userId,
        subject: 'Your AutovestAI deposit is pending review',
        body: `
          <p>Your deposit has been received on-chain and is pending manual review.</p>
          <p><strong>Amount:</strong> ${amount.toFixed(2)} USDT</p>
          <p><strong>Network:</strong> ${network}</p>
          <p><strong>Transaction hash:</strong> ${txHash}</p>
          <p>Your trading balance will update after an admin approves the deposit.</p>
        `,
      });
    } catch {
      return;
    }
  }

  private async fetchERC20Detections(address: string, createdAt: Date) {
    if (this.etherscanApiKey) {
      try {
        return await this.fetchERC20DetectionsFromEtherscan(address);
      } catch (error) {
        this.logger.warn(
          `Etherscan ERC20 scan failed for ${address}, falling back to RPC: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    return this.fetchERC20DetectionsFromRpc(address, createdAt);
  }

  private async fetchERC20DetectionsFromEtherscan(address: string): Promise<DepositDetection[]> {
    const url = new URL('https://api.etherscan.io/v2/api');
    url.searchParams.set('chainid', '1');
    url.searchParams.set('module', 'account');
    url.searchParams.set('action', 'tokentx');
    url.searchParams.set('contractaddress', ETH_USDT_CONTRACT);
    url.searchParams.set('address', address);
    url.searchParams.set('sort', 'desc');
    url.searchParams.set('page', '1');
    url.searchParams.set('offset', '100');
    url.searchParams.set('apikey', this.etherscanApiKey);

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
      status?: string;
      message?: string;
      result?:
        | string
        | Array<{
            hash?: string;
            from?: string;
            to?: string;
            value?: string;
            tokenDecimal?: string;
            confirmations?: string;
            timeStamp?: string;
          }>;
    };

    if (!Array.isArray(data.result)) {
      const message =
        typeof data.result === 'string' && data.result.trim()
          ? data.result
          : data.message ?? 'Invalid Etherscan response';
      throw new Error(message);
    }

    return data.result
      .filter((tx) => tx.hash && tx.to && tx.to.toLowerCase() === address.toLowerCase())
      .map((tx) => {
        const decimals = Number(tx.tokenDecimal ?? String(ERC20_USDT_DECIMALS));
        const amount = Number(tx.value ?? '0') / 10 ** decimals;
        const confirmations = Number(tx.confirmations ?? '0');

        return {
          txHash: tx.hash ?? '',
          network: Network.ERC20,
          amount,
          fromAddress: tx.from ?? '',
          toAddress: address,
          confirmations,
          detectedAt: new Date(Number(tx.timeStamp ?? '0') * 1000 || Date.now()),
        };
      })
      .filter((tx) => Number.isFinite(tx.amount) && tx.amount > 0);
  }

  private async fetchERC20DetectionsFromRpc(
    address: string,
    createdAt: Date,
  ): Promise<DepositDetection[]> {
    const latestBlockNumber = await this.fetchEthereumLatestBlockNumber();
    const startBlockNumber = await this.resolveEthereumScanStartBlock(
      address,
      createdAt,
      latestBlockNumber,
    );
    const blockTimestampCache = new Map<number, Date>();
    const detections: DepositDetection[] = [];

    for (
      let fromBlockNumber = startBlockNumber;
      fromBlockNumber <= latestBlockNumber;
      fromBlockNumber += ETHEREUM_LOG_SCAN_CHUNK_SIZE
    ) {
      const toBlockNumber = Math.min(
        fromBlockNumber + ETHEREUM_LOG_SCAN_CHUNK_SIZE - 1,
        latestBlockNumber,
      );
      const logs = await this.fetchEthereumRpc<
        Array<{
          transactionHash?: string;
          blockNumber?: string;
          topics?: string[];
          data?: string;
        }>
      >('eth_getLogs', [
        {
          address: ETH_USDT_CONTRACT,
          fromBlock: this.toEthereumHex(fromBlockNumber),
          toBlock: this.toEthereumHex(toBlockNumber),
          topics: [ERC20_TRANSFER_TOPIC, null, this.toEthereumTopicAddress(address)],
        },
      ]);

      for (const log of logs) {
        if (!log.transactionHash || !log.blockNumber) {
          continue;
        }

        const blockNumber = this.fromEthereumHex(log.blockNumber);
        const amount = this.parseErc20Amount(log.data);

        if (!Number.isFinite(amount) || amount <= 0) {
          continue;
        }

        detections.push({
          txHash: log.transactionHash,
          network: Network.ERC20,
          amount,
          fromAddress: this.extractAddressFromTopic(log.topics?.[1]),
          toAddress: address,
          confirmations: latestBlockNumber - blockNumber + 1,
          detectedAt: await this.fetchEthereumBlockTimestamp(blockNumber, blockTimestampCache),
        });
      }
    }

    await this.setLastScannedBlock(address, latestBlockNumber);
    return detections.sort(
      (left, right) => right.detectedAt.getTime() - left.detectedAt.getTime(),
    );
  }

  private async resolveEthereumScanStartBlock(
    address: string,
    createdAt: Date,
    latestBlockNumber: number,
  ) {
    const lastScannedBlock = await this.getLastScannedBlock(address);

    if (lastScannedBlock > 0 && lastScannedBlock <= latestBlockNumber) {
      return Math.max(
        lastScannedBlock - NETWORK_CONFIRMATIONS_REQUIRED.ERC20,
        0,
      );
    }

    const ageMs = Math.max(Date.now() - createdAt.getTime(), 0);
    const estimatedBlocksAgo = Math.ceil(ageMs / ETHEREUM_AVERAGE_BLOCK_TIME_MS);

    return Math.max(
      latestBlockNumber - estimatedBlocksAgo - INITIAL_ERC20_SCAN_BUFFER_BLOCKS,
      0,
    );
  }

  private async fetchEthereumLatestBlockNumber() {
    const latestBlockHex = await this.fetchEthereumRpc<string>('eth_blockNumber', []);
    return this.fromEthereumHex(latestBlockHex);
  }

  private async fetchEthereumBlockTimestamp(
    blockNumber: number,
    cache: Map<number, Date>,
  ): Promise<Date> {
    const cached = cache.get(blockNumber);

    if (cached) {
      return cached;
    }

    const block = await this.fetchEthereumRpc<{ timestamp?: string } | null>(
      'eth_getBlockByNumber',
      [this.toEthereumHex(blockNumber), false],
    );
    const timestamp = block?.timestamp
      ? new Date(this.fromEthereumHex(block.timestamp) * 1000)
      : new Date();

    cache.set(blockNumber, timestamp);
    return timestamp;
  }

  private async fetchEthereumRpc<T>(method: string, params: unknown[]): Promise<T> {
    let lastError: Error | null = null;

    for (const rpcUrl of this.ethRpcUrls) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `${method}-${Date.now()}`,
            method,
            params,
          }),
        });

        if (!response.ok) {
          throw new Error(`RPC ${response.status}`);
        }

        const text = await response.text();
        const payload = JSON.parse(text) as {
          result?: T;
          error?: {
            message?: string;
          };
        };

        if (payload.error) {
          throw new Error(payload.error.message ?? 'Unknown RPC error');
        }

        return payload.result as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error(`Ethereum RPC ${method} failed`);
  }

  private toEthereumHex(value: number) {
    return `0x${Math.max(0, Math.floor(value)).toString(16)}`;
  }

  private fromEthereumHex(value: string) {
    return Number.parseInt(value, 16);
  }

  private toEthereumTopicAddress(address: string) {
    return `0x000000000000000000000000${address.trim().toLowerCase().replace(/^0x/, '')}`;
  }

  private extractAddressFromTopic(topic?: string) {
    if (!topic || topic.length < 40) {
      return '';
    }

    return `0x${topic.slice(-40)}`.toLowerCase();
  }

  private parseErc20Amount(value?: string) {
    if (!value || value === '0x') {
      return 0;
    }

    try {
      return Number(BigInt(value)) / 10 ** ERC20_USDT_DECIMALS;
    } catch {
      return 0;
    }
  }
}
