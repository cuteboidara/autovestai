'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Panel } from '@/components/ui/panel';
import { useLivePrices } from '@/hooks/use-live-prices';
import { cn, formatNumber } from '@/lib/utils';
import { marketDataApi } from '@/services/api/market-data';
import { MarketQuote, SymbolInfo } from '@/types/market-data';

const categories = [
  'ALL',
  'FOREX',
  'METALS',
  'INDICES',
  'COMMODITIES',
  'CRYPTO',
  'STOCKS',
  'ETFS',
] as const;

type CategoryFilter = (typeof categories)[number];

export default function MarketsPage() {
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});

  useEffect(() => {
    void (async () => {
      setLoading(true);

      try {
        const items = await marketDataApi.listSymbols({ enabledOnly: false });
        setSymbols(items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredSymbols = useMemo(() => {
    const query = search.trim().toLowerCase();

    return symbols.filter((symbol) => {
      const matchesCategory = category === 'ALL' || symbol.category === category;
      const matchesSearch =
        !query ||
        symbol.symbol.toLowerCase().includes(query) ||
        symbol.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [category, search, symbols]);
  const liveQuotes = useLivePrices(filteredSymbols.map((symbol) => symbol.symbol));
  const resolvedQuotes = useMemo(
    () => ({
      ...quotes,
      ...liveQuotes,
    }),
    [liveQuotes, quotes],
  );

  useEffect(() => {
    const uncached = filteredSymbols
      .filter((symbol) => symbol.enabled && !resolvedQuotes[symbol.symbol])
      .map((symbol) => symbol.symbol);

    if (uncached.length === 0) {
      return;
    }

    let cancelled = false;

    const loadQuotes = async () => {
      const entries: Array<[string, MarketQuote]> = [];

      for (let index = 0; index < uncached.length; index += 20) {
        const batch = uncached.slice(index, index + 20);
        const results = await Promise.allSettled(
          batch.map(async (symbol) => [symbol, await marketDataApi.getPrice(symbol)] as [string, MarketQuote]),
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            entries.push(result.value);
          }
        }
      }

      if (!cancelled && entries.length > 0) {
        setQuotes((current) => ({
          ...current,
          ...Object.fromEntries(entries),
        }));
      }
    };

    void loadQuotes();

    return () => {
      cancelled = true;
    };
  }, [filteredSymbols, resolvedQuotes]);

  const groupedSymbols = useMemo(() => {
    const groups = new Map<string, SymbolInfo[]>();

    for (const symbol of filteredSymbols) {
      const bucket = groups.get(symbol.category) ?? [];
      bucket.push(symbol);
      groups.set(symbol.category, bucket);
    }

    return Array.from(groups.entries());
  }, [filteredSymbols]);

  return (
    <main className="min-h-screen bg-page px-4 py-8 sm:px-6 xl:px-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <PageHeader
          eyebrow="Markets"
          title="Markets"
          description="Browse live public pricing across the full AutovestAI instrument universe."
          actions={
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href="/register">Create account</Link>
              </Button>
            </div>
          }
        />

        <Panel
          title="Instrument Directory"
          description="Search the full product set and filter by asset class."
        >
          <div className="space-y-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search symbol or description"
              className="h-[42px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[14px] text-[#0F1117] outline-none transition-all duration-150 placeholder:text-[#9CA3AF] focus:border-[#F0B429] focus:ring-[3px] focus:ring-[#F0B429]/15"
            />

            <div className="sticky top-3 z-20 -mx-5 border-y border-border bg-page/95 px-5 py-3 backdrop-blur">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={
                      item === category
                        ? 'whitespace-nowrap rounded-full border border-accent bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary'
                        : 'whitespace-nowrap rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-secondary'
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {filteredSymbols.map((symbol) => {
                const quote = resolvedQuotes[symbol.symbol];
                const expanded = expandedSymbol === symbol.symbol;
                const delayed =
                  quote?.delayed ||
                  quote?.marketStatus === 'STALE' ||
                  quote?.marketStatus === 'DEGRADED';

                return (
                  <div
                    key={symbol.symbol}
                    className="overflow-hidden rounded-xl border border-border bg-white"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                      onClick={() =>
                        setExpandedSymbol((current) =>
                          current === symbol.symbol ? null : symbol.symbol,
                        )
                      }
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{symbol.symbol}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-secondary">
                          {symbol.category} •{' '}
                          {!symbol.enabled
                            ? 'Disabled'
                            : delayed
                              ? 'Delayed'
                              : 'Live'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-primary">
                          {quote ? formatNumber(quote.lastPrice, symbol.digits) : '--'}
                        </p>
                        <ChevronDown
                          className={`h-4 w-4 text-secondary transition ${
                            expanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {expanded ? (
                      <div className="border-t border-border bg-page px-4 py-4 text-sm text-secondary">
                        <div className="grid gap-3">
                          <p>
                            <span className="label-eyebrow">Bid / Ask</span>
                            <span className="mt-1 block text-primary">
                              {quote
                                ? `${formatNumber(quote.bid, symbol.digits)} / ${formatNumber(quote.ask, symbol.digits)}`
                                : '--'}
                            </span>
                          </p>
                          <p>
                            <span className="label-eyebrow">Description</span>
                            <span className="mt-1 block text-primary">{symbol.description}</span>
                          </p>
                          <p>
                            <span className="label-eyebrow">Margin</span>
                            <span className="mt-1 block text-primary">{symbol.marginRetailPct}%</span>
                          </p>
                          <p>
                            <span className="label-eyebrow">Swap Long / Short</span>
                            <span className="mt-1 block text-primary">
                              {symbol.swapLong} / {symbol.swapShort}
                            </span>
                          </p>
                          <p>
                            <span className="label-eyebrow">Min Size</span>
                            <span className="mt-1 block text-primary">{symbol.minTradeSizeLots}</span>
                          </p>
                          <p>
                            <span className="label-eyebrow">Trading Hours</span>
                            <span className="mt-1 block text-primary">{symbol.tradingHours}</span>
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block">
              {groupedSymbols.map(([group, items]) => (
                <div key={group} className="mb-6 space-y-3">
                  <div>
                    <p className="label-eyebrow">{group}</p>
                    <h2 className="mt-1 text-[16px] font-semibold text-primary">
                      {group} instruments
                    </h2>
                  </div>
                  <DataTable
                    columns={[
                      {
                        key: 'symbol',
                        header: 'Symbol',
                        render: (symbol) => (
                          <span className="font-medium text-primary">{symbol.symbol}</span>
                        ),
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        render: (symbol) => {
                          const quote = resolvedQuotes[symbol.symbol];
                          const delayed =
                            quote?.delayed ||
                            quote?.marketStatus === 'STALE' ||
                            quote?.marketStatus === 'DEGRADED';

                          return (
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                                !symbol.enabled
                                  ? 'bg-slate-200 text-slate-600'
                                  : delayed
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700',
                              )}
                            >
                              {!symbol.enabled ? 'Disabled' : delayed ? 'Delayed' : 'Live'}
                            </span>
                          );
                        },
                      },
                      {
                        key: 'price',
                        header: 'Last',
                        align: 'right',
                        render: (symbol) => {
                          const quote = resolvedQuotes[symbol.symbol];
                          return quote ? formatNumber(quote.lastPrice, symbol.digits) : '--';
                        },
                      },
                      {
                        key: 'bidAsk',
                        header: 'Bid / Ask',
                        align: 'right',
                        render: (symbol) => {
                          const quote = resolvedQuotes[symbol.symbol];
                          return quote
                            ? `${formatNumber(quote.bid, symbol.digits)} / ${formatNumber(quote.ask, symbol.digits)}`
                            : '--';
                        },
                      },
                      {
                        key: 'description',
                        header: 'Description',
                        render: (symbol) => symbol.description,
                      },
                      {
                        key: 'margin',
                        header: 'Margin',
                        align: 'right',
                        render: (symbol) => `${symbol.marginRetailPct}%`,
                      },
                      {
                        key: 'swapLong',
                        header: 'Swap Long',
                        align: 'right',
                        render: (symbol) => String(symbol.swapLong),
                      },
                      {
                        key: 'swapShort',
                        header: 'Swap Short',
                        align: 'right',
                        render: (symbol) => String(symbol.swapShort),
                      },
                      {
                        key: 'minSize',
                        header: 'Min Size',
                        align: 'right',
                        render: (symbol) => String(symbol.minTradeSizeLots),
                      },
                      {
                        key: 'hours',
                        header: 'Trading Hours',
                        render: (symbol) => symbol.tradingHours,
                      },
                    ]}
                    data={items}
                    rowKey={(symbol) => symbol.symbol}
                    emptyTitle={loading ? 'Loading instruments' : 'No instruments found'}
                    emptyDescription={
                      loading
                        ? 'Loading contract specifications from the broker backend.'
                        : 'Try adjusting the search or category filter.'
                    }
                  />
                </div>
              ))}
            </div>

            {!loading && filteredSymbols.length === 0 ? (
              <div className="rounded-2xl border border-border bg-page px-4 py-6 text-sm text-secondary">
                No instruments matched the current filters.
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </main>
  );
}
