import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { roundTo, toDecimal, toNumber } from '../../common/utils/decimal';
import { AuditService } from '../audit/audit.service';
import { CreateTreasuryBalanceSnapshotDto } from './dto/create-treasury-balance-snapshot.dto';
import { ListTreasuryBalanceSnapshotsQueryDto } from './dto/list-treasury-balance-snapshots-query.dto';
import { ListTreasuryMovementsQueryDto } from './dto/list-treasury-movements-query.dto';
import {
  TreasuryBalanceSnapshotDto,
  TreasuryLiabilitiesBreakdownDto,
  TreasuryMonitoringMode,
  TreasuryMovementDto,
  TreasuryReconciliationReportDto,
  TreasuryReconciliationStatus,
  TreasurySummaryDto,
  TreasuryWarningItemDto,
} from './dto/treasury-response.dto';
import { ExplorerTreasuryBalanceProvider } from './providers/explorer-treasury-balance.provider';
import { ManualTreasuryBalanceProvider } from './providers/manual-treasury-balance.provider';
import { TreasuryBalanceObservation } from './providers/treasury-balance-provider.interface';
import {
  getTreasuryBalanceSnapshotModel,
  TreasurySnapshotRecord,
} from './treasury.prisma';
import {
  buildExplorerLink,
  normalizeTreasuryNetwork,
  TREASURY_API_SNAPSHOT_DEDUPE_WINDOW_MS,
  TREASURY_SUPPORTED_API_NETWORKS,
  TREASURY_SUPPORTED_ASSET,
} from './treasury.constants';

interface TreasuryConfigSnapshot {
  asset: typeof TREASURY_SUPPORTED_ASSET;
  network: string;
  masterWalletAddress: string | null;
  explorerBaseUrl: string | null;
  monitoringMode: TreasuryMonitoringMode;
  staleSnapshotHours: number;
  pendingWithdrawalWarningThreshold: number;
  reconciliationTolerance: number;
}

interface TreasuryMetricsSnapshot {
  internalClientLiabilities: number;
  pendingDepositsTotal: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
}

interface TreasuryBalanceContext {
  currentObservation: TreasuryBalanceObservation | null;
  latestSnapshot: TreasuryBalanceSnapshotDto | null;
  liveBalanceAvailable: boolean;
  liveBalanceLookupError: string | null;
}

export function determineTreasuryReconciliationStatus(args: {
  onChainBalance: number | null;
  internalClientLiabilities: number;
  reconciliationTolerance: number;
  warnings: TreasuryWarningItemDto[];
}): TreasuryReconciliationStatus {
  if (args.warnings.some((warning) => warning.severity === 'error')) {
    return 'error';
  }

  if (args.onChainBalance === null) {
    return 'error';
  }

  const difference = args.onChainBalance - args.internalClientLiabilities;

  if (difference < -args.reconciliationTolerance) {
    return 'error';
  }

  if (
    Math.abs(difference) > args.reconciliationTolerance ||
    args.warnings.some((warning) => warning.severity === 'warning')
  ) {
    return 'warning';
  }

  return 'ok';
}

