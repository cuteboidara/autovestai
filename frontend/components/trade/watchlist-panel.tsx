'use client';

import { ChevronLeft, Search, X } from 'lucide-react';
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { useLiveQuote } from '@/hooks/use-live-prices';
import { cn, formatNumber } from '@/lib/utils';
import { MarketQuote, SymbolInfo } from '@/types/market-data';

type WatchlistCategory = 'ALL' | SymbolInfo['category'];

interface WatchlistPanelProps {
  symbols: SymbolInfo[];
  watchlist: string[];
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

function formatChangePct(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '--';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, 2)}%`;
}

function resolveRowHint(item: SymbolInfo, quote?: MarketQuote) {
  const marketStatus =
    !item.enabled
      ? 'DISABLED'
      : quote?.marketStatus && quote.marketStatus !== 'LIVE'
        ? quote.marketStatus
        : quote?.marketState && quote.marketState !== 'LIVE'
          ? quote.marketState
          : null;

  if (!marketStatus) {
    return item.displayName || item.description || item.category;
  }

  return `${item.displayName || item.description || item.category} • ${marketStatus}`;
}

export const WatchlistPanel = memo(function WatchlistPanel({
  symbols,
  watchlist,
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
  const deferredSearch = useDeferredValue(search);

  const universe = useMemo(() => {
    const categoryRank = new Map(categoryOrder.map((cat, i) => [cat, i]));
    const watchlistRank = new Map(watchlist.map((symbol, index) => [symbol, index]));

    return [...symbols].sort((a, b) => {
      const leftRank = watchlistRank.get(a.symbol);
      const rightRank = watchlistRank.get(b.symbol);

      if (leftRank != null || rightRank != null) {
        if (leftRank == null) return 1;
        if (rightRank == null) return -1;
        if (leftRank !== rightRank) return leftRank - rightRank;
      }

      const rankDiff =
        (categoryRank.get(a.category) ?? 99) - (categoryRank.get(b.category) ?? 99);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      return a.symbol.localeCompare(b.symbol);
    });
  }, [symbols, watchlist]);

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

  return (
    <section
      className={cn(
        'terminal-panel flex h-full min-h-0 flex-col overflow-hidden',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--terminal-border)] px-3 py-2">
        <div className="min-w-0">
          <p className="terminal-label">Market Explorer</p>
          <p className="truncate text-sm font-semibold text-[var(--terminal-text-primary)]">
            Watchlist
          </p>
        </div>

        <div className="flex items-center gap-1">
          {selectedSymbol && onClearSelection ? (
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]"
              onClick={onClearSelection}
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          ) : null}

          {onToggleCollapse ? (
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] text-[var(--terminal-text-secondary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]"
              onClick={onToggleCollapse}
            >
              <ChevronLeft
                className={cn('h-3.5 w-3.5 transition-transform', collapsed ? 'rotate-180' : '')}
              />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-b border-[var(--terminal-border)] px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--terminal-text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search symbol"
            className="h-8 w-full rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] pl-8 pr-3 text-[12px] text-[var(--terminal-text-primary)] outline-none transition duration-150 placeholder:text-[var(--terminal-text-muted)] focus:border-[var(--terminal-border-strong)]"
          />
        </div>

        <div className="terminal-scrollbar flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {categoryOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCategory(item.value)}
              className={cn(
                'inline-flex h-7 shrink-0 items-center rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition duration-150',
                item.value === category
                  ? 'border-[var(--terminal-border-strong)] bg-[rgba(128,148,184,0.14)] text-[var(--terminal-text-primary)]'
                  : 'border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_68px_68px_54px] items-center gap-2 border-b border-[var(--terminal-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--terminal-text-muted)]">
        <span>Symbol</span>
        <span className="text-right">Bid</span>
        <span className="text-right">Ask</span>
        <span className="text-right">Chg</span>
      </div>

      <div className="terminal-scrollbar flex-1 overflow-y-auto">
        {loading ? (
          <div className="divide-y divide-[var(--terminal-border)]">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[minmax(0,1fr)_68px_68px_54px] items-center gap-2 px-3 py-2.5"
              >
                <div className="space-y-1">
                  <div className="h-3 w-20 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                  <div className="h-2.5 w-28 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                </div>
                <div className="h-3 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                <div className="h-3 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
                <div className="h-3 animate-pulse rounded bg-[var(--terminal-bg-elevated)]" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-semibold text-[var(--terminal-text-primary)]">
              No symbols match this filter
            </p>
            <p className="mt-2 text-[12px] text-[var(--terminal-text-secondary)]">
              Adjust the asset filter or search term to view another instrument.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            return (
              <WatchlistRow
                key={item.symbol}
                item={item}
                isSelected={selectedSymbol === item.symbol}
                onSelect={onSelect}
              />
            );
          })
        )}
      </div>
    </section>
  );
});

function WatchlistRow({
  item,
  isSelected,
  onSelect,
}: {
  item: SymbolInfo;
  isSelected: boolean;
  onSelect: (symbol: string) => void;
}) {
  const quote = useLiveQuote(item.symbol);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const previousPriceRef = useRef<number | null>(null);
  const bid = quote ? formatNumber(quote.bid, item.digits) : '--';
  const ask = quote ? formatNumber(quote.ask, item.digits) : '--';
  const changePct = quote?.changePct ?? null;
  const changeText = formatChangePct(changePct);
  const rowHint = resolveRowHint(item, quote);

  useEffect(() => {
    if (!quote) {
      return;
    }

    const previousPrice = previousPriceRef.current;

    if (previousPrice != null && previousPrice !== quote.lastPrice) {
      setFlash(quote.lastPrice > previousPrice ? 'up' : 'down');
      const timeoutId = window.setTimeout(() => setFlash(null), 220);
      previousPriceRef.current = quote.lastPrice;
      return () => window.clearTimeout(timeoutId);
    }

    previousPriceRef.current = quote.lastPrice;
  }, [quote]);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.symbol)}
      className={cn(
        'grid w-full grid-cols-[minmax(0,1fr)_68px_68px_54px] items-center gap-2 border-b border-[var(--terminal-border)] px-3 py-2.5 text-left transition duration-150',
        isSelected
          ? 'bg-[rgba(128,148,184,0.12)] shadow-[inset_2px_0_0_0_rgba(128,148,184,0.8)]'
          : 'hover:bg-[rgba(19,32,53,0.5)]',
        flash === 'up' ? 'terminal-price-up' : '',
        flash === 'down' ? 'terminal-price-down' : '',
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              !item.enabled
                ? 'bg-red-400'
                : quote?.marketStatus === 'DELAYED'
                  ? 'bg-amber-300'
                  : quote?.marketStatus === 'STALE'
                    ? 'bg-red-300'
                    : 'bg-emerald-400',
            )}
          />
          <p className="truncate text-[12px] font-semibold text-[var(--terminal-text-primary)]">
            {item.symbol}
          </p>
        </div>
        <p className="mt-1 truncate text-[10px] text-[var(--terminal-text-secondary)]">
          {rowHint}
        </p>
      </div>

      <span className="price-display text-right text-[12px] text-[var(--terminal-text-primary)]">
        {bid}
      </span>
      <span className="price-display text-right text-[12px] text-[var(--terminal-text-primary)]">
        {ask}
      </span>
      <span
        className={cn(
          'price-display text-right text-[11px] font-semibold',
          typeof changePct === 'number'
            ? changePct >= 0
              ? 'text-[var(--terminal-green)]'
              : 'text-[var(--terminal-red)]'
            : 'text-[var(--terminal-text-secondary)]',
        )}
      >
        {changeText}
      </span>
    </button>
  );
}
