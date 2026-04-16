import {
  HistoryResponse,
  MarketDataConfig,
  MarketQuote,
  SymbolInfo,
} from '@/types/market-data';

import { apiRequest } from './http';

export const marketDataApi = {
  getConfig() {
    return apiRequest<MarketDataConfig>('/market-data/config', {
      authMode: 'none',
    });
  },
  listSymbols(params?: {
    search?: string;
    assetClass?: string;
    enabledOnly?: boolean;
  }) {
    const query = new URLSearchParams();

    if (params?.search) {
      query.set('search', params.search);
    }

    if (params?.assetClass) {
      query.set('assetClass', params.assetClass);
    }

    if (params?.enabledOnly !== undefined) {
      query.set('enabledOnly', String(params.enabledOnly));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';

    return apiRequest<SymbolInfo[]>(`/market-data/symbols${suffix}`, {
      authMode: 'none',
    });
  },
  getSymbolInfo(symbol: string) {
    return apiRequest<SymbolInfo>(`/market-data/symbols/${encodeURIComponent(symbol)}`, {
      authMode: 'none',
    });
  },
  getHistory(params: {
    symbol: string;
    resolution: string;
    from: number;
    to: number;
  }) {
    const query = new URLSearchParams({
      symbol: params.symbol,
      resolution: params.resolution,
      from: String(params.from),
      to: String(params.to),
    });

    return apiRequest<HistoryResponse>(`/market-data/history?${query.toString()}`, {
      authMode: 'none',
    });
  },
  getPrice(symbol: string) {
    return apiRequest<MarketQuote>(`/market-data/price/${encodeURIComponent(symbol)}`, {
      authMode: 'none',
    });
  },
  getPrices(symbols: string[]) {
    const normalizedSymbols = [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))];

    if (normalizedSymbols.length === 0) {
      return Promise.resolve<MarketQuote[]>([]);
    }

    const query = new URLSearchParams();
    normalizedSymbols.forEach((symbol) => query.append('symbols', symbol));

    return apiRequest<MarketQuote[]>(`/market-data/prices?${query.toString()}`, {
      authMode: 'none',
    });
  },
};
