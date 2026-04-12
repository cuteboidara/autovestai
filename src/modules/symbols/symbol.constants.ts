export const SUPPORTED_RESOLUTION_MAP = {
  '1': 1,
  '1m': 1,
  '5': 5,
  '5m': 5,
  '15': 15,
  '15m': 15,
  '60': 60,
  '1h': 60,
} as const;

export type SupportedResolution = 1 | 5 | 15 | 60;

export const SUPPORTED_RESOLUTIONS = ['1', '5', '15', '60'] as const;

export const TRADINGVIEW_EXCHANGE_NAME = 'AutovestAI';
export const TRADINGVIEW_SYMBOL_PREFIX = 'AUTOVEST';

export const STARTER_SYMBOLS = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'XAUUSD',
  'XAGUSD',
  'BTCUSD',
  'ETHUSD',
  'SP-CASH',
  'NSDQ-CASH',
  'DOW-CASH',
  'APPLE',
  'MICROSOFT',
  'NVIDIA',
  'SPY',
  'QQQ',
] as const;

export const DEFAULT_WATCHLIST_SYMBOLS = [...STARTER_SYMBOLS] as const;

export const BINANCE_STREAM_MAP: Record<string, string> = {
  ADAUSD: 'adausdt',
  BCHUSD: 'bchusdt',
  BNBUSD: 'bnbusdt',
  BTCUSD: 'btcusdt',
  DOGEUSD: 'dogeusdt',
  DOTUSD: 'dotusdt',
  ETHUSD: 'ethusdt',
  LINKUSD: 'linkusdt',
  LTCUSD: 'ltcusdt',
  MANAUSD: 'manausdt',
  SANDUSD: 'sandusdt',
  SOLUSD: 'solusdt',
  SUIUSD: 'suiusdt',
  TRXUSD: 'trxusdt',
  XRPUSD: 'xrpusdt',
};

export const YAHOO_TICKER_OVERRIDES: Record<string, string> = {
  'ASX-CASH': '^AXJO',
  'BRNT-CASH': 'BZ=F',
  'CAC-CASH': '^FCHI',
  'CL-CASH': 'CL=F',
  'COCOA-CASH': 'CC=F',
  'COFFEE-CASH': 'KC=F',
  'COPPER-CASH': 'HG=F',
  'CORN-CASH': 'ZC=F',
  'COTTON-CASH': 'CT=F',
  'DAX-CASH': '^GDAXI',
  'DOW-CASH': '^DJI',
  'DXY-CASH': 'DX-Y.NYB',
  'EUSX-CASH': '^STOXX50E',
  'FTSE-CASH': '^FTSE',
  'IBEX-CASH': '^IBEX',
  'MIB-CASH': 'FTSEMIB.MI',
  'NGAS-CASH': 'NG=F',
  'NK-CASH': '^N225',
  'NSDQ-CASH': '^NDX',
  'RTY-CASH': '^RUT',
  'SBEAN-CASH': 'ZS=F',
  'SMI-CASH': '^SSMI',
  'SP-CASH': '^GSPC',
  'SUGAR-CASH': 'SB=F',
  'WHEAT-CASH': 'ZW=F',
  ADAUSD: 'ADA-USD',
  APPLE: 'AAPL',
  ABBOT: 'ABT',
  ALCOA: 'AA',
  ALIBABA: 'BABA',
  AMAZON: 'AMZN',
  AMEX: 'AXP',
  ASMLUS: 'ASML',
  ATNT: 'T',
  BAIDU: 'BIDU',
  BOA: 'BAC',
  BOEING: 'BA',
  BROADCOM: 'AVGO',
  CHEVRON: 'CVX',
  CITIGROUP: 'C',
  COCACOLA: 'KO',
  DASHUSD: 'DASH-USD',
  DELTA: 'DAL',
  DISNEY: 'DIS',
  ETHUSD: 'ETH-USD',
  EXXONMOBIL: 'XOM',
  FACEBOOK: 'META',
  FORD: 'F',
  FSOLAR: 'FSLR',
  GOLDMNSACHS: 'GS',
  GOOGLE: 'GOOGL',
  JPMORGAN: 'JPM',
  Mastercard: 'MA',
  MCDONALDS: 'MCD',
  MICROSOFT: 'MSFT',
  MORGANSTAN: 'MS',
  MOTOROLA: 'MSI',
  NETFLIX: 'NFLX',
  NIKE: 'NKE',
  NVIDIA: 'NVDA',
  ORACLE: 'ORCL',
  PAYPAL: 'PYPL',
  PEPSICO: 'PEP',
  PFIZER: 'PFE',
  PETRO: 'PBR',
  QUALCOMM: 'QCOM',
  REDDIT: 'RDDT',
  TSLA: 'TSLA',
  TRUMPUSD: 'TRUMP-USD',
  XAGUSD: 'SI=F',
  XAUUSD: 'GC=F',
  XMRUSD: 'XMR-USD',
  XPDUSD: 'PA=F',
  XPTUSD: 'PL=F',
};

