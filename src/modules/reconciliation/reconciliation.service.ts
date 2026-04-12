import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  ReconciliationRunSource,
  ReconciliationStatus,
  TreasuryBalanceSnapshot,
} from '@prisma/client';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { roundTo, toDecimal, toNumber } from '../../common/utils/decimal';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { AuditService } from '../audit/audit.service';
import { normalizeTreasuryNetwork } from '../treasury/treasury.constants';
import {
  TreasuryBalanceSnapshotDto,
  TreasurySummaryDto,
} from '../treasury/dto/treasury-response.dto';
import { TreasuryService } from '../treasury/treasury.service';
import { ListReconciliationRunsQueryDto } from './dto/list-reconciliation-runs-query.dto';
import {
  ReconciliationHealthSnapshotDto,
  ReconciliationRunDto,
  ReconciliationWarningItemDto,
} from './dto/reconciliation-response.dto';
import {
  RECONCILIATION_DEFAULT_APPROVED_OUTFLOW_THRESHOLD,
  RECONCILIATION_DEFAULT_INTERVAL_HOURS,
  RECONCILIATION_DEFAULT_PENDING_WITHDRAWAL_THRESHOLD,
  RECONCILIATION_DEFAULT_STALE_SNAPSHOT_HOURS,
  RECONCILIATION_DEFAULT_TOLERANCE,
  RECONCILIATION_FORMULAS,
  RECONCILIATION_SUPPORTED_ASSET,
  RECONCILIATION_SUPPORTED_NETWORKS,
} from './reconciliation.constants';

interface ReconciliationConfigSnapshot {
  asset: string;
  network: string;
  configuredTreasuryWalletAddress: string | null;
  tolerance: number;
  staleSnapshotHours: number;
  highPendingWithdrawalsThreshold: number;
  approvedOutflowThreshold: number;
  enableScheduledRuns: boolean;
  scheduleIntervalHours: number;
}

interface ReconciliationComputationSnapshot {
  treasuryWalletAddress: string | null;
  latestTreasuryBalanceSnapshotId: string | null;
  treasuryBalance: number | null;
  internalClientLiabilities: number;
  pendingDepositsTotal: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
  grossDifference: number | null;
  operationalDifference: number | null;
  status: ReconciliationStatus;
  warnings: ReconciliationWarningItemDto[];
}

interface ReconciliationWarningInput {
  asset: string;
  network: string;
  configuredTreasuryWalletAddress: string | null;
  latestTreasuryBalanceSnapshot: TreasuryBalanceSnapshotDto | null;
  treasuryBalance: number | null;
  internalClientLiabilities: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
  tolerance: number;
  staleSnapshotHours: number;
  highPendingWithdrawalsThreshold: number;
  approvedOutflowThreshold: number;
}

type ReconciliationRunRecord = Prisma.ReconciliationRunGetPayload<{
  include: {
    latestTreasuryBalanceSnapshot: {
      include: {
        createdByUser: {
          select: {
            id: true;
            email: true;
          };
        };
      };
    };
    initiatedByUser: {
      select: {
        id: true;
        email: true;
      };
    };
  };
}>;

export function calculateReconciliationDifferences(args: {
  treasuryBalance: number | null;
  internalClientLiabilities: number;
  approvedButNotSentWithdrawalsTotal: number;
}): {
  grossDifference: number | null;
  operationalDifference: number | null;
} {
  if (args.treasuryBalance === null) {
    return {
      grossDifference: null,
      operationalDifference: null,
    };
  }

  return {
    grossDifference: roundTo(
      args.treasuryBalance - args.internalClientLiabilities,
      8,
    ),
    operationalDifference: roundTo(
      args.treasuryBalance -
        args.internalClientLiabilities -
        args.approvedButNotSentWithdrawalsTotal,
      8,
    ),
  };
}

