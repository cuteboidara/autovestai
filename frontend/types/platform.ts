export interface PlatformSymbolHealth {
  symbol: string;
  healthy: boolean;
  status: 'ok' | 'delayed' | 'stale' | 'degraded' | 'down' | 'closed' | 'disabled';
  reason: string;
  source: string | null;
  timestamp: string | null;
  ageMs: number | null;
  tradingAvailable: boolean;
  marketState?: string;
}

export interface PlatformStatus {
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string;
  features: {
    tradingEnabled: boolean;
    registrationsEnabled: boolean;
    withdrawalsEnabled: boolean;
    copyTradingEnabled: boolean;
    affiliateProgramEnabled: boolean;
    affiliatePayoutsEnabled: boolean;
  };
  symbolHealth: Record<string, PlatformSymbolHealth>;
  providerHealth?: Record<
    string,
    {
      provider: string;
      transport: 'streaming' | 'polling';
      status: 'OK' | 'DEGRADED' | 'DISCONNECTED' | 'DISABLED' | 'MISCONFIGURED' | 'RATE_LIMITED';
      reason:
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
        | 'upstream_error'
        | null;
      message: string | null;
      symbolCount: number;
      lastUpdateAt: string | null;
      retryAt: string | null;
      recommendedAction: string | null;
      consecutiveFailures: number;
    }
  >;
  timestamp: string;
}
