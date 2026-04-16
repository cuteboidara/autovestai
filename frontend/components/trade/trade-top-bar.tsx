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

const workspaceTabs = ['Chart', 'Positions', 'Watchlist', 'Portfolio', 'Tools'];

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
  const workspaceLabel =
    accountType === 'DEMO' ? 'Demo execution workspace' : 'Live execution workspace';

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
    <div
      data-testid="terminal-header"
      className="border-b border-[var(--terminal-border)] bg-[rgba(7,12,20,0.96)]"
    >
      <div className="border-b border-[var(--terminal-border)] px-3 py-2 lg:px-4">
        <div className="flex items-center gap-2">
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <div className="rounded-md border border-[var(--terminal-border)] bg-[rgba(15,22,34,0.72)] px-2 py-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-muted)]">
                Terminal
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--terminal-text-primary)]">
                {workspaceLabel}
              </p>
            </div>
          </div>

          <div className="terminal-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {workspaceTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={cn(
                  'inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-[11px] font-semibold transition duration-150',
                  tab === 'Chart'
                    ? 'border-[var(--terminal-border-strong)] bg-[rgba(128,148,184,0.14)] text-[var(--terminal-text-primary)]'
                    : 'border-transparent text-[var(--terminal-text-secondary)] hover:border-[var(--terminal-border)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              className="hidden h-8 items-center gap-2 rounded-md border border-[var(--terminal-border)] bg-[rgba(10,17,27,0.82)] px-3 text-left transition duration-150 hover:border-[var(--terminal-border-strong)] hover:bg-[var(--terminal-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/30 lg:inline-flex"
              onClick={onOpenAccountSwitcher}
            >
              <div className="min-w-0">
                <p className="terminal-label">Account</p>
                <p className="truncate text-xs font-semibold text-[var(--terminal-text-primary)]">
                  {displayAccount}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                  accountType === 'DEMO'
                    ? 'bg-amber-500/10 text-amber-300'
                    : 'bg-emerald-500/10 text-emerald-300',
                )}
              >
                {accountType === 'DEMO' ? 'Demo' : 'Live'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--terminal-text-secondary)]" />
            </button>

            <div
              className={cn(
                'hidden h-8 items-center gap-2 rounded-md border px-2.5 text-[11px] font-medium lg:inline-flex',
                websocketConnected
                  ? 'border-emerald-500/18 bg-emerald-500/8 text-emerald-300'
                  : 'border-amber-500/18 bg-amber-500/8 text-amber-300',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  websocketConnected ? 'bg-emerald-400 terminal-pulse' : 'bg-amber-300',
                )}
              />
              {websocketConnected ? 'Connected' : 'Reconnecting'}
            </div>

            <div className="hidden items-center gap-1 xl:flex">
              <Link
                href="/wallet?tab=deposit"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--terminal-border)] bg-[rgba(10,17,27,0.82)] px-3 text-[11px] font-semibold text-[var(--terminal-text-primary)] transition duration-150 hover:border-[var(--terminal-border-strong)] hover:bg-[var(--terminal-bg-hover)]"
              >
                <ArrowDownToLine className="h-3.5 w-3.5 text-[var(--terminal-green)]" />
                Deposit
              </Link>
              <Link
                href="/wallet?tab=withdraw"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--terminal-border)] bg-[rgba(10,17,27,0.82)] px-3 text-[11px] font-semibold text-[var(--terminal-text-secondary)] transition duration-150 hover:border-[var(--terminal-border-strong)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]"
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                Withdraw
              </Link>
            </div>

            <button
              type="button"
              aria-label="Notifications"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[rgba(10,17,27,0.82)] text-[var(--terminal-text-secondary)] transition duration-150 hover:border-[var(--terminal-border-strong)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]"
            >
              <Bell className="h-3.5 w-3.5" />
            </button>

            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--terminal-border)] bg-[rgba(10,17,27,0.82)] px-2.5 text-[11px] text-[var(--terminal-text-primary)] transition duration-150 hover:border-[var(--terminal-border-strong)] hover:bg-[var(--terminal-bg-hover)]"
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[rgba(255,255,255,0.04)] text-[10px] font-semibold text-[var(--terminal-text-primary)]">
                  {userEmail ? userEmail.slice(0, 2).toUpperCase() : <UserCircle2 className="h-3.5 w-3.5" />}
                </span>
                <span className="hidden max-w-[96px] truncate sm:inline">
                  {userEmail?.split('@')[0] ?? 'Profile'}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-[var(--terminal-text-secondary)] transition-transform',
                    accountMenuOpen ? 'rotate-180' : '',
                  )}
                />
              </button>

              {accountMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Terminal account actions"
                  className="terminal-panel absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(15rem,calc(100vw-1.5rem))] p-2 sm:w-60"
                >
                  <div className="rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.92)] px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-[var(--terminal-text-primary)]">
                      {userEmail ?? 'Profile'}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--terminal-text-secondary)]">
                      {accountCode}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--terminal-text-secondary)]">
                      Balance {balanceLabel}
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
                        className="flex min-h-[34px] items-center rounded-md px-3 text-[12px] text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]"
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

      <div
        data-testid="terminal-summary-strip"
        className="border-b border-[var(--terminal-border)] bg-[rgba(9,16,26,0.92)] px-3 py-1.5 lg:px-4"
      >
        <div className="terminal-scrollbar flex items-center overflow-x-auto">
          {summaryMetrics.map((metric, index) => (
            <div
              key={metric.label}
              className={cn(
                'flex min-w-[112px] shrink-0 flex-col gap-0.5 px-3 first:pl-0',
                index > 0 ? 'border-l border-[var(--terminal-border)]' : '',
              )}
            >
              <span className="terminal-label">{metric.label}</span>
              <span
                className={cn(
                  'price-display text-[12px] font-semibold',
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
        <div className="px-3 py-2 lg:px-4">
          <div
            data-testid="trading-disabled-banner"
            className="flex flex-col gap-2 rounded-md border border-amber-500/18 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-100 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex min-w-0 items-start gap-2">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <div className="min-w-0">
                <p className="font-semibold text-amber-100">{tradingBlockedMessage}</p>
                <p className="mt-0.5 text-amber-100/70">
                  Order entry remains disabled until the account is verified and funded for live trading.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tradingBlockedActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    'inline-flex h-8 items-center justify-center rounded-md border px-3 text-[11px] font-semibold transition duration-150',
                    action.label === 'Deposit'
                      ? 'border-[var(--terminal-border-strong)] bg-[var(--terminal-bg-hover)] text-[var(--terminal-text-primary)] hover:text-[var(--terminal-accent)]'
                      : 'border-amber-500/18 bg-[rgba(10,17,27,0.72)] text-amber-100/90 hover:bg-[rgba(19,32,53,0.78)]',
                  )}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