export function buildReconciliationWarnings(
  input: ReconciliationWarningInput,
): ReconciliationWarningItemDto[] {
  const warnings: ReconciliationWarningItemDto[] = [];
  const supportedNetwork = RECONCILIATION_SUPPORTED_NETWORKS.includes(
    input.network as (typeof RECONCILIATION_SUPPORTED_NETWORKS)[number],
  );

  if (input.asset !== RECONCILIATION_SUPPORTED_ASSET) {
    warnings.push({
      code: 'UNSUPPORTED_ASSET',
      severity: 'critical',
      title: 'Unsupported treasury asset',
      detail: `Alpha reconciliation only supports ${RECONCILIATION_SUPPORTED_ASSET}.`,
    });
  }

  if (!input.configuredTreasuryWalletAddress) {
    warnings.push({
      code: 'TREASURY_CONFIG_MISSING',
      severity: 'critical',
      title: 'Treasury wallet is not configured',
      detail:
        'TREASURY_MASTER_WALLET_ADDRESS must be configured before reconciliation can be trusted.',
    });
  }

  if (!supportedNetwork) {
    warnings.push({
      code: 'UNSUPPORTED_NETWORK',
      severity: 'critical',
      title: 'Unsupported treasury network',
      detail: `Alpha reconciliation does not support ${input.network}.`,
    });
  }

  if (!input.latestTreasuryBalanceSnapshot) {
    warnings.push({
      code: 'TREASURY_BALANCE_SNAPSHOT_MISSING',
      severity: 'critical',
      title: 'Treasury balance snapshot missing',
      detail: 'No treasury balance snapshot is available for the current treasury wallet.',
    });
  } else {
    const snapshotAgeHours =
      (Date.now() - input.latestTreasuryBalanceSnapshot.observedAt.getTime()) /
      (60 * 60 * 1000);

    if (snapshotAgeHours > input.staleSnapshotHours) {
      warnings.push({
        code: 'TREASURY_BALANCE_SNAPSHOT_STALE',
        severity: 'warning',
        title: 'Treasury balance snapshot is stale',
        detail: `Latest treasury balance snapshot is older than ${input.staleSnapshotHours} hours.`,
      });
    }
  }

  const { grossDifference, operationalDifference } =
    calculateReconciliationDifferences({
      treasuryBalance: input.treasuryBalance,
      internalClientLiabilities: input.internalClientLiabilities,
      approvedButNotSentWithdrawalsTotal:
        input.approvedButNotSentWithdrawalsTotal,
    });

  if (grossDifference !== null) {
    if (grossDifference < -input.tolerance) {
      warnings.push({
        code: 'LIABILITIES_EXCEED_TREASURY',
        severity: 'critical',
        title: 'Liabilities exceed treasury',
        detail:
          'Observed treasury balance is below internal client liabilities beyond tolerance.',
      });
    } else if (Math.abs(grossDifference) > input.tolerance) {
      warnings.push({
        code: 'RECONCILIATION_MISMATCH',
        severity: 'warning',
        title: 'Treasury mismatch exceeds tolerance',
        detail: `Gross reconciliation difference exceeds the ${input.tolerance} USDT tolerance.`,
      });
    }
  }

  if (input.pendingWithdrawalsTotal > input.highPendingWithdrawalsThreshold) {
    warnings.push({
      code: 'PENDING_WITHDRAWALS_HIGH',
      severity: 'warning',
      title: 'Pending withdrawals are elevated',
      detail: `Pending withdrawals exceed ${input.highPendingWithdrawalsThreshold} USDT.`,
    });
  }

  if (
    input.approvedButNotSentWithdrawalsTotal > input.approvedOutflowThreshold ||
    (operationalDifference !== null && operationalDifference < -input.tolerance)
  ) {
    warnings.push({
      code: 'APPROVED_WITHDRAWALS_NOT_SENT_HIGH',
      severity:
        operationalDifference !== null && operationalDifference < -input.tolerance
          ? 'critical'
          : 'warning',
      title: 'Approved withdrawals not yet sent',
      detail:
        operationalDifference !== null && operationalDifference < -input.tolerance
          ? 'Approved but not sent withdrawals push the operational difference negative.'
          : `Approved but not sent withdrawals exceed ${input.approvedOutflowThreshold} USDT.`,
    });
  }

  return warnings;
}

export function evaluateReconciliationStatus(
  warnings: ReconciliationWarningItemDto[],
): ReconciliationStatus {
  if (warnings.some((warning) => warning.severity === 'critical')) {
    return ReconciliationStatus.ERROR;
  }

  if (warnings.length > 0) {
    return ReconciliationStatus.WARNING;
  }

  return ReconciliationStatus.OK;
}

