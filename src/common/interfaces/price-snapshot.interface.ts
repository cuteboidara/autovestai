export interface PriceSnapshot {
  symbol: string;
  rawPrice: number;
  lastPrice: number;
  bid: number;
  ask: number;
  spread: number;
  markup: number;
  source: string;
  marketState: 'LIVE' | 'STALE' | 'CLOSED' | 'BOOTSTRAP';
  changePct?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  delayed?: boolean;
  timestamp: string;
  lastUpdated: string;
}
