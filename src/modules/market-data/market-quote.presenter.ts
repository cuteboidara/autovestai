import { Symbol as TradingSymbol } from '@prisma/client';

import { PriceSnapshot } from '../../common/interfaces/price-snapshot.interface';
import { getSymbolMasterRecord } from '../symbols/symbol-master';

export type QuoteHealthStatus =
  | 'ok'
  | 'delayed'
  | 'stale'
  | 'degraded'
  | 'down'
  | 'closed'
  | 'disabled';

export interface QuoteHealthSnapshot {
  status: QuoteHealthStatus | string;
  reason: string;
  ageMs: number | null;
  tradingAvailable: boolean;
  marketState: PriceSnapshot['marketState'] | string;
}

export interface MarketQuotePayload {
  symbol: string;
  displayName: string;
  assetClass: TradingSymbol['category'];
  enabled: boolean;
  tradingViewSymbol: string;
  quoteSource: TradingSymbol['quoteSource'];
  rawPrice: number;
  last: number;
  lastPrice: number;
  bid: number;
  ask: number;
  spread: number;
  markup: number;
  changePct: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  delayed: boolean;
  source: string;
  marketState: PriceSnapshot['marketState'];
  marketStatus:
    | 'LIVE'
    | 'DELAYED'
    | 'STALE'
    | 'DEGRADED'
    | 'DISABLED'
    | 'CLOSED';
  healthStatus: QuoteHealthStatus;
  healthReason: string;
  ageMs: number | null;
  tradingAvailable: boolean;
  timestamp: string;
  lastUpdated: string;
}

function toClientMarketStatus(
  status: QuoteHealthStatus | string,
): MarketQuotePayload['marketStatus'] {
  switch (status) {
    case 'ok':
      return 'LIVE';
    case 'delayed':
      return 'DELAYED';
    case 'stale':
      return 'STALE';
    case 'closed':
      return 'CLOSED';
    case 'disabled':
      return 'DISABLED';
    case 'degraded':
    case 'down':
    default:
      return 'DEGRADED';
  }
}

function normalizeHealthStatus(status: QuoteHealthStatus | string): QuoteHealthStatus {
  switch (status) {
    case 'ok':
    case 'delayed':
    case 'stale':
    case 'degraded':
    case 'down':
    case 'closed':
    case 'disabled':
      return status;
    default:
      return 'degraded';
  }
}

export function createMarketQuotePayload(params: {
  instrument: Pick<
    TradingSymbol,
    'symbol' | 'description' | 'category' | 'isActive' | 'quoteSource'
  >;
  snapshot: PriceSnapshot;
  health: QuoteHealthSnapshot;
  tradingViewSymbol: string;
}): MarketQuotePayload {
  const { instrument, snapshot, health, tradingViewSymbol } = params;
  const healthStatus = normalizeHealthStatus(health.status);

  return {
    symbol: instrument.symbol,
    displayName:
      getSymbolMasterRecord(instrument.symbol)?.displayName ?? instrument.description,
    assetClass: instrument.category,
    enabled: instrument.isActive,
    tradingViewSymbol,
    quoteSource: instrument.quoteSource,
    rawPrice: snapshot.rawPrice,
    last: snapshot.lastPrice,
    lastPrice: snapshot.lastPrice,
    bid: snapshot.bid,
    ask: snapshot.ask,
    spread: snapshot.spread,
    markup: snapshot.markup,
    changePct: snapshot.changePct ?? null,
    dayHigh: snapshot.dayHigh ?? null,
    dayLow: snapshot.dayLow ?? null,
    delayed: healthStatus === 'delayed' || Boolean(snapshot.delayed),
    source: snapshot.source,
    marketState:
      (health.marketState as MarketQuotePayload['marketState']) ?? snapshot.marketState,
    marketStatus: toClientMarketStatus(healthStatus),
    healthStatus,
    healthReason: health.reason,
    ageMs: health.ageMs,
    tradingAvailable: health.tradingAvailable,
    timestamp: snapshot.timestamp,
    lastUpdated: snapshot.lastUpdated,
  };
}