@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private scheduledRunHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly treasuryService: TreasuryService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly brokerSettingsService: BrokerSettingsService,
  ) {}

  onModuleInit(): void {
    const config = this.getConfigSnapshot();

    if (!config.enableScheduledRuns) {
      return;
    }

    const intervalMs = config.scheduleIntervalHours * 60 * 60 * 1000;
    this.scheduledRunHandle = setInterval(() => {
      void this.runScheduledReconciliation();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.scheduledRunHandle) {
      clearInterval(this.scheduledRunHandle);
      this.scheduledRunHandle = null;
    }
  }

  async runReconciliation(options?: {
    source?: ReconciliationRunSource;
    initiatedBy?: AuthenticatedUser | null;
  }): Promise<ReconciliationRunDto> {
    const source = options?.source ?? ReconciliationRunSource.ON_DEMAND;
    const initiatedBy = options?.initiatedBy ?? null;
    const config = this.getConfigSnapshot();
    const summary = await this.treasuryService.getSummary();
    const computation = this.computeRun(summary, config);
    const run = await this.prismaService.reconciliationRun.create({
      data: {
        asset: config.asset,
        network: config.network,
        treasuryWalletAddress: computation.treasuryWalletAddress,
        latestTreasuryBalanceSnapshotId: computation.latestTreasuryBalanceSnapshotId,
        treasuryBalance:
          computation.treasuryBalance === null
            ? null
            : toDecimal(computation.treasuryBalance),
        internalClientLiabilities: toDecimal(computation.internalClientLiabilities),
        pendingDepositsTotal: toDecimal(computation.pendingDepositsTotal),
        pendingWithdrawalsTotal: toDecimal(computation.pendingWithdrawalsTotal),
        approvedButNotSentWithdrawalsTotal: toDecimal(
          computation.approvedButNotSentWithdrawalsTotal,
        ),
        grossDifference:
          computation.grossDifference === null
            ? null
            : toDecimal(computation.grossDifference),
        operationalDifference:
          computation.operationalDifference === null
            ? null
            : toDecimal(computation.operationalDifference),
        toleranceUsed: toDecimal(config.tolerance),
        status: computation.status,
        warningsJson: this.toWarningsJson(computation.warnings),
        source,
        initiatedByUserId: initiatedBy?.id ?? null,
      },
      include: {
        latestTreasuryBalanceSnapshot: {
          include: {
            createdByUser: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        initiatedByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (initiatedBy) {
      await this.auditService.log({
        actorUserId: initiatedBy.id,
        actorRole: initiatedBy.role.toLowerCase(),
        action: 'RECONCILIATION_RUN_CREATED',
        entityType: 'reconciliation_run',
        entityId: run.id,
        metadataJson: {
          source,
          status: computation.status,
          treasuryBalance: computation.treasuryBalance,
          internalClientLiabilities: computation.internalClientLiabilities,
          grossDifference: computation.grossDifference,
          operationalDifference: computation.operationalDifference,
          warningCodes: computation.warnings.map((warning) => warning.code),
        } as Prisma.InputJsonValue,
      });
    }

    return this.toRunDto(run);
  }

  async getLatestRun(): Promise<ReconciliationRunDto | null> {
    const latestRun = await this.prismaService.reconciliationRun.findFirst({
      include: {
        latestTreasuryBalanceSnapshot: {
          include: {
            createdByUser: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        initiatedByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return latestRun ? this.toRunDto(latestRun) : null;
  }

  async listRuns(
    query: ListReconciliationRunsQueryDto = {},
  ): Promise<ReconciliationRunDto[]> {
    const runs = await this.prismaService.reconciliationRun.findMany({
      where: {
        status: query.status,
        source: query.source,
        createdAt: {
          gte: this.parseDateBoundary(query.dateFrom, 'start'),
          lte: this.parseDateBoundary(query.dateTo, 'end'),
        },
      },
      include: {
        latestTreasuryBalanceSnapshot: {
          include: {
            createdByUser: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        initiatedByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return runs.map((run) => this.toRunDto(run));
  }

  async getRunById(id: string): Promise<ReconciliationRunDto> {
    const run = await this.prismaService.reconciliationRun.findUnique({
      where: { id },
      include: {
        latestTreasuryBalanceSnapshot: {
          include: {
            createdByUser: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        initiatedByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Reconciliation run not found');
    }

    return this.toRunDto(run);
  }

  async getLatestReconciliationMetrics(): Promise<ReconciliationHealthSnapshotDto> {
    const latestRun = await this.prismaService.reconciliationRun.findFirst({
      select: {
        status: true,
        warningsJson: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const warnings = this.readWarnings(latestRun?.warningsJson);

    return {
      latestStatus: latestRun?.status ?? null,
      latestRunTimestamp: latestRun?.createdAt.toISOString() ?? null,
      warningCount: warnings.length,
      errorState: latestRun?.status === ReconciliationStatus.ERROR,
    };
  }

  private computeRun(
    summary: TreasurySummaryDto,
    config: ReconciliationConfigSnapshot,
  ): ReconciliationComputationSnapshot {
    const treasuryBalance = summary.onChainBalance;
    const { grossDifference, operationalDifference } =
      calculateReconciliationDifferences({
        treasuryBalance,
        internalClientLiabilities: summary.internalClientLiabilities,
        approvedButNotSentWithdrawalsTotal:
          summary.approvedButNotSentWithdrawalsTotal,
      });
    const warnings = buildReconciliationWarnings({
      asset: config.asset,
      network: config.network,
      configuredTreasuryWalletAddress: config.configuredTreasuryWalletAddress,
      latestTreasuryBalanceSnapshot: summary.latestBalanceSnapshot,
      treasuryBalance,
      internalClientLiabilities: summary.internalClientLiabilities,
      pendingWithdrawalsTotal: summary.pendingWithdrawalsTotal,
      approvedButNotSentWithdrawalsTotal:
        summary.approvedButNotSentWithdrawalsTotal,
      tolerance: config.tolerance,
      staleSnapshotHours: config.staleSnapshotHours,
      highPendingWithdrawalsThreshold: config.highPendingWithdrawalsThreshold,
      approvedOutflowThreshold: config.approvedOutflowThreshold,
    });

    return {
      treasuryWalletAddress:
        config.configuredTreasuryWalletAddress ?? summary.walletAddress ?? null,
      latestTreasuryBalanceSnapshotId: summary.latestBalanceSnapshot?.id ?? null,
      treasuryBalance,
      internalClientLiabilities: roundTo(summary.internalClientLiabilities, 8),
      pendingDepositsTotal: roundTo(summary.pendingDepositsTotal, 8),
      pendingWithdrawalsTotal: roundTo(summary.pendingWithdrawalsTotal, 8),
      approvedButNotSentWithdrawalsTotal: roundTo(
        summary.approvedButNotSentWithdrawalsTotal,
        8,
      ),
      grossDifference,
      operationalDifference,
      status: evaluateReconciliationStatus(warnings),
      warnings,
    };
  }

  private getConfigSnapshot(): ReconciliationConfigSnapshot {
    const treasuryWalletSettings = this.brokerSettingsService.getTreasuryWalletSettings();

    return {
      asset:
        (this.configService.get<string>('treasury.asset') ??
          RECONCILIATION_SUPPORTED_ASSET)
          .trim()
          .toUpperCase(),
      network: treasuryWalletSettings.network,
      configuredTreasuryWalletAddress: treasuryWalletSettings.masterWalletAddress,
      tolerance:
        this.configService.get<number>('reconciliation.tolerance') ??
        RECONCILIATION_DEFAULT_TOLERANCE,
      staleSnapshotHours:
        this.configService.get<number>('reconciliation.staleSnapshotHours') ??
        RECONCILIATION_DEFAULT_STALE_SNAPSHOT_HOURS,
      highPendingWithdrawalsThreshold:
        this.configService.get<number>(
          'reconciliation.highPendingWithdrawalsThreshold',
        ) ?? RECONCILIATION_DEFAULT_PENDING_WITHDRAWAL_THRESHOLD,
      approvedOutflowThreshold:
        this.configService.get<number>('reconciliation.approvedOutflowThreshold') ??
        RECONCILIATION_DEFAULT_APPROVED_OUTFLOW_THRESHOLD,
      enableScheduledRuns:
        this.configService.get<boolean>('reconciliation.enableScheduledRuns') ??
        false,
      scheduleIntervalHours:
        this.configService.get<number>('reconciliation.scheduleIntervalHours') ??
        RECONCILIATION_DEFAULT_INTERVAL_HOURS,
    };
  }

  private async runScheduledReconciliation(): Promise<void> {
    try {
      await this.runReconciliation({
        source: ReconciliationRunSource.SCHEDULED,
      });
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : 'Scheduled reconciliation run failed',
      );
    }
  }

  private toRunDto(run: ReconciliationRunRecord): ReconciliationRunDto {
    const warnings = this.readWarnings(run.warningsJson);

    return {
      id: run.id,
      asset: run.asset,
      network: run.network,
      treasuryWalletAddress: run.treasuryWalletAddress,
      latestTreasuryBalanceSnapshotId: run.latestTreasuryBalanceSnapshotId,
      latestTreasuryBalanceSnapshot: run.latestTreasuryBalanceSnapshot
        ? this.toTreasuryBalanceSnapshotDto(run.latestTreasuryBalanceSnapshot)
        : null,
      treasuryBalance:
        run.treasuryBalance === null
          ? null
          : roundTo(toNumber(run.treasuryBalance) ?? 0, 8),
      internalClientLiabilities: roundTo(
        toNumber(run.internalClientLiabilities) ?? 0,
        8,
      ),
      pendingDepositsTotal: roundTo(toNumber(run.pendingDepositsTotal) ?? 0, 8),
      pendingWithdrawalsTotal: roundTo(
        toNumber(run.pendingWithdrawalsTotal) ?? 0,
        8,
      ),
      approvedButNotSentWithdrawalsTotal: roundTo(
        toNumber(run.approvedButNotSentWithdrawalsTotal) ?? 0,
        8,
      ),
      grossDifference:
        run.grossDifference === null
          ? null
          : roundTo(toNumber(run.grossDifference) ?? 0, 8),
      operationalDifference:
        run.operationalDifference === null
          ? null
          : roundTo(toNumber(run.operationalDifference) ?? 0, 8),
      toleranceUsed: roundTo(toNumber(run.toleranceUsed) ?? 0, 8),
      status: run.status,
      warnings,
      warningCount: warnings.length,
      source: run.source,
      initiatedByUserId: run.initiatedByUserId,
      initiatedByUser: run.initiatedByUser,
      formulas: RECONCILIATION_FORMULAS,
      createdAt: run.createdAt,
    };
  }

  private toTreasuryBalanceSnapshotDto(
    snapshot: TreasuryBalanceSnapshot & {
      createdByUser: {
        id: string;
        email: string;
      } | null;
    },
  ): TreasuryBalanceSnapshotDto {
    return {
      id: snapshot.id,
      asset: snapshot.asset,
      network: snapshot.network,
      walletAddress: snapshot.walletAddress,
      balance: roundTo(toNumber(snapshot.balance) ?? 0, 8),
      source: snapshot.source.toLowerCase() as 'manual' | 'api',
      sourceReference: snapshot.sourceReference,
      observedAt: snapshot.observedAt,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      createdByUser: snapshot.createdByUser,
    };
  }

  private readWarnings(
    value: Prisma.JsonValue | null | undefined,
  ): ReconciliationWarningItemDto[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return [];
      }

      const warning = item as Record<string, unknown>;

      if (
        typeof warning.code !== 'string' ||
        typeof warning.severity !== 'string' ||
        typeof warning.title !== 'string' ||
        typeof warning.detail !== 'string'
      ) {
        return [];
      }

      return [
        {
          code: warning.code,
          severity:
            warning.severity === 'critical' ? 'critical' : 'warning',
          title: warning.title,
          detail: warning.detail,
        } satisfies ReconciliationWarningItemDto,
      ];
    });
  }

  private toWarningsJson(
    warnings: ReconciliationWarningItemDto[],
  ): Prisma.InputJsonValue {
    return warnings.map(
      (warning) =>
        ({
          code: warning.code,
          severity: warning.severity,
          title: warning.title,
          detail: warning.detail,
        }) as Prisma.InputJsonObject,
    ) as Prisma.InputJsonArray;
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
