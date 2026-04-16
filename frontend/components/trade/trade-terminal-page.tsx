'use client';

import { ChevronRight, X, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';

import { OrderTicket } from '@/components/trade/order-ticket';
import { TradeInstrumentHeader } from '@/components/trade/trade-instrument-header';
import { TradeTopBar } from '@/components/trade/trade-top-bar';
import { TradingViewPanel } from '@/components/trade/trading-view-panel';
import { WatchlistPanel } from '@/components/trade/watchlist-panel';
import { useAccountContext } from '@/context/account-context';
import {
  useLiveConnectionStatus,
  useLivePriceSubscription,
  useLiveQuote,
} from '@/hooks/use-live-prices';
import { calculateLivePositionPnl } from '@/lib/trade-live-metrics';
import { getActiveAccountLabel, getTradingAvailability } from '@/lib/trading-access';
import { cn, formatNumber, formatUsdt } from '@/lib/utils';
import { marketDataApi } from '@/services/api/market-data';
import { ordersApi } from '@/services/api/orders';
import { platformApi } from '@/services/api/platform';
import { positionsApi } from '@/services/api/positions';
import { walletApi } from '@/services/api/wallet';
import { useAuthStore } from '@/store/auth-store';
import { useMarketDataStore } from '@/store/market-data-store';
import { useNotificationStore } from '@/store/notification-store';
import { useOrdersStore } from '@/store/orders-store';
import { usePlatformStore } from '@/store/platform-store';
import { usePositionsStore } from '@/store/positions-store';
import { useWalletStore } from '@/store/wallet-store';
import { DEFAULT_WATCHLIST_SYMBOLS } from '@/store/market-data-store';
import { SymbolInfo } from '@/types/market-data';

const timeframeButtons = [
  { label: '1M', value: '1' },
  { label: '5M', value: '5' },
  { label: '15M', value: '15' },
  { label: '30M', value: '30' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: '1D' },
] as const;

const WATCHLIST_STORAGE_PREFIX = 'autovestai_watchlist_';

function getWatchlistStorageKey(userId?: string | null) {
  return userId ? `${WATCHLIST_STORAGE_PREFIX}${userId}` : null;
}

function readStoredWatchlist(storageKey: string | null) {
  if (!storageKey || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : null;
  } catch {
    return null;
  }
}

function writeStoredWatchlist(storageKey: string | null, symbols: string[]) {
  if (!storageKey || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(symbols));
}

function resolveWatchlistSymbols(preferredSymbols: string[], symbolList: SymbolInfo[]) {
  const symbolByNormalized = new Map(
    symbolList.map((symbol) => [symbol.symbol.trim().toUpperCase(), symbol.symbol] as const),
  );

  return preferredSymbols
    .map((symbol) => symbolByNormalized.get(symbol.trim().toUpperCase()) ?? null)
    .filter((symbol): symbol is string => Boolean(symbol));
}

function arraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function dateValue(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function resolutionMatches(
  supportedResolutions: string[] | undefined,
  resolution: string,
) {
  if (!supportedResolutions?.length) {
    return true;
  }

  return supportedResolutions.includes(resolution) || (
    resolution === '1D' && supportedResolutions.includes('D')
  );
}

function MobileSymbolSearchRow({
  symbol,
  isSelected,
  onSelect,
}: {
  symbol: SymbolInfo;
  isSelected: boolean;
  onSelect: (symbol: string) => void;
}) {
  const quote = useLiveQuote(symbol.symbol);

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-between border-b border-[var(--terminal-border)]/40 px-4 py-3 text-left transition duration-150',
        isSelected
          ? 'bg-[var(--terminal-accent)]/10'
          : 'hover:bg-[var(--terminal-bg-hover)]',
      )}
      onClick={() => onSelect(symbol.symbol)}
    >
      <div>
        <span className={cn('block text-sm font-semibold', isSelected ? 'text-[var(--terminal-accent)]' : 'text-[var(--terminal-text-primary)]')}>
          {symbol.symbol}
        </span>
        {symbol.description ? (
          <span className="block text-[11px] text-[var(--terminal-text-secondary)]">{symbol.description}</span>
        ) : null}
      </div>
      {quote ? (
        <div className="text-right">
          <span className="price-display block text-sm font-semibold text-[var(--terminal-green)]">
            {formatNumber(quote.bid, symbol.digits)}
          </span>
        </div>
      ) : null}
    </button>
  );
}

