'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  UserCircle2,
  X,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AccountSwitcher } from '@/components/accounts/account-switcher';
import type { AppNavGroup, AppNavItem } from '@/components/navigation/navigation.types';
import { resolveActiveNav } from '@/components/navigation/navigation.utils';
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock';
import { adminRoute } from '@/lib/admin-route';
import { getAuthenticatedHomeRoute } from '@/lib/kyc-access';
import { cn, formatUsdt } from '@/lib/utils';
import { walletApi } from '@/services/api/wallet';
import { useAuthStore } from '@/store/auth-store';
import { useWalletStore } from '@/store/wallet-store';

import { WebsocketStatusIndicator } from './websocket-status-indicator';

interface AppShellProps {
  title: string;
  badgeLabel?: string;
  navGroups: AppNavGroup[];
  children: ReactNode;
  theme?: 'default' | 'client';
}

const shellStyles: CSSProperties = {
  '--shell-sidebar-width': '16rem',
  '--shell-sidebar-rail-width': '5rem',
  '--shell-navbar-height': '4.25rem',
} as CSSProperties;

interface ShellNavigationProps {
  navGroups: AppNavGroup[];
  activeItem: AppNavItem | null;
  onNavigate?: () => void;
  mobile?: boolean;
}

interface AccountCardProps {
  email: string;
  role: string;
  initials: string;
  mobile?: boolean;
  onLogout: () => void;
}

