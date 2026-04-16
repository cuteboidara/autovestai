'use client';

import { useEffect, useRef, useState } from 'react';

import { cn, formatNumber } from '@/lib/utils';
import { MarketQuote, SymbolInfo } from '@/types/market-data';

interface TimeframeOption {
  label: string;
  value: string;
  enabled: boolean;
}

interface TradeInstrumentHeaderProps {
  symbol: string;
  symbolInfo?: SymbolInfo;
  quote?: MarketQuote;
  spreadDisplay: string;
  marketStatus: string;
  timeframes: TimeframeOption[];
  selectedTimeframe: string;
  onSelectTimeframe: (value: string) => void;
  onPreferredSideChange?: (side: 'BUY' | 'SELL') => void;
}

function resolveStatusBadge(status: string) {
  if (status === 'CLOSED' || status === 'DISABLED') {
    return {
      label: 'Closed',
      classes: 'bg-red-500/10 text-red-300 border-red-500/20',
    };
  }

  if (status === 'DELAYED' || status === 'DEGRADED') {
    return {
      label: status === 'DELAYED' ? 'Delayed' : 'Degraded',
      classes: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    };
  }

  if (status === 'STALE') {
    return {
      label: 'Stale feed',
      classes: 'bg-red-500/10 text-red-300 border-red-500/20',
    };
  }

  return {
    label: 'Live',
    classes: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  };
}

function formatChangePct(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '--';
  }

  return `${value > 0 ? '+' : ''}${formatNumber(value, 2)}%`;
}

