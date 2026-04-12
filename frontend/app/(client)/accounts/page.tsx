'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, CirclePlus, RotateCcw, WalletCards } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAccountContext } from '@/context/account-context';
import { cn, formatDateTime, formatUsdt } from '@/lib/utils';
import { useNotificationStore } from '@/store/notification-store';
import { AccountSummary } from '@/types/account';

function accountTypeClasses(type: 'LIVE' | 'DEMO') {
  return type === 'LIVE'
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    : 'border-slate-500/25 bg-slate-500/10 text-slate-300';
}

function AccountCardSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-glow">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      <div className="mt-6 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

function CreateAccountCard({
  title,
  description,
  loading,
  onClick,
}: {
  title: string;
  description: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group flex min-h-[176px] w-full flex-col items-start justify-between rounded-3xl border border-dashed border-borderStrong bg-surface/50 p-6 text-left transition hover:border-accent/45 hover:bg-page disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-page text-accent transition group-hover:border-accent/45">
        <CirclePlus className="h-5 w-5" />
      </div>
      <div>
        <p className="text-base font-semibold text-primary">{title}</p>
        <p className="mt-2 text-sm leading-6 text-secondary">{description}</p>
      </div>
    </button>
  );
}

function AccountCard({
  account,
  activeActionId,
  onSetActive,
  onResetDemo,
  onFundAccount,
}: {
  account: AccountSummary;
  activeActionId: string | null;
  onSetActive: (accountId: string) => void;
  onResetDemo: (accountId: string) => void;
  onFundAccount: (account: AccountSummary) => void;
}) {
  const loading = activeActionId === account.id;

  return (
    <article
      className={cn(
        'rounded-3xl border bg-surface p-6 shadow-glow',
        account.isDefault ? 'border-accent/35' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
                accountTypeClasses(account.type),
              )}
            >
              {account.type}
            </span>
            {account.isDefault ? (
              <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                Active
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-primary">{account.accountNo}</h2>
            <StatusBadge value={account.status} />
          </div>
          <p className="mt-2 text-sm text-secondary">{account.name}</p>
        </div>

        <div className="rounded-2xl border border-border bg-page px-4 py-3 text-right">
          <p className="label-eyebrow">Balance</p>
          <p className="mt-3 text-2xl font-semibold text-primary">{formatUsdt(account.balance)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">USDT</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-page px-4 py-4">
          <p className="label-eyebrow">Equity</p>
          <p className="mt-3 text-lg font-semibold text-primary">{formatUsdt(account.equity)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-page px-4 py-4">
          <p className="label-eyebrow">Free Margin</p>
          <p className="mt-3 text-lg font-semibold text-primary">
            {formatUsdt(account.freeMargin)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-page px-4 py-4">
          <p className="label-eyebrow">Open Positions</p>
          <p className="mt-3 text-lg font-semibold text-primary">{account.openPositions}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm text-secondary">
        <CalendarDays className="h-4 w-4 text-muted" />
        <span>Created {formatDateTime(account.createdAt)}</span>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {account.isDefault ? (
          <Button variant="secondary" disabled>
            Active Account
          </Button>
        ) : (
          <Button disabled={loading} onClick={() => onSetActive(account.id)}>
            {loading ? 'Switching...' : 'Set Active'}
          </Button>
        )}

        {account.type === 'LIVE' ? (
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => onFundAccount(account)}
          >
            Fund
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => onResetDemo(account.id)}
          >
            <RotateCcw className="h-4 w-4" />
            {loading ? 'Resetting...' : 'Reset'}
          </Button>
        )}
      </div>
    </article>
  );
}

export default function AccountsPage() {
  const router = useRouter();
  const pushNotification = useNotificationStore((state) => state.push);
  const { accounts, loading, createAccount, setActiveAccount, resetDemoAccount } =
    useAccountContext();
  const [createDialogType, setCreateDialogType] = useState<'LIVE' | 'DEMO' | null>(null);
  const [resetAccountId, setResetAccountId] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  async function handleSetActive(accountId: string) {
    setActiveActionId(accountId);

    try {
      const account = await setActiveAccount(accountId);

      pushNotification({
        title: 'Active account updated',
        description: `${account.accountNo} is now your default account.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Account switch failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleFundAccount(account: AccountSummary) {
    setActiveActionId(account.id);

    try {
      if (!account.isDefault) {
        await setActiveAccount(account.id);
      }

      router.push('/wallet?tab=deposit');
    } catch (error) {
      pushNotification({
        title: 'Unable to prepare funding',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleCreateAccount() {
    if (!createDialogType) {
      return;
    }

    setDialogSubmitting(true);

    try {
      const shouldActivate = createDialogType === 'LIVE';
      const account = await createAccount({ type: createDialogType }, { activate: shouldActivate });

      pushNotification({
        title: createDialogType === 'DEMO' ? 'Demo account ready' : 'Live account created',
        description: `${account.accountNo} is ready to use.`,
        type: 'success',
      });

      setCreateDialogType(null);

      if (createDialogType === 'LIVE') {
        router.push('/wallet?tab=deposit');
      }
    } catch (error) {
      pushNotification({
        title: 'Unable to create account',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setDialogSubmitting(false);
    }
  }

  async function handleResetDemo() {
    if (!resetAccountId) {
      return;
    }

    setDialogSubmitting(true);
    setActiveActionId(resetAccountId);

    try {
      const account = await resetDemoAccount(resetAccountId);

      pushNotification({
        title: 'Demo balance reset',
        description: `${account.accountNo} restored to ${formatUsdt(account.balance)}`,
        type: 'success',
      });
      setResetAccountId(null);
    } catch (error) {
      pushNotification({
        title: 'Unable to reset demo',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setDialogSubmitting(false);
      setActiveActionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Portal / Accounts"
        title="Accounts"
        description="Manage your live and demo trading accounts, switch the active account, and fund or reset balances from one place."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreateDialogType('LIVE')}>
              + Open Live Account
            </Button>
            <Button onClick={() => setCreateDialogType('DEMO')}>+ Open Demo Account</Button>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-2">
        {loading
          ? Array.from({ length: 2 }).map((_, index) => <AccountCardSkeleton key={index} />)
          : accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                activeActionId={activeActionId}
                onSetActive={handleSetActive}
                onResetDemo={setResetAccountId}
                onFundAccount={handleFundAccount}
              />
            ))}
      </section>

      {!loading && accounts.length === 0 ? (
        <EmptyState
          title="No trading accounts yet"
          description="Open a demo account to practice with virtual funds or create a live account for real deposits and withdrawals."
          icon={<WalletCards className="h-5 w-5" />}
          action={
            <Button onClick={() => setCreateDialogType('DEMO')}>Open Demo Account</Button>
          }
        />
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <CreateAccountCard
          title="Open Demo Account"
          description="Start with exactly 10,000.00 USDT in virtual balance and test ideas without risk."
          loading={dialogSubmitting}
          onClick={() => setCreateDialogType('DEMO')}
        />
        <CreateAccountCard
          title="Open Live Account"
          description="Create a production account, set it active, and move directly into the deposit flow."
          loading={dialogSubmitting}
          onClick={() => setCreateDialogType('LIVE')}
        />
      </section>

      <div className="rounded-3xl border border-border bg-surface px-6 py-5 text-sm text-secondary">
        Funding and withdrawals continue in the{' '}
        <Link href="/wallet" className="font-medium text-accent">
          wallet workspace
        </Link>
        .
      </div>

      <ConfirmDialog
        open={createDialogType === 'DEMO'}
        title="Open Demo Account"
        description="Your demo account will start with exactly 10,000.00 USDT in virtual funds."
        confirmLabel="Create Demo Account"
        loading={dialogSubmitting}
        onCancel={() => setCreateDialogType(null)}
        onConfirm={() => void handleCreateAccount()}
      />

      <ConfirmDialog
        open={createDialogType === 'LIVE'}
        title="Open Live Account"
        description="A new live account will be created and set active so you can fund it immediately."
        confirmLabel="Create Live Account"
        loading={dialogSubmitting}
        onCancel={() => setCreateDialogType(null)}
        onConfirm={() => void handleCreateAccount()}
      />

      <ConfirmDialog
        open={Boolean(resetAccountId)}
        title="Reset Demo Balance"
        description="This closes any open demo positions and restores the account to exactly 10,000.00 USDT."
        confirmLabel="Reset Demo"
        loading={dialogSubmitting}
        onCancel={() => setResetAccountId(null)}
        onConfirm={() => void handleResetDemo()}
      />
    </div>
  );
}
