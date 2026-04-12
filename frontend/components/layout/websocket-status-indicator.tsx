'use client';

import { useAdminStore } from '@/store/admin-store';

export function WebsocketStatusIndicator() {
  const connected = useAdminStore((state) => state.websocketConnected);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        connected
          ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
          : 'border-red-400/30 bg-red-500/15 text-red-300'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-300'}`}
      />
      {connected ? 'Live' : 'Offline'}
    </div>
  );
}
