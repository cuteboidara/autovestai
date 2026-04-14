import { TradeTerminalPage } from '@/components/trade/trade-terminal-page';

export default function TradePage() {
  return (
    <div
      data-testid="trade-page-layout"
      className="flex h-full min-h-0 flex-col gap-4"
    >
      <div className="shrink-0 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        CFDs are leveraged products. Monitor margin level, stop-loss coverage,
        and liquidation risk before submitting any live order.
      </div>
      <div className="min-h-0 flex-1">
        <TradeTerminalPage />
      </div>
    </div>
  );
}
