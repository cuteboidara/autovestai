'use client';

import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Panel } from '@/components/ui/panel';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { formatDateTime, formatNumber, formatPercentage, formatUsdt } from '@/lib/utils';
import { AdminCopyProvider, AdminCopyTrade } from '@/types/admin';

export default function AdminCopyTradingPage() {
  const { hasPermission } = useAuth();
  const [providers, setProviders] = useState<AdminCopyProvider[]>([]);
  const [trades, setTrades] = useState<AdminCopyTrade[]>([]);
  const canApproveCopy = hasPermission('copy.approve');

  async function refreshCopyAdmin() {
    const [providerList, tradeList] = await Promise.all([adminApi.listCopyMasters(), adminApi.listCopyTrades()]);

    setProviders(providerList);
    setTrades(tradeList);
  }

  useEffect(() => {
    if (!canApproveCopy) {
      return;
    }

    void refreshCopyAdmin();
  }, [canApproveCopy]);

  const failedTrades = useMemo(
    () => trades.filter((trade) => trade.status === 'CLOSED' && trade.pnl < 0),
    [trades],
  );

  if (!canApproveCopy) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Copy Trading Admin"
          title="Provider and mirrored-trade diagnostics"
          description="Inspect published signal providers and mirrored trade activity across copier accounts."
        />
        <PermissionDenied
          title="Copy trading moderation unavailable"
          description="This admin account does not have permission to inspect copy trading."
          requiredPermission="copy.approve"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Copy Trading Admin"
        title="Copy Trading"
        description="Inspect live signal providers, active copier relationships, and mirrored trade replication."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Providers" value={providers.length} />
        <StatCard label="Accepting" value={providers.filter((item) => item.isAccepting && item.isPublic).length} />
        <StatCard label="Hidden/paused" value={providers.filter((item) => !item.isAccepting || !item.isPublic).length} />
        <StatCard label="Losing mirrored trades" value={failedTrades.length} />
      </div>

      <Panel title="Signal Providers" description="Published provider profiles and copier counts.">
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="min-w-[920px] table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pb-3">Provider</th>
                <th className="pb-3">User</th>
                <th className="pb-3">Signal Account</th>
                <th className="pb-3 text-right">Copiers</th>
                <th className="pb-3 text-right">Return</th>
                <th className="pb-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-secondary">
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td className="py-3">
                    <p className="font-medium text-primary">{provider.displayName}</p>
                    <p className="mt-1 text-xs text-secondary">{provider.strategy || provider.bio || '--'}</p>
                  </td>
                  <td className="py-3">{provider.user.email}</td>
                  <td className="py-3">
                    <p>{provider.account.name}</p>
                    <p className="mt-1 text-xs text-secondary">{provider.account.accountNo} • {provider.account.type}</p>
                  </td>
                  <td className="py-3 text-right tabular-nums">{provider.followerCount}</td>
                  <td className="py-3 text-right tabular-nums">{formatPercentage(provider.totalReturn)}</td>
                  <td className="py-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge value={provider.status} />
                      <StatusBadge value={provider.account.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Mirrored Trades" description="Recent copied positions across follower accounts.">
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="min-w-[920px] table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pb-3">Opened</th>
                <th className="pb-3">Provider</th>
                <th className="pb-3">Follower</th>
                <th className="pb-3">Symbol</th>
                <th className="pb-3 text-right">Volume</th>
                <th className="pb-3 whitespace-nowrap">Status</th>
                <th className="pb-3 text-right">P&amp;L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-secondary">
              {trades.map((trade) => (
                <tr key={trade.id}>
                  <td className="py-3">{formatDateTime(trade.openedAt)}</td>
                  <td className="py-3">{trade.master?.displayName ?? '--'}</td>
                  <td className="py-3">
                    <p>{trade.follower.email}</p>
                    <p className="mt-1 text-xs text-secondary">{trade.account.accountNo}</p>
                  </td>
                  <td className="py-3">
                    <p className="font-medium text-primary">{trade.symbol}</p>
                    <p className="mt-1 text-xs text-secondary">{trade.side}</p>
                  </td>
                  <td className="py-3 text-right">{formatNumber(trade.volume, 4)}</td>
                  <td className="py-3 whitespace-nowrap">
                    <StatusBadge value={trade.status} />
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
    </div>
  );
}
