import { TradeTerminalPage } from '@/components/trade/trade-terminal-page';

export default function TradePage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        CFDs are leveraged products. Monitor margin level, stop-loss coverage,
        and liquidation risk before submitting any live order.
      </div>
      <TradeTerminalPage />
    </div>
  );
}
