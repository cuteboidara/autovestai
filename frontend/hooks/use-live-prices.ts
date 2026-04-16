'use client';

import { useEffect, useMemo, useRef } from 'react';

import { socketManager } from '@/lib/socket-manager';
import { useAuthStore } from '@/store/auth-store';
import { useMarketDataStore } from '@/store/market-data-store';
import { LiveConnectionStatus } from '@/types/market-data';

function useNormalizedSymbols(symbols: string[]) {
  return useMemo(
    () =>
      [
        ...new Set(
          symbols
            .map((symbol) => symbol.trim().toUpperCase())
            .filter(Boolean),
        ),
      ].sort(),
    [symbols],
  );
}

export function useLivePriceSubscription(symbols: string[]) {
  const token = useAuthStore((state) => state.token);
  const normalizedSymbols = useNormalizedSymbols(symbols);
  const activeSymbolsRef = useRef<string[]>([]);

  useEffect(() => {
    socketManager.connect(token);
    const previousSymbols = new Set(activeSymbolsRef.current);
    const nextSymbols = new Set(normalizedSymbols);

    normalizedSymbols
      .filter((symbol) => !previousSymbols.has(symbol))
      .forEach((symbol) => socketManager.subscribePrice(symbol));
    activeSymbolsRef.current
      .filter((symbol) => !nextSymbols.has(symbol))
      .forEach((symbol) => socketManager.unsubscribePrice(symbol));

    activeSymbolsRef.current = normalizedSymbols;
  }, [normalizedSymbols, token]);

  useEffect(
    () => () => {
      activeSymbolsRef.current.forEach((symbol) => socketManager.unsubscribePrice(symbol));
      activeSymbolsRef.current = [];
    },
    [],
  );
}

export function useLiveQuote(symbol: string) {
  const normalizedSymbol = useMemo(() => symbol.trim().toUpperCase(), [symbol]);

  return useMarketDataStore((state) =>
    normalizedSymbol ? state.quotes[normalizedSymbol] : undefined,
  );
}

export function useLiveConnectionStatus(): LiveConnectionStatus {
  return useMarketDataStore((state) => state.connectionStatus);
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
