'use client';

import { create } from 'zustand';

import { CandleUpdatePayload, MarketQuote } from '@/types/market-data';

export const DEFAULT_WATCHLIST_SYMBOLS = [
  // Forex majors
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'GBPAUD',
  'AUDJPY', 'CADJPY', 'USDMXN', 'USDSEK', 'USDNOK', 'USDTRY',
  // Metals
  'XAUUSD', 'XAGUSD', 'XPDUSD', 'XPTUSD', 'COPPER-CASH',
  // Indices
  'SP-CASH', 'NSDQ-CASH', 'DOW-CASH', 'FTSE-CASH', 'DAX-CASH', 'CAC-CASH',
  'NK-CASH', 'ASX-CASH', 'RTY-CASH', 'EUSX-CASH', 'DXY-CASH',
  // Commodities
  'BRNT-CASH', 'CL-CASH', 'NGAS-CASH', 'XAUUSD', 'WHEAT-CASH', 'CORN-CASH',
  // Crypto
  'BTCUSD', 'ETHUSD', 'XRPUSD', 'SOLUSD', 'BNBUSD', 'ADAUSD', 'DOGEUSD',
  'DOTUSD', 'LTCUSD', 'LINKUSD', 'TRXUSD', 'SUIUSD',
  // US Stocks
  'APPLE', 'MICROSOFT', 'NVIDIA', 'GOOGLE', 'AMAZON', 'TSLA', 'FACEBOOK',
  'NETFLIX', 'AMD', 'INTEL', 'ORACLE', 'PAYPAL', 'ADOBE', 'CISCO',
  'BOEING', 'JPMORGAN', 'BOA', 'GOLDMNSACHS', 'MASTERCARD', 'VISA',
  'DISNEY', 'COCACOLA', 'PEPSICO', 'MCDONALDS', 'WALMART', 'NIKE',
  'UBER', 'SHOPIFY', 'COIN', 'PLTR', 'GME', 'FORD', 'GM',
  'EXXONMOBIL', 'CHEVRON', 'DELTA', 'AAL', 'IBM', 'PFIZER', 'MRNA',
  'ABBV', 'REDDIT', 'SPOT', 'ZOOM', 'ARM', 'BROADCOM', 'BKNG',
  // EU Stocks
  'ADIDAS', 'BMW', 'SIEMENS', 'VOWGEN', 'NESTLE', 'ROCHE', 'ABBN',
  'BBVA', 'ENEL', 'ENI', 'ALLI', 'DBFRA', 'RHM',
  // UK Stocks
  'HSBC', 'LLOY', 'BARC', 'BP', 'VOD', 'TESCO', 'AVIVA', 'RR',
  // Mideast
  'ARAMCO', 'RAJHI', 'EMAAR', 'EMIRATESNBD', 'FAB.AD', 'QNBK',
  // Latam & India
  'VALE3', 'ITUB4', 'RELIANCE', 'TATAMOTORS',
  // ETFs
  'SPY', 'QQQ', 'DIA', 'GLD', 'GDX', 'XLK', 'XLF', 'XLE', 'XLV',
  'IBIT', 'TQQQ', 'SQQQ', 'USO', 'VIXY',
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