export function TradeInstrumentHeader({
  symbol,
  symbolInfo,
  quote,
  spreadDisplay,
  marketStatus,
  timeframes,
  selectedTimeframe,
  onSelectTimeframe,
  onPreferredSideChange,
}: TradeInstrumentHeaderProps) {
  const [flash, setFlash] = useState<{
    bid?: 'up' | 'down';
    ask?: 'up' | 'down';
    last?: 'up' | 'down';
  }>({});
  const previousQuoteRef = useRef<{
    bid?: number;
    ask?: number;
    last?: number;
  }>({});

  useEffect(() => {
    if (!quote) {
      previousQuoteRef.current = {};
      setFlash({});
      return;
    }

    const nextFlash: {
      bid?: 'up' | 'down';
      ask?: 'up' | 'down';
      last?: 'up' | 'down';
    } = {};
    const previousBid = previousQuoteRef.current.bid;
    const previousAsk = previousQuoteRef.current.ask;
    const previousLast = previousQuoteRef.current.last;
    const nextLast = quote.lastPrice ?? quote.bid;

    if (typeof previousBid === 'number' && previousBid !== quote.bid) {
      nextFlash.bid = quote.bid > previousBid ? 'up' : 'down';
    }

    if (typeof previousAsk === 'number' && previousAsk !== quote.ask) {
      nextFlash.ask = quote.ask > previousAsk ? 'up' : 'down';
    }

    if (typeof previousLast === 'number' && previousLast !== nextLast) {
      nextFlash.last = nextLast > previousLast ? 'up' : 'down';
    }

    previousQuoteRef.current = {
      bid: quote.bid,
      ask: quote.ask,
      last: nextLast,
    };

    if (Object.keys(nextFlash).length === 0) {
      return;
    }

    setFlash(nextFlash);
    const timeoutId = window.setTimeout(() => setFlash({}), 220);
    return () => window.clearTimeout(timeoutId);
  }, [quote]);

  if (!symbol) {
    return (
      <div className="border-b border-[var(--terminal-border)] px-3 py-3">
        <p className="terminal-label">Chart Workspace</p>
        <p className="mt-1 text-sm font-semibold text-[var(--terminal-text-primary)]">
          No symbol selected
        </p>
        <p className="mt-1 text-[12px] text-[var(--terminal-text-secondary)]">
          Choose an instrument from the market explorer to load chart context and order routing.
        </p>
      </div>
    );
  }

  const digits = symbolInfo?.digits ?? 5;
  const statusBadge = resolveStatusBadge(marketStatus);
  const bidPrice = quote ? formatNumber(quote.bid, digits) : '--';
  const askPrice = quote ? formatNumber(quote.ask, digits) : '--';
  const lastPrice = quote ? formatNumber(quote.lastPrice ?? quote.bid, digits) : '--';
  const dayHigh = quote?.dayHigh != null ? formatNumber(quote.dayHigh, digits) : '--';
  const dayLow = quote?.dayLow != null ? formatNumber(quote.dayLow, digits) : '--';
  const changePct = formatChangePct(quote?.changePct);

  return (
    <div className="border-b border-[var(--terminal-border)] bg-[rgba(8,13,21,0.94)]">
      <div className="flex min-w-0 flex-col gap-3 px-3 py-3">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="terminal-chip">Chart</span>
              <h2 className="truncate text-base font-semibold tracking-[0.01em] text-[var(--terminal-text-primary)]">
                {symbol}
              </h2>
              <span className="terminal-chip">
                {symbolInfo?.assetClass ?? symbolInfo?.category ?? 'Market'}
              </span>
              <span
                className={cn(
                  'inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.08em]',
                  statusBadge.classes,
                )}
              >
                {statusBadge.label}
              </span>
            </div>

            <p className="mt-2 truncate text-[12px] text-[var(--terminal-text-secondary)]">
              {symbolInfo?.description ?? symbolInfo?.displayName ?? 'Live market symbol'}
            </p>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-4">
            {[
              { label: 'Last', value: lastPrice, tone: 'text-[var(--terminal-text-primary)]' },
              { label: 'High', value: dayHigh, tone: 'text-[var(--terminal-green)]' },
              { label: 'Low', value: dayLow, tone: 'text-[var(--terminal-red)]' },
              {
                label: 'Change',
                value: changePct,
                tone:
                  quote?.changePct != null
                    ? quote.changePct >= 0
                      ? 'text-[var(--terminal-green)]'
                      : 'text-[var(--terminal-red)]'
                    : 'text-[var(--terminal-text-primary)]',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-[var(--terminal-border)] bg-[rgba(10,17,27,0.78)] px-3 py-2"
              >
                <p className="terminal-label">{item.label}</p>
                <p className={cn('price-display mt-1 text-[13px] font-semibold', item.tone)}>
                  <span
                    className={cn(
                      item.label === 'Last' && flash.last === 'up' ? 'terminal-price-up' : '',
                      item.label === 'Last' && flash.last === 'down' ? 'terminal-price-down' : '',
                    )}
                  >
                    {item.value}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_86px]">
            <button
              type="button"
              onClick={() => onPreferredSideChange?.('SELL')}
              className="rounded-md border border-red-500/18 bg-red-500/8 px-3 py-2 text-left transition duration-150 hover:bg-red-500/12"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-red-300">
                Sell
              </span>
              <span
                className={cn(
                  'price-display mt-1 block text-base font-semibold text-red-300',
                  flash.bid === 'up' ? 'terminal-price-up' : '',
                  flash.bid === 'down' ? 'terminal-price-down' : '',
                )}
              >
                {bidPrice}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onPreferredSideChange?.('BUY')}
              className="rounded-md border border-emerald-500/18 bg-emerald-500/8 px-3 py-2 text-left transition duration-150 hover:bg-emerald-500/12"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-300">
                Buy
              </span>
              <span
                className={cn(
                  'price-display mt-1 block text-base font-semibold text-emerald-300',
                  flash.ask === 'up' ? 'terminal-price-up' : '',
                  flash.ask === 'down' ? 'terminal-price-down' : '',
                )}
              >
                {askPrice}
              </span>
            </button>

            <div className="rounded-md border border-[var(--terminal-border)] bg-[rgba(10,17,27,0.78)] px-3 py-2">
              <p className="terminal-label">Spread</p>
              <p className="price-display mt-1 text-[13px] font-semibold text-[var(--terminal-text-primary)]">
                {spreadDisplay}
              </p>
            </div>
          </div>

          <div className="terminal-scrollbar flex items-center gap-1 overflow-x-auto">
            {timeframes.map((timeframe) => (
              <button
                key={timeframe.value}
                type="button"
                disabled={!timeframe.enabled}
                onClick={() => timeframe.enabled && onSelectTimeframe(timeframe.value)}
                className={cn(
                  'inline-flex h-7 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition duration-150',
                  selectedTimeframe === timeframe.value
                    ? 'border-[var(--terminal-border-strong)] bg-[rgba(128,148,184,0.14)] text-[var(--terminal-text-primary)]'
                    : timeframe.enabled
                      ? 'border-[var(--terminal-border)] bg-[rgba(10,17,27,0.78)] text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]'
                      : 'cursor-not-allowed border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-muted)]',
                )}
              >
                {timeframe.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
