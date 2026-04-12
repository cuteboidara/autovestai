'use client';

import { socketManager } from '@/lib/socket-manager';
import { marketDataApi } from '@/services/api/market-data';
import { SymbolInfo } from '@/types/market-data';

type TradingViewSymbolInfo = SymbolInfo;

interface TradingViewBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type RealtimeCallback = (bar: TradingViewBar) => void;

interface SubscriptionRecord {
  symbol: string;
  resolution: string;
  unsubscribe: () => void;
}

function mapTradingViewTypeToAssetClass(symbolType: string) {
  const normalized = symbolType.trim().toLowerCase();

  switch (normalized) {
    case 'forex':
      return 'FOREX';
    case 'crypto':
      return 'CRYPTO';
    case 'commodity':
      return undefined;
    case 'index':
      return 'INDICES';
    case 'stock':
      return 'STOCKS';
    case 'fund':
      return 'ETFS';
    default:
      return undefined;
  }
}

function candleToBar(candle: {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}): TradingViewBar {
  return {
    time: new Date(candle.timestamp).getTime(),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

export function createUdfDatafeed() {
  const subscriptions = new Map<string, SubscriptionRecord>();

  return {
    onReady(callback: (config: Record<string, unknown>) => void) {
      void marketDataApi
        .getConfig()
        .then((config) => callback(config as unknown as Record<string, unknown>));
    },
    searchSymbols(
      userInput: string,
      _exchange: string,
      symbolType: string,
      onResultReadyCallback: (result: TradingViewSymbolInfo[]) => void,
    ) {
      void marketDataApi
        .listSymbols({
          search: userInput.trim(),
          assetClass: mapTradingViewTypeToAssetClass(symbolType),
          enabledOnly: true,
        })
        .then((symbols) => onResultReadyCallback(symbols));
    },
    resolveSymbol(
      symbolName: string,
      onSymbolResolvedCallback: (symbol: TradingViewSymbolInfo) => void,
      onResolveErrorCallback: (reason: string) => void,
    ) {
      void marketDataApi
        .getSymbolInfo(symbolName)
        .then((symbol) => onSymbolResolvedCallback(symbol))
        .catch((error: Error) => onResolveErrorCallback(error.message));
    },
    getBars(
      symbolInfo: TradingViewSymbolInfo,
      resolution: string,
      periodParams: { from: number; to: number },
      onHistoryCallback: (bars: TradingViewBar[], meta: { noData: boolean }) => void,
      onErrorCallback: (error: string) => void,
    ) {
      void marketDataApi
        .getHistory({
          symbol: symbolInfo.ticker,
          resolution,
          from: periodParams.from,
          to: periodParams.to,
        })
        .then((response) => {
          if (response.s === 'no_data') {
            onHistoryCallback([], { noData: true });
            return;
          }

          const bars = response.t.map((time, index) => ({
            time: time * 1000,
            open: response.o[index],
            high: response.h[index],
            low: response.l[index],
            close: response.c[index],
          }));

          onHistoryCallback(bars, { noData: bars.length === 0 });
        })
        .catch((error: Error) => onErrorCallback(error.message));
    },
    subscribeBars(
      symbolInfo: TradingViewSymbolInfo,
      resolution: string,
      onRealtimeCallback: RealtimeCallback,
      subscriberUID: string,
    ) {
      socketManager.connect(
        typeof window !== 'undefined' ? window.localStorage.getItem('autovestai.token') : null,
      );
      socketManager.subscribeCandles(symbolInfo.ticker, resolution);

      const unsubscribe = socketManager.on('candle_update', (payload) => {
        const data = payload as
          | {
              symbol?: string;
              resolution?: string;
              candle?: {
                timestamp: string;
                open: number;
                high: number;
                low: number;
                close: number;
              };
            }
          | undefined;

        if (
          !data?.candle ||
          data.symbol !== symbolInfo.ticker ||
          String(data.resolution) !== String(resolution)
        ) {
          return;
        }

        onRealtimeCallback(candleToBar(data.candle));
      });

      subscriptions.set(subscriberUID, {
        symbol: symbolInfo.ticker,
        resolution,
        unsubscribe,
      });
    },
    unsubscribeBars(subscriberUID: string) {
      const subscription = subscriptions.get(subscriberUID);

      if (!subscription) {
        return;
      }

      socketManager.unsubscribeCandles(subscription.symbol, subscription.resolution);
      subscription.unsubscribe();
      subscriptions.delete(subscriberUID);
    },
    getServerTime(callback: (time: number) => void) {
      callback(Math.floor(Date.now() / 1000));
    },
  };
}
