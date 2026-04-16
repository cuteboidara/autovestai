import { AlertTriangle } from 'lucide-react';

import { TradeTerminalPage } from '@/components/trade/trade-terminal-page';

export default function TradePage() {
  return (
    <div
      data-testid="trade-page-layout"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="border-b border-[var(--terminal-border)] bg-[rgba(7,12,20,0.92)] px-3 py-2 text-[11px] text-[var(--terminal-text-secondary)] lg:px-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <p className="leading-5">
            CFDs are leveraged products. Monitor margin level, stop-loss coverage, and
            liquidation risk before submitting any live order.
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <TradeTerminalPage />
      </div>
    </div>
  );
}
