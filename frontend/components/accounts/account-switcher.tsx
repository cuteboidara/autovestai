'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, LoaderCircle, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useAccountContext } from '@/context/account-context';
import { cn, formatUsdt } from '@/lib/utils';
import { useNotificationStore } from '@/store/notification-store';

interface AccountSwitcherProps {
  homeHref: string;
  mobile?: boolean;
  onNavigate?: () => void;
}

function accountTypeClasses(type: 'LIVE' | 'DEMO') {
  return type === 'LIVE'
    ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300'
    : 'border-slate-400/25 bg-white/5 text-slate-300';
}

function accountStatusClasses(status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED') {
  if (status === 'ACTIVE') {
    return 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300';
  }

  if (status === 'SUSPENDED') {
    return 'border-amber-500/30 bg-amber-500/12 text-amber-300';
  }

  return 'border-rose-500/30 bg-rose-500/12 text-rose-300';
}

export function AccountSwitcher({
  homeHref,
  mobile = false,
  onNavigate,
}: AccountSwitcherProps) {
  const router = useRouter();
  const pushNotification = useNotificationStore((state) => state.push);
  const {
    accounts,
    activeAccount,
    loading,
    switcherOpen,
    setSwitcherOpen,
    setActiveAccount,
    createAccount,
  } = useAccountContext();
  const [submittingAction, setSubmittingAction] = useState<'LIVE' | 'DEMO' | null>(null);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!switcherOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSwitcherOpen(false);
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [setSwitcherOpen, switcherOpen]);

  async function handleCreateAccount(type: 'LIVE' | 'DEMO') {
    setSubmittingAction(type);

    try {
      const created = await createAccount({ type }, { activate: true });

      pushNotification({
        title: type === 'DEMO' ? 'Demo account ready' : 'Live account created',
        description: `${created.name} • ${created.accountNo}`,
        type: 'success',
      });

      if (type === 'LIVE') {
        router.push('/wallet?tab=deposit');
      }

      onNavigate?.();
    } catch (error) {
      pushNotification({
        title: 'Account action failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleSwitchAccount(accountId: string) {
    if (accountId === activeAccount?.id) {
      setSwitcherOpen(false);
      onNavigate?.();
      return;
    }

    setSwitchingAccountId(accountId);

    try {
      const account = await setActiveAccount(accountId);

      pushNotification({
        title: 'Active account updated',
        description: `${account.name} • ${account.accountNo}`,
        type: 'success',
      });
      onNavigate?.();
    } catch (error) {
      pushNotification({
        title: 'Unable to switch account',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSwitchingAccountId(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={switcherOpen}
        className={cn(
          'flex w-full items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
          mobile ? 'justify-between' : '',
        )}
        onClick={() => setSwitcherOpen(!switcherOpen)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-sm font-semibold text-accent">
            AV
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">AutovestAI</p>
            <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">
              {activeAccount
                ? `${activeAccount.type} ${activeAccount.accountNo}`
                : loading
                  ? 'Loading account'
                  : 'Select account'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            switcherOpen ? 'rotate-180' : '',
          )}
        />
      </button>

      {switcherOpen ? (
        <div
          role="menu"
          aria-label="Account switcher"
          className={cn(
            'z-50 mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#12161E] p-2 shadow-2xl shadow-black/40',
            mobile ? 'relative w-full' : 'absolute left-0 top-full w-[19rem]',
          )}
        >
          <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              Active Account
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                  activeAccount ? accountTypeClasses(activeAccount.type) : '',
                )}
              >
                {activeAccount?.type ?? 'ACCOUNT'}
              </span>
              <span className="truncate text-sm font-semibold text-white">
                {activeAccount?.accountNo ?? 'Not selected'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {activeAccount ? formatUsdt(activeAccount.balance) : 'No account selected'}
            </p>
            {activeAccount ? (
              <div className="mt-2">
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                    accountStatusClasses(activeAccount.status),
                  )}
                >
                  {activeAccount.status}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-2 space-y-1">
            {accounts.map((account) => {
              const isCurrent = account.id === activeAccount?.id;
              const isSwitching = switchingAccountId === account.id;
              const switchable = account.status === 'ACTIVE';

              return (
                <button
                  key={account.id}
                  type="button"
                  role="menuitem"
                  className="flex min-h-[54px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!isCurrent && !switchable}
                  onClick={() => void handleSwitchAccount(account.id)}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                    {isCurrent ? (
                      <Check className="h-4 w-4 text-emerald-300" />
                    ) : isSwitching ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{account.name}</span>
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                          accountTypeClasses(account.type),
                        )}
                      >
                        {account.type}
                      </span>
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                          accountStatusClasses(account.status),
                        )}
                      >
                        {account.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {account.accountNo} • {formatUsdt(account.balance)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
            <button
              type="button"
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              disabled={submittingAction !== null}
              onClick={() => void handleCreateAccount('DEMO')}
            >
              {submittingAction === 'DEMO' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Open Demo Account
            </button>
            <button
              type="button"
              className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              disabled={submittingAction !== null}
              onClick={() => void handleCreateAccount('LIVE')}
            >
              {submittingAction === 'LIVE' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Open Live Account
            </button>
            <Link
              href={homeHref}
              role="menuitem"
              className="flex min-h-[44px] items-center rounded-xl px-3 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              onClick={() => {
                setSwitcherOpen(false);
                onNavigate?.();
              }}
            >
              Manage Accounts
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
