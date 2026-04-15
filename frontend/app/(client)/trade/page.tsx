import { AlertTriangle } from 'lucide-react';

import { TradeTerminalPage } from '@/components/trade/trade-terminal-page';

export default function TradePage() {
  return (
    <div
      data-testid="trade-page-layout"
      className="flex h-full min-h-0 flex-col gap-3"
    >
      <div className="terminal-panel-soft shrink-0 px-4 py-3 text-sm text-amber-100/88">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="leading-6">
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
