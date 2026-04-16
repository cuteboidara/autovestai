'use client';

import { useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Panel } from '@/components/ui/panel';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { kycApi } from '@/services/api/kyc';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils';
import { useAdminStore } from '@/store/admin-store';
import {
  AdminOpenPosition,
  AdminOverview,
  OperationalMetrics,
  ReadinessChecklistItem,
} from '@/types/admin';
import { KycSubmission } from '@/types/kyc';
import { WalletTransaction } from '@/types/wallet';

function formatProviderLabel(provider: string) {
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

function formatProviderReason(reason: string | null) {
  return reason ? reason.replace(/_/g, ' ') : 'none';
}

export default function AdminOverviewPage() {
  const { hasPermission } = useAuth();
  const exposure = useAdminStore((state) => state.exposure);
  const hedgeActions = useAdminStore((state) => state.hedgeActions);
  const setExposure = useAdminStore((state) => state.setExposure);
  const setHedgeActions = useAdminStore((state) => state.setHedgeActions);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [readinessPreview, setReadinessPreview] = useState<ReadinessChecklistItem[]>([]);
  const [recentKyc, setRecentKyc] = useState<KycSubmission[]>([]);
  const [recentWalletRequests, setRecentWalletRequests] = useState<WalletTransaction[]>([]);
  const [openPositionsPreview, setOpenPositionsPreview] = useState<AdminOpenPosition[]>([]);
  const canViewOverview = hasPermission('dashboard.view');
  const canViewMetrics = hasPermission('health.view');
  const canViewReadiness = hasPermission('readiness.view');

  useEffect(() => {
    if (!canViewOverview && !canViewMetrics && !canViewReadiness) {
      return;
    }

    let active = true;

    async function load() {
      const [overviewResponse, metricsResponse, readinessResponse, kycResponse, walletResponse, openPositionsResponse] = await Promise.all([
        canViewOverview ? adminApi.getOverview() : Promise.resolve(null),
        canViewMetrics ? adminApi.getMetrics() : Promise.resolve(null),
        canViewReadiness ? adminApi.getReadiness() : Promise.resolve([]),
        hasPermission('kyc.approve') ? kycApi.listAdmin().catch(() => []) : Promise.resolve([]),
        hasPermission('transactions.view')
          ? adminApi.listPendingTransactions().catch(() => [])
          : Promise.resolve([]),
        canViewOverview ? adminApi.listOpenPositions().catch(() => []) : Promise.resolve([]),
      ]);

      if (!active) {
        return;
      }

      setOverview(overviewResponse);
      setMetrics(metricsResponse);
      const nonOkReadiness = readinessResponse.filter((item) => item.status !== 'ok');
      setReadinessPreview((nonOkReadiness.length > 0 ? nonOkReadiness : readinessResponse).slice(0, 5));
      setRecentKyc(kycResponse.slice(0, 5));
      setRecentWalletRequests(walletResponse.slice(0, 5));
      setOpenPositionsPreview(openPositionsResponse.slice(0, 8));

      if (overviewResponse) {
        setExposure(overviewResponse.exposure);
        setHedgeActions(overviewResponse.hedgeActions);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [
    canViewMetrics,
    canViewOverview,
    canViewReadiness,
    setExposure,
    setHedgeActions,
  ]);

  if (!canViewOverview) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Backoffice"
          title="Broker operations overview"
          description="Live operational summary for users, balances, exposure, KYC, copy trading, wallet operations, and commissions."
        />
        <PermissionDenied
          title="Overview unavailable"
          description="This admin account does not have permission to view the broker operations overview."
          requiredPermission="dashboard.view"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Backoffice"
        title="Operations Overview"
        description="Live operational summary for users, balances, exposure, KYC, copy trading, wallet operations, and commissions."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={overview?.totalUsers ?? '--'} />
        <StatCard label="Pending KYC" value={overview?.pendingKyc ?? '--'} />
        <StatCard label="Pending Deposits" value={overview?.pendingDeposits ?? '--'} />
        <StatCard label="Open Positions" value={overview?.openPositions ?? '--'} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Users" value={overview?.activeUsers ?? '--'} />
        <StatCard
          label="Total Balances"
          value={overview ? formatCurrency(overview.totalBalances) : '--'}
        />
        <StatCard label="Pending Withdrawals" value={overview?.pendingWithdrawals ?? '--'} />
        <StatCard
          label="Copy Trading"
          value={overview ? overview.copyTrading.masters : '--'}
          helper={overview ? `${overview.copyTrading.followers} followers • ${overview.copyTrading.trades} trades` : undefined}
        />
      </div>

      <Panel
        title="Treasury"
        description="Master wallet addresses and pending withdrawal pressure."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
          <div className="rounded-2xl border border-border bg-page p-4">
            <p className="label-eyebrow">TRC20 Master Wallet</p>
            <p className="mt-3 break-all font-mono text-sm text-primary">
              {overview?.treasury.masterWalletTrc20 ?? 'Not configured'}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-page p-4">
            <p className="label-eyebrow">ERC20 Master Wallet</p>
            <p className="mt-3 break-all font-mono text-sm text-primary">
              {overview?.treasury.masterWalletErc20 ?? 'Not configured'}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-page p-4">
            <p className="label-eyebrow">Pending Withdrawals</p>
            <p className="mt-3 text-2xl font-semibold text-primary">
              {overview ? formatCurrency(overview.treasury.pendingWithdrawalAmount) : '--'}
            </p>
            <p className="mt-2 text-sm text-secondary">
              Check treasury balance before approving payouts.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent KYC Submissions" description="Latest manual compliance items requiring review.">
          <DataTable
            columns={[
              {
                key: 'user',
                header: 'User',
                render: (item) => item.user?.email ?? item.fullName ?? '--',
              },
              {
                key: 'submitted',
                header: 'Submitted',
                render: (item) => formatDateTime(item.createdAt ?? ''),
              },
              {
                key: 'documents',
                header: 'Documents',
                render: (item) =>
                  [item.documentFrontUrl, item.documentBackUrl, item.selfieUrl].filter(Boolean).length,
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => <StatusBadge value={item.status} />,
              },
            ]}
            data={recentKyc}
            rowKey={(item) => item.id ?? item.userId ?? item.createdAt ?? Math.random().toString()}
            emptyTitle="No recent KYC cases"
            emptyDescription="Manual KYC submissions will appear here."
          />
        </Panel>

        <Panel title="Recent Wallet Requests" description="Pending deposit and withdrawal approvals waiting for review.">
          <DataTable
            columns={[
              {
                key: 'user',
                header: 'User',
                render: (item) => item.userId,
              },
              { key: 'type', header: 'Type', render: (item) => item.type },
              {
                key: 'amount',
                header: 'Amount',
                align: 'right',
                render: (item) => formatCurrency(item.amount),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => <StatusBadge value={item.status} />,
              },
            ]}
            data={recentWalletRequests}
            rowKey={(item) => item.id}
            emptyTitle="No pending wallet requests"
            emptyDescription="Pending deposit and withdrawal requests will appear here."
          />
        </Panel>
      </div>

      {canViewMetrics || canViewReadiness ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          {canViewMetrics ? (
            <Panel
              title="Platform Health"
              description="Infrastructure runtime, provider coverage, and sampled market data health."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0 rounded-2xl border border-border bg-page p-4">
                  <div className="flex items-center justify-between">
                    <p className="label-eyebrow">Database</p>
                    <StatusBadge value={metrics?.infrastructure.database.status ?? 'warning'} />
                  </div>
                  <p className="mt-3 break-words text-sm text-secondary">
                    {metrics?.infrastructure.database.summary ?? 'Loading database health...'}
                  </p>
                </div>
                <div className="min-w-0 rounded-2xl border border-border bg-page p-4">
                  <div className="flex items-center justify-between">
                    <p className="label-eyebrow">Redis</p>
                    <StatusBadge value={metrics?.infrastructure.redis.status ?? 'warning'} />
                  </div>
                  <p className="mt-3 break-words text-sm text-secondary">
                    {metrics?.infrastructure.redis.summary ?? 'Loading Redis health...'}
                  </p>
                </div>
                <div className="min-w-0 rounded-2xl border border-border bg-page p-4">
                  <div className="flex items-center justify-between">
                    <p className="label-eyebrow">Queues</p>
                    <StatusBadge value={metrics?.infrastructure.queues.status ?? 'warning'} />
                  </div>
                  <p className="mt-3 break-words text-sm text-secondary">
                    {metrics?.infrastructure.queues.summary ?? 'Loading queue health...'}
                  </p>
                </div>
                <div className="min-w-0 rounded-2xl border border-border bg-page p-4">
                  <div className="flex items-center justify-between">
                    <p className="label-eyebrow">WebSocket</p>
                    <StatusBadge value={metrics?.infrastructure.websocket.status ?? 'info'} />
                  </div>
                  <p className="mt-3 break-words text-sm text-secondary">
                    {metrics?.infrastructure.websocket.summary ?? 'Loading websocket health...'}
                  </p>
                </div>
              </div>
              {metrics ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="min-w-0 rounded-2xl border border-border bg-page p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="label-eyebrow">Failed jobs</p>
                        <StatusBadge
                          value={
                            metrics.failedJobs.orderExecution + metrics.failedJobs.copyTrading > 0
                              ? 'warning'
                              : 'ok'
                          }
                        />
                      </div>
                      <p className="mt-3 break-words text-sm text-secondary">
                        {metrics.failedJobs.orderExecution + metrics.failedJobs.copyTrading} failed
                        jobs across order execution and copy trading.
                      </p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-border bg-page p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="label-eyebrow">Surveillance alerts</p>
                        <StatusBadge value="ok" />
                      </div>
                      <p className="mt-3 break-words text-sm text-secondary">
                        {Object.values(metrics.surveillanceAlertCounts).reduce((sum, count) => sum + count, 0)} open
                        alerts currently tracked.
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="label-eyebrow">Market Providers</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">
                        Health, reason, retry, and action
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {Object.values(metrics.providerHealth).map((provider) => (
                        <div
                          key={provider.provider}
                          className="min-w-0 rounded-2xl border border-border bg-page p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-medium text-primary">
                                {formatProviderLabel(provider.provider)}
                              </p>
                              <p className="mt-2 break-words text-sm text-secondary">
                                {provider.transport === 'streaming' ? 'Streaming' : 'Polling'} •{' '}
                                {provider.symbolCount} symbols
                              </p>
                            </div>
                            <StatusBadge value={provider.status} className="shrink-0" />
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="min-w-0 rounded-xl border border-border/70 bg-panel/40 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                Reason
                              </p>
                              <p className="mt-1 break-words text-sm text-primary">
                                {formatProviderReason(provider.reason)}
                              </p>
                            </div>
                            <div className="min-w-0 rounded-xl border border-border/70 bg-panel/40 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                                Last update
                              </p>
                              <p className="mt-1 break-words text-sm text-primary">
                                {provider.lastUpdateAt
                                  ? formatDateTime(provider.lastUpdateAt)
                                  : 'No successful update yet'}
                              </p>
                            </div>
                          </div>
                          {provider.message ? (
                            <p className="mt-3 break-words text-sm text-secondary">
                              {provider.message}
                            </p>
                          ) : null}
                          {provider.retryAt ? (
                            <p className="mt-2 break-words text-sm text-secondary">
                              Next retry {formatDateTime(provider.retryAt)}
                            </p>
                          ) : null}
                          {provider.recommendedAction ? (
                            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                                Recommended Action
                              </p>
                              <p className="mt-1 break-words text-sm text-amber-100">
                                {provider.recommendedAction}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-3 flex items-center justify-between gap-3">
                      <p className="label-eyebrow">Sample Market Coverage</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">
                        Cached quotes for key instruments
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {metrics.sampleQuotes.map((item) => (
                      <div
                        key={item.symbol}
                        className="min-w-0 rounded-2xl border border-border bg-page p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-primary">{item.symbol}</p>
                          <StatusBadge
                            value={item.lastPrice ? (item.delayed ? 'degraded' : 'ok') : 'warning'}
                          />
                        </div>
                        <p className="mt-2 break-words text-sm text-secondary">
                          {item.lastPrice != null ? formatNumber(item.lastPrice, 4) : '--'} •{' '}
                          {item.provider ?? 'unknown'}
                        </p>
                        <p className="mt-2 break-words text-sm text-secondary">
                          {item.lastUpdated ? formatDateTime(item.lastUpdated) : 'No update yet'}
                        </p>
                        {item.delayed ? (
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                            Delayed
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {canViewReadiness ? (
            <Panel
              title="Readiness Preview"
              description="Current launch blockers and warnings."
            >
              <div className="space-y-3">
                {readinessPreview.map((item) => (
                  <div
                    key={item.key}
                    className="min-w-0 rounded-2xl border border-border bg-page p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-primary">{item.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                          {item.category}
                        </p>
                      </div>
                      <StatusBadge value={item.status} className="shrink-0" />
                    </div>
                    <p className="mt-2 break-words text-sm text-secondary">{item.summary}</p>
                    {item.action ? (
                      <p className="mt-2 break-words text-sm text-amber-200">{item.action}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Exposure by Symbol" description="Latest dealing desk exposure breakdown.">
          <DataTable
            columns={[
              {
                key: 'symbol',
                header: 'Symbol',
                render: (item) => <span className="font-medium text-primary">{item.symbol}</span>,
              },
              { key: 'long', header: 'Long', align: 'right', render: (item) => item.longVolume },
              { key: 'short', header: 'Short', align: 'right', render: (item) => item.shortVolume },
              { key: 'net', header: 'Net', align: 'right', render: (item) => item.netVolume },
              {
                key: 'floating',
                header: 'Floating Impact',
                align: 'right',
                render: (item) => formatCurrency(item.floatingPnlImpactEstimate),
              },
            ]}
            data={exposure}
            rowKey={(item) => item.symbol}
            emptyTitle="No exposure data"
            emptyDescription="Exposure snapshots will appear here when positions are open."
          />
        </Panel>

        <Panel title="Hedge Suggestions" description="Latest suggested or approved hedge actions.">
          <div className="space-y-3">
            {hedgeActions.slice(0, 8).map((action) => (
              <div key={action.id} className="rounded-2xl border border-border bg-page p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary">
                      {action.symbol} {action.actionType}
                    </p>
                    <p className="mt-1 text-sm text-secondary">{action.reason}</p>
                  </div>
                  <StatusBadge value={action.status} />
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted">
                  {formatDateTime(action.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Open Positions Across Users" description="Latest active positions across client accounts.">
        <DataTable
          columns={[
            {
              key: 'user',
              header: 'User',
              render: (item) => item.email,
            },
            {
              key: 'account',
              header: 'Account',
              render: (item) => `${item.accountName} (${item.accountNo})`,
            },
            {
              key: 'symbol',
              header: 'Symbol',
              render: (item) => <span className="font-medium text-primary">{item.symbol}</span>,
            },
            { key: 'side', header: 'Side', render: (item) => item.side },
            {
              key: 'volume',
              header: 'Volume',
              align: 'right',
              render: (item) => formatNumber(item.volume, 4),
            },
            {
              key: 'pnl',
              header: 'P&L',
              align: 'right',
              render: (item) => formatCurrency(item.pnl),
            },
          ]}
          data={openPositionsPreview}
          rowKey={(item) => item.id}
          emptyTitle="No open positions"
          emptyDescription="Open client positions will appear here."
        />
      </Panel>
    </div>
  );
}
