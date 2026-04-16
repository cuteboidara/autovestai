'use client';

import { MarketQuote } from '@/types/market-data';
import { PositionRecord } from '@/types/trading';

export function getLivePositionMark(
  position: PositionRecord,
  quote?: MarketQuote,
) {
  if (quote) {
    return position.side === 'BUY' ? quote.bid : quote.ask;
  }

  if (position.side === 'BUY' && typeof position.currentBid === 'number') {
    return position.currentBid;
  }

  if (position.side === 'SELL' && typeof position.currentAsk === 'number') {
    return position.currentAsk;
  }

  if (typeof position.currentPrice === 'number' && position.currentPrice > 0) {
    return position.currentPrice;
  }

  return null;
}

export function calculateLivePositionPnl(
  position: PositionRecord,
  quote?: MarketQuote,
) {
  const mark = getLivePositionMark(position, quote);

  if (typeof mark !== 'number') {
    return position.unrealizedPnl ?? position.pnl;
  }

  const contractSize =
    typeof position.contractSize === 'number' && position.contractSize > 0
      ? position.contractSize
      : 1;
  const direction = position.side === 'BUY' ? 1 : -1;

  return Number(
    (
      (mark - position.entryPrice) *
      direction *
      position.volume *
      contractSize
    ).toFixed(8),
  );
}
