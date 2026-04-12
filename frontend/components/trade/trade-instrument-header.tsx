'use client';

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
}

function resolveMarketState(status: string) {
  if (status === 'CLOSED' || status === 'DISABLED') {
    return {
      label: 'Closed',
      classes: 'border-red-500/25 bg-red-500/10 text-red-300',
    };
  }

  return {
    label: 'Open',
    classes: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  };
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
}: TradeInstrumentHeaderProps) {
  if (!symbol) {
    return (
      <div className="border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-4">
        <div className="border border-dashed border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
            Market Focus
          </p>
          <p className="mt-3 text-lg font-semibold text-[var(--terminal-text-primary)]">
            No symbol selected
          </p>
          <p className="mt-2 max-w-2xl text-sm text-[var(--terminal-text-secondary)]">
            Choose an instrument from the watchlist to load live pricing, chart context, and order routing.
          </p>
        </div>
      </div>
    );
  }

  const digits = symbolInfo?.digits ?? 5;
  const marketState = resolveMarketState(marketStatus);
  const bidPrice = quote ? formatNumber(quote.bid, digits) : '--';
  const askPrice = quote ? formatNumber(quote.ask, digits) : '--';
  const feedBadge =
    marketStatus === 'STALE'
      ? {
          label: 'Stale feed',
          classes: 'border-red-500/25 bg-red-500/10 text-red-300',
        }
      : marketStatus === 'DELAYED'
        ? {
            label: 'Delayed feed',
            classes: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
          }
        : marketStatus === 'DEGRADED'
          ? {
              label: 'Feed degraded',
              classes: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
            }
          : null;

  return (
    <div className="border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--terminal-text-primary)]">
                {symbol}
              </h2>
              <p className="mt-1 text-sm text-[var(--terminal-text-secondary)]">
                {symbolInfo?.description ?? symbolInfo?.displayName ?? 'Live market symbol'}
              </p>
            </div>

            <span
              className={cn(
                'inline-flex h-8 items-center border px-3 text-[11px] font-semibold uppercase tracking-[0.14em]',
                marketState.classes,
              )}
            >
              {marketState.label}
            </span>

            {feedBadge ? (
              <span
                className={cn(
                  'inline-flex h-8 items-center gap-2 border px-3 text-[11px] font-semibold uppercase tracking-[0.14em]',
                  feedBadge.classes,
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    marketStatus === 'STALE' ? 'bg-red-300' : 'bg-amber-300',
                  )}
                />
                {feedBadge.label}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {timeframes.map((timeframe) => (
              <button
                key={timeframe.value}
                type="button"
                disabled={!timeframe.enabled}
                onClick={() => timeframe.enabled && onSelectTimeframe(timeframe.value)}
                className={cn(
                  'inline-flex h-8 items-center border px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40',
                  selectedTimeframe === timeframe.value
                    ? 'border-[var(--terminal-accent)] bg-[var(--terminal-accent)] text-[#0A0E1A]'
                    : timeframe.enabled
                      ? 'border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]'
                      : 'cursor-not-allowed border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-muted)]',
                )}
              >
                {timeframe.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(140px,1fr)_auto_minmax(140px,1fr)]">
          <div className="border border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
              Bid
            </p>
            <p className="price-display mt-2 text-2xl font-semibold text-[var(--terminal-red)]">
              {bidPrice}
            </p>
          </div>

          <div className="flex items-center justify-center px-2 text-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
                Spread
              </p>
              <p className="price-display mt-2 text-sm font-semibold text-[var(--terminal-text-primary)]">
                {spreadDisplay}
              </p>
            </div>
          </div>

          <div className="border border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
              Ask
            </p>
            <p className="price-display mt-2 text-2xl font-semibold text-[var(--terminal-green)]">
              {askPrice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
