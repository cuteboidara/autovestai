'use client';

import { ChevronLeft, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { cn, formatNumber } from '@/lib/utils';
import { MarketQuote, SymbolInfo } from '@/types/market-data';

type WatchlistCategory = 'ALL' | SymbolInfo['category'];

interface WatchlistPanelProps {
  symbols: SymbolInfo[];
  watchlist: string[];
  quotes: Record<string, MarketQuote>;
  selectedSymbol: string;
  loading?: boolean;
  onSelect: (symbol: string) => void;
  onClearSelection?: () => void;
  onTrade?: (symbol: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

const categoryOrder: SymbolInfo['category'][] = [
  'FOREX',
  'METALS',
  'INDICES',
  'CRYPTO',
  'COMMODITIES',
  'STOCKS',
  'ETFS',
];

const categoryLabelMap: Record<WatchlistCategory, string> = {
  ALL: 'All',
  FOREX: 'Forex',
  METALS: 'Metals',
  INDICES: 'Indices',
  COMMODITIES: 'Commodities',
  CRYPTO: 'Crypto',
  STOCKS: 'Stocks',
  ETFS: 'ETFs',
};

function getMonogram(symbol: string) {
  return symbol.replace(/[^A-Z]/gi, '').slice(0, 2).toUpperCase() || symbol.slice(0, 2);
}

export function WatchlistPanel({
  symbols,
  watchlist,
  quotes,
  selectedSymbol,
  loading = false,
  onSelect,
  onClearSelection,
  onToggleCollapse,
  collapsed = false,
  className,
}: WatchlistPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<WatchlistCategory>('ALL');
  const [flashes, setFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const deferredSearch = useDeferredValue(search);
  const previousPricesRef = useRef<Record<string, number>>({});

  // Show all available symbols (sorted by category order, then alphabetically)
  const universe = useMemo(() => {
    const categoryRank = new Map(categoryOrder.map((cat, i) => [cat, i]));
    return [...symbols].sort((a, b) => {
      const rankDiff = (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99);
      if (rankDiff !== 0) return rankDiff;
      return a.symbol.localeCompare(b.symbol);
    });
  }, [symbols]);

  const categoryOptions = useMemo(
    () => [
      { value: 'ALL' as const, label: categoryLabelMap.ALL },
      ...categoryOrder
        .filter((value) => universe.some((item) => item.category === value))
        .map((value) => ({
          value,
          label: categoryLabelMap[value],
        })),
    ],
    [universe],
  );

  const filtered = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return universe.filter((item) => {
      const matchesCategory = category === 'ALL' || item.category === category;
      const matchesSearch =
        !query ||
        item.symbol.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.displayName.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [category, deferredSearch, universe]);

  useEffect(() => {
    if (category === 'ALL') {
      return;
    }

    if (!categoryOptions.some((item) => item.value === category)) {
      setCategory('ALL');
    }
  }, [category, categoryOptions]);

  useEffect(() => {
    const nextFlashes: Record<string, 'up' | 'down'> = {};

    for (const symbol of watchlist) {
      const quote = quotes[symbol];

      if (!quote) {
        continue;
      }

      const previous = previousPricesRef.current[symbol];
      if (typeof previous === 'number' && previous !== quote.lastPrice) {
        nextFlashes[symbol] = quote.lastPrice > previous ? 'up' : 'down';
      }

      previousPricesRef.current[symbol] = quote.lastPrice;
    }

    if (Object.keys(nextFlashes).length === 0) {
      return;
    }

    setFlashes((current) => ({ ...current, ...nextFlashes }));
    const timeoutId = window.setTimeout(() => {
      setFlashes((current) => {
        const next = { ...current };

        for (const symbol of Object.keys(nextFlashes)) {
          delete next[symbol];
        }

        return next;
      });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [quotes, watchlist]);

  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col bg-[var(--terminal-bg-primary)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--terminal-border)] px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-[var(--terminal-text-primary)]">Watchlist</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
            Live markets
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedSymbol && onClearSelection ? (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]"
              onClick={onClearSelection}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}

          {onToggleCollapse ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]"
              onClick={onToggleCollapse}
            >
              <ChevronLeft
                className={cn('h-4 w-4 transition-transform', collapsed ? 'rotate-180' : '')}
              />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-b border-[var(--terminal-border)] px-4 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--terminal-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search symbols"
            className="h-10 w-full border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] pl-9 pr-3 text-sm text-[var(--terminal-text-primary)] outline-none transition duration-150 placeholder:text-[var(--terminal-text-muted)] focus:border-[var(--terminal-accent)]"
          />
        </div>

        <div className="terminal-scrollbar flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {categoryOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center border px-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition duration-150',
                item.value === category
                  ? 'border-[var(--terminal-accent)] bg-[var(--terminal-accent)] text-[#0A0E1A]'
                  : 'border-[var(--terminal-border)] bg-[var(--terminal-bg-elevated)] text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="terminal-scrollbar flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="space-y-2 px-2 py-1">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="flex min-h-[56px] items-center gap-3 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-3 py-3"
              >
                <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--terminal-bg-elevated)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                  <div className="h-3 w-36 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                  <div className="h-3 w-10 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-2 mt-2 border border-dashed border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-[var(--terminal-text-primary)]">
              No symbols match this filter
            </p>
            <p className="mt-2 text-sm text-[var(--terminal-text-secondary)]">
              Adjust the asset filter or search term to view another instrument.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const quote = quotes[item.symbol];
            const spread = quote ? formatNumber(quote.ask - quote.bid, item.digits) : '--';
            const marketStatus =
              !item.enabled
                ? 'DISABLED'
                : quote?.marketStatus && quote.marketStatus !== 'LIVE'
                  ? quote.marketStatus
                  : quote?.marketState && quote.marketState !== 'LIVE'
                    ? quote.marketState
                    : null;
            const isDelayed = quote?.delayed || marketStatus === 'DELAYED';
            const isStale = marketStatus === 'STALE';
            const isDegraded = marketStatus === 'DEGRADED';

            return (
              <button
                key={item.symbol}
                type="button"
                onClick={() => onSelect(item.symbol)}
                className={cn(
                  'relative mb-2 grid min-h-[64px] w-full grid-cols-[auto_minmax(0,1fr)_112px] items-center gap-3 border border-transparent px-3 py-3 text-left transition duration-150',
                  selectedSymbol === item.symbol
                    ? 'bg-[var(--terminal-bg-elevated)]'
                    : 'hover:bg-[var(--terminal-bg-hover)]',
                  flashes[item.symbol] === 'up' ? 'terminal-price-up' : '',
                  flashes[item.symbol] === 'down' ? 'terminal-price-down' : '',
                )}
              >
                {selectedSymbol === item.symbol ? (
                  <span className="absolute inset-y-2 left-0 w-[3px] bg-[var(--terminal-accent)]" />
                ) : null}

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--terminal-bg-surface)] text-xs font-semibold text-[var(--terminal-text-primary)]">
                  {getMonogram(item.symbol)}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="whitespace-nowrap text-sm font-semibold text-[var(--terminal-text-primary)]">
                      {item.symbol}
                    </p>
                    {isDelayed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                        <span className="h-2 w-2 rounded-full bg-amber-300" />
                        Delayed
                      </span>
                    ) : isStale ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-300">
                        <span className="h-2 w-2 rounded-full bg-red-300" />
                        Stale
                      </span>
                    ) : isDegraded ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                        <span className="h-2 w-2 rounded-full bg-amber-300" />
                        Degraded
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--terminal-text-secondary)]">
                    {item.category}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-[11px]',
                      marketStatus &&
                        marketStatus !== 'DEGRADED' &&
                        marketStatus !== 'DELAYED' &&
                        marketStatus !== 'STALE'
                        ? 'font-semibold uppercase tracking-[0.14em] text-[var(--terminal-red)]'
                        : 'text-[var(--terminal-text-muted)]',
                    )}
                  >
                    {marketStatus &&
                    marketStatus !== 'DEGRADED' &&
                    marketStatus !== 'DELAYED' &&
                    marketStatus !== 'STALE'
                      ? marketStatus
                      : `Spread ${spread}`}
                  </p>
                </div>

                <div className="w-[112px] shrink-0 text-right">
                  <p className="price-display whitespace-nowrap text-[13px] font-semibold text-[var(--terminal-red)]">
                    {quote ? formatNumber(quote.bid, item.digits) : '--'}
                  </p>
                  <p className="price-display mt-1 whitespace-nowrap text-[13px] font-semibold text-[var(--terminal-green)]">
                    {quote ? formatNumber(quote.ask, item.digits) : '--'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
