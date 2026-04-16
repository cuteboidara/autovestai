'use client';

import { Minus, Plus } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { cn, formatNumber, formatUsdt } from '@/lib/utils';
import { ordersApi } from '@/services/api/orders';
import { useNotificationStore } from '@/store/notification-store';
import { usePlatformStore } from '@/store/platform-store';
import { MarketQuote, SymbolInfo } from '@/types/market-data';
import { OrderSide, OrderType } from '@/types/trading';

type InputMode = 'PRICE' | 'PIPS';
type TicketOrderType = OrderType | 'STOP' | 'STOP_LIMIT';
type PriceFlashState = {
  ask?: 'up' | 'down';
  bid?: 'up' | 'down';
  execution?: 'up' | 'down';
};

interface OrderTicketProps {
  accountId?: string | null;
  selectedSymbol: string;
  symbols: SymbolInfo[];
  quote?: MarketQuote;
  onSymbolChange: (symbol: string) => void;
  onSubmitted: () => Promise<void>;
  preferredSide?: OrderSide | null;
  accountDisabledReason?: string | null;
  isMobileLayout?: boolean;
  className?: string;
}

const defaultState = {
  side: 'BUY' as OrderSide,
  type: 'MARKET' as TicketOrderType,
  volume: '0.01',
  leverage: '10',
  price: '',
  stopLoss: '',
  takeProfit: '',
};

const inputClass =
  'h-9 w-full rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] px-3 text-[12px] text-[var(--terminal-text-primary)] outline-none transition duration-150 placeholder:text-[var(--terminal-text-muted)] focus:border-[var(--terminal-border-strong)]';

