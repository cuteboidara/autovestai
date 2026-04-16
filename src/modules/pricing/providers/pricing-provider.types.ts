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
  | 'OK'
  | 'DEGRADED'
  | 'DISCONNECTED'
  | 'DISABLED'
  | 'MISCONFIGURED'
  | 'RATE_LIMITED';

export type PricingProviderReason =
  | 'awaiting_first_update'
  | 'disabled_by_config'
  | 'missing_api_key'
  | 'no_symbols_configured'
  | 'http_429'
  | 'geo_blocked'
  | 'connection_failed'
  | 'stale_quotes'
  | 'auth_failed'
  | 'subscription_rejected'
  | 'upstream_error';

export interface PricingProviderStatus {
  provider: string;
  transport: PricingProviderTransport;
  status: PricingProviderStatusValue;
  reason: PricingProviderReason | null;
  message: string | null;
  symbolCount: number;
  lastUpdateAt: string | null;
  retryAt: string | null;
  recommendedAction: string | null;
  consecutiveFailures: number;
}
