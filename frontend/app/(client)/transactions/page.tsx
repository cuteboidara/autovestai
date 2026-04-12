'use client';

import Link from 'next/link';
import { ArrowDownToLine, ReceiptText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAccountContext } from '@/context/account-context';
import { formatDateTime, formatUsdt } from '@/lib/utils';
import { accountsApi } from '@/services/api/accounts';
import { walletApi } from '@/services/api/wallet';
import { WalletTransaction } from '@/types/wallet';

function TransactionsSkeleton() {
  return (
    <Panel title="Transaction History" description="Funding and ledger activity for the selected account.">
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </Panel>
  );
}

function resolveTransactionMethod(transaction: WalletTransaction) {
  const metadata = transaction.metadata as Record<string, unknown> | null;
  const network = typeof metadata?.network === 'string' ? metadata.network : null;

  return network ?? transaction.reference ?? transaction.asset ?? 'USDT';
}

function resolveTransactionStatus(transaction: WalletTransaction) {
  if (transaction.status === 'REJECTED') {
    return 'FAILED';
  }

  return transaction.status;
}

export default function TransactionsPage() {
  const { activeAccountId } = useAccountContext();
  const transactionsQuery = useQuery({
    queryKey: ['client-transactions', activeAccountId],
    enabled: Boolean(activeAccountId),
    queryFn: async () => {
      if (!activeAccountId) {
        return null;
      }

      const query = new URLSearchParams({ accountId: activeAccountId }).toString();
      const [account, transactions] = await Promise.all([
        accountsApi.get(activeAccountId),
        walletApi.listTransactions(query),
      ]);

      return { account, transactions };
    },
  });

  if (!activeAccountId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Client Portal / Transactions"
          title="Transactions"
          description="Review deposits, withdrawals, and ledger events for your active trading account."
        />
        <EmptyState
          title="No active account selected"
          description="Choose an account first so we can load its funding and transaction history."
          icon={<ReceiptText className="h-5 w-5" />}
          action={
            <Button asChild>
              <Link href="/accounts">Manage Accounts</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (transactionsQuery.isLoading || !transactionsQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Client Portal / Transactions"
          title="Transactions"
          description="Review deposits, withdrawals, and ledger events for your active trading account."
        />
        <TransactionsSkeleton />
      </div>
    );
  }

  const { account, transactions } = transactionsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Portal / Transactions"
        title="Transactions"
        description={`Funding activity for ${account.accountNo}. Every deposit, withdrawal, and trade ledger item is listed here.`}
        actions={
          <Button asChild>
            <Link href="/wallet?tab=deposit">Deposit Now</Link>
          </Button>
        }
      />

      <Panel
        title="Transaction History"
        description={`${account.type} account • ${account.accountNo}`}
      >
        <DataTable
          columns={[
            {
              key: 'type',
              header: 'Type',
              render: (transaction) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-page text-accent">
                    <ArrowDownToLine className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">{transaction.type}</p>
                    <p className="text-xs text-muted">{transaction.asset}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              render: (transaction) => (
                <span className="font-medium text-primary">{formatUsdt(transaction.amount)}</span>
              ),
            },
            {
              key: 'method',
              header: 'Method',
              render: (transaction) => (
                <span className="text-secondary">{resolveTransactionMethod(transaction)}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (transaction) => (
                <StatusBadge value={resolveTransactionStatus(transaction)} />
              ),
            },
            {
              key: 'date',
              header: 'Date',
              align: 'right',
              render: (transaction) => (
                <span className="text-secondary">{formatDateTime(transaction.createdAt)}</span>
              ),
            },
          ]}
          data={transactions}
          rowKey={(transaction) => transaction.id}
          emptyTitle="No transactions yet"
          emptyDescription="Make your first deposit to get started."
          emptyIcon={<ReceiptText className="h-5 w-5" />}
          emptyAction={
            <Button asChild>
              <Link href="/wallet?tab=deposit">Deposit Now</Link>
            </Button>
          }
        />
      </Panel>
    </div>
  );
}