const sectionCardClass = 'rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] p-3';

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export const OrderTicket = memo(function OrderTicket({
  accountId = null,
  selectedSymbol,
  symbols,
  quote,
  onSubmitted,
  preferredSide = null,
  accountDisabledReason = null,
  isMobileLayout = false,
  className,
}: OrderTicketProps) {
  const pushNotification = useNotificationStore((state) => state.push);
  const platformStatus = usePlatformStore((state) => state.status);
  const [form, setForm] = useState(defaultState);
  const [stopLossMode, setStopLossMode] = useState<InputMode>('PRICE');
  const [takeProfitMode, setTakeProfitMode] = useState<InputMode>('PRICE');
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceFlash, setPriceFlash] = useState<PriceFlashState>({});
  const pendingRequestIdRef = useRef<string | null>(null);
  const previousQuoteRef = useRef<{
    ask?: number;
    bid?: number;
    execution?: number;
  }>({});

  const selectedSymbolInfo = useMemo(
    () => symbols.find((symbol) => symbol.symbol === selectedSymbol),
    [selectedSymbol, symbols],
  );
  const hasSelectedSymbol = Boolean(selectedSymbolInfo && selectedSymbol);
  const numericVolume = Number(form.volume || 0);
  const numericLeverage = Number(form.leverage || 1);
  const numericLimitPrice = Number(form.price || 0);
  const executionPrice =
    !hasSelectedSymbol
      ? 0
      : form.type === 'LIMIT' && numericLimitPrice > 0
        ? numericLimitPrice
        : form.side === 'BUY'
          ? quote?.ask ?? 0
          : quote?.bid ?? 0;
  const tickSize = selectedSymbolInfo?.minTickIncrement ?? 0.0001;
  const volumeStep = selectedSymbolInfo?.minTradeSizeLots ?? 0.01;
  const minVolume = selectedSymbolInfo?.minTradeSizeLots ?? 0.01;
  const maxVolume = selectedSymbolInfo?.maxTradeSizeLots ?? 100;
  const maxLeverage = selectedSymbolInfo?.maxLeverage;
  const typeSupportsBackend = form.type === 'MARKET' || form.type === 'LIMIT';
  const selectedSymbolHealth = platformStatus?.symbolHealth[selectedSymbol];
  const effectiveHealthStatus = selectedSymbolHealth?.status ?? quote?.healthStatus;
  const effectiveHealthReason = selectedSymbolHealth?.reason ?? quote?.healthReason;
  const effectiveTradingAvailable =
    selectedSymbolHealth?.tradingAvailable ?? quote?.tradingAvailable ?? true;
  const currentMarketStatus =
    effectiveHealthStatus === 'disabled'
      ? 'DISABLED'
      : effectiveHealthStatus === 'closed'
        ? 'CLOSED'
        : effectiveHealthStatus === 'delayed'
          ? 'DELAYED'
          : effectiveHealthStatus === 'stale'
            ? 'STALE'
            : effectiveHealthStatus === 'degraded' || effectiveHealthStatus === 'down'
              ? 'DEGRADED'
              : quote?.marketStatus ??
                (quote?.delayed ? 'DELAYED' : quote?.marketState ?? 'LIVE');
  const symbolDisabledReason =
    hasSelectedSymbol && selectedSymbolInfo && !selectedSymbolInfo.enabled
      ? `${selectedSymbolInfo.symbol} is not live for trading yet.`
      : null;
  const platformBlockedReason =
    platformStatus && !platformStatus.features.tradingEnabled
      ? platformStatus.maintenanceMessage || 'Trading is temporarily disabled.'
      : effectiveTradingAvailable === false
        ? effectiveHealthReason ?? 'Trading is temporarily unavailable for this instrument.'
        : currentMarketStatus === 'CLOSED'
          ? 'Market closed for this instrument'
          : currentMarketStatus === 'DISABLED'
            ? `${selectedSymbol} is not live for trading yet.`
            : null;
  const tradingBlockedReason =
    symbolDisabledReason ?? accountDisabledReason ?? platformBlockedReason;
  const staleQuoteWarning =
    currentMarketStatus === 'DELAYED'
      ? effectiveHealthReason ?? 'Price may be up to 30s delayed'
      : currentMarketStatus === 'STALE' &&
          effectiveTradingAvailable
        ? effectiveHealthReason ??
          'Quote feed is stale. Orders still route using the latest cached price.'
        : currentMarketStatus === 'DEGRADED' && effectiveTradingAvailable
          ? effectiveHealthReason ??
            'Live quote feed is degraded. Orders still route using the latest cached price.'
          : null;
  const currentAssetClass =
    selectedSymbolInfo?.assetClass ?? selectedSymbolInfo?.category ?? null;
  const selectionBlockedReason = hasSelectedSymbol
    ? null
    : 'Select a symbol from the watchlist to prepare an order ticket.';
  const submissionBlockedReason = selectionBlockedReason ?? tradingBlockedReason;
  const controlsDisabled = !hasSelectedSymbol;
  const requiredMargin =
    hasSelectedSymbol &&
    numericVolume > 0 &&
    executionPrice > 0 &&
    selectedSymbolInfo &&
    numericLeverage >= 1
      ? (selectedSymbolInfo.lotSize * numericVolume * executionPrice) / numericLeverage
      : 0;
  const spread =
    quote && selectedSymbolInfo
      ? formatNumber(quote.ask - quote.bid, selectedSymbolInfo.digits)
      : '--';

  useEffect(() => {
    pendingRequestIdRef.current = null;
    previousQuoteRef.current = {};
    setPriceFlash({});
    setStopLossEnabled(false);
    setTakeProfitEnabled(false);
    setForm((current) => ({
      ...current,
      price: '',
      stopLoss: '',
      takeProfit: '',
    }));
  }, [selectedSymbol]);

  useEffect(() => {
    if (preferredSide) {
      setForm((current) => ({ ...current, side: preferredSide }));
    }
  }, [preferredSide]);

  useEffect(() => {
    if (!maxLeverage) {
      return;
    }

    setForm((current) => {
      const leverage = Number(current.leverage || 1);
      const nextLeverage = clampValue(
        Number.isFinite(leverage) && leverage > 0 ? Math.round(leverage) : 1,
        1,
        maxLeverage,
      );
      const nextValue = String(nextLeverage);

      return current.leverage === nextValue
        ? current
        : { ...current, leverage: nextValue };
    });
  }, [maxLeverage]);

  useEffect(() => {
    if (!quote || !hasSelectedSymbol) {
      return;
    }

    const nextFlash: PriceFlashState = {};
    const previousAsk = previousQuoteRef.current.ask;
    const previousBid = previousQuoteRef.current.bid;
    const previousExecution = previousQuoteRef.current.execution;

    if (typeof previousAsk === 'number' && previousAsk !== quote.ask) {
      nextFlash.ask = quote.ask > previousAsk ? 'up' : 'down';
    }

    if (typeof previousBid === 'number' && previousBid !== quote.bid) {
      nextFlash.bid = quote.bid > previousBid ? 'up' : 'down';
    }

    if (
      typeof previousExecution === 'number' &&
      executionPrice > 0 &&
      previousExecution !== executionPrice
    ) {
      nextFlash.execution = executionPrice > previousExecution ? 'up' : 'down';
    }

    previousQuoteRef.current = {
      ask: quote.ask,
      bid: quote.bid,
      execution: executionPrice > 0 ? executionPrice : undefined,
    };

    if (Object.keys(nextFlash).length === 0) {
      return;
    }

    setPriceFlash(nextFlash);
    const timeoutId = window.setTimeout(() => setPriceFlash({}), 400);
    return () => window.clearTimeout(timeoutId);
  }, [executionPrice, hasSelectedSymbol, quote, selectedSymbol]);

  function updateForm(patch: Partial<typeof defaultState>) {
    pendingRequestIdRef.current = null;
    setForm((current) => ({ ...current, ...patch }));
  }

  function adjustVolume(direction: 'up' | 'down') {
    const nextValue = numericVolume || minVolume;
    const candidate = direction === 'up' ? nextValue + volumeStep : nextValue - volumeStep;
    const clamped = clampValue(candidate, minVolume, maxVolume);
    updateForm({
      volume: clamped.toFixed(Math.min(4, String(volumeStep).split('.')[1]?.length ?? 2)),
    });
  }

  function handleLeverageChange(value: string) {
    if (value.trim() === '') {
      updateForm({ leverage: value });
      return;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    const limit = maxLeverage ?? Math.max(1, Math.round(numericValue));
    updateForm({ leverage: String(clampValue(Math.round(numericValue), 1, limit)) });
  }

  function getPendingRequestId() {
    if (!pendingRequestIdRef.current) {
      pendingRequestIdRef.current =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    return pendingRequestIdRef.current;
  }

  function resolveProtectivePrice(
    value: string,
    mode: InputMode,
    kind: 'stopLoss' | 'takeProfit',
  ) {
    if (!value || !selectedSymbolInfo || executionPrice <= 0) {
      return undefined;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return undefined;
    }

    if (mode === 'PRICE') {
      return numericValue;
    }

    const distance = numericValue * tickSize;

    if (kind === 'takeProfit') {
      return form.side === 'BUY' ? executionPrice + distance : executionPrice - distance;
    }

    return form.side === 'BUY' ? executionPrice - distance : executionPrice + distance;
  }

  async function handleSubmit() {
    if (submissionBlockedReason) {
      setError(submissionBlockedReason);
      return;
    }

    if (!typeSupportsBackend) {
      setError('Stop and stop-limit routing will be enabled when backend order support is available.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await ordersApi.place({
        accountId: accountId ?? undefined,
        clientRequestId: getPendingRequestId(),
        symbol: selectedSymbol,
        side: form.side,
        type: form.type as OrderType,
        volume: Number(form.volume),
        leverage: Number(form.leverage),
        price: form.type === 'LIMIT' && form.price ? Number(form.price) : undefined,
        stopLoss: stopLossEnabled
          ? resolveProtectivePrice(form.stopLoss, stopLossMode, 'stopLoss')
          : undefined,
        takeProfit: takeProfitEnabled
          ? resolveProtectivePrice(form.takeProfit, takeProfitMode, 'takeProfit')
          : undefined,
      });

      pushNotification({
        title: `${form.side} order queued`,
        description: `${selectedSymbol} ${form.type.toLowerCase()} order submitted to the backend.`,
        type: 'success',
      });

      pendingRequestIdRef.current = null;
      setStopLossEnabled(false);
      setTakeProfitEnabled(false);
      setForm((current) => ({
        ...current,
        volume: defaultState.volume,
        price: '',
        stopLoss: '',
        takeProfit: '',
      }));
      await onSubmitted();
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : 'Order submission failed';
      setError(message);
      pushNotification({
        title: 'Order rejected',
        description: message,
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside
      className={cn(
        'terminal-panel flex min-h-0 flex-col overflow-hidden',
        className,
      )}
    >
      <div className="border-b border-[var(--terminal-border)] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="terminal-label">
              Order Ticket
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-semibold tracking-[0.01em] text-[var(--terminal-text-primary)]">
                {selectedSymbol || 'Select Symbol'}
              </p>
              {currentAssetClass ? (
                <span className="terminal-chip">{currentAssetClass}</span>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[var(--terminal-text-secondary)]">
              {selectedSymbolInfo
                ? selectedSymbolInfo.displayName || selectedSymbolInfo.assetClass
                : 'Select an instrument from the watchlist to enable order entry'}
            </p>
          </div>

          <div className="min-w-[96px] text-right">
            <p className="terminal-label">
              {form.type === 'LIMIT' ? 'Pending price' : 'Execution'}
            </p>
            <p
              className={cn(
                'price-display text-lg font-semibold text-[var(--terminal-text-primary)]',
                priceFlash.execution === 'up' ? 'terminal-price-up' : '',
                priceFlash.execution === 'down' ? 'terminal-price-down' : '',
              )}
            >
              {executionPrice
                ? formatNumber(executionPrice, selectedSymbolInfo?.digits ?? 5)
                : '--'}
            </p>
            <p className="mt-1 text-xs text-[var(--terminal-text-secondary)]">
              Spread {spread}
            </p>
          </div>
        </div>
      </div>

      <div className="terminal-scrollbar flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(['SELL', 'BUY'] as OrderSide[]).map((side) => {
              const active = form.side === side;
              const price =
                side === 'SELL'
                  ? quote
                    ? formatNumber(quote.bid, selectedSymbolInfo?.digits ?? 5)
                    : '--'
                  : quote
                    ? formatNumber(quote.ask, selectedSymbolInfo?.digits ?? 5)
                    : '--';

              return (
                <button
                  key={side}
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => updateForm({ side })}
                  className={cn(
                    'rounded-md border px-3 py-3 text-left transition duration-150 disabled:cursor-not-allowed disabled:opacity-45',
                    side === 'SELL'
                      ? active
                        ? 'border-[var(--terminal-red)] bg-[var(--terminal-red-bg)] text-white'
                        : 'border-[var(--terminal-border)] bg-[rgba(6,11,19,0.72)] text-[var(--terminal-red)]'
                      : active
                        ? 'border-[var(--terminal-green)] bg-[var(--terminal-green-bg)] text-white'
                        : 'border-[var(--terminal-border)] bg-[rgba(6,11,19,0.72)] text-[var(--terminal-green)]',
                    side === 'SELL' && priceFlash.bid === 'up' ? 'terminal-price-up' : '',
                    side === 'SELL' && priceFlash.bid === 'down' ? 'terminal-price-down' : '',
                    side === 'BUY' && priceFlash.ask === 'up' ? 'terminal-price-up' : '',
                    side === 'BUY' && priceFlash.ask === 'down' ? 'terminal-price-down' : '',
                  )}
                >
                  <p className="text-[11px] font-semibold">
                    {side}
                  </p>
                  <p className="price-display mt-2 text-xl font-semibold">{price}</p>
                </button>
              );
            })}
          </div>

          <div className={sectionCardClass}>
            <p className="terminal-label">Order type</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Market', value: 'MARKET' as TicketOrderType, enabled: true },
                { label: 'Limit', value: 'LIMIT' as TicketOrderType, enabled: true },
                { label: 'Stop', value: 'STOP' as TicketOrderType, enabled: false },
                { label: 'Stop Limit', value: 'STOP_LIMIT' as TicketOrderType, enabled: false },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={!item.enabled || controlsDisabled}
                  onClick={() => item.enabled && updateForm({ type: item.value })}
                  className={cn(
                    'inline-flex min-h-[34px] items-center justify-center rounded-md border px-3 text-[10px] font-semibold uppercase tracking-[0.08em] transition duration-150 disabled:cursor-not-allowed disabled:opacity-45',
                    form.type === item.value
                      ? 'border-[var(--terminal-border-strong)] bg-[rgba(128,148,184,0.14)] text-[var(--terminal-text-primary)]'
                      : item.enabled
                        ? 'border-[var(--terminal-border)] bg-[rgba(6,11,19,0.72)] text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]'
                        : 'border-[var(--terminal-border)] bg-[rgba(6,11,19,0.5)] text-[var(--terminal-text-muted)]',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'LIMIT' ? (
            <div className={sectionCardClass}>
              <p className="terminal-label">
                Pending Price
              </p>
              <input
                type="number"
                min="0.00000001"
                step={
                  selectedSymbolInfo
                    ? Number((1 / selectedSymbolInfo.pricescale).toFixed(8))
                    : 0.01
                }
                value={form.price}
                disabled={controlsDisabled}
                onChange={(event) => updateForm({ price: event.target.value })}
                placeholder="Enter pending price"
                className={cn('mt-3', inputClass)}
              />
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={sectionCardClass}>
              <div className="flex items-center justify-between gap-3">
                <p className="terminal-label">Volume</p>
                <p className="text-[11px] text-[var(--terminal-text-secondary)]">
                  Margin
                </p>
              </div>
              <p className="mt-1 text-[11px] font-medium text-[var(--terminal-text-primary)]">
                {hasSelectedSymbol ? formatUsdt(requiredMargin) : '--'}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={controlsDisabled}
                  onClick={() => adjustVolume('down')}
                >
                  <Minus className="h-4 w-4" />
                </button>

                <input
                  type="number"
                  min={minVolume}
                  max={maxVolume}
                  step={volumeStep}
                  value={form.volume}
                  disabled={controlsDisabled}
                  onChange={(event) => updateForm({ volume: event.target.value })}
                  className={cn('text-center text-base font-semibold', inputClass)}
                />

                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={controlsDisabled}
                  onClick={() => adjustVolume('up')}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={sectionCardClass}>
              <p className="terminal-label">Leverage</p>
              <input
                type="number"
                min="1"
                max={maxLeverage}
                step="1"
                value={form.leverage}
                disabled={controlsDisabled}
                onChange={(event) => handleLeverageChange(event.target.value)}
                className={cn('mt-3', inputClass)}
              />
              <p className="mt-2 text-[11px] text-[var(--terminal-text-secondary)]">
                Max available {maxLeverage ? `1:${maxLeverage}` : '--'}
              </p>
            </div>
          </div>

          {[
            {
              label: 'Stop Loss',
              enabled: stopLossEnabled,
              mode: stopLossMode,
              onEnabledChange: setStopLossEnabled,
              onModeChange: setStopLossMode,
              value: form.stopLoss,
              onChange: (value: string) => updateForm({ stopLoss: value }),
            },
            {
              label: 'Take Profit',
              enabled: takeProfitEnabled,
              mode: takeProfitMode,
              onEnabledChange: setTakeProfitEnabled,
              onModeChange: setTakeProfitMode,
              value: form.takeProfit,
              onChange: (value: string) => updateForm({ takeProfit: value }),
            },
          ].map((field) => (
            <div key={field.label} className={sectionCardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="terminal-label">
                    {field.label}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--terminal-text-muted)]">
                    {field.mode === 'PRICE' ? 'Enter price level' : 'Enter pip distance'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => {
                    field.onEnabledChange(!field.enabled);
                    if (field.enabled) {
                      field.onChange('');
                    }
                  }}
                  className={cn(
                    'inline-flex h-7 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition duration-150 disabled:cursor-not-allowed disabled:opacity-45',
                    field.enabled
                      ? 'border-[var(--terminal-border-strong)] bg-[rgba(128,148,184,0.14)] text-[var(--terminal-text-primary)]'
                      : 'border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]',
                  )}
                >
                  {field.enabled ? 'On' : 'Off'}
                </button>
              </div>

              {field.enabled ? (
                <>
                  <div className="mt-3 flex gap-2">
                    {(['PRICE', 'PIPS'] as InputMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={controlsDisabled}
                        className={cn(
                          'inline-flex h-7 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition duration-150 disabled:cursor-not-allowed disabled:opacity-45',
                          field.mode === mode
                            ? 'border-[var(--terminal-border)] bg-[var(--terminal-bg-elevated)] text-[var(--terminal-text-primary)]'
                            : 'border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]',
                        )}
                        onClick={() => field.onModeChange(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min="0.00000001"
                    step={field.mode === 'PIPS' ? 1 : tickSize}
                    value={field.value}
                    disabled={controlsDisabled}
                    onChange={(event) => field.onChange(event.target.value)}
                    placeholder={field.mode === 'PIPS' ? 'Enter pips' : 'Enter price'}
                    className={cn('mt-3', inputClass)}
                  />
                </>
              ) : null}
            </div>
          ))}

          <div className={cn(sectionCardClass, 'text-sm')}>
            {[
              [
                'Execution Price',
                executionPrice
                  ? formatNumber(executionPrice, selectedSymbolInfo?.digits ?? 5)
                  : '--',
              ],
              ['Spread', spread],
              ['Asset Class', currentAssetClass ?? '--'],
              ['Leverage', hasSelectedSymbol && numericLeverage > 0 ? `1:${numericLeverage}` : '--'],
              ['Pip Value', selectedSymbolInfo?.pipValue ?? '--'],
              ['Status', currentMarketStatus],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-b border-[var(--terminal-border)]/70 py-2.5 last:border-b-0 last:pb-0 first:pt-0"
              >
                <span className="text-[var(--terminal-text-secondary)]">{label}</span>
                <span className="price-display text-right font-medium text-[var(--terminal-text-primary)]">
                  {value}
                </span>
              </div>
            ))}
          </div>

          {staleQuoteWarning && !submissionBlockedReason ? (
            <div className="rounded-md border border-amber-500/18 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-200">
              {staleQuoteWarning}
            </div>
          ) : null}

          {submissionBlockedReason ? (
            <div className="rounded-md border border-amber-500/18 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-200">
              {submissionBlockedReason}
            </div>
          ) : null}

          {error ? <p className="text-sm text-[var(--terminal-red)]">{error}</p> : null}
        </div>
      </div>

      <div className="border-t border-[var(--terminal-border)] px-3 py-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting || Boolean(submissionBlockedReason)}
          className={cn(
            'flex min-h-[42px] w-full items-center justify-center rounded-md border text-sm font-semibold text-white transition duration-150 disabled:cursor-not-allowed disabled:opacity-50',
            form.side === 'BUY'
              ? 'border-[var(--terminal-green)] bg-[var(--terminal-green)] hover:opacity-90'
              : 'border-[var(--terminal-red)] bg-[var(--terminal-red)] hover:opacity-90',
          )}
        >
          {submitting
            ? 'Submitting...'
            : hasSelectedSymbol
              ? `${form.side} ${selectedSymbol}`
              : 'Select Symbol'}
        </button>

        <p
          className={cn(
            'mt-3 text-center text-[11px] leading-5 text-[var(--terminal-text-secondary)]',
            isMobileLayout ? 'pb-2' : '',
          )}
        >
          Orders execute against the latest available broker quote and may be filled at market.
        </p>
      </div>
    </aside>
  );
});
