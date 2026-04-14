'use client';

import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  ChevronDown,
  ShieldAlert,
  UserCircle2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface SummaryMetric {
  label: string;
  value: string;
  tone?: string;
}

interface TradingAction {
  href: string;
  label: string;
}

interface TradeTopBarProps {
  accountLabel: string;
  accountNumber?: string | null;
  accountType?: 'LIVE' | 'DEMO' | null;
  balanceLabel: string;
  websocketConnected: boolean;
  userEmail?: string | null;
  summaryMetrics: SummaryMetric[];
  tradingBlockedMessage?: string | null;
  tradingBlockedActions?: TradingAction[];
  onOpenAccountSwitcher?: () => void;
}

export function TradeTopBar({
  accountLabel,
  accountNumber = null,
  accountType = 'LIVE',
  balanceLabel,
  websocketConnected,
  userEmail,
  summaryMetrics,
  tradingBlockedMessage,
  tradingBlockedActions = [],
  onOpenAccountSwitcher,
}: TradeTopBarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountCode = accountNumber ?? accountLabel;

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [accountMenuOpen]);

  return (
    <>
      <div className="border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)]">
        <div className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:flex-none sm:flex-nowrap">
            <div className="flex h-10 items-center gap-2 border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-3 text-[var(--terminal-text-primary)]">
              <span className="flex h-6 w-6 items-center justify-center bg-[var(--terminal-accent)] text-xs font-semibold text-[#0A0E1A]">
                AV
              </span>
              <span className="text-sm font-semibold">AutovestAI</span>
            </div>

            <button
              type="button"
              className="flex h-10 w-full min-w-0 items-center justify-between gap-3 border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-3 text-left transition duration-150 hover:bg-[var(--terminal-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40 sm:w-auto sm:min-w-[182px]"
              onClick={onOpenAccountSwitcher}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
                  Account
                </p>
                <p className="truncate text-sm font-semibold text-[var(--terminal-text-primary)]">
                  {(accountType ?? 'LIVE').toUpperCase()} {accountCode}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-[var(--terminal-text-secondary)]" />
            </button>
          </div>

          <div className="hidden min-w-0 items-center border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-2 text-sm xl:flex">
            <span className="mr-3 text-[var(--terminal-text-secondary)]">Balance</span>
            <span className="price-display font-semibold text-[var(--terminal-text-primary)]">
              {balanceLabel}
            </span>
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <div
              className={cn(
                'inline-flex h-10 items-center gap-2 border px-3 text-xs font-semibold uppercase tracking-[0.14em]',
                accountType === 'DEMO'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  accountType === 'DEMO' ? 'bg-amber-300' : 'bg-emerald-400',
                  websocketConnected ? 'terminal-pulse' : '',
                )}
              />
              {accountType === 'DEMO' ? 'Demo' : 'Live'}
            </div>

            <div
              className={cn(
                'hidden h-10 items-center gap-2 border px-3 text-xs font-semibold uppercase tracking-[0.14em] lg:inline-flex',
                websocketConnected
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-300',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  websocketConnected ? 'bg-emerald-400 terminal-pulse' : 'bg-amber-300',
                )}
              />
              {websocketConnected ? 'Connected' : 'Reconnecting'}
            </div>

            <button
              type="button"
              aria-label="Notifications"
              className="inline-flex h-10 w-10 items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
            >
              <Bell className="h-4 w-4" />
            </button>

            <Link
              href="/wallet?tab=deposit"
              className="inline-flex h-10 items-center gap-2 border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-3 text-sm font-medium text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
            >
              <ArrowDownToLine className="h-4 w-4 text-[var(--terminal-accent)]" />
              <span className="hidden sm:inline">Deposit</span>
            </Link>

            <Link
              href="/wallet?tab=withdraw"
              className="hidden h-10 items-center gap-2 border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-3 text-sm font-medium text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40 md:inline-flex"
            >
              <ArrowUpFromLine className="h-4 w-4 text-[var(--terminal-text-secondary)]" />
              Withdraw
            </Link>

            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                className="inline-flex h-10 items-center gap-2 border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-3 text-sm text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center bg-[var(--terminal-bg-elevated)] text-xs font-semibold text-[var(--terminal-text-primary)]">
                  {userEmail ? userEmail.slice(0, 2).toUpperCase() : <UserCircle2 className="h-4 w-4" />}
                </span>
                <span className="hidden max-w-[120px] truncate sm:inline">
                  {userEmail?.split('@')[0] ?? 'Profile'}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-[var(--terminal-text-secondary)] transition-transform',
                    accountMenuOpen ? 'rotate-180' : '',
                  )}
                />
              </button>

              {accountMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Terminal account actions"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(14rem,calc(100vw-1.5rem))] border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] p-2 sm:w-56"
                >
                  <div className="border border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] px-3 py-3">
                    <p className="truncate text-sm font-semibold text-[var(--terminal-text-primary)]">
                      {userEmail ?? 'Profile'}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
                      {accountCode}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1">
                    {[
                      { href: '/accounts', label: 'Account Center' },
                      { href: '/profile?tab=security', label: 'Security' },
                      { href: '/support', label: 'Support' },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className="flex min-h-[40px] items-center px-3 text-sm text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop metric cards */}
      <div className="hidden border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-3 md:block">
        <div className="grid gap-2 xl:grid-cols-6">
          {summaryMetrics.map((metric) => (
            <div
              key={metric.label}
              className="border border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] px-3 py-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
                {metric.label}
              </p>
              <p className={cn('price-display mt-2 text-sm font-semibold', metric.tone ?? 'text-[var(--terminal-text-primary)]')}>
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </div>
      {/* Mobile compact metric strip */}
      <div className="flex items-center gap-3 overflow-x-auto border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-2 md:hidden terminal-scrollbar">
        {summaryMetrics.map((metric) => (
          <div key={metric.label} className="flex shrink-0 items-center gap-1.5">
            <span className="text-[10px] font-medium text-[var(--terminal-text-secondary)]">{metric.label}</span>
            <span className={cn('price-display text-[10px] font-semibold', metric.tone ?? 'text-[var(--terminal-text-primary)]')}>
              {metric.value}
            </span>
          </div>
        ))}
      </div>

      {tradingBlockedMessage ? (
        <div className="border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] px-4 py-3">
          <div
            data-testid="trading-disabled-banner"
            className="flex flex-col gap-4 border border-amber-500/25 bg-amber-500/10 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center bg-amber-500/12 text-amber-300">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-200">{tradingBlockedMessage}</p>
                <p className="mt-1 text-sm text-amber-100/70">
                  Order entry remains disabled until the account is verified and funded for live trading.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {tradingBlockedActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    'inline-flex min-h-[40px] items-center justify-center border px-4 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40',
                    action.label === 'Deposit'
                      ? 'border-[var(--terminal-accent)] bg-[var(--terminal-accent)] text-[#0A0E1A] hover:opacity-90'
                      : 'border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] text-[var(--terminal-text-primary)] hover:bg-[var(--terminal-bg-hover)]',
                  )}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
