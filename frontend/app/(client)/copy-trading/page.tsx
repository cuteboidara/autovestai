'use client';

import Link from 'next/link';
import { Copy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { CopyTraderModal } from '@/components/copy-trading/copy-trader-modal';
import { ProviderSparkline } from '@/components/copy-trading/provider-sparkline';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatNumber, formatPercentage, formatUsdt } from '@/lib/utils';
import { accountsApi } from '@/services/api/accounts';
import { copyTradingApi } from '@/services/api/copy-trading';
import { useNotificationStore } from '@/store/notification-store';
import { AccountSummary } from '@/types/account';
import {
  CopyRelationRecord,
  ProviderSortBy,
  SignalProviderSummary,
} from '@/types/copy-trading';

type ActiveTab = 'discover' | 'my-copies';

const sortOptions: Array<{ value: ProviderSortBy; label: string }> = [
  { value: 'BEST_RETURN', label: 'Best Return' },
  { value: 'MOST_COPIERS', label: 'Most Copiers' },
  { value: 'LOWEST_DRAWDOWN', label: 'Lowest Drawdown' },
  { value: 'NEWEST', label: 'Newest' },
];

function sortProviders(providers: SignalProviderSummary[], sortBy: ProviderSortBy) {
  return [...providers].sort((left, right) => {
    if (sortBy === 'MOST_COPIERS') {
      return right.activeCopiers - left.activeCopiers;
    }

    if (sortBy === 'LOWEST_DRAWDOWN') {
      return left.maxDrawdown - right.maxDrawdown;
    }

    if (sortBy === 'NEWEST') {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    return right.totalReturn - left.totalReturn;
  });
}

function CopyTradingSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <Panel title="Marketplace" description="Loading providers and active copy relationships.">
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-border bg-surface p-5 shadow-glow">
            <Skeleton className="h-24 w-full" />
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="mt-5 h-16 w-full" />
            <div className="mt-5 flex gap-3">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CopyTradingPage() {
  const pushNotification = useNotificationStore((state) => state.push);
  const [activeTab, setActiveTab] = useState<ActiveTab>('discover');
  const [sortBy, setSortBy] = useState<ProviderSortBy>('BEST_RETURN');
  const [minReturn, setMinReturn] = useState('');
  const [maxDrawdown, setMaxDrawdown] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<SignalProviderSummary | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<CopyRelationRecord | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const pageQuery = useQuery({
    queryKey: ['client-copy-trading-page'],
    queryFn: async () => {
      const [providers, myCopies, accounts] = await Promise.all([
        copyTradingApi.listProviders(),
        copyTradingApi.listMyCopies(),
        accountsApi.list(),
      ]);

      return { providers, myCopies, accounts };
    },
  });

  const filteredProviders = useMemo(() => {
    const providers = pageQuery.data?.providers ?? [];
    const minimumReturn = minReturn === '' ? null : Number(minReturn);
    const maximumDrawdown = maxDrawdown === '' ? null : Number(maxDrawdown);

    return sortProviders(
      providers.filter((provider) => {
        if (minimumReturn !== null && provider.totalReturn < minimumReturn) {
          return false;
        }

        if (maximumDrawdown !== null && provider.maxDrawdown > maximumDrawdown) {
          return false;
        }

        return true;
      }),
      sortBy,
    );
  }, [maxDrawdown, minReturn, pageQuery.data?.providers, sortBy]);

  async function refreshPage() {
    await pageQuery.refetch();
  }

  async function pauseOrResumeCopy(relation: CopyRelationRecord) {
    setActionId(relation.id);

    try {
      await copyTradingApi.updateCopy(relation.id, {
        status: relation.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
      });
      await refreshPage();
    } catch (error) {
      pushNotification({
        title: 'Copy update failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setActionId(null);
    }
  }

  async function stopCopy(relation: CopyRelationRecord) {
    setActionId(relation.id);

    try {
      await copyTradingApi.stopCopy(relation.id);
      await refreshPage();
    } catch (error) {
      pushNotification({
        title: 'Stop copy failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setActionId(null);
    }
  }

  const accounts = pageQuery.data?.accounts ?? [];
  const myCopies = pageQuery.data?.myCopies ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Portal / Copy Trading"
        title="Copy Trading"
        description="Discover signal providers, compare performance, and mirror strategies from your own trading account."
        actions={
          <>
            <SegmentedControl
              items={[
                { value: 'discover', label: 'Discover Providers' },
                { value: 'my-copies', label: 'My Copies' },
              ]}
              value={activeTab}
              onChange={(value) => setActiveTab(value as ActiveTab)}
            />
            <Button asChild variant="secondary">
              <Link href="/copy-trading/register">Become a Provider</Link>
            </Button>
          </>
        }
      />

      {pageQuery.isLoading || !pageQuery.data ? (
        <CopyTradingSkeleton cards={activeTab === 'discover' ? 3 : 2} />
      ) : activeTab === 'discover' ? (
        <>
          <Panel
            title="Marketplace"
            description="Filter public signal providers by return, drawdown, and popularity."
            actions={
              <div className="grid gap-3 md:grid-cols-3">
                <Select value={sortBy} onChange={(event) => setSortBy(event.target.value as ProviderSortBy)}>
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  placeholder="Min Return %"
                  value={minReturn}
                  onChange={(event) => setMinReturn(event.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max Drawdown %"
                  value={maxDrawdown}
                  onChange={(event) => setMaxDrawdown(event.target.value)}
                />
              </div>
            }
          >
            {filteredProviders.length === 0 ? (
              <EmptyState
                title="No providers match this filter"
                description="Try widening the return or drawdown filters to load more strategies."
                icon={<Copy className="h-5 w-5" />}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSortBy('BEST_RETURN');
                      setMinReturn('');
                      setMaxDrawdown('');
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-5 xl:grid-cols-3">
                {filteredProviders.map((provider) => (
                  <article
                    key={provider.id}
                    className="overflow-hidden rounded-3xl border border-border bg-surface shadow-glow"
                  >
                    <div className="border-b border-border bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.18),transparent_34%),linear-gradient(135deg,#0F172A_0%,#111827_100%)] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          {provider.avatarUrl ? (
                            <img
                              src={provider.avatarUrl}
                              alt={provider.displayName}
                              className="h-14 w-14 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-primary">
                              {provider.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="truncate text-xl font-semibold text-primary">
                              {provider.displayName}
                            </h3>
                            <p className="mt-1 truncate text-sm text-secondary">
                              {provider.strategy || 'Multi-asset strategy'}
                            </p>
                          </div>
                        </div>
                        <StatusBadge value={provider.isAccepting ? 'active' : 'paused'} />
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-border bg-page px-3 py-4">
                          <p className="label-eyebrow">Return</p>
                          <p className="mt-3 text-lg font-semibold text-emerald-300">
                            {formatPercentage(provider.totalReturn)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-page px-3 py-4">
                          <p className="label-eyebrow">Win Rate</p>
                          <p className="mt-3 text-lg font-semibold text-primary">
                            {formatPercentage(provider.winRate)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-page px-3 py-4">
                          <p className="label-eyebrow">Copiers</p>
                          <p className="mt-3 text-lg font-semibold text-primary">
                            {provider.activeCopiers}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5 p-5">
                      <ProviderSparkline values={provider.monthlyReturns.map((point) => point.value)} />

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-border bg-page px-4 py-3">
                          <p className="label-eyebrow">Max Drawdown</p>
                          <p className="mt-3 font-semibold text-red-300">
                            {formatPercentage(provider.maxDrawdown)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-page px-4 py-3">
                          <p className="label-eyebrow">Min Copy</p>
                          <p className="mt-3 font-semibold text-primary">
                            {formatUsdt(provider.minCopyAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <Button
                          disabled={!provider.isAccepting}
                          onClick={() => {
                            setSelectedRelation(null);
                            setSelectedProvider(provider);
                          }}
                        >
                          Copy
                        </Button>
                        <Button variant="secondary" asChild>
                          <Link href={`/copy-trading/${provider.id}`}>View Profile</Link>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </>
      ) : (
        <Panel
          title="My Copies"
          description="Monitor allocated capital, copied PnL, fees, and account assignments."
        >
          {myCopies.length === 0 ? (
            <EmptyState
              title="No copied providers yet"
              description="Browse the marketplace and start copying a provider to see performance and controls here."
              icon={<Users className="h-5 w-5" />}
              action={<Button onClick={() => setActiveTab('discover')}>Browse Providers</Button>}
            />
          ) : (
            <div className="space-y-4">
              {myCopies.map((relation) => {
                const isBusy = actionId === relation.id;

                return (
                  <article
                    key={relation.id}
                    className="rounded-3xl border border-border bg-page p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold text-primary">
                            {relation.provider.displayName}
                          </h3>
                          <StatusBadge value={relation.status} />
                        </div>
                        <p className="mt-2 text-sm text-secondary">
                          {relation.provider.strategy || 'Provider strategy'} • Account{' '}
                          {relation.copyAccount.name} ({relation.copyAccount.type})
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="secondary"
                          disabled={relation.status === 'STOPPED' || isBusy}
                          onClick={() => void pauseOrResumeCopy(relation)}
                        >
                          {relation.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={relation.status === 'STOPPED' || isBusy}
                          onClick={() => {
                            setSelectedProvider(
                              pageQuery.data.providers.find((provider) => provider.id === relation.providerId) ??
                                null,
                            );
                            setSelectedRelation(relation);
                          }}
                        >
                          Adjust
                        </Button>
                        <Button
                          variant="danger"
                          disabled={relation.status === 'STOPPED' || isBusy}
                          onClick={() => void stopCopy(relation)}
                        >
                          Stop Copy
                        </Button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                        <p className="label-eyebrow">Allocated</p>
                        <p className="mt-3 text-lg font-semibold text-primary">
                          {formatUsdt(relation.allocatedAmount)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                        <p className="label-eyebrow">Net PnL</p>
                        <p
                          className={
                            relation.netCopiedPnl >= 0
                              ? 'mt-3 text-lg font-semibold text-emerald-300'
                              : 'mt-3 text-lg font-semibold text-red-300'
                          }
                        >
                          {formatUsdt(relation.netCopiedPnl)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                        <p className="label-eyebrow">Fees Paid</p>
                        <p className="mt-3 text-lg font-semibold text-primary">
                          {formatUsdt(relation.feesPaid)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                        <p className="label-eyebrow">Copy Ratio</p>
                        <p className="mt-3 text-lg font-semibold text-primary">
                          {formatNumber(relation.copyRatio, 1)}x
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      <CopyTraderModal
        open={Boolean(selectedProvider)}
        mode={selectedRelation ? 'adjust' : 'start'}
        provider={selectedProvider}
        relation={selectedRelation}
        accounts={accounts as AccountSummary[]}
        onClose={() => {
          setSelectedProvider(null);
          setSelectedRelation(null);
        }}
        onSuccess={refreshPage}
      />
    </div>
  );
}
