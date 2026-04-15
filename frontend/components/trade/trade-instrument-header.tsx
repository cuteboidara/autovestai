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
      classes: 'bg-red-500/10 text-red-300',
    };
  }

  return {
    label: 'Open',
    classes: 'bg-emerald-500/10 text-emerald-300',
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
      <div className="border-b border-[var(--terminal-border)] px-5 py-5">
        <div className="terminal-panel-soft px-5 py-5">
          <p className="terminal-label">
            Market Focus
          </p>
          <p className="mt-3 text-xl font-semibold text-[var(--terminal-text-primary)]">
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
          classes: 'bg-red-500/10 text-red-300',
        }
      : marketStatus === 'DELAYED'
        ? {
            label: 'Delayed feed',
            classes: 'bg-amber-500/10 text-amber-300',
          }
        : marketStatus === 'DEGRADED'
          ? {
              label: 'Feed degraded',
              classes: 'bg-amber-500/10 text-amber-300',
            }
          : null;

  return (
    <div className="border-b border-[var(--terminal-border)] px-5 py-5">
      <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="terminal-label">Market</p>
              <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-[var(--terminal-text-primary)]">
                {symbol}
              </h2>
              <p className="mt-1 text-sm text-[var(--terminal-text-secondary)]">
                {symbolInfo?.description ?? symbolInfo?.displayName ?? 'Live market symbol'}
              </p>
              <span
                className={cn(
                  'mt-3 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold',
                  marketState.classes,
                )}
              >
                {marketState.label}
              </span>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="terminal-chip">{symbolInfo?.assetClass ?? symbolInfo?.category ?? 'Market'}</span>
                <span className="terminal-chip">Spread {spreadDisplay}</span>
                {feedBadge ? (
                  <span
                    className={cn(
                      'inline-flex min-h-[32px] items-center gap-2 rounded-full px-3 text-xs font-semibold',
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
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="terminal-panel-soft px-4 py-3">
                <p className="terminal-label">Bid</p>
                <p className="price-display mt-2 text-2xl font-semibold text-[var(--terminal-red)]">
                  {bidPrice}
                </p>
              </div>

              <div className="terminal-panel-soft px-4 py-3">
                <p className="terminal-label">Spread</p>
                <p className="price-display mt-2 text-xl font-semibold text-[var(--terminal-text-primary)]">
                  {spreadDisplay}
                </p>
              </div>

              <div className="terminal-panel-soft px-4 py-3">
                <p className="terminal-label">Ask</p>
                <p className="price-display mt-2 text-2xl font-semibold text-[var(--terminal-green)]">
                  {askPrice}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {timeframes.map((timeframe) => (
              <button
                key={timeframe.value}
                type="button"
                disabled={!timeframe.enabled}
                onClick={() => timeframe.enabled && onSelectTimeframe(timeframe.value)}
                className={cn(
                  'inline-flex h-9 items-center rounded-full border px-3 text-[12px] font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--terminal-accent)]/40',
                  selectedTimeframe === timeframe.value
                    ? 'border-[var(--terminal-accent)] bg-[var(--terminal-accent)] text-[#0A0E1A]'
                    : timeframe.enabled
                      ? 'border-[var(--terminal-border)] bg-[rgba(255,255,255,0.02)] text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]'
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
