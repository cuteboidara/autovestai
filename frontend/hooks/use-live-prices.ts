'use client';

import { useEffect, useMemo } from 'react';

import { socketManager } from '@/lib/socket-manager';
import { useAuthStore } from '@/store/auth-store';
import { useMarketDataStore } from '@/store/market-data-store';

function useNormalizedSymbols(symbols: string[]) {
  return useMemo(
    () =>
      [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))].sort(),
    [symbols],
  );
}

export function useLivePriceSubscription(symbols: string[]) {
  const token = useAuthStore((state) => state.token);
  const normalizedSymbols = useNormalizedSymbols(symbols);
  const subscriptionKey = normalizedSymbols.join('|');

  useEffect(() => {
    if (normalizedSymbols.length === 0) {
      return;
    }

    socketManager.connect(token);
    normalizedSymbols.forEach((symbol) => socketManager.subscribePrice(symbol));

    return () => {
      normalizedSymbols.forEach((symbol) => socketManager.unsubscribePrice(symbol));
    };
  }, [subscriptionKey, normalizedSymbols, token]);
}

export function useLiveQuote(symbol: string) {
  const normalizedSymbol = useMemo(() => symbol.trim(), [symbol]);

  return useMarketDataStore((state) =>
    normalizedSymbol ? state.quotes[normalizedSymbol] : undefined,
  );
}

export function useLivePrices(symbols: string[]) {
  const quotes = useMarketDataStore((state) => state.quotes);
  const normalizedSymbols = useNormalizedSymbols(symbols);

  useLivePriceSubscription(normalizedSymbols);

  return useMemo(
    () =>
      Object.fromEntries(
        normalizedSymbols
          .filter((symbol) => Boolean(quotes[symbol]))
          .map((symbol) => [symbol, quotes[symbol]]),
      ),
    [normalizedSymbols, quotes],
  );
}
