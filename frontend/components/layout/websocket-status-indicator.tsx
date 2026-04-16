'use client';

import { useMarketDataStore } from '@/store/market-data-store';

export function WebsocketStatusIndicator() {
  const connectionStatus = useMarketDataStore((state) => state.connectionStatus);
  const connected = connectionStatus === 'connected';
  const reconnecting = connectionStatus === 'reconnecting';
  const stale = connectionStatus === 'stale';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        connected
          ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
          : reconnecting
            ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
            : 'border-red-400/30 bg-red-500/15 text-red-300'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? 'bg-emerald-400' : reconnecting ? 'bg-amber-300' : 'bg-red-300'
        }`}
      />
      {connected ? 'Live' : stale ? 'Stale' : reconnecting ? 'Reconnecting' : 'Offline'}
    </div>
  );
}