function ShellNavigation({
  navGroups,
  activeItem,
  onNavigate,
  mobile = false,
}: ShellNavigationProps) {
  return (
    <nav className={cn('min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-4', mobile ? 'mt-3' : '')}>
      {navGroups.map((group) => (
        <div key={group.label} className="mt-5 first:mt-0">
          <p
            className={cn(
              'px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#566072]',
              mobile ? '' : 'sr-only lg:not-sr-only',
            )}
          >
            {group.label}
          </p>
          <div className="mt-2 space-y-1">
            {group.items.map((item) => {
              const active = activeItem === item;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={!mobile ? item.label : undefined}
                  title={!mobile ? item.label : undefined}
                  onClick={onNavigate}
                  className={cn(
                    'group relative flex min-h-[46px] items-center rounded-xl text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
                    mobile
                      ? 'items-start gap-3 px-3 py-3'
                      : 'justify-center px-0 py-2.5 lg:justify-start lg:px-3',
                    active
                      ? 'bg-sidebarActive text-white shadow-[inset_0_0_0_1px_rgba(240,180,41,0.08)]'
                      : 'text-slate-300 hover:bg-sidebarHover hover:text-white',
                  )}
                >
                  <span className="pointer-events-none absolute inset-y-2 left-0 hidden w-[3px] rounded-full bg-accent lg:block" />
                  <span
                    className={cn(
                      'shrink-0 text-slate-400 transition-colors group-hover:text-white [&_svg]:h-4 [&_svg]:w-4',
                      active ? 'text-accent' : '',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 leading-5',
                      mobile
                        ? 'block break-words whitespace-normal'
                        : 'hidden lg:block lg:truncate lg:whitespace-nowrap',
                    )}
                  >
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span className="ml-auto inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-[#0D1320]">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AccountCard({
  email,
  role,
  initials,
  mobile = false,
  onLogout,
}: AccountCardProps) {
  return (
    <div className="mx-2 mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div
        className={cn(
          'flex items-center gap-3',
          mobile ? '' : 'justify-center lg:justify-start',
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
          {initials}
        </div>
        <div className={cn('min-w-0 flex-1', mobile ? 'block' : 'hidden lg:block')}>
          <p className="truncate text-sm font-medium text-white">{email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">
            {role}
          </p>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          onClick={onLogout}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function BrokerShell({
  title,
  badgeLabel,
  navGroups,
  children,
  theme = 'default',
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const sessionId = useAuthStore((state) => state.sessionId);
  const wallet = useWalletStore((state) => state.wallet);
  const setWalletSnapshot = useWalletStore((state) => state.setSnapshot);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const searchKey = searchParams.toString();
  const isTerminalRoute = pathname.startsWith('/trade');

  useBodyScrollLock(mobileNavOpen);

  const navState = useMemo(
    () => resolveActiveNav(navGroups, pathname, searchParams),
    [navGroups, pathname, searchKey, searchParams],
  );
  const navItems = useMemo(() => navGroups.flatMap((group) => group.items), [navGroups]);
  const activeGroup = navState.activeGroup ?? navGroups[0] ?? null;
  const activeItem = navState.activeItem ?? navItems[0] ?? null;
  const balanceValue = wallet?.balance;
  const accountEmail = user?.email ?? 'Guest';
  const accountRole = user?.adminRole ?? user?.role ?? 'USER';
  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
      : accountEmail.slice(0, 2).toUpperCase();
  const accountHomeHref = useMemo(
    () =>
      theme === 'client'
        ? '/accounts'
        : user
          ? getAuthenticatedHomeRoute(user)
          : '/accounts',
    [theme, user],
  );

  useEffect(() => {
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
  }, [pathname, searchKey]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (isTerminalRoute) {
      document.body.dataset.page = 'terminal';
    } else {
      delete document.body.dataset.page;
    }

    return () => {
      delete document.body.dataset.page;
    };
  }, [isTerminalRoute]);

  useEffect(() => {
    if (!token || user?.role === 'ADMIN') {
      return;
    }

    let active = true;
    let refreshTimer: number | undefined;

    const refreshWalletSnapshot = async () => {
      try {
        const snapshot = await walletApi.getWallet();

        if (active) {
          setWalletSnapshot(snapshot);
        }
      } catch {
        return undefined;
      }
    };

    void refreshWalletSnapshot();
    refreshTimer = window.setInterval(() => {
      void refreshWalletSnapshot();
    }, 30_000);

    return () => {
      active = false;
      if (refreshTimer) {
        window.clearInterval(refreshTimer);
      }
    };
  }, [setWalletSnapshot, token, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileNavOpen(false);
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen && !accountMenuOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      setMobileNavOpen(false);
      setAccountMenuOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [accountMenuOpen, mobileNavOpen]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [accountMenuOpen]);

  const handleLogout = () => {
    setMobileNavOpen(false);
    setAccountMenuOpen(false);

    void logout().finally(() => {
      router.push('/login');
    });
  };

  return (
    <div
      className={cn(
        'page-shell',
        theme === 'client' ? 'client-shell' : '',
        isTerminalRoute ? 'bg-[#0F1117]' : '',
      )}
      style={shellStyles}
    >
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--shell-sidebar-rail-width)] flex-col overflow-hidden border-r border-white/5 bg-sidebar text-inverse md:flex lg:w-[var(--shell-sidebar-width)]">
        <div className="flex min-h-0 flex-1 flex-col py-4">
          <div className="px-3">
            {user?.role === 'ADMIN' ? (
              <Link
                href={adminRoute()}
                className="flex min-h-[52px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 lg:justify-start"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-sm font-semibold text-accent">
                  AV
                </span>
                <div className="ml-3 hidden min-w-0 lg:block">
                  <p className="truncate text-sm font-semibold">AutovestAI</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    {badgeLabel ?? 'Client'}
                  </p>
                </div>
              </Link>
            ) : (
              <AccountSwitcher homeHref={accountHomeHref} />
            )}
            {badgeLabel ? (
              <div className="mt-4 hidden rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent lg:inline-flex">
                {badgeLabel}
              </div>
            ) : null}
          </div>

          <ShellNavigation navGroups={navGroups} activeItem={activeItem} />
          <AccountCard
            email={accountEmail}
            role={accountRole}
            initials={initials}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-40 bg-[#06080D]/70 backdrop-blur-sm md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-0.75rem))] max-w-[92vw] flex-col overflow-hidden border-r border-white/10 bg-sidebar text-inverse shadow-2xl shadow-black/40 md:hidden"
          >
            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {user?.role === 'ADMIN' ? (
                    <Link
                      href={adminRoute()}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white transition hover:bg-white/10"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-sm font-semibold text-accent">
                        AV
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">AutovestAI</p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                          {badgeLabel ?? 'Client'}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <AccountSwitcher
                      homeHref={accountHomeHref}
                      mobile
                      onNavigate={() => setMobileNavOpen(false)}
                    />
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {badgeLabel ? (
                <div className="mt-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                  {badgeLabel}
                </div>
              ) : null}
            </div>

            <ShellNavigation
              navGroups={navGroups}
              activeItem={activeItem}
              mobile
              onNavigate={() => setMobileNavOpen(false)}
            />
            <div className="pb-4">
              <AccountCard
                email={accountEmail}
                role={accountRole}
                initials={initials}
                mobile
                onLogout={handleLogout}
              />
            </div>
          </aside>
        </>
      ) : null}

      <div
        className={cn(
          'min-h-screen md:pl-[var(--shell-sidebar-rail-width)] lg:pl-[var(--shell-sidebar-width)]',
          isTerminalRoute ? 'bg-[#0F1117]' : '',
        )}
      >
        <header
          className={cn(
            'sticky top-0 z-30 border-b backdrop-blur',
            isTerminalRoute
              ? 'border-[#1E2235] bg-[#0B0E13]/95'
              : 'border-white/10 bg-sidebar/95',
          )}
        >
          <div className="mx-auto flex min-h-[var(--shell-navbar-height)] w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation menu"
                aria-expanded={mobileNavOpen}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 md:hidden"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {title}
                  {activeGroup ? ` / ${activeGroup.label}` : ''}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white sm:text-base">
                  {activeItem?.label ?? title}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden min-w-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white xl:inline-flex">
                {typeof balanceValue === 'number'
                  ? (
                    <>
                      <span className="shrink-0 text-slate-300">Balance</span>
                      <span className="price-display font-semibold text-white tabular-nums">
                        {formatUsdt(balanceValue)}
                      </span>
                    </>
                  )
                  : user?.role === 'ADMIN'
                    ? 'Admin session'
                    : 'Loading balance...'}
              </div>

              <div className="hidden lg:inline-flex">
                <WebsocketStatusIndicator />
              </div>

              <button
                type="button"
                aria-label="Notifications"
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 md:inline-flex"
              >
                <Bell className="h-4 w-4" />
              </button>

              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  className="inline-flex h-10 max-w-[3rem] items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 sm:max-w-[210px]"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <UserCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="hidden max-w-[120px] truncate sm:inline">
                    {accountEmail.split('@')[0]}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-slate-400 transition-transform',
                      accountMenuOpen ? 'rotate-180' : '',
                    )}
                  />
                </button>

                {accountMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Account actions"
                    className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#12161E] p-2 shadow-2xl shadow-black/40 sm:w-64"
                  >
                    <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-3">
                      <p className="truncate text-sm font-semibold text-white">{accountEmail}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        {accountRole}
                        {sessionId ? ` • ${sessionId.slice(0, 8)}` : ''}
                      </p>
                    </div>
                    <div className="mt-2 space-y-1">
                      <Link
                        href={accountHomeHref}
                        role="menuitem"
                        className="flex min-h-[42px] items-center rounded-xl px-3 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        {user?.role === 'ADMIN' ? 'Admin workspace' : 'Account center'}
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex min-h-[42px] w-full items-center rounded-xl px-3 text-left text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                        onClick={handleLogout}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main
          className={cn(
            'min-w-0',
            isTerminalRoute
              ? 'h-[calc(100dvh-var(--shell-navbar-height))] overflow-hidden bg-[#0F1117] p-0'
              : 'px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-8 xl:px-10 2xl:px-12',
          )}
        >
          {isTerminalRoute ? (
            children
          ) : (
            <div className="mx-auto w-full max-w-[1600px] min-w-0">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}

export const AppShell = BrokerShell;
export type { AppNavGroup, AppNavItem } from '@/components/navigation/navigation.types';
