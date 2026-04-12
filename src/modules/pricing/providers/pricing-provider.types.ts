import { PriceSnapshot } from '../../../common/interfaces/price-snapshot.interface';

export interface ProviderPriceUpdate {
  symbol: string;
  rawPrice: number;
  bid?: number;
  ask?: number;
  changePct?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  delayed?: boolean;
  timestamp?: string;
  marketState?: PriceSnapshot['marketState'];
}

export type PricingUpdateHandler = (
  source: string,
  update: ProviderPriceUpdate,
) => Promise<void> | void;

export type PricingProviderTransport = 'streaming' | 'polling';

export type PricingProviderStatusValue =
  | 'connecting'
  | 'connected'
  | 'polling'
  | 'degraded'
  | 'disconnected';

export interface PricingProviderStatus {
  provider: string;
  transport: PricingProviderTransport;
  status: PricingProviderStatusValue;
  symbolCount: number;
  lastUpdateAt: string | null;
  lastError: string | null;
}