export const BOOTSTRAP_PRICE_OVERRIDES: Record<string, number> = {
  BTCUSD: 65000,
  ETHUSD: 3200,
  XAUUSD: 2300,
  XAGUSD: 26,
  'DOW-CASH': 39000,
  'SP-CASH': 5200,
  'NSDQ-CASH': 18000,
  EURUSD: 1.08,
  GBPUSD: 1.27,
  USDJPY: 150,
  APPLE: 190,
  MICROSOFT: 420,
  NVIDIA: 900,
  SPY: 520,
  QQQ: 450,
};

export const DEFAULT_SPREAD_OVERRIDES: Record<string, number> = {
  BTCUSD: 20,
  ETHUSD: 2,
  XAUUSD: 0.5,
  XAGUSD: 0.05,
  'SP-CASH': 0.5,
  'NSDQ-CASH': 1,
  'DOW-CASH': 2,
  APPLE: 0.05,
  MICROSOFT: 0.05,
  NVIDIA: 0.1,
  SPY: 0.05,
  QQQ: 0.05,
};

type SupportedCategory =
  | 'FOREX'
  | 'METALS'
  | 'INDICES'
  | 'COMMODITIES'
  | 'CRYPTO'
  | 'STOCKS'
  | 'ETFS';

export function deriveQuoteSource(symbol: string, category: SupportedCategory) {
  if (category === 'FOREX') {
    return 'FOREX_API' as const;
  }

  if (BINANCE_STREAM_MAP[symbol]) {
    return 'BINANCE' as const;
  }

  if (
    category === 'METALS' ||
    category === 'INDICES' ||
    category === 'COMMODITIES' ||
    category === 'STOCKS' ||
    category === 'ETFS' ||
    category === 'CRYPTO'
  ) {
    return 'YAHOO' as const;
  }

  return 'MANUAL' as const;
}

export function deriveQuoteSymbol(symbol: string, category: SupportedCategory) {
  if (category === 'FOREX') {
    return symbol;
  }

  if (BINANCE_STREAM_MAP[symbol]) {
    return BINANCE_STREAM_MAP[symbol];
  }

  return YAHOO_TICKER_OVERRIDES[symbol] ?? symbol;
}

export function deriveDefaultSpread(params: {
  symbol: string;
  category: SupportedCategory;
  minTickIncrement: number;
}) {
  if (DEFAULT_SPREAD_OVERRIDES[params.symbol] !== undefined) {
    return DEFAULT_SPREAD_OVERRIDES[params.symbol];
  }

  switch (params.category) {
    case 'FOREX':
      return params.minTickIncrement * 20;
    case 'METALS':
      return params.minTickIncrement * 10;
    case 'INDICES':
      return params.minTickIncrement * 5;
    case 'COMMODITIES':
      return params.minTickIncrement * 4;
    case 'CRYPTO':
      return params.minTickIncrement * 20;
    case 'STOCKS':
    case 'ETFS':
      return Math.max(params.minTickIncrement * 2, 0.02);
    default:
      return params.minTickIncrement;
  }
}

export function deriveBootstrapPrice(symbol: string, category: SupportedCategory) {
  if (BOOTSTRAP_PRICE_OVERRIDES[symbol] !== undefined) {
    return BOOTSTRAP_PRICE_OVERRIDES[symbol];
  }

  switch (category) {
    case 'FOREX':
      return 1;
    case 'METALS':
      return 100;
    case 'INDICES':
      return 1000;
    case 'COMMODITIES':
      return 50;
    case 'CRYPTO':
      return 100;
    case 'STOCKS':
    case 'ETFS':
      return 100;
    default:
      return 1;
  }
}

export function deriveTradingViewType(category: SupportedCategory) {
  switch (category) {
    case 'FOREX':
      return 'forex';
    case 'CRYPTO':
      return 'crypto';
    case 'INDICES':
      return 'index';
    case 'STOCKS':
      return 'stock';
    case 'ETFS':
      return 'fund';
    case 'METALS':
    case 'COMMODITIES':
      return 'commodity';
    default:
      return 'cfd';
  }
}

export function buildTradingViewSymbol(symbol: string) {
  return `${TRADINGVIEW_SYMBOL_PREFIX}:${symbol.trim().toUpperCase()}`;
}

export function deriveMaxLeverageFromMarginRetailPct(marginRetailPct: number) {
  return Math.max(1, Math.floor(100 / Math.max(marginRetailPct, 0.01)));
}
