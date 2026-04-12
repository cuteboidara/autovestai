'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CopyTraderModal } from '@/components/copy-trading/copy-trader-modal';
import { EquityCurveChart } from '@/components/copy-trading/equity-curve-chart';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { accountsApi } from '@/services/api/accounts';
import { copyTradingApi } from '@/services/api/copy-trading';
import { useNotificationStore } from '@/store/notification-store';
import { AccountSummary } from '@/types/account';
import { SignalProviderProfile } from '@/types/copy-trading';
import { formatDateTime, formatNumber, formatPercentage, formatUsdt } from '@/lib/utils';

export default function ProviderProfilePage() {
  const params = useParams<{ providerId: string }>();
  const providerId = Array.isArray(params.providerId) ? params.providerId[0] : params.providerId;
  const pushNotification = useNotificationStore((state) => state.push);
  const [provider, setProvider] = useState<SignalProviderProfile | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  async function refresh() {
    const [providerProfile, accountList] = await Promise.all([
      copyTradingApi.getProvider(providerId),
      accountsApi.list(),
    ]);

    setProvider(providerProfile);
    setAccounts(accountList);
  }

  useEffect(() => {
    void refresh()
      .catch((error) => {
        pushNotification({
          title: 'Provider unavailable',
          description: error instanceof Error ? error.message : 'Request failed',
          type: 'error',
        });
      })
      .finally(() => setLoading(false));
  }, [providerId, pushNotification]);

  if (!provider) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Copy Trading"
          title={loading ? 'Loading provider...' : 'Provider not found'}
          description="Signal provider profile and trading history."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Portal / Copy Trading"
        title={provider.displayName}
        description={provider.bio || provider.strategy || 'No provider bio has been published yet.'}
        actions={
          <>
            <StatusBadge value={provider.isAccepting ? 'active' : 'paused'} />
            <Button disabled={!provider.isAccepting} onClick={() => setCopyModalOpen(true)}>
              Copy This Trader
            </Button>
          </>
        }
      />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(280px,0.65fr)]">
        <Panel
          title="Performance"
          description="All-time and current-period trading performance."
          className="2xl:col-span-2"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">All-Time Return</p>
              <p className="mt-3 text-2xl font-semibold text-emerald-300">
                {formatPercentage(provider.stats.totalReturn)}
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Monthly Return</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {formatPercentage(provider.stats.monthlyReturn)}
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Win Rate</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {formatPercentage(provider.stats.winRate)}
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Max Drawdown</p>
              <p className="mt-3 text-2xl font-semibold text-rose-300">
                {formatPercentage(provider.stats.maxDrawdown)}
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Avg Trade Duration</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {formatNumber(provider.stats.avgTradeDurationHours, 2)}h
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Total Trades</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {provider.stats.totalTrades}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Copy Summary" description="Live copy settings and funding thresholds.">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-page px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Strategy</p>
              <p className="mt-2 text-lg font-semibold">
                {provider.strategy || 'Discretionary multi-market strategy'}
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Min Copy Amount</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {formatUsdt(provider.minCopyAmount)}
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Profit Fee</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {formatNumber(provider.feePercent, 2)}%
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Active Copiers</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {provider.activeCopiers}
              </p>
            </div>
            <div className="rounded-3xl bg-page p-4">
              <p className="label-eyebrow">Current Equity</p>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {formatUsdt(provider.stats.currentEquity)}
              </p>
            </div>
            <div className="2xl:sticky 2xl:top-24">
              <Button
                className="w-full"
                disabled={!provider.isAccepting}
                onClick={() => setCopyModalOpen(true)}
              >
                Copy This Trader
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Equity Curve" description="All-time realized equity path for the signal account.">
        <EquityCurveChart data={provider.equityCurve} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Panel title="Recent Trades" description="Latest closed positions from this signal account.">
          <div className="overflow-x-auto">
            <table className="min-w-[680px] table-fixed text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-muted">
                <tr>
                  <th className="pb-3">Symbol</th>
                  <th className="pb-3">Side</th>
                  <th className="pb-3">Open</th>
                  <th className="pb-3">Close</th>
                  <th className="pb-3 text-right">P&amp;L %</th>
                  <th className="pb-3 text-right">P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-secondary">
                {provider.recentTrades.map((trade) => (
                  <tr key={trade.id}>
                    <td className="py-3 font-medium text-primary">{trade.symbol}</td>
                    <td className="py-3">{trade.side}</td>
                    <td className="py-3">{formatDateTime(trade.openedAt)}</td>
                    <td className="py-3">{trade.closedAt ? formatDateTime(trade.closedAt) : '--'}</td>
                    <td className={`py-3 text-right font-medium ${trade.pnlPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {formatPercentage(trade.pnlPercent)}
                    </td>
                    <td className={`py-3 text-right font-medium ${trade.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {formatUsdt(trade.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Current Copiers" description="Active and paused followers are anonymized.">
          <div className="space-y-3">
            {provider.currentCopiers.map((copier) => (
              <div key={copier.id} className="rounded-3xl bg-page p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary">{copier.alias}</p>
                    <p className="mt-1 text-sm text-secondary">
                      {formatUsdt(copier.allocatedAmount)} • {formatNumber(copier.copyRatio, 1)}x
                    </p>
                  </div>
                  <StatusBadge value={copier.status} />
                </div>
              </div>
            ))}
            {provider.currentCopiers.length === 0 ? (
              <p className="text-sm text-secondary">No active copiers are connected right now.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <CopyTraderModal
        open={copyModalOpen}
        provider={provider}
        accounts={accounts}
        onClose={() => setCopyModalOpen(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
