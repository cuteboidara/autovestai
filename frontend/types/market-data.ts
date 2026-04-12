export interface MarketQuote {
  symbol: string;
  displayName?: string;
  assetClass?: SymbolInfo['assetClass'];
  enabled?: boolean;
  tradingViewSymbol?: string;
  quoteSource?: string;
  rawPrice: number;
  lastPrice: number;
  bid: number;
  ask: number;
  spread: number;
  markup: number;
  changePct?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  delayed?: boolean;
  timestamp: string;
  source?: string;
  marketState?: string;
  marketStatus?:
    | 'LIVE'
    | 'CLOSED'
    | 'DEGRADED'
    | 'DISABLED'
    | 'STALE'
    | 'BOOTSTRAP'
    | 'DELAYED';
  tradingAvailable?: boolean;
  lastUpdated?: string;
}

export interface Candle {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: string;
}

export interface CandleUpdatePayload {
  symbol: string;
  resolution: string;
  candle: Candle;
}

export interface SymbolInfo {
  symbol: string;
  displayName: string;
  assetClass:
    | 'FOREX'
    | 'METALS'
    | 'INDICES'
    | 'COMMODITIES'
    | 'CRYPTO'
    | 'STOCKS'
    | 'ETFS';
  enabled: boolean;
  tradingViewSymbol: string;
  name: string;
  ticker: string;
  full_name?: string;
  pro_name?: string;
  description: string;
  category: 'FOREX' | 'METALS' | 'INDICES' | 'COMMODITIES' | 'CRYPTO' | 'STOCKS' | 'ETFS';
  marketGroup?: string | null;
  type: string;
  session: string;
  timezone: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_weekly_and_monthly?: boolean;
  exchange?: string;
  listed_exchange?: string;
  supported_resolutions: string[];
  data_status: string;
  quoteSource: string;
  marketStatus: 'LIVE' | 'CLOSED' | 'DELAYED' | 'STALE' | 'DEGRADED' | 'DISABLED';
  healthStatus: 'ok' | 'delayed' | 'stale' | 'degraded' | 'down' | 'closed' | 'disabled';
  tradingAvailable: boolean;
  lotSize: number;
  minLot: number;
  maxLot: number;
  tickSize: number;
  maxLeverage: number;
  marginRetailPct: number;
  marginProPct: number;
  swapLong: number;
  swapShort: number;
  digits: number;
  minTickIncrement: number;
  minTradeSizeLots: number;
  maxTradeSizeLots: number;
  pipValue: string;
  tradingHours: string;
  isActive: boolean;
}

export interface HistoryResponse {
  s: 'ok' | 'no_data';
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
}

export interface MarketDataConfig {
  supports_search: boolean;
  supports_group_request: boolean;
  supports_marks: boolean;
  supports_timescale_marks: boolean;
  supports_time: boolean;
  supported_resolutions: string[];
}
