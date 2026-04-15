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
  const displayAccount = accountNumber ? `Acct ${accountNumber}` : accountLabel;
  const workspaceLabel = accountType === 'DEMO' ? 'Demo execution workspace' : 'Live execution workspace';

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
      <div
        data-testid="terminal-header"
        className="border-b border-[var(--terminal-border)] bg-[rgba(6,11,19,0.88)] backdrop-blur-xl"
      >
        <div className="px-4 py-3 lg:px-5 xl:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 lg:flex-nowrap">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--terminal-accent)]/12 text-sm font-semibold text-[var(--terminal-accent)]">
                  AV
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-[var(--terminal-text-primary)]">
                    Trading Terminal
                  </p>
                  <p className="truncate text-xs text-[var(--terminal-text-secondary)]">
                    {workspaceLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="terminal-panel-soft flex h-11 w-full min-w-0 items-center justify-between gap-3 px-4 text-left transition duration-150 hover:bg-[var(--terminal-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40 sm:w-auto sm:min-w-[220px]"
                onClick={onOpenAccountSwitcher}
              >
                <div className="min-w-0">
                  <p className="terminal-label">Account</p>
                  <p className="truncate text-sm font-semibold text-[var(--terminal-text-primary)]">
                    {displayAccount}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold',
                      accountType === 'DEMO'
                        ? 'bg-amber-500/12 text-amber-300'
                        : 'bg-emerald-500/12 text-emerald-300',
                    )}
                  >
                    {accountType === 'DEMO' ? 'Demo' : 'Live'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[var(--terminal-text-secondary)]" />
                </div>
              </button>
            </div>

            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
              <div className="terminal-chip hidden lg:inline-flex">
                <span>Balance</span>
                <span className="price-display text-[13px] font-semibold text-[var(--terminal-text-primary)]">
                  {balanceLabel}
                </span>
              </div>

              <div
                className={cn(
                  'terminal-chip',
                  websocketConnected
                    ? 'text-emerald-300'
                    : 'text-amber-300',
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

              <div className="hidden items-center rounded-full border border-[var(--terminal-border)] bg-[rgba(15,23,42,0.55)] p-1 xl:flex">
                <Link
                  href="/wallet?tab=deposit"
                  className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
                >
                  <ArrowDownToLine className="h-4 w-4 text-[var(--terminal-accent)]" />
                  Deposit
                </Link>
                <Link
                  href="/wallet?tab=withdraw"
                  className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
                >
                  <ArrowUpFromLine className="h-4 w-4" />
                  Withdraw
                </Link>
              </div>

              <button
                type="button"
                aria-label="Notifications"
                className="terminal-panel-soft inline-flex h-11 w-11 items-center justify-center text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
              >
                <Bell className="h-4 w-4" />
              </button>

              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  className="terminal-panel-soft inline-flex h-11 items-center gap-2 px-3 text-sm text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] text-xs font-semibold text-[var(--terminal-text-primary)]">
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
                    className="terminal-panel absolute right-0 top-[calc(100%+0.6rem)] z-40 w-[min(15rem,calc(100vw-1.5rem))] p-2 sm:w-60"
                  >
                    <div className="terminal-panel-soft px-3 py-3">
                      <p className="truncate text-sm font-semibold text-[var(--terminal-text-primary)]">
                        {userEmail ?? 'Profile'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--terminal-text-secondary)]">
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
                          className="flex min-h-[40px] items-center rounded-2xl px-3 text-sm text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
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
      </div>

      <div
        data-testid="terminal-summary-strip"
        className="border-b border-[var(--terminal-border)] bg-[rgba(11,18,29,0.72)] px-4 py-3 lg:px-5 xl:px-6"
      >
        <div className="hidden gap-x-5 gap-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {summaryMetrics.map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 border-l border-[var(--terminal-border)] pl-4 first:border-l-0 first:pl-0"
            >
              <p className="terminal-label">{metric.label}</p>
              <p
                className={cn(
                  'price-display mt-1 text-[15px] font-semibold',
                  metric.tone ?? 'text-[var(--terminal-text-primary)]',
                )}
              >
                {metric.value}
              </p>
            </div>
          ))}
        </div>
        <div className="terminal-scrollbar flex items-center gap-4 overflow-x-auto md:hidden">
          {summaryMetrics.map((metric) => (
            <div key={metric.label} className="flex shrink-0 items-center gap-1.5">
              <span className="text-[11px] text-[var(--terminal-text-secondary)]">{metric.label}</span>
              <span
                className={cn(
                  'price-display text-[11px] font-semibold',
                  metric.tone ?? 'text-[var(--terminal-text-primary)]',
                )}
              >
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {tradingBlockedMessage ? (
        <div className="border-b border-[var(--terminal-border)] bg-[rgba(6,11,19,0.78)] px-4 py-2.5 lg:px-5 xl:px-6">
          <div
            data-testid="trading-disabled-banner"
            className="flex flex-col gap-3 rounded-2xl border border-amber-500/18 bg-amber-500/10 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-300">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-100">{tradingBlockedMessage}</p>
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
                    'inline-flex min-h-[38px] items-center justify-center rounded-full border px-4 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40',
                    action.label === 'Deposit'
                      ? 'border-[var(--terminal-accent)] bg-[var(--terminal-accent)] text-[#0A0E1A] hover:opacity-90'
                      : 'border-amber-500/18 bg-[rgba(15,23,42,0.55)] text-[var(--terminal-text-primary)] hover:bg-[var(--terminal-bg-hover)]',
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
