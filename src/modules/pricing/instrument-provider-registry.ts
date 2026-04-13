import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalizeSymbolIdentifier } from '../symbols/symbol-master';

export type LivePricingProvider = 'coingecko' | 'binance' | 'forex-api' | 'yahoo-finance';

interface ActivationRegistryEntry {
  raw_pdf_symbol?: string;
  asset_class?: string;
  backend_seed?: {
    symbol?: string;
    quote_source?: string;
    quote_symbol?: string | null;
  };
  provider_symbol_map?: Record<
    string,
    {
      symbol?: string;
      from_symbol?: string;
      to_symbol?: string;
    }
  >;
}

const REGISTRY_PATH = join(process.cwd(), 'activation_output', 'instruments_master.json');

let cachedProviderMap: Map<string, LivePricingProvider> | null = null;

function inferProvider(entry: ActivationRegistryEntry): LivePricingProvider {
  const symbol = normalizeSymbolIdentifier(
    entry.backend_seed?.symbol ?? entry.raw_pdf_symbol ?? '',
  );
  const assetClass = String(entry.asset_class ?? '').toUpperCase();
  const quoteSource = String(entry.backend_seed?.quote_source ?? '').toUpperCase();
  const providerMap = entry.provider_symbol_map ?? {};

  // Crypto assets → CoinGecko (primary), Binance available as secondary via fallback
  if (providerMap.binance?.symbol || quoteSource === 'BINANCE') {
    return 'coingecko';
  }

  if (
    assetClass === 'FOREX' ||
    quoteSource === 'FOREX_API' ||
    symbol === 'XAUUSD' ||
    symbol === 'XAGUSD'
  ) {
    return 'forex-api';
  }

  return 'yahoo-finance';
}

function loadProviderMap() {
  if (cachedProviderMap) {
    return cachedProviderMap;
  }

  const providerMap = new Map<string, LivePricingProvider>();

  if (!existsSync(REGISTRY_PATH)) {
    cachedProviderMap = providerMap;
    return providerMap;
  }

  const parsed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as ActivationRegistryEntry[];

  for (const entry of parsed) {
    const symbol = normalizeSymbolIdentifier(
      entry.backend_seed?.symbol ?? entry.raw_pdf_symbol ?? '',
    );

    if (!symbol) {
      continue;
    }

    providerMap.set(symbol, inferProvider(entry));
  }

  cachedProviderMap = providerMap;
  return providerMap;
}

export function getPrimaryProviderForSymbol(symbol: string): LivePricingProvider {
  return loadProviderMap().get(normalizeSymbolIdentifier(symbol)) ?? 'yahoo-finance';
}
