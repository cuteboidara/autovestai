import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  OrderQueueService,
  QueueHealthSummary,
  QueueMetricsSnapshot,
} from '../../common/queue/order-queue.service';
import { RedisService } from '../../common/redis/redis.service';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { CopyTradingQueueService } from '../copy-trading/copy-trading-queue.service';
import { PricingService } from '../pricing/pricing.service';
import { PricingProviderStatus } from '../pricing/providers/pricing-provider.types';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { getTreasuryBalanceSnapshotModel } from '../treasury/treasury.prisma';
import { TradingGateway } from '../trading/trading.gateway';
import { SurveillanceService } from '../surveillance/surveillance.service';

export type HealthIndicatorStatus = 'ok' | 'info' | 'warning' | 'error' | 'degraded';

export interface DependencyHealthCheck {
  status: 'ok' | 'warning' | 'error';
  connected: boolean;
  summary: string;
  detail: string;
  recommendedAction: string | null;
}

export interface QueueHealthCheck {
  status: 'ok' | 'warning' | 'error';
  summary: string;
  totalBacklog: number;
  totalFailed: number;
  orderExecution: QueueHealthSummary;
  copyTrading: QueueHealthSummary;
  recommendedAction: string | null;
}

export interface WebsocketHealthCheck {
  status: 'ok' | 'info';
  connectedClients: number;
  summary: string;
  recommendedAction: string | null;
}

export interface ReadinessField {
  label: string;
  value: string;
}

