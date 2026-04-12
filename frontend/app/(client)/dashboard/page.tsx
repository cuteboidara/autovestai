'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CreditCard, LineChart, ReceiptText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { useAccountContext } from '@/context/account-context';
import { formatDateTime, formatNumber, formatUsdt } from '@/lib/utils';
import { accountsApi } from '@/services/api/accounts';
import { positionsApi } from '@/services/api/positions';
import { walletApi } from '@/services/api/wallet';

const quickActions = [
  {
    href: '/wallet?tab=deposit',
    label: 'Deposit',
    description: 'Fund your active account',
    icon: <ArrowDownToLine className="h-5 w-5" />,
  },
  {
    href: '/wallet?tab=withdraw',
    label: 'Withdraw',
    description: 'Request a payout',
    icon: <ArrowUpFromLine className="h-5 w-5" />,
  },
  {
    href: '/trade',
    label: 'New Trade',
    description: 'Open the trading terminal',
    icon: <LineChart className="h-5 w-5" />,
  },
  {
    href: '/copy-trading',
    label: 'Copy Trading',
    description: 'Browse signal providers',
    icon: <CreditCard className="h-5 w-5" />,
  },
] as const;

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[420px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeAccountId } = useAccountContext();
  const dashboardQuery = useQuery({
    queryKey: ['client-dashboard', activeAccountId],
    enabled: Boolean(activeAccountId),
    queryFn: async () => {
      if (!activeAccountId) {
        return null;
      }

      const transactionQuery = new URLSearchParams({ accountId: activeAccountId }).toString();
      const [account, positions, transactions] = await Promise.all([
        accountsApi.get(activeAccountId),
        positionsApi.list(activeAccountId, 'OPEN'),
        walletApi.listTransactions(transactionQuery),
      ]);

      return {
        account,
        positions,
        transactions,
      };
    },
  });

  const recentTransactions = useMemo(
    () => (dashboardQuery.data?.transactions ?? []).slice(0, 6),
    [dashboardQuery.data?.transactions],
  );

  if (!activeAccountId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Client Portal / Dashboard"
          title="Dashboard"
          description="Your live account overview, open positions, and latest account activity."
        />
        <EmptyState
          title="No active account selected"
          description="Open a demo or live account to start tracking balances, positions, and transactions here."
          action={
            <Button asChild>
              <Link href="/accounts">Open an account</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (dashboardQuery.isLoading || !dashboardQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Client Portal / Dashboard"
          title="Dashboard"
          description="Your live account overview, open positions, and latest account activity."
        />
        <DashboardSkeleton />
      </div>
    );
  }

  const { account, positions, transactions } = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Portal / Dashboard"
        title="Dashboard"
        description="Track the active account balance sheet, open market exposure, and your latest funding activity."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Equity" value={formatUsdt(account.equity)} helper={account.accountNo} />
        <StatCard label="Balance" value={formatUsdt(account.balance)} helper={account.type} />
        <StatCard label="Free Margin" value={formatUsdt(account.freeMargin)} helper={`${account.openPositions} open positions`} />
        <StatCard
          label="Floating PnL"
          value={
            <span className={account.unrealizedPnl >= 0 ? 'text-emerald-300' : 'text-red-300'}>
              {formatUsdt(account.unrealizedPnl)}
            </span>
          }
          helper={account.unrealizedPnl >= 0 ? 'Open trades are in profit' : 'Open trades are underwater'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Open Positions"
          description="Live exposure for the currently active account."
        >
          <DataTable
            columns={[
              {
                key: 'symbol',
                header: 'Symbol',
                render: (position) => <span className="font-medium text-primary">{position.symbol}</span>,
              },
              {
                key: 'side',
                header: 'Side',
                render: (position) => position.side,
              },
              {
                key: 'size',
                header: 'Size',
                align: 'right',
                render: (position) => formatNumber(position.volume, 4),
              },
              {
                key: 'entry',
                header: 'Entry',
                align: 'right',
                render: (position) => formatNumber(position.entryPrice, 5),
              },
              {
                key: 'current',
                header: 'Current',
                align: 'right',
                render: (position) => formatNumber(position.currentPrice, 5),
              },
              {
                key: 'pnl',
                header: 'P&L',
                align: 'right',
                render: (position) => (
                  <span className={(position.unrealizedPnl ?? position.pnl) >= 0 ? 'font-medium text-emerald-300' : 'font-medium text-red-300'}>
                    {formatUsdt(position.unrealizedPnl ?? position.pnl)}
                  </span>
                ),
              },
            ]}
            data={positions}
            rowKey={(position) => position.id}
            emptyTitle="No open positions yet"
            emptyDescription="Start trading to see your activity here."
            emptyAction={
              <Button asChild>
                <Link href="/trade">Open terminal</Link>
              </Button>
            }
          />
        </Panel>

        <Panel
          title="Recent Transactions"
          description="Latest funding and trade ledger events for the active account."
        >
          {recentTransactions.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="Make your first deposit to get started."
              action={
                <Button asChild>
                  <Link href="/wallet?tab=deposit">Deposit now</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="rounded-2xl border border-border bg-page px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">{transaction.type}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">
                        {transaction.reference || transaction.asset}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">{formatUsdt(transaction.amount)}</p>
                      <p className="mt-1 text-xs text-secondary">{formatDateTime(transaction.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <section className="space-y-3">
        <p className="label-eyebrow">Quick Actions</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-3xl border border-border bg-surface p-5 shadow-glow transition hover:-translate-y-0.5 hover:border-accent/35 hover:bg-page"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-page text-accent">
                {action.icon}
              </div>
              <p className="mt-4 text-base font-semibold text-primary">{action.label}</p>
              <p className="mt-2 text-sm text-secondary">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {transactions.length === 0 && positions.length === 0 ? (
        <div className="rounded-3xl border border-border bg-surface px-6 py-5 text-sm text-secondary">
          The active account is ready. Fund it or place a first trade to populate this overview.
        </div>
      ) : null}
    </div>
  );
}
