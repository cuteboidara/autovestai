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
      status: 'connecting' | 'connected' | 'polling' | 'degraded' | 'disconnected';
      symbolCount: number;
      lastUpdateAt: string | null;
      lastError: string | null;
    }
  >;
  timestamp: string;
}