export function TradeTerminalPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const pushNotification = useNotificationStore((state) => state.push);
  const socketConnectionStatus = useLiveConnectionStatus();
  const selectedSymbol = useMarketDataStore((state) => state.selectedSymbol);
  const selectedResolution = useMarketDataStore((state) => state.selectedResolution);
  const watchlist = useMarketDataStore((state) => state.watchlist);
  const setSelectedSymbol = useMarketDataStore((state) => state.setSelectedSymbol);
  const setSelectedResolution = useMarketDataStore((state) => state.setSelectedResolution);
  const setWatchlist = useMarketDataStore((state) => state.setWatchlist);
  const upsertQuote = useMarketDataStore((state) => state.upsertQuote);
  const wallet = useWalletStore((state) => state.wallet);
  const setSnapshot = useWalletStore((state) => state.setSnapshot);
  const setOrders = useOrdersStore((state) => state.setOrders);
  const positions = usePositionsStore((state) => state.positions);
  const setPositions = usePositionsStore((state) => state.setPositions);
  const platformStatus = usePlatformStore((state) => state.status);
  const setPlatformStatus = usePlatformStore((state) => state.setStatus);
  const {
    accounts,
    activeAccount,
    activeAccountId,
    setSwitcherOpen,
    resetDemoAccount,
  } = useAccountContext();
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchlistCollapsed, setWatchlistCollapsed] = useState(false);
  const [preferredSide, setPreferredSide] = useState<'BUY' | 'SELL' | null>(null);
  const [mobileSymbolModalOpen, setMobileSymbolModalOpen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const watchlistStorageKey = useMemo(() => getWatchlistStorageKey(user?.id), [user?.id]);

  const activeSymbol = selectedSymbol.trim();
  const selectedSymbolInfo = useMemo(
    () => symbols.find((symbol) => symbol.symbol === activeSymbol),
    [activeSymbol, symbols],
  );
  const selectedQuote = useLiveQuote(activeSymbol);
  const selectedSymbolHealth = activeSymbol
    ? platformStatus?.symbolHealth[activeSymbol]
    : undefined;
  const selectedHealthStatus = selectedSymbolHealth?.status ?? selectedQuote?.healthStatus;
  const resolvedTimeframes = useMemo(
    () =>
      timeframeButtons.map((timeframe) => ({
        ...timeframe,
        enabled: resolutionMatches(selectedSymbolInfo?.supported_resolutions, timeframe.value),
      })),
    [selectedSymbolInfo?.supported_resolutions],
  );
  const openPositions = useMemo(
    () =>
      positions
        .filter(
          (position) =>
            position.status === 'OPEN' &&
            (!activeAccountId || position.accountId === activeAccountId),
        )
        .sort(
          (left, right) =>
            dateValue(right.openedAt ?? right.updatedAt) -
            dateValue(left.openedAt ?? left.updatedAt),
        ),
    [activeAccountId, positions],
  );
  const filteredSymbols = useMemo(
    () =>
      symbolSearch.trim()
        ? symbols.filter(
            (s) =>
              s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) ||
              (s.description ?? '').toLowerCase().includes(symbolSearch.toLowerCase()),
          )
        : symbols,
    [symbolSearch, symbols],
  );
  const liveSubscriptionSymbols = useMemo(
    () =>
      [...new Set([
        ...watchlist,
        ...openPositions.map((position) => position.symbol),
        activeSymbol,
        ...(mobileSymbolModalOpen ? filteredSymbols.map((symbol) => symbol.symbol) : []),
      ])].filter(Boolean),
    [activeSymbol, filteredSymbols, mobileSymbolModalOpen, openPositions, watchlist],
  );
  useLivePriceSubscription(liveSubscriptionSymbols);
  const liveFloatingPnl = useMarketDataStore((state) =>
    openPositions.reduce(
      (total, position) => total + calculateLivePositionPnl(position, state.quotes[position.symbol]),
      0,
    ),
  );

  const refreshTerminalData = useCallback(async () => {
    const accountQuery = activeAccountId
      ? `accountId=${encodeURIComponent(activeAccountId)}`
      : undefined;
    const [walletSnapshot, orderItems, positionItems] = await Promise.all([
      walletApi.getWallet(),
      ordersApi.list(accountQuery),
      positionsApi.list(activeAccountId, 'ALL'),
    ]);

    setSnapshot(walletSnapshot);
    setOrders(orderItems);
    setPositions(positionItems);
  }, [activeAccountId, setOrders, setPositions, setSnapshot]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [symbolList] = await Promise.all([
          marketDataApi.listSymbols({ enabledOnly: true }),
          refreshTerminalData(),
        ]);

        const enabledSymbols = symbolList.map((item) => item.symbol);
        const enabledSet = new Set(enabledSymbols);
        const storedWatchlist = resolveWatchlistSymbols(
          readStoredWatchlist(watchlistStorageKey) ?? [],
          symbolList,
        ).filter((symbol) => enabledSet.has(symbol));
        const currentWatchlist = resolveWatchlistSymbols(watchlist, symbolList).filter(
          (symbol) => enabledSet.has(symbol),
        );
        const defaultWatchlist = resolveWatchlistSymbols(
          [...DEFAULT_WATCHLIST_SYMBOLS],
          symbolList,
        ).filter((symbol) => enabledSet.has(symbol));
        const resolvedWatchlist =
          storedWatchlist.length > 0
            ? storedWatchlist
            : currentWatchlist.length > 0
              ? currentWatchlist
              : defaultWatchlist.length > 0
                ? defaultWatchlist
                : enabledSymbols.slice(0, DEFAULT_WATCHLIST_SYMBOLS.length);
        const nextActiveSymbol =
          activeSymbol === ''
            ? ''
            : activeSymbol && enabledSet.has(activeSymbol)
              ? activeSymbol
              : resolvedWatchlist[0] ?? '';
        const universe = [...new Set([...resolvedWatchlist, nextActiveSymbol])].filter(Boolean);
        const quoteResults = await marketDataApi.getPrices(universe).catch(() => []);

        if (!active) {
          return;
        }

        setSymbols(symbolList);
        if (!arraysEqual(watchlist, resolvedWatchlist)) {
          setWatchlist(resolvedWatchlist);
        }

        if (nextActiveSymbol !== activeSymbol) {
          setSelectedSymbol(nextActiveSymbol);
        }

        quoteResults.forEach((quote) => upsertQuote(quote));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [
    activeSymbol,
    refreshTerminalData,
    setSelectedSymbol,
    setWatchlist,
    upsertQuote,
    watchlist,
    watchlistStorageKey,
  ]);

  useEffect(() => {
    if (watchlist.length === 0) {
      return;
    }

    writeStoredWatchlist(watchlistStorageKey, watchlist);
  }, [watchlist, watchlistStorageKey]);

  useEffect(() => {
    const activeTimeframe =
      resolvedTimeframes.find((timeframe) => timeframe.value === selectedResolution) ?? null;

    if (activeTimeframe?.enabled || resolvedTimeframes.length === 0) {
      return;
    }

    const fallback = resolvedTimeframes.find((timeframe) => timeframe.enabled)?.value;
    if (fallback && fallback !== selectedResolution) {
      setSelectedResolution(fallback);
    }
  }, [resolvedTimeframes, selectedResolution, setSelectedResolution]);

  useEffect(() => {
    if (socketConnectionStatus === 'connected') {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshTerminalData().catch(() => undefined);
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [refreshTerminalData, socketConnectionStatus]);

  useEffect(() => {
    if (!activeSymbol || (socketConnectionStatus === 'connected' && selectedHealthStatus !== 'stale')) {
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      void Promise.allSettled([
        marketDataApi.getPrice(activeSymbol).then((quote) => {
          if (active) {
            upsertQuote(quote);
          }
        }),
        platformApi.getStatus().then((status) => {
          if (active) {
            setPlatformStatus(status);
          }
        }),
      ]);
    }, 3_000);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    activeSymbol,
    selectedHealthStatus,
    setPlatformStatus,
    upsertQuote,
    socketConnectionStatus,
  ]);

  const floatingPnl = liveFloatingPnl;
  const usedMargin =
    wallet?.usedMargin ??
    openPositions.reduce((total, position) => total + position.marginUsed, 0);
  const derivedEquity =
    typeof wallet?.balance === 'number'
      ? wallet.balance + floatingPnl
      : wallet?.equity ?? null;
  const derivedFreeMargin =
    derivedEquity != null
      ? derivedEquity - usedMargin
      : wallet?.freeMargin ?? null;
  const derivedMarginLevel =
    derivedEquity != null && usedMargin > 0
      ? (derivedEquity / usedMargin) * 100
      : usedMargin > 0
        ? wallet?.marginLevel ?? null
        : null;
  const tradingAvailability = getTradingAvailability(user, wallet);
  const demoAccount = activeAccount?.type === 'DEMO' ? activeAccount : null;
  const hasLiveAccount = accounts.some(
    (account) => account.type === 'LIVE' && account.status === 'ACTIVE',
  );
  const summaryMetrics = useMemo(
    () => [
      { label: 'Balance', value: wallet ? formatUsdt(wallet.balance) : '--' },
      { label: 'Equity', value: derivedEquity != null ? formatUsdt(derivedEquity) : '--' },
      {
        label: 'Free Margin',
        value: derivedFreeMargin != null ? formatUsdt(derivedFreeMargin) : '--',
      },
      { label: 'Margin Used', value: wallet ? formatUsdt(usedMargin) : '--' },
      {
        label: 'Margin Level',
        value:
          derivedMarginLevel != null
            ? `${formatNumber(derivedMarginLevel, 2)}%`
            : '--',
      },
      {
        label: 'Floating PnL',
        value: formatUsdt(floatingPnl),
        tone:
          floatingPnl >= 0
            ? 'text-[var(--terminal-green)]'
            : 'text-[var(--terminal-red)]',
      },
    ],
    [derivedEquity, derivedFreeMargin, derivedMarginLevel, floatingPnl, usedMargin, wallet],
  );
  const spreadDisplay =
    selectedQuote && selectedSymbolInfo
      ? formatNumber(selectedQuote.ask - selectedQuote.bid, selectedSymbolInfo.digits)
      : '--';
  const terminalLayoutStyle = useMemo(
    () =>
      ({
        '--trade-watchlist-width': watchlistCollapsed ? '48px' : '284px',
        '--trade-ticket-width': '320px',
      }) as CSSProperties,
    [watchlistCollapsed],
  );
  const marketStatus =
    selectedHealthStatus === 'disabled'
      ? 'DISABLED'
      : selectedHealthStatus === 'closed'
        ? 'CLOSED'
        : selectedHealthStatus === 'delayed'
          ? 'DELAYED'
          : selectedHealthStatus === 'stale'
            ? 'STALE'
            : selectedHealthStatus === 'degraded' ||
                selectedHealthStatus === 'down'
              ? 'DEGRADED'
              : selectedQuote?.marketStatus ??
                (selectedQuote?.delayed
                  ? 'DELAYED'
                  : selectedQuote?.marketState && selectedQuote.marketState !== 'LIVE'
                    ? selectedQuote.marketState
                    : 'LIVE');
  const topBarConnectionStatus =
    socketConnectionStatus === 'connected' && marketStatus === 'STALE'
      ? 'stale'
      : socketConnectionStatus;
  const openAccountSwitcher = useCallback(() => {
    setSwitcherOpen(true);
  }, [setSwitcherOpen]);
  const clearSelectedSymbol = useCallback(() => {
    setSelectedSymbol('');
  }, [setSelectedSymbol]);
  const collapseWatchlist = useCallback(() => {
    setWatchlistCollapsed(true);
  }, []);
  const handleOrderSubmitted = useCallback(() => refreshTerminalData(), [refreshTerminalData]);
  const handleMobileSymbolSelect = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol);
      setMobileSymbolModalOpen(false);
    },
    [setSelectedSymbol],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--terminal-bg-primary)] text-[var(--terminal-text-primary)]">
      <div className="flex h-full flex-col">
        <TradeTopBar
          accountLabel={getActiveAccountLabel(user, wallet)}
          accountNumber={activeAccount?.accountNo}
          accountType={wallet?.type ?? activeAccount?.type}
          balanceLabel={wallet ? formatUsdt(wallet.balance) : 'Loading balance...'}
          connectionStatus={topBarConnectionStatus}
          userEmail={user?.email}
          summaryMetrics={summaryMetrics}
          tradingBlockedMessage={tradingAvailability.message}
          tradingBlockedActions={tradingAvailability.actions}
          onOpenAccountSwitcher={openAccountSwitcher}
        />

        {demoAccount ? (
          <div className="border-b border-[var(--terminal-border)] bg-[rgba(7,12,20,0.92)] px-3 py-2 text-[11px] text-amber-100 lg:px-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <p className="font-medium text-amber-100/92">
                Demo account {demoAccount.accountNo} active. Virtual balance {formatUsdt(demoAccount.balance)}.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-amber-500/25 bg-amber-500/8 px-3 text-[11px] font-semibold text-amber-200 transition duration-150 hover:bg-amber-500/12"
                  onClick={() => {
                    void resetDemoAccount(demoAccount.id)
                      .then(() => refreshTerminalData())
                      .then(() => {
                        pushNotification({
                          title: 'Demo balance reset',
                          description: `${demoAccount.accountNo} restored to ${formatUsdt(10_000)}`,
                          type: 'success',
                        });
                      })
                      .catch((error) => {
                        pushNotification({
                          title: 'Unable to reset demo balance',
                          description:
                            error instanceof Error ? error.message : 'Request failed',
                          type: 'error',
                        });
                      });
                  }}
                >
                  Reset
                </button>

                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--terminal-border-strong)] bg-[var(--terminal-bg-hover)] px-3 text-[11px] font-semibold text-[var(--terminal-text-primary)] transition duration-150 hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-accent)]"
                  onClick={() => {
                    if (
                      typeof window !== 'undefined' &&
                      window.matchMedia('(max-width: 767px)').matches
                    ) {
                      router.push(hasLiveAccount ? '/accounts' : '/wallet?tab=deposit');
                      return;
                    }

                    setSwitcherOpen(true);
                  }}
                >
                  Switch to Live
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 bg-[var(--terminal-bg-primary)]">
          <div className="flex min-h-0 w-full flex-1 flex-col px-2 py-2 lg:px-3 lg:py-3">
            <div
              data-testid="trade-terminal-scroll-region"
              style={terminalLayoutStyle}
              className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto pb-[env(safe-area-inset-bottom)] md:pb-0 lg:grid lg:grid-cols-[var(--trade-watchlist-width)_minmax(0,1fr)_var(--trade-ticket-width)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden"
            >
              <button
                type="button"
                className="terminal-panel-soft flex shrink-0 items-center justify-between px-3 py-2 text-left lg:hidden"
                onClick={() => {
                  setSymbolSearch('');
                  setMobileSymbolModalOpen(true);
                }}
              >
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--terminal-text-muted)]">
                    Active Market
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-[var(--terminal-text-primary)]">
                    {activeSymbol || 'Select Symbol'}
                  </span>
                  {selectedQuote && selectedSymbolInfo ? (
                    <span className="price-display mt-1 block text-[11px] text-[var(--terminal-text-secondary)]">
                      <span className="text-[var(--terminal-red)]">
                        {formatNumber(selectedQuote.bid, selectedSymbolInfo.digits)}
                      </span>
                      {' / '}
                      <span className="text-[var(--terminal-green)]">
                        {formatNumber(selectedQuote.ask, selectedSymbolInfo.digits)}
                      </span>
                      {' · '}Spread {spreadDisplay}
                    </span>
                  ) : (
                    <span className="mt-1 block text-[11px] text-[var(--terminal-text-secondary)]">
                      Open symbol explorer
                    </span>
                  )}
                </div>
                <Search className="ml-2 h-4 w-4 shrink-0 text-[var(--terminal-text-secondary)]" />
              </button>

              <div className="hidden min-h-0 lg:block">
                {watchlistCollapsed ? (
                  <button
                    type="button"
                    className="terminal-panel flex h-full w-full items-center justify-center text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
                    onClick={() => setWatchlistCollapsed(false)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <WatchlistPanel
                    symbols={symbols}
                    watchlist={watchlist}
                    selectedSymbol={selectedSymbol}
                    loading={loading}
                    onSelect={setSelectedSymbol}
                    onClearSelection={clearSelectedSymbol}
                    onToggleCollapse={collapseWatchlist}
                    collapsed={watchlistCollapsed}
                    className="h-full"
                  />
                )}
              </div>

              <div className="terminal-panel flex min-h-[320px] min-w-0 flex-col overflow-hidden lg:min-h-0">
                <TradeInstrumentHeader
                  symbol={activeSymbol}
                  symbolInfo={selectedSymbolInfo}
                  quote={selectedQuote}
                  spreadDisplay={spreadDisplay}
                  marketStatus={marketStatus}
                  timeframes={resolvedTimeframes}
                  selectedTimeframe={selectedResolution}
                  onSelectTimeframe={setSelectedResolution}
                  onPreferredSideChange={setPreferredSide}
                />

                <div className="h-[46vh] min-h-[320px] shrink-0 md:h-[52vh] lg:h-auto lg:min-h-0 lg:flex-1">
                  <TradingViewPanel
                    symbol={activeSymbol}
                    resolution={selectedResolution}
                    className="h-full"
                  />
                </div>
              </div>

              <div className="min-w-0 lg:min-h-0">
                <OrderTicket
                  accountId={activeAccountId}
                  selectedSymbol={activeSymbol}
                  symbols={symbols}
                  quote={selectedQuote}
                  onSymbolChange={setSelectedSymbol}
                  onSubmitted={handleOrderSubmitted}
                  preferredSide={preferredSide}
                  accountDisabledReason={tradingAvailability.message}
                  isMobileLayout={false}
                  className="h-auto lg:h-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile fullscreen symbol search modal */}
        {mobileSymbolModalOpen ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-[var(--terminal-bg-primary)] md:hidden">
            <div className="flex shrink-0 items-center gap-3 border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-[var(--terminal-text-secondary)]" />
              <input
                autoFocus
                type="text"
                placeholder="Search symbols…"
                value={symbolSearch}
                onChange={(e) => setSymbolSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--terminal-text-primary)] placeholder:text-[var(--terminal-text-secondary)] focus:outline-none"
              />
              <button
                type="button"
                aria-label="Close symbol search"
                className="shrink-0 text-[var(--terminal-text-secondary)] hover:text-[var(--terminal-text-primary)]"
                onClick={() => setMobileSymbolModalOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="terminal-scrollbar flex-1 overflow-y-auto">
              {filteredSymbols.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[var(--terminal-text-secondary)]">No symbols found</p>
              ) : (
                filteredSymbols.map((sym) => {
                  const isSelected = sym.symbol === activeSymbol;
                  return (
                    <MobileSymbolSearchRow
                      key={sym.symbol}
                      symbol={sym}
                      isSelected={isSelected}
                      onSelect={handleMobileSymbolSelect}
                    />
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div
          style={terminalLayoutStyle}
          className="pointer-events-none absolute inset-0 z-10 hidden bg-[var(--terminal-bg-primary)]/82 px-2 py-2 lg:grid lg:grid-cols-[var(--trade-watchlist-width)_minmax(0,1fr)_var(--trade-ticket-width)] lg:grid-rows-[minmax(0,1fr)] lg:gap-2 lg:px-3 lg:py-3"
        >
          <div className="terminal-panel space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--terminal-bg-elevated)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                  <div className="h-3 w-36 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-12 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                  <div className="h-3 w-10 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                </div>
              </div>
            ))}
          </div>
          <div className="terminal-panel p-4">
            <div className="h-full animate-pulse rounded-xl bg-[var(--terminal-bg-elevated)]" />
          </div>
          <div className="terminal-panel space-y-4 p-4">
            <div className="h-10 w-full animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 w-full animate-pulse rounded bg-[var(--terminal-bg-elevated)]"
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
