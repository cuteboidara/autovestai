'use client';

import { create } from 'zustand';

import { CandleUpdatePayload, MarketQuote } from '@/types/market-data';

export const DEFAULT_WATCHLIST_SYMBOLS = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'USDCHF',
  'AUDUSD',
  'USDCAD',
  'NZDUSD',
  'EURGBP',
  'EURJPY',
  'GBPJPY',
  'XAUUSD',
  'XAGUSD',
  'BTCUSD',
  'ETHUSD',
  'BNBUSD',
  'NSDQ-CASH',
  'SP-CASH',
  'DOW-CASH',
  'DAX-CASH',
  'BRNT-CASH',
  'CL-CASH',
] as const;

interface MarketDataState {
  watchlist: string[];
  selectedSymbol: string;
  selectedResolution: string;
  quotes: Record<string, MarketQuote>;
  candles: Record<string, CandleUpdatePayload['candle'][]>;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedResolution: (resolution: string) => void;
  setWatchlist: (symbols: string[]) => void;
  upsertQuote: (quote: MarketQuote) => void;
  upsertCandle: (payload: CandleUpdatePayload) => void;
}

export const useMarketDataStore = create<MarketDataState>((set) => ({
  watchlist: [...DEFAULT_WATCHLIST_SYMBOLS],
  selectedSymbol: 'EURUSD',
  selectedResolution: '1',
  quotes: {},
  candles: {},
  setSelectedSymbol(symbol) {
    set({ selectedSymbol: symbol });
  },
  setSelectedResolution(resolution) {
    set({ selectedResolution: resolution });
  },
  setWatchlist(symbols) {
    set({ watchlist: symbols });
  },
  upsertQuote(quote) {
    set((state) => ({
      quotes: {
        ...state.quotes,
        [quote.symbol]: quote,
      },
    }));
  },
  upsertCandle(payload) {
    const key = `${payload.symbol}:${payload.resolution}`;
    set((state) => {
      const existing = state.candles[key] ?? [];
      const last = existing[existing.length - 1];
      const next =
        last && last.timestamp === payload.candle.timestamp
          ? [...existing.slice(0, -1), payload.candle]
          : [...existing, payload.candle].slice(-500);

      return {
        candles: {
          ...state.candles,
          [key]: next,
        },
      };
    });
  },
}));
