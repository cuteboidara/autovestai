'use client';

import { ChevronRight, X, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { OrderTicket } from '@/components/trade/order-ticket';
import {
  TradeActivityPanel,
  TradeBottomTab,
  TradeBottomTabMeta,
} from '@/components/trade/trade-activity-panel';
import { TradeInstrumentHeader } from '@/components/trade/trade-instrument-header';
import { TradeTopBar } from '@/components/trade/trade-top-bar';
import { TradingViewPanel } from '@/components/trade/trading-view-panel';
import { WatchlistPanel } from '@/components/trade/watchlist-panel';
import { useAccountContext } from '@/context/account-context';
import { useLivePrices } from '@/hooks/use-live-prices';
import { getActiveAccountLabel, getTradingAvailability } from '@/lib/trading-access';
import { cn, formatNumber, formatUsdt } from '@/lib/utils';
import { marketDataApi } from '@/services/api/market-data';
import { ordersApi } from '@/services/api/orders';
import { platformApi } from '@/services/api/platform';
import { positionsApi } from '@/services/api/positions';
import { walletApi } from '@/services/api/wallet';
import { useAdminStore } from '@/store/admin-store';
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

const bottomTabMeta: Record<TradeBottomTab, TradeBottomTabMeta> = {
  open: {
    label: 'Open Positions',
    shortLabel: 'Open',
    emptyTitle: 'No open positions',
    emptyDescription: 'Filled live trades will appear here once market exposure is active.',
  },
  pending: {
    label: 'Pending Orders',
    shortLabel: 'Pending',
    emptyTitle: 'No pending orders',
    emptyDescription: 'Working limit orders will appear here when they are queued for execution.',
  },
  closed: {
    label: 'Closed Positions',
    shortLabel: 'Closed',
    emptyTitle: 'No closed positions',
    emptyDescription: 'Settled positions and realized results will appear here after positions close.',
  },
  history: {
    label: 'Order History',
    shortLabel: 'History',
    emptyTitle: 'No order history',
    emptyDescription: 'Executed, rejected, and cancelled orders will appear here once routing activity starts.',
  },
};

function mapSearchTab(value: string | null): TradeBottomTab {
  if (value === 'orders') return 'pending';
  if (value === 'history') return 'history';
  if (value === 'closed') return 'closed';
  return 'open';
}

function mapBottomTabToSearch(tab: TradeBottomTab) {
  if (tab === 'pending') return 'orders';
  if (tab === 'history') return 'history';
  if (tab === 'closed') return 'closed';
  return 'open';
}

function clampHeight(value: number) {
  return Math.min(Math.max(value, 220), 420);
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

export function TradeTerminalPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const pushNotification = useNotificationStore((state) => state.push);
  const websocketConnected = useAdminStore((state) => state.websocketConnected);
  const selectedSymbol = useMarketDataStore((state) => state.selectedSymbol);
  const selectedResolution = useMarketDataStore((state) => state.selectedResolution);
  const watchlist = useMarketDataStore((state) => state.watchlist);
  const quotes = useMarketDataStore((state) => state.quotes);
  const setSelectedSymbol = useMarketDataStore((state) => state.setSelectedSymbol);
  const setSelectedResolution = useMarketDataStore((state) => state.setSelectedResolution);
  const setWatchlist = useMarketDataStore((state) => state.setWatchlist);
  const upsertQuote = useMarketDataStore((state) => state.upsertQuote);
  const wallet = useWalletStore((state) => state.wallet);
  const setSnapshot = useWalletStore((state) => state.setSnapshot);
  const orders = useOrdersStore((state) => state.orders);
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
  const [positionsHeight, setPositionsHeight] = useState(280);
  const [mobilePositionsExpanded, setMobilePositionsExpanded] = useState(false);
  const [preferredSide, setPreferredSide] = useState<'BUY' | 'SELL' | null>(null);
  const [mobileSymbolModalOpen, setMobileSymbolModalOpen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [flashedPnlIds, setFlashedPnlIds] = useState<Record<string, true>>({});
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const previousPnlRef = useRef<Record<string, number>>({});
  // Subscribe to all loaded symbols so the watchlist panel shows live prices for every instrument
  const allSymbolKeys = useMemo(() => symbols.map((s) => s.symbol), [symbols]);
  const liveQuotes = useLivePrices([...allSymbolKeys, selectedSymbol]);
  const watchlistStorageKey = useMemo(() => getWatchlistStorageKey(user?.id), [user?.id]);

  const activeBottomTab = mapSearchTab(searchParams.get('tab'));
  const activeSymbol = selectedSymbol.trim();
  const terminalQuotes = useMemo(
    () => ({
      ...quotes,
      ...liveQuotes,
    }),
    [liveQuotes, quotes],
  );
  const selectedSymbolInfo = useMemo(
    () => symbols.find((symbol) => symbol.symbol === activeSymbol),
    [activeSymbol, symbols],
  );
  const selectedQuote = activeSymbol ? terminalQuotes[activeSymbol] : undefined;
  const selectedSymbolHealth = activeSymbol
    ? platformStatus?.symbolHealth[activeSymbol]
    : undefined;
  const symbolDigitsMap = useMemo(
    () => Object.fromEntries(symbols.map((symbol) => [symbol.symbol, symbol.digits])),
    [symbols],
  );
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
  const closedPositions = useMemo(
    () =>
      positions
        .filter(
          (position) =>
            position.status === 'CLOSED' &&
            (!activeAccountId || position.accountId === activeAccountId),
        )
        .sort(
          (left, right) =>
            dateValue(right.closedAt ?? right.updatedAt) -
            dateValue(left.closedAt ?? left.updatedAt),
        ),
    [activeAccountId, positions],
  );
  const pendingOrders = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            ['PENDING', 'OPEN', 'PROCESSING'].includes(order.status) &&
            (!activeAccountId || order.accountId === activeAccountId),
        )
        .sort((left, right) => dateValue(right.updatedAt) - dateValue(left.updatedAt)),
    [activeAccountId, orders],
  );
  const orderHistory = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            ['EXECUTED', 'REJECTED', 'CANCELLED'].includes(order.status) &&
            (!activeAccountId || order.accountId === activeAccountId),
        )
        .sort((left, right) => dateValue(right.updatedAt) - dateValue(left.updatedAt)),
    [activeAccountId, orders],
  );

  async function refreshTerminalData() {
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
  }

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
        const quoteResults = await Promise.allSettled(
          universe.map((symbol) => marketDataApi.getPrice(symbol)),
        );

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

        quoteResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            upsertQuote(result.value);
          }
        });
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
    activeAccountId,
    activeSymbol,
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
    const intervalId = window.setInterval(() => {
      void refreshTerminalData().catch(() => undefined);
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, [activeAccountId]);

  useEffect(() => {
    if (!activeSymbol || (websocketConnected && selectedSymbolHealth?.status !== 'stale')) {
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
    selectedSymbolHealth?.status,
    setPlatformStatus,
    upsertQuote,
    websocketConnected,
  ]);

  useEffect(() => {
    const nextFlashes: Record<string, true> = {};

    for (const position of openPositions) {
      const nextPnl = position.unrealizedPnl ?? position.pnl;
      const previous = previousPnlRef.current[position.id];

      if (typeof previous === 'number' && previous !== nextPnl) {
        nextFlashes[position.id] = true;
      }

      previousPnlRef.current[position.id] = nextPnl;
    }

    if (Object.keys(nextFlashes).length === 0) {
      return;
    }

    setFlashedPnlIds((current) => ({ ...current, ...nextFlashes }));
  }, [openPositions]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!resizeStateRef.current) {
        return;
      }

      const nextHeight = clampHeight(
        resizeStateRef.current.startHeight - (event.clientY - resizeStateRef.current.startY),
      );
      setPositionsHeight(nextHeight);
    }

    function handleMouseUp() {
      resizeStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const floatingPnl =
    typeof wallet?.unrealizedPnl === 'number'
      ? wallet.unrealizedPnl
      : openPositions.reduce(
          (total, position) => total + (position.unrealizedPnl ?? position.pnl),
          0,
        );
  const tradingAvailability = getTradingAvailability(user, wallet);
  const demoAccount = activeAccount?.type === 'DEMO' ? activeAccount : null;
  const hasLiveAccount = accounts.some(
    (account) => account.type === 'LIVE' && account.status === 'ACTIVE',
  );
  const summaryMetrics = [
    { label: 'Balance', value: wallet ? formatUsdt(wallet.balance) : '--' },
    { label: 'Equity', value: wallet ? formatUsdt(wallet.equity) : '--' },
    { label: 'Free Margin', value: wallet ? formatUsdt(wallet.freeMargin) : '--' },
    { label: 'Margin Used', value: wallet ? formatUsdt(wallet.usedMargin) : '--' },
    {
      label: 'Margin Level',
      value:
        wallet?.marginLevel != null
          ? `${formatNumber(wallet.marginLevel, 2)}%`
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
  ];
  const rows =
    activeBottomTab === 'open'
      ? openPositions
      : activeBottomTab === 'pending'
        ? pendingOrders
        : activeBottomTab === 'closed'
          ? closedPositions
          : orderHistory;
  const spreadDisplay =
    selectedQuote && selectedSymbolInfo
      ? formatNumber(selectedQuote.ask - selectedQuote.bid, selectedSymbolInfo.digits)
      : '--';
  const filteredSymbols = useMemo(
    () =>
      symbolSearch.trim()
        ? symbols.filter(
            (s) =>
              s.symbol.toLowerCase().includes(symbolSearch.toLowerCase()) ||
              (s.description ?? '').toLowerCase().includes(symbolSearch.toLowerCase()),
          )
        : symbols,
    [symbols, symbolSearch],
  );
  const marketStatus =
    selectedSymbolHealth?.status === 'disabled'
      ? 'DISABLED'
      : selectedSymbolHealth?.status === 'closed'
        ? 'CLOSED'
        : selectedSymbolHealth?.status === 'delayed'
          ? 'DELAYED'
          : selectedSymbolHealth?.status === 'stale'
            ? 'STALE'
            : selectedSymbolHealth?.status === 'degraded' ||
                selectedSymbolHealth?.status === 'down'
              ? 'DEGRADED'
              : selectedQuote?.marketStatus ??
                (selectedQuote?.delayed
                  ? 'DELAYED'
                  : selectedQuote?.marketState && selectedQuote.marketState !== 'LIVE'
                    ? selectedQuote.marketState
                    : 'LIVE');

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--terminal-bg-primary)] text-[var(--terminal-text-primary)]">
      <div className="flex h-full flex-col">
        <TradeTopBar
          accountLabel={getActiveAccountLabel(user, wallet)}
          accountNumber={activeAccount?.accountNo}
          accountType={wallet?.type ?? activeAccount?.type}
          balanceLabel={wallet ? formatUsdt(wallet.balance) : 'Loading balance...'}
          websocketConnected={websocketConnected}
          userEmail={user?.email}
          summaryMetrics={summaryMetrics}
          tradingBlockedMessage={tradingAvailability.message}
          tradingBlockedActions={tradingAvailability.actions}
          onOpenAccountSwitcher={() => setSwitcherOpen(true)}
        />

        {demoAccount ? (
          <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="font-semibold">
                DEMO ACCOUNT {demoAccount.accountNo} • Virtual Balance{' '}
                {formatUsdt(demoAccount.balance)}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[38px] items-center justify-center border border-amber-500/30 bg-amber-500/10 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200 transition duration-150 hover:bg-amber-500/20"
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
                  Reset Balance
                </button>

                <button
                  type="button"
                  className="inline-flex min-h-[38px] items-center justify-center border border-amber-500/30 bg-amber-500 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#0A0E1A] transition duration-150 hover:opacity-90"
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
          <div
            className="hidden min-h-0 shrink-0 border-r border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] md:block"
            style={{ width: watchlistCollapsed ? 68 : 260 }}
          >
            {watchlistCollapsed ? (
              <button
                type="button"
                className="flex h-full w-full items-center justify-center text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40"
                onClick={() => setWatchlistCollapsed(false)}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <WatchlistPanel
                symbols={symbols}
                watchlist={watchlist}
                quotes={terminalQuotes}
                selectedSymbol={selectedSymbol}
                loading={loading}
                onSelect={setSelectedSymbol}
                onClearSelection={() => setSelectedSymbol('')}
                onToggleCollapse={() => setWatchlistCollapsed(true)}
                className="h-full"
              />
            )}
          </div>

          <div
            data-testid="trade-terminal-scroll-region"
            className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-[calc(88px+env(safe-area-inset-bottom))] md:overflow-hidden md:pb-0"
          >
            {/* Mobile: symbol selector bar */}
            <button
              type="button"
              className="flex shrink-0 items-center justify-between border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-2.5 text-left md:hidden"
              onClick={() => { setSymbolSearch(''); setMobileSymbolModalOpen(true); }}
            >
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--terminal-text-primary)]">
                  {activeSymbol || 'Select Symbol'}
                </span>
                {selectedQuote && selectedSymbolInfo ? (
                  <span className="price-display block text-[10px] text-[var(--terminal-text-secondary)]">
                    <span className="text-[var(--terminal-green)]">{formatNumber(selectedQuote.bid, selectedSymbolInfo.digits)}</span>
                    {' / '}
                    <span className="text-[var(--terminal-red)]">{formatNumber(selectedQuote.ask, selectedSymbolInfo.digits)}</span>
                    {' · '}spread {spreadDisplay}
                  </span>
                ) : (
                  <span className="block text-[10px] text-[var(--terminal-text-secondary)]">Tap to search symbols</span>
                )}
              </div>
              <Search className="ml-2 h-4 w-4 shrink-0 text-[var(--terminal-text-secondary)]" />
            </button>

            {/* Desktop: instrument header with timeframes */}
            <div className="hidden md:block">
              <TradeInstrumentHeader
                symbol={activeSymbol}
                symbolInfo={selectedSymbolInfo}
                quote={selectedQuote}
                spreadDisplay={spreadDisplay}
                marketStatus={marketStatus}
                timeframes={resolvedTimeframes}
                selectedTimeframe={selectedResolution}
                onSelectTimeframe={setSelectedResolution}
              />
            </div>

            {/* Chart – fixed height on mobile, flex-1 on desktop */}
            <div className="h-[42vh] shrink-0 md:h-auto md:min-h-0 md:flex-1">
              <TradingViewPanel
                symbol={activeSymbol}
                resolution={selectedResolution}
                className="h-full"
              />
            </div>

            {/* Mobile: inline compact order ticket */}
            <div className="shrink-0 border-t border-[var(--terminal-border)] md:hidden">
              <OrderTicket
                accountId={activeAccountId}
                selectedSymbol={activeSymbol}
                symbols={symbols}
                quote={selectedQuote}
                onSymbolChange={setSelectedSymbol}
                onSubmitted={refreshTerminalData}
                preferredSide={preferredSide}
                accountDisabledReason={tradingAvailability.message}
                isMobileLayout
              />
            </div>

            <TradeActivityPanel
              activeTab={activeBottomTab}
              bottomTabMeta={bottomTabMeta}
              rows={rows}
              quotes={terminalQuotes}
              symbolDigitsMap={symbolDigitsMap}
              positionsHeight={positionsHeight}
              closingPositionId={closingPositionId}
              flashedPnlIds={flashedPnlIds}
              mobileExpanded={mobilePositionsExpanded}
              onSetTab={(tab) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('tab', mapBottomTabToSearch(tab));
                router.replace(`${pathname}?${params.toString()}`);
              }}
              onClosePosition={(positionId) => {
                setClosingPositionId(positionId);
                void positionsApi
                  .close(positionId)
                  .then(() => refreshTerminalData())
                  .finally(() => setClosingPositionId(null));
              }}
              onResizeStart={(clientY) => {
                resizeStateRef.current = { startY: clientY, startHeight: positionsHeight };
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
              }}
              onMobileExpandedChange={setMobilePositionsExpanded}
            />
          </div>

          <div className="hidden w-[320px] shrink-0 xl:block">
            <OrderTicket
              accountId={activeAccountId}
              selectedSymbol={activeSymbol}
              symbols={symbols}
              quote={selectedQuote}
              onSymbolChange={setSelectedSymbol}
              onSubmitted={refreshTerminalData}
              preferredSide={preferredSide}
              accountDisabledReason={tradingAvailability.message}
              className="h-full"
            />
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
                  const quote = terminalQuotes[sym.symbol];
                  const isSelected = sym.symbol === activeSymbol;
                  return (
                    <button
                      key={sym.symbol}
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between border-b border-[var(--terminal-border)]/40 px-4 py-3 text-left transition duration-150',
                        isSelected
                          ? 'bg-[var(--terminal-accent)]/10'
                          : 'hover:bg-[var(--terminal-bg-hover)]',
                      )}
                      onClick={() => {
                        setSelectedSymbol(sym.symbol);
                        setMobileSymbolModalOpen(false);
                      }}
                    >
                      <div>
                        <span className={cn('block text-sm font-semibold', isSelected ? 'text-[var(--terminal-accent)]' : 'text-[var(--terminal-text-primary)]')}>
                          {sym.symbol}
                        </span>
                        {sym.description ? (
                          <span className="block text-[11px] text-[var(--terminal-text-secondary)]">{sym.description}</span>
                        ) : null}
                      </div>
                      {quote ? (
                        <div className="text-right">
                          <span className="price-display block text-sm font-semibold text-[var(--terminal-green)]">
                            {formatNumber(quote.bid, sym.digits)}
                          </span>
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-10 hidden bg-[var(--terminal-bg-primary)]/78 p-4 md:grid md:grid-cols-[320px_minmax(0,1fr)_360px] md:gap-4">
          <div className="space-y-3 rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] p-4">
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
          <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] p-4">
            <div className="h-full animate-pulse rounded-xl bg-[var(--terminal-bg-elevated)]" />
          </div>
          <div className="space-y-4 rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] p-4">
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