export interface ReadinessChecklistEntry {
  key: string;
  label: string;
  category: 'infra' | 'providers' | 'operations' | 'config';
  status: HealthIndicatorStatus;
  summary: string;
  detail?: string | null;
  fields?: ReadinessField[];
  action?: string | null;
}

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
    infrastructure: {
      database: DependencyHealthCheck;
      redis: DependencyHealthCheck;
      queues: QueueHealthCheck;
      websocket: WebsocketHealthCheck;
    };
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
      database,
      redis,
      queues,
      openPositions,
      pendingWithdrawals,
      orderQueue,
      copyQueue,
      surveillanceAlertCounts,
      reconciliation,
    ] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
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
      infrastructure: {
        database,
        redis,
        queues,
        websocket: this.checkWebsocket(),
      },
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

  async getReadinessChecklist(): Promise<ReadinessChecklistEntry[]> {
    const treasuryWalletSettings = this.brokerSettingsService.getTreasuryWalletSettings();
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
          network: treasuryWalletSettings.network,
          walletAddress: treasuryWalletSettings.masterWalletAddress || undefined,
        },
        orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.reconciliationService.getLatestReconciliationMetrics(),
    ]);

    const symbolConfigs = this.brokerSettingsService.getAllSymbolConfigs();
    const treasuryWalletAddress = treasuryWalletSettings.masterWalletAddress ?? '';
    const treasurySnapshotStaleHours =
      this.configService.get<number>('treasury.staleSnapshotHours') ?? 24;
    const treasurySnapshotAgeHours = latestTreasurySnapshot
      ? (Date.now() - latestTreasurySnapshot.observedAt.getTime()) / (60 * 60 * 1000)
      : null;

    const providerItems = Object.entries(metrics.providerHealth).map(([key, provider]) =>
      this.buildProviderReadinessItem(key, provider),
    );
    const sampleQuoteHealthyCount = metrics.sampleQuotes.filter((sample) => sample.lastPrice !== null)
      .length;
    const delayedSampleCount = metrics.sampleQuotes.filter((sample) => sample.delayed).length;

    return [
      {
        key: 'db_connected',
        label: 'DB connected',
        category: 'infra',
        status: database.status,
        summary: database.summary,
        detail: database.detail,
        action: database.recommendedAction,
      },
      {
        key: 'redis_connected',
        label: 'Redis connected',
        category: 'infra',
        status: redis.status,
        summary: redis.summary,
        detail: redis.detail,
        action: redis.recommendedAction,
      },
      {
        key: 'queues_healthy',
        label: 'Queues healthy',
        category: 'infra',
        status: queues.status,
        summary: queues.summary,
        fields: [
          { label: 'Order queue', value: queues.orderExecution.summary },
          { label: 'Copy queue', value: queues.copyTrading.summary },
        ],
        action: queues.recommendedAction,
      },
      {
        key: 'websocket_clients',
        label: 'WebSocket clients',
        category: 'infra',
        status: metrics.infrastructure.websocket.status,
        summary: metrics.infrastructure.websocket.summary,
        action: metrics.infrastructure.websocket.recommendedAction,
      },
      {
        key: 'migrations_applied',
        label: 'Migrations applied',
        category: 'config',
        status: migrationCount > 0 ? 'ok' : 'warning',
        summary:
          migrationCount > 0
            ? `${migrationCount} Prisma migrations found`
            : 'No Prisma migrations detected yet',
      },
      {
        key: 'seeded_super_admin_present',
        label: 'Seeded super admin present',
        category: 'config',
        status: seededSuperAdmin ? 'ok' : 'error',
        summary: seededSuperAdmin
          ? `Seeded super admin ${seededSuperAdmin.email} is present`
          : 'Seeded super admin is missing',
      },
      {
        key: 'broker_settings_configured',
        label: 'Broker settings configured',
        category: 'config',
        status: brokerSettings > 0 ? 'ok' : 'error',
        summary: `${brokerSettings} broker settings rows present`,
      },
      {
        key: 'symbol_configs_configured',
        label: 'Symbol configs configured',
        category: 'config',
        status: symbolConfigs.length > 0 ? 'ok' : 'error',
        summary: `${symbolConfigs.length} symbol configs loaded`,
      },
      {
        key: 'kyc_workflow_enabled',
        label: 'KYC workflow enabled',
        category: 'operations',
        status: 'ok',
        summary: 'KYC submission and admin review endpoints are available.',
      },
      {
        key: 'withdrawal_review_controls_active',
        label: 'Withdrawal review controls active',
        category: 'operations',
        status: 'ok',
        summary: 'Pending withdrawal approval flow is active.',
      },
      {
        key: 'treasury_wallet_configured',
        label: 'Treasury wallet configured',
        category: 'config',
        status: treasuryWalletAddress ? 'ok' : 'warning',
        summary: treasuryWalletAddress || 'TREASURY_MASTER_WALLET_ADDRESS not configured',
        action: treasuryWalletAddress
          ? null
          : 'Set TREASURY_MASTER_WALLET_ADDRESS before enabling automated treasury workflows.',
      },
      {
        key: 'treasury_snapshot_fresh',
        label: 'Treasury snapshot fresh',
        category: 'operations',
        status:
          latestTreasurySnapshot && treasurySnapshotAgeHours !== null
            ? treasurySnapshotAgeHours <= treasurySnapshotStaleHours
              ? 'ok'
              : 'warning'
            : 'warning',
        summary: latestTreasurySnapshot
          ? `Latest treasury snapshot observed ${treasurySnapshotAgeHours?.toFixed(1)} hours ago`
          : 'No treasury balance snapshot recorded yet',
      },
      {
        key: 'reconciliation_run_present',
        label: 'Reconciliation run present',
        category: 'operations',
        status: latestReconciliation.latestRunTimestamp ? 'ok' : 'warning',
        summary:
          latestReconciliation.latestRunTimestamp ??
          'No reconciliation run has been persisted yet',
      },
      {
        key: 'reconciliation_latest_status',
        label: 'Reconciliation latest status',
        category: 'operations',
        status:
          latestReconciliation.latestStatus === 'ERROR'
            ? 'error'
            : latestReconciliation.latestStatus === 'WARNING'
            ? 'warning'
            : latestReconciliation.latestStatus === 'OK'
            ? 'ok'
            : 'warning',
        summary: latestReconciliation.latestStatus
          ? `${latestReconciliation.latestStatus} with ${latestReconciliation.warningCount} warning(s)`
          : 'No reconciliation status available yet',
      },
      {
        key: 'audit_logging_active',
        label: 'Audit logging active',
        category: 'operations',
        status: 'ok',
        summary: 'Audit logging module is loaded and admin audit endpoints are available.',
      },
      {
        key: 'surveillance_active',
        label: 'Surveillance active',
        category: 'operations',
        status: 'ok',
        summary: `${Object.values(metrics.surveillanceAlertCounts).reduce(
          (sum, value) => sum + Number(value),
          0,
        )} alert counts currently tracked`,
      },
      {
        key: 'frontend_env_configured',
        label: 'Frontend env configured',
        category: 'config',
        status: this.configService.get<string>('app.frontendUrl') ? 'ok' : 'warning',
        summary:
          this.configService.get<string>('app.frontendUrl') ??
          'FRONTEND_URL not configured',
      },
      {
        key: 'tradingview_assets',
        label: 'TradingView assets present / fallback active',
        category: 'config',
        status:
          process.env.FRONTEND_TRADINGVIEW_ASSETS_ENABLED === 'true'
            ? 'ok'
            : 'warning',
        summary:
          process.env.FRONTEND_TRADINGVIEW_ASSETS_ENABLED === 'true'
            ? 'TradingView charting assets flagged as present'
            : 'Fallback chart mode assumed until frontend TradingView assets are supplied',
      },
      {
        key: 'market_data_coverage',
        label: 'Market data coverage',
        category: 'providers',
        status:
          sampleQuoteHealthyCount === metrics.sampleQuotes.length
            ? delayedSampleCount > 0
              ? 'degraded'
              : 'ok'
            : 'warning',
        summary: `${sampleQuoteHealthyCount}/${metrics.sampleQuotes.length} sample markets have quotes${
          delayedSampleCount > 0 ? `; ${delayedSampleCount} are delayed.` : '.'
        }`,
        fields: metrics.sampleQuotes.map((sample) => ({
          label: sample.symbol,
          value:
            sample.lastPrice !== null
              ? `${sample.provider ?? 'unknown'} ${sample.lastPrice} @ ${sample.lastUpdated ?? 'unknown'}`
              : 'No quote cached',
        })),
        action:
          sampleQuoteHealthyCount === metrics.sampleQuotes.length
            ? null
            : 'Restore coverage for the missing sample markets before enabling full trading for those symbols.',
      },
      ...providerItems,
    ];
  }

  private async checkDatabase(): Promise<DependencyHealthCheck> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        connected: true,
        summary: 'Database responded successfully.',
        detail: 'Database responded to SELECT 1.',
        recommendedAction: null,
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        summary: 'Database readiness check failed.',
        detail:
          error instanceof Error ? error.message : 'Database check failed',
        recommendedAction: 'Check DATABASE_URL, Prisma connectivity, and database availability.',
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealthCheck> {
    try {
      const response = await this.redisService.getClient().ping();
      return {
        status: response === 'PONG' ? 'ok' : 'warning',
        connected: response === 'PONG',
        summary:
          response === 'PONG'
            ? 'Redis responded successfully.'
            : `Redis responded with ${response}.`,
        detail: `Redis responded with ${response}.`,
        recommendedAction:
          response === 'PONG'
            ? null
            : 'Check Redis health and connection stability.',
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        summary: 'Redis readiness check failed.',
        detail: error instanceof Error ? error.message : 'Redis check failed',
        recommendedAction: 'Check REDIS_URL and Redis server availability.',
      };
    }
  }

  private async checkQueues(): Promise<QueueHealthCheck> {
    try {
      const [orderQueue, copyQueue] = await Promise.all([
        this.orderQueueService.getQueueMetrics(),
        this.copyTradingQueueService.getQueueMetrics(),
      ]);
      const orderSummary = this.toQueueHealthSummary('Order execution', orderQueue);
      const copySummary = this.toQueueHealthSummary('Copy trading', copyQueue);
      const totalFailed = orderSummary.failed + copySummary.failed;
      const totalBacklog = orderSummary.backlog + copySummary.backlog;

      return {
        status: totalFailed > 0 ? 'warning' : 'ok',
        summary:
          totalFailed > 0
            ? `${totalFailed} failed queue job(s); backlog ${totalBacklog}.`
            : totalBacklog > 0
              ? `Queues are healthy with backlog ${totalBacklog}.`
              : 'Queues are healthy and idle.',
        totalBacklog,
        totalFailed,
        orderExecution: orderSummary,
        copyTrading: copySummary,
        recommendedAction:
          totalFailed > 0
            ? 'Review failed queue jobs and retry or purge the stuck jobs.'
            : null,
      };
    } catch (error) {
      return {
        status: 'error',
        summary: 'Queue health check failed.',
        totalBacklog: 0,
        totalFailed: 0,
        orderExecution: this.emptyQueueHealthSummary('Order execution'),
        copyTrading: this.emptyQueueHealthSummary('Copy trading'),
        recommendedAction:
          'Check Redis/BullMQ connectivity before relying on asynchronous order processing.',
      };
    }
  }

  private checkWebsocket(): WebsocketHealthCheck {
    const connectedClients = this.tradingGateway.getConnectedClientCount();

    if (connectedClients === 0) {
      return {
        status: 'info',
        connectedClients,
        summary: 'No realtime websocket clients are currently connected.',
        recommendedAction:
          'This is neutral unless users or admins are expected to be on live trading pages right now.',
      };
    }

    return {
      status: 'ok',
      connectedClients,
      summary: `${connectedClients} realtime websocket client(s) connected.`,
      recommendedAction: null,
    };
  }

  private toQueueHealthSummary(label: string, metrics: QueueMetricsSnapshot): QueueHealthSummary {
    const backlog = metrics.waiting + metrics.active + metrics.delayed;
    const status: QueueHealthSummary['status'] = metrics.failed > 0 ? 'DEGRADED' : 'OK';

    return {
      name: metrics.name,
      status,
      backlog,
      active: metrics.active,
      waiting: metrics.waiting,
      delayed: metrics.delayed,
      failed: metrics.failed,
      completed: metrics.completed,
      summary:
        metrics.failed > 0
          ? `${label}: ${metrics.failed} failed, backlog ${backlog}.`
          : backlog > 0
            ? `${label}: backlog ${backlog}, active ${metrics.active}.`
            : `${label}: idle and healthy.`,
      recommendedAction:
        metrics.failed > 0
          ? `Inspect failed ${label.toLowerCase()} jobs and retry if safe.`
          : null,
    };
  }

  private emptyQueueHealthSummary(label: string): QueueHealthSummary {
    return {
      name: label,
      status: 'DISCONNECTED',
      backlog: 0,
      active: 0,
      waiting: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      summary: `${label}: unavailable.`,
      recommendedAction: null,
    };
  }

  private buildProviderReadinessItem(
    key: string,
    provider: PricingProviderStatus,
  ): ReadinessChecklistEntry {
    return {
      key: `provider_${key}`,
      label: this.formatProviderLabel(provider.provider),
      category: 'providers',
      status: this.mapProviderStatus(provider.status),
      summary: this.providerSummary(provider),
      fields: [
        { label: 'Status', value: provider.status },
        { label: 'Reason', value: provider.reason ?? 'none' },
        { label: 'Symbols', value: String(provider.symbolCount) },
        {
          label: 'Last update',
          value: provider.lastUpdateAt ?? 'No successful update yet',
        },
        ...(provider.retryAt
          ? [{ label: 'Retry at', value: provider.retryAt }]
          : []),
      ],
      detail: provider.message,
      action: provider.recommendedAction,
    };
  }

  private mapProviderStatus(status: PricingProviderStatus['status']): HealthIndicatorStatus {
    switch (status) {
      case 'OK':
        return 'ok';
      case 'RATE_LIMITED':
      case 'DEGRADED':
        return 'degraded';
      case 'DISABLED':
        return 'info';
      case 'MISCONFIGURED':
      case 'DISCONNECTED':
        return 'warning';
      default:
        return 'warning';
    }
  }

  private providerSummary(provider: PricingProviderStatus): string {
    switch (provider.status) {
      case 'OK':
        return `${provider.symbolCount} symbols active via ${provider.transport}.`;
      case 'DISABLED':
        return provider.message ?? 'Provider intentionally disabled.';
      case 'MISCONFIGURED':
        return provider.message ?? 'Provider configuration is incomplete.';
      case 'RATE_LIMITED':
        return provider.message ?? 'Provider is rate limited; fallback coverage should absorb the gap.';
      case 'DISCONNECTED':
        return provider.message ?? 'Provider is unreachable from this environment.';
      case 'DEGRADED':
      default:
        return provider.message ?? 'Provider health is degraded.';
    }
  }

  private formatProviderLabel(provider: string): string {
    switch (provider) {
      case 'coingecko':
        return 'CoinGecko';
      case 'binance':
        return 'Binance';
      case 'twelve-data':
        return 'Twelve Data';
      case 'forex-api':
        return 'Forex API';
      case 'yahoo-finance':
        return 'Yahoo Finance';
      default:
        return provider;
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
