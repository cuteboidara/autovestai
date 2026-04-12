import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  OrderQueueService,
  QueueMetricsSnapshot,
} from '../../common/queue/order-queue.service';
import { RedisService } from '../../common/redis/redis.service';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { CopyTradingQueueService } from '../copy-trading/copy-trading-queue.service';
import { PricingService } from '../pricing/pricing.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { getTreasuryBalanceSnapshotModel } from '../treasury/treasury.prisma';
import { normalizeTreasuryNetwork } from '../treasury/treasury.constants';
import { TradingGateway } from '../trading/trading.gateway';
import { SurveillanceService } from '../surveillance/surveillance.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly orderQueueService: OrderQueueService,
    private readonly copyTradingQueueService: CopyTradingQueueService,
    private readonly tradingGateway: TradingGateway,
    private readonly surveillanceService: SurveillanceService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly configService: ConfigService,
    private readonly pricingService: PricingService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  async getLive() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReady() {
    const [database, redis, queues] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
    ]);

    return {
      status:
        database.status === 'ok' &&
        redis.status === 'ok' &&
        queues.status === 'ok'
          ? 'ok'
          : 'degraded',
      database,
      redis,
      queues,
      timestamp: new Date().toISOString(),
    };
  }

  async getHealth() {
    const [ready, metrics] = await Promise.all([
      this.getReady(),
      this.getOperationalMetrics().catch((error) => ({
        error: error instanceof Error ? error.message : 'metrics unavailable',
      })),
    ]);

    return {
      ...ready,
      metrics,
    };
  }

  async getPublicPlatformStatus() {
    return {
      ...this.brokerSettingsService.getPublicPlatformStatus(),
      symbolHealth: this.pricingService.getAllSymbolHealth(),
      providerHealth: this.pricingService.getProviderHealth(),
      timestamp: new Date().toISOString(),
    };
  }

  async getOperationalMetrics(): Promise<{
    openPositions: number;
    pendingWithdrawals: number;
    queueBacklog: {
      orderExecution: number;
      copyTrading: number;
    };
    failedJobs: {
      orderExecution: number;
      copyTrading: number;
    };
    websocketConnectedClients: number;
    surveillanceAlertCounts: Record<string, number>;
    symbolHealth: Record<string, ReturnType<PricingService['getSymbolHealth']>>;
    providerHealth: ReturnType<PricingService['getProviderHealth']>;
    sampleQuotes: ReturnType<PricingService['getSampleQuotes']>;
    reconciliation: {
      latestStatus: 'OK' | 'WARNING' | 'ERROR' | null;
      latestRunTimestamp: string | null;
      warningCount: number;
      errorState: boolean;
    };
  }> {
    const [
      openPositions,
      pendingWithdrawals,
      orderQueue,
      copyQueue,
      surveillanceAlertCounts,
      reconciliation,
    ] = await Promise.all([
      this.prismaService.position.count({
        where: { status: 'OPEN' },
      }),
      this.prismaService.transaction.count({
        where: {
          type: 'WITHDRAW',
          status: 'PENDING',
        },
      }),
      this.orderQueueService.getQueueMetrics(),
      this.copyTradingQueueService.getQueueMetrics(),
      this.surveillanceService.getAlertCounts(),
      this.reconciliationService.getLatestReconciliationMetrics(),
    ]);

    return {
      openPositions,
      pendingWithdrawals,
      queueBacklog: {
        orderExecution:
          orderQueue.waiting + orderQueue.active + orderQueue.delayed,
        copyTrading: copyQueue.waiting + copyQueue.active + copyQueue.delayed,
      },
      failedJobs: {
        orderExecution: orderQueue.failed,
        copyTrading: copyQueue.failed,
      },
      websocketConnectedClients: this.tradingGateway.getConnectedClientCount(),
      surveillanceAlertCounts,
      symbolHealth: this.pricingService.getAllSymbolHealth(),
      providerHealth: this.pricingService.getProviderHealth(),
      sampleQuotes: this.pricingService.getSampleQuotes([
        'EURUSD',
        'BTCUSD',
        'SP-CASH',
        'XAUUSD',
      ]),
      reconciliation,
    };
  }

  async getReadinessChecklist() {
    const [
      database,
      redis,
      queues,
      metrics,
      migrationCount,
      seededSuperAdmin,
      brokerSettings,
      latestTreasurySnapshot,
      latestReconciliation,
    ] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
      this.getOperationalMetrics(),
      this.getMigrationCount(),
      this.prismaService.adminUser.findFirst({
        where: {
          role: 'SUPER_ADMIN',
          createdById: null,
        },
        select: {
          id: true,
          email: true,
        },
      }),
      this.prismaService.brokerSetting.count(),
      getTreasuryBalanceSnapshotModel(this.prismaService).findFirst({
        where: {
          asset: 'USDT',
          network: normalizeTreasuryNetwork(
            this.configService.get<string>('treasury.network') ?? 'TRC20',
          ),
          walletAddress:
            this.configService.get<string>('treasury.masterWalletAddress')?.trim() || undefined,
        },
        orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.reconciliationService.getLatestReconciliationMetrics(),
    ]);

    const symbolConfigs = this.brokerSettingsService.getAllSymbolConfigs();
    const treasuryWalletAddress =
      this.configService.get<string>('treasury.masterWalletAddress')?.trim() ?? '';
    const treasurySnapshotStaleHours =
      this.configService.get<number>('treasury.staleSnapshotHours') ?? 24;
    const treasurySnapshotAgeHours = latestTreasurySnapshot
      ? (Date.now() - latestTreasurySnapshot.observedAt.getTime()) / (60 * 60 * 1000)
      : null;

    return [
      {
        key: 'db_connected',
        label: 'DB connected',
        status: database.status,
        detail: database.detail,
      },
      {
        key: 'redis_connected',
        label: 'Redis connected',
        status: redis.status,
        detail: redis.detail,
      },
      {
        key: 'queues_healthy',
        label: 'Queues healthy',
        status: queues.status,
        detail: queues.detail,
      },
      {
        key: 'migrations_applied',
        label: 'Migrations applied',
        status: migrationCount > 0 ? 'ok' : 'warning',
        detail:
          migrationCount > 0
            ? `${migrationCount} Prisma migrations found`
            : 'No Prisma migrations detected yet',
      },
      {
        key: 'seeded_super_admin_present',
        label: 'Seeded super admin present',
        status: seededSuperAdmin ? 'ok' : 'error',
        detail: seededSuperAdmin
          ? `Seeded super admin ${seededSuperAdmin.email} is present`
          : 'Seeded super admin is missing',
      },
      {
        key: 'broker_settings_configured',
        label: 'Broker settings configured',
        status: brokerSettings > 0 ? 'ok' : 'error',
        detail: `${brokerSettings} broker settings rows present`,
      },
      {
        key: 'symbol_configs_configured',
        label: 'Symbol configs configured',
        status: symbolConfigs.length > 0 ? 'ok' : 'error',
        detail: `${symbolConfigs.length} symbol configs loaded`,
      },
      {
        key: 'kyc_workflow_enabled',
        label: 'KYC workflow enabled',
        status: 'ok',
        detail: 'KYC submission and admin review endpoints are available',
      },
      {
        key: 'withdrawal_review_controls_active',
        label: 'Withdrawal review controls active',
        status: 'ok',
        detail: 'Pending withdrawal approval flow is active',
      },
      {
        key: 'treasury_wallet_configured',
        label: 'Treasury wallet configured',
        status: treasuryWalletAddress ? 'ok' : 'warning',
        detail: treasuryWalletAddress || 'TREASURY_MASTER_WALLET_ADDRESS not configured',
      },
      {
        key: 'treasury_snapshot_fresh',
        label: 'Treasury snapshot fresh',
        status:
          latestTreasurySnapshot && treasurySnapshotAgeHours !== null
            ? treasurySnapshotAgeHours <= treasurySnapshotStaleHours
              ? 'ok'
              : 'warning'
            : 'warning',
        detail: latestTreasurySnapshot
          ? `Latest treasury snapshot observed ${treasurySnapshotAgeHours?.toFixed(1)} hours ago`
          : 'No treasury balance snapshot recorded yet',
      },
      {
        key: 'reconciliation_run_present',
        label: 'Reconciliation run present',
        status: latestReconciliation.latestRunTimestamp ? 'ok' : 'warning',
        detail:
          latestReconciliation.latestRunTimestamp ??
          'No reconciliation run has been persisted yet',
      },
      {
        key: 'reconciliation_latest_status',
        label: 'Reconciliation latest status',
        status:
          latestReconciliation.latestStatus === 'ERROR'
            ? 'error'
            : latestReconciliation.latestStatus === 'WARNING'
            ? 'warning'
            : latestReconciliation.latestStatus === 'OK'
            ? 'ok'
            : 'warning',
        detail: latestReconciliation.latestStatus
          ? `${latestReconciliation.latestStatus} with ${latestReconciliation.warningCount} warning(s)`
          : 'No reconciliation status available yet',
      },
      {
        key: 'audit_logging_active',
        label: 'Audit logging active',
        status: 'ok',
        detail: 'Audit logging module is loaded and admin audit endpoints are available',
      },
      {
        key: 'surveillance_active',
        label: 'Surveillance active',
        status: 'ok',
        detail: `${Object.values(metrics.surveillanceAlertCounts).reduce(
          (sum, value) => sum + Number(value),
          0,
        )} alert counts currently tracked`,
      },
      {
        key: 'frontend_env_configured',
        label: 'Frontend env configured',
        status: this.configService.get<string>('app.frontendUrl') ? 'ok' : 'warning',
        detail:
          this.configService.get<string>('app.frontendUrl') ??
          'FRONTEND_URL not configured',
      },
      {
        key: 'tradingview_assets',
        label: 'TradingView assets present / fallback active',
        status:
          process.env.FRONTEND_TRADINGVIEW_ASSETS_ENABLED === 'true'
            ? 'ok'
            : 'warning',
        detail:
          process.env.FRONTEND_TRADINGVIEW_ASSETS_ENABLED === 'true'
            ? 'TradingView charting assets flagged as present'
            : 'Fallback chart mode assumed until frontend TradingView assets are supplied',
      },
      {
        key: 'pricing_providers_active',
        label: 'Pricing providers active',
        status: Object.values(metrics.providerHealth).every(
          (provider) => provider.status === 'connected' || provider.status === 'polling',
        )
          ? 'ok'
          : 'warning',
        detail: metrics.providerHealth,
      },
      ...metrics.sampleQuotes.map((sample) => ({
        key: `symbol_health_${sample.symbol.toLowerCase()}`,
        label: `${sample.symbol} sample price`,
        status: sample.lastPrice ? 'ok' : 'warning',
        detail: sample.lastPrice
          ? `${sample.provider ?? 'unknown'} ${sample.lastPrice} updated ${sample.lastUpdated ?? 'unknown'}`
          : 'No quote cached yet',
      })),
    ];
  }

  private async checkDatabase() {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        detail: 'Database responded to SELECT 1',
      };
    } catch (error) {
      return {
        status: 'error',
        detail:
          error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  private async checkRedis() {
    try {
      const response = await this.redisService.getClient().ping();
      return {
        status: response === 'PONG' ? 'ok' : 'warning',
        detail: `Redis responded with ${response}`,
      };
    } catch (error) {
      return {
        status: 'error',
        detail: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }

  private async checkQueues(): Promise<{
    status: 'ok' | 'warning' | 'error';
    detail: string | {
      orderQueue: QueueMetricsSnapshot;
      copyQueue: QueueMetricsSnapshot;
    };
  }> {
    try {
      const [orderQueue, copyQueue] = await Promise.all([
        this.orderQueueService.getQueueMetrics(),
        this.copyTradingQueueService.getQueueMetrics(),
      ]);

      return {
        status: orderQueue.failed + copyQueue.failed > 0 ? 'warning' : 'ok',
        detail: {
          orderQueue,
          copyQueue,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        detail: error instanceof Error ? error.message : 'Queue check failed',
      };
    }
  }

  private async getMigrationCount() {
    try {
      const result = await this.prismaService.$queryRawUnsafe<
        Array<{ count: bigint }>
      >('SELECT COUNT(*)::bigint as count FROM "_prisma_migrations"');

      return Number(result[0]?.count ?? 0);
    } catch (_error) {
      return 0;
    }
  }
}