@Injectable()
export class TreasuryService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly manualTreasuryBalanceProvider: ManualTreasuryBalanceProvider,
    private readonly explorerTreasuryBalanceProvider: ExplorerTreasuryBalanceProvider,
  ) {}

  async getSummary(): Promise<TreasurySummaryDto> {
    const { config, metrics, balanceContext } = await this.loadTreasuryState();
    const warnings = this.buildWarnings(config, metrics, balanceContext);
    const onChainBalance = balanceContext.currentObservation?.balance ?? null;
    const reconciliationDifference =
      onChainBalance === null
        ? null
        : roundTo(onChainBalance - metrics.internalClientLiabilities, 8);
    const grossTreasuryAfterPendingWithdrawals =
      onChainBalance === null
        ? null
        : roundTo(onChainBalance - metrics.pendingWithdrawalsTotal, 8);
    const netTreasuryAfterPendingOutflows =
      onChainBalance === null
        ? null
        : roundTo(
            onChainBalance -
              metrics.pendingWithdrawalsTotal -
              metrics.approvedButNotSentWithdrawalsTotal,
            8,
          );
    const availableOperatingSurplusDeficit =
      onChainBalance === null
        ? null
        : roundTo(
            onChainBalance -
              metrics.internalClientLiabilities -
              metrics.approvedButNotSentWithdrawalsTotal,
            8,
          );
    const reconciliationStatus = determineTreasuryReconciliationStatus({
      onChainBalance,
      internalClientLiabilities: metrics.internalClientLiabilities,
      reconciliationTolerance: config.reconciliationTolerance,
      warnings,
    });

    return {
      walletAddress:
        config.masterWalletAddress ?? balanceContext.latestSnapshot?.walletAddress ?? null,
      asset: config.asset,
      network: config.network,
      explorerBaseUrl: config.explorerBaseUrl,
      explorerUrl: buildExplorerLink(
        config.explorerBaseUrl,
        config.masterWalletAddress ?? balanceContext.latestSnapshot?.walletAddress ?? null,
      ),
      monitoringMode: config.monitoringMode,
      onChainBalance,
      liveBalanceAvailable: balanceContext.liveBalanceAvailable,
      balanceSource: balanceContext.currentObservation?.source ?? null,
      latestBalanceSnapshot: balanceContext.latestSnapshot,
      internalClientLiabilities: roundTo(metrics.internalClientLiabilities, 8),
      pendingDepositsTotal: roundTo(metrics.pendingDepositsTotal, 8),
      pendingWithdrawalsTotal: roundTo(metrics.pendingWithdrawalsTotal, 8),
      approvedButNotSentWithdrawalsTotal: roundTo(
        metrics.approvedButNotSentWithdrawalsTotal,
        8,
      ),
      grossTreasuryAfterPendingWithdrawals,
      netTreasuryAfterPendingOutflows,
      availableOperatingSurplusDeficit,
      reconciliationDifference,
      lastCheckedAt: balanceContext.currentObservation?.observedAt ?? null,
      reconciliationStatus,
      warnings,
    };
  }

  async getReconciliationReport(): Promise<TreasuryReconciliationReportDto> {
    const summary = await this.getSummary();

    return {
      latestOnChainBalanceSnapshot: summary.latestBalanceSnapshot,
      internalClientLiabilities: summary.internalClientLiabilities,
      pendingDepositsTotal: summary.pendingDepositsTotal,
      pendingWithdrawalsTotal: summary.pendingWithdrawalsTotal,
      approvedButNotSentWithdrawalsTotal: summary.approvedButNotSentWithdrawalsTotal,
      reconciliationDifference: summary.reconciliationDifference,
      status: summary.reconciliationStatus,
      warnings: summary.warnings,
      generatedAt: new Date(),
    };
  }

  async listBalanceSnapshots(
    query: ListTreasuryBalanceSnapshotsQueryDto = {},
  ): Promise<TreasuryBalanceSnapshotDto[]> {
    const config = this.getConfigSnapshot();
    const snapshots = await getTreasuryBalanceSnapshotModel(this.prismaService).findMany({
      where: {
        asset: config.asset,
        network: config.network,
        walletAddress: config.masterWalletAddress ?? undefined,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? 25,
    });

    return snapshots.map((snapshot) => this.toBalanceSnapshotDtoFromRecord(snapshot));
  }

  async createBalanceSnapshot(
    dto: CreateTreasuryBalanceSnapshotDto,
    admin: AuthenticatedUser,
  ): Promise<TreasuryBalanceSnapshotDto> {
    const config = this.getConfigSnapshot();

    if (!config.masterWalletAddress) {
      throw new BadRequestException(
        'TREASURY_MASTER_WALLET_ADDRESS must be configured before recording snapshots',
      );
    }

    const observedAt = dto.observedAt ? new Date(dto.observedAt) : new Date();
    const snapshot = await getTreasuryBalanceSnapshotModel(this.prismaService).create({
      data: {
        asset: config.asset,
        network: config.network,
        walletAddress: config.masterWalletAddress,
        balance: toDecimal(dto.balance),
        source: 'MANUAL',
        sourceReference: dto.sourceNote?.trim() || null,
        observedAt,
        createdByUserId: admin.id,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    await this.auditService.log({
      actorUserId: admin.id,
      actorRole: admin.role.toLowerCase(),
      action: 'TREASURY_BALANCE_SNAPSHOT_CREATED',
      entityType: 'treasury_balance_snapshot',
      entityId: snapshot.id,
      metadataJson: {
        balance: dto.balance,
        asset: config.asset,
        network: config.network,
        observedAt: observedAt.toISOString(),
        sourceReference: snapshot.sourceReference,
      } as Prisma.InputJsonValue,
    });

    return this.toBalanceSnapshotDtoFromRecord(snapshot);
  }

  async listMovements(
    query: ListTreasuryMovementsQueryDto = {},
  ): Promise<TreasuryMovementDto[]> {
    const where: Prisma.TransactionWhereInput = {
      asset: TREASURY_SUPPORTED_ASSET,
      type:
        query.type ??
        ({
          in: [TransactionType.DEPOSIT, TransactionType.WITHDRAW],
        } satisfies Prisma.EnumTransactionTypeFilter),
      status: query.status,
      createdAt: {
        gte: this.parseDateBoundary(query.dateFrom, 'start'),
        lte: this.parseDateBoundary(query.dateTo, 'end'),
      },
      OR: query.user
        ? [
            { userId: { contains: query.user, mode: 'insensitive' } },
            { user: { email: { contains: query.user, mode: 'insensitive' } } },
          ]
        : undefined,
    };

    const transactions = await this.prismaService.transaction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return transactions
      .filter((transaction) => {
        if (!query.txHash) {
          return true;
        }

        const txHash = this.extractTransactionHash(transaction);
        return txHash?.toLowerCase().includes(query.txHash.toLowerCase()) ?? false;
      })
      .map((transaction) => this.toMovementDto(transaction));
  }

  async getLiabilitiesBreakdown(): Promise<TreasuryLiabilitiesBreakdownDto> {
    const [wallets, totalLiabilitiesAggregate, activeUsersWithBalance] = await Promise.all([
      this.prismaService.wallet.findMany({
        where: {
          balance: {
            gt: 0,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: {
          balance: 'desc',
        },
        take: 20,
      }),
      this.prismaService.wallet.aggregate({
        _sum: {
          balance: true,
        },
        where: {
          balance: {
            gt: 0,
          },
        },
      }),
      this.prismaService.wallet.count({
        where: {
          balance: {
            gt: 0,
          },
        },
      }),
    ]);

    const totalLiabilities = toNumber(totalLiabilitiesAggregate._sum.balance) ?? 0;
    const topFiveBalance = wallets
      .slice(0, 5)
      .reduce((sum, wallet) => sum + (toNumber(wallet.balance) ?? 0), 0);

    return {
      totalLiabilities: roundTo(totalLiabilities, 8),
      totalActiveUsersWithBalance: activeUsersWithBalance,
      concentrationPercentageTop5:
        totalLiabilities > 0 ? roundTo((topFiveBalance / totalLiabilities) * 100, 2) : 0,
      topUsers: wallets.map((wallet) => {
        const balance = toNumber(wallet.balance) ?? 0;

        return {
          userId: wallet.userId,
          email: wallet.user.email,
          balance: roundTo(balance, 8),
          concentrationPercentage:
            totalLiabilities > 0 ? roundTo((balance / totalLiabilities) * 100, 2) : 0,
        };
      }),
    };
  }

  private async loadTreasuryState(): Promise<{
    config: TreasuryConfigSnapshot;
    metrics: TreasuryMetricsSnapshot;
    balanceContext: TreasuryBalanceContext;
  }> {
    const config = this.getConfigSnapshot();
    const [metrics, balanceContext] = await Promise.all([
      this.loadMetrics(),
      this.resolveBalanceContext(config),
    ]);

    return {
      config,
      metrics,
      balanceContext,
    };
  }

  private getConfigSnapshot(): TreasuryConfigSnapshot {
    return {
      asset: TREASURY_SUPPORTED_ASSET,
      network: normalizeTreasuryNetwork(
        this.configService.get<string>('treasury.network') ?? 'TRC20',
      ),
      masterWalletAddress:
        this.configService.get<string>('treasury.masterWalletAddress')?.trim() || null,
      explorerBaseUrl:
        this.configService.get<string>('treasury.explorerBaseUrl')?.trim() || null,
      monitoringMode:
        (this.configService.get<string>('treasury.monitoringMode') ?? 'manual').toLowerCase() ===
        'api'
          ? 'api'
          : 'manual',
      staleSnapshotHours:
        this.configService.get<number>('treasury.staleSnapshotHours') ?? 24,
      pendingWithdrawalWarningThreshold:
        this.configService.get<number>('treasury.pendingWithdrawalWarningThreshold') ??
        10_000,
      reconciliationTolerance:
        this.configService.get<number>('treasury.reconciliationTolerance') ?? 0.01,
    };
  }

  private async loadMetrics(): Promise<TreasuryMetricsSnapshot> {
    const [
      liabilitiesAggregate,
      pendingDepositsAggregate,
      pendingWithdrawalsAggregate,
      approvedWithdrawals,
    ] = await Promise.all([
      this.prismaService.wallet.aggregate({
        _sum: {
          balance: true,
        },
      }),
      this.prismaService.transaction.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          asset: TREASURY_SUPPORTED_ASSET,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
        },
      }),
      this.prismaService.transaction.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          asset: TREASURY_SUPPORTED_ASSET,
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.PENDING,
        },
      }),
      this.prismaService.transaction.findMany({
        where: {
          asset: TREASURY_SUPPORTED_ASSET,
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.APPROVED,
        },
        select: {
          amount: true,
          reference: true,
          metadata: true,
        },
      }),
    ]);

    return {
      internalClientLiabilities: toNumber(liabilitiesAggregate._sum.balance) ?? 0,
      pendingDepositsTotal: toNumber(pendingDepositsAggregate._sum.amount) ?? 0,
      pendingWithdrawalsTotal: toNumber(pendingWithdrawalsAggregate._sum.amount) ?? 0,
      approvedButNotSentWithdrawalsTotal: approvedWithdrawals.reduce((sum, withdrawal) => {
        return this.hasSentWithdrawalMarker(withdrawal)
          ? sum
          : sum + (toNumber(withdrawal.amount) ?? 0);
      }, 0),
    };
  }

  private async resolveBalanceContext(
    config: TreasuryConfigSnapshot,
  ): Promise<TreasuryBalanceContext> {
    const providerInput = {
      asset: config.asset,
      network: config.network,
      walletAddress: config.masterWalletAddress,
    };
    const latestManualObservation =
      await this.manualTreasuryBalanceProvider.getObservedBalance(providerInput);
    let currentObservation = latestManualObservation;
    let latestSnapshot = latestManualObservation
      ? this.toBalanceSnapshotDtoFromObservation(latestManualObservation)
      : null;
    let liveBalanceAvailable = false;
    let liveBalanceLookupError: string | null = null;

    if (config.monitoringMode === 'api' && config.masterWalletAddress) {
      if (!TREASURY_SUPPORTED_API_NETWORKS.includes(config.network as 'TRC20')) {
        liveBalanceLookupError = `Unsupported treasury API network: ${config.network}`;
      } else {
        try {
          const explorerObservation =
            await this.explorerTreasuryBalanceProvider.getObservedBalance(providerInput);

          if (explorerObservation) {
            currentObservation = await this.persistApiObservation(explorerObservation);
            latestSnapshot = this.toBalanceSnapshotDtoFromObservation(currentObservation);
            liveBalanceAvailable = true;
          } else if (!latestSnapshot) {
            currentObservation = null;
            liveBalanceLookupError = 'No live treasury balance available';
          }
        } catch (error) {
          liveBalanceLookupError =
            error instanceof Error ? error.message : 'Treasury balance lookup failed';
          currentObservation = latestManualObservation;
        }
      }
    }

    return {
      currentObservation,
      latestSnapshot,
      liveBalanceAvailable,
      liveBalanceLookupError,
    };
  }

  private buildWarnings(
    config: TreasuryConfigSnapshot,
    metrics: TreasuryMetricsSnapshot,
    balanceContext: TreasuryBalanceContext,
  ): TreasuryWarningItemDto[] {
    const warnings: TreasuryWarningItemDto[] = [];
    const currentObservation = balanceContext.currentObservation;

    if (!config.masterWalletAddress) {
      warnings.push({
        code: 'treasury_wallet_missing',
        severity: 'error',
        message: 'Treasury wallet address is not configured.',
      });
    }

    if (
      config.monitoringMode === 'api' &&
      !TREASURY_SUPPORTED_API_NETWORKS.includes(config.network as 'TRC20')
    ) {
      warnings.push({
        code: 'unsupported_network_config',
        severity: 'warning',
        message: `Treasury API monitoring does not support ${config.network} in alpha.`,
      });
    }

    if (!balanceContext.latestSnapshot) {
      warnings.push({
        code: 'no_balance_snapshot',
        severity: currentObservation ? 'warning' : 'error',
        message: 'No treasury balance snapshot has been recorded yet.',
      });
    } else {
      const snapshotAgeHours =
        (Date.now() - balanceContext.latestSnapshot.observedAt.getTime()) / (60 * 60 * 1000);

      if (snapshotAgeHours > config.staleSnapshotHours) {
        warnings.push({
          code: 'stale_balance_snapshot',
          severity: 'warning',
          message: `Latest treasury balance snapshot is older than ${config.staleSnapshotHours} hours.`,
        });
      }
    }

    if (balanceContext.liveBalanceLookupError) {
      warnings.push({
        code: 'live_balance_unavailable',
        severity: balanceContext.latestSnapshot ? 'warning' : 'error',
        message: balanceContext.liveBalanceLookupError,
      });
    }

    if (!currentObservation) {
      warnings.push({
        code: 'on_chain_balance_unavailable',
        severity: 'error',
        message: 'No on-chain treasury balance is currently available.',
      });
    } else {
      const difference = currentObservation.balance - metrics.internalClientLiabilities;

      if (difference < -config.reconciliationTolerance) {
        warnings.push({
          code: 'liabilities_exceed_treasury',
          severity: 'error',
          message: 'Client liabilities exceed observed treasury balance.',
        });
      } else if (Math.abs(difference) > config.reconciliationTolerance) {
        warnings.push({
          code: 'reconciliation_mismatch',
          severity: 'warning',
          message: `Treasury reconciliation mismatch exceeds the ${config.reconciliationTolerance} USDT tolerance.`,
        });
      }
    }

    if (
      metrics.pendingWithdrawalsTotal >
      config.pendingWithdrawalWarningThreshold
    ) {
      warnings.push({
        code: 'pending_withdrawals_high',
        severity: 'warning',
        message: `Pending withdrawals exceed the ${config.pendingWithdrawalWarningThreshold} USDT warning threshold.`,
      });
    }

    return warnings;
  }

  private async persistApiObservation(
    observation: TreasuryBalanceObservation,
  ): Promise<TreasuryBalanceObservation> {
    const latestSnapshot = await getTreasuryBalanceSnapshotModel(this.prismaService).findFirst({
      where: {
        asset: observation.asset,
        network: observation.network,
        walletAddress: observation.walletAddress,
        source: 'API',
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (latestSnapshot) {
      const ageMs = Date.now() - latestSnapshot.observedAt.getTime();
      const balanceDifference = Math.abs(
        (toNumber(latestSnapshot.balance) ?? 0) - observation.balance,
      );

      if (
        ageMs <= TREASURY_API_SNAPSHOT_DEDUPE_WINDOW_MS &&
        balanceDifference <= 0.00000001
      ) {
        return this.toBalanceObservation(latestSnapshot);
      }
    }

    const createdSnapshot = await getTreasuryBalanceSnapshotModel(this.prismaService).create({
      data: {
        asset: observation.asset,
        network: observation.network,
        walletAddress: observation.walletAddress,
        balance: toDecimal(observation.balance),
        source: 'API',
        sourceReference: observation.sourceReference,
        observedAt: observation.observedAt,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return this.toBalanceObservation(createdSnapshot);
  }

  private toBalanceObservation(snapshot: TreasurySnapshotRecord): TreasuryBalanceObservation {
    return {
      id: snapshot.id,
      asset: snapshot.asset,
      network: snapshot.network,
      walletAddress: snapshot.walletAddress,
      balance: toNumber(snapshot.balance) ?? 0,
      source: snapshot.source.toLowerCase() as 'manual' | 'api',
      sourceReference: snapshot.sourceReference,
      observedAt: snapshot.observedAt,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      createdByUser: snapshot.createdByUser,
    };
  }

  private toBalanceSnapshotDtoFromObservation(
    snapshot: TreasuryBalanceObservation,
  ): TreasuryBalanceSnapshotDto {
    return {
      id: snapshot.id,
      asset: snapshot.asset,
      network: snapshot.network,
      walletAddress: snapshot.walletAddress,
      balance: roundTo(snapshot.balance, 8),
      source: snapshot.source,
      sourceReference: snapshot.sourceReference,
      observedAt: snapshot.observedAt,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      createdByUser: snapshot.createdByUser,
    };
  }

  private toBalanceSnapshotDtoFromRecord(
    snapshot: TreasurySnapshotRecord,
  ): TreasuryBalanceSnapshotDto {
    return this.toBalanceSnapshotDtoFromObservation(this.toBalanceObservation(snapshot));
  }

  private toMovementDto(transaction: {
    id: string;
    userId: string;
    type: TransactionType;
    amount: Prisma.Decimal;
    asset: string;
    status: TransactionStatus;
    reference: string | null;
    metadata: Prisma.JsonValue | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      email: string;
    };
  }): TreasuryMovementDto {
    const metadata = this.readMetadata(transaction.metadata);

    return {
      id: transaction.id,
      type: transaction.type as 'DEPOSIT' | 'WITHDRAW',
      userId: transaction.userId,
      userEmail: transaction.user.email,
      amount: roundTo(toNumber(transaction.amount) ?? 0, 8),
      asset: transaction.asset,
      network: typeof metadata.network === 'string' ? metadata.network : null,
      status: transaction.status,
      txHash: this.extractTransactionHash(transaction),
      explorerUrl:
        typeof metadata.explorerUrl === 'string' ? metadata.explorerUrl : null,
      source:
        metadata.autoDetected === true
          ? 'blockchain_detection'
          : transaction.status === TransactionStatus.APPROVED
          ? 'admin_approved'
          : 'client_request',
      reference: transaction.reference,
      approvedAt: transaction.approvedAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private hasSentWithdrawalMarker(transaction: {
    reference: string | null;
    metadata: Prisma.JsonValue | null;
  }): boolean {
    const metadata = this.readMetadata(transaction.metadata);

    return [
      metadata.sentAt,
      metadata.completedAt,
      metadata.txHash,
      metadata.blockchainTxId,
      metadata.payoutTxHash,
      metadata.releaseTxHash,
    ].some((value) => typeof value === 'string' && value.trim().length > 0);
  }

  private extractTransactionHash(transaction: {
    reference: string | null;
    metadata: Prisma.JsonValue | null;
  }): string | null {
    const metadata = this.readMetadata(transaction.metadata);
    const candidates = [
      metadata.txHash,
      metadata.blockchainTxId,
      metadata.payoutTxHash,
      metadata.releaseTxHash,
      metadata.withdrawalTxHash,
      transaction.reference,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }

    return null;
  }

  private readMetadata(metadata: Prisma.JsonValue | null): Record<string, unknown> {
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  }

  private parseDateBoundary(
    value: string | undefined,
    mode: 'start' | 'end',
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    if (value.length === 10) {
      return mode === 'start'
        ? new Date(`${value}T00:00:00.000`)
        : new Date(`${value}T23:59:59.999`);
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
