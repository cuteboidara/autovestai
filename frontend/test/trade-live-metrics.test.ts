import { describe, expect, it } from 'vitest';

import { calculateLivePositionPnl, getLivePositionMark } from '@/lib/trade-live-metrics';

describe('trade-live-metrics', () => {
  it('uses bid marks for long positions and ask marks for short positions', () => {
    expect(
      getLivePositionMark(
        {
          id: '1',
          userId: 'user-1',
          accountId: 'account-1',
          orderId: 'order-1',
          symbol: 'EURUSD',
          side: 'BUY',
          entryPrice: 1.1,
          exitPrice: null,
          volume: 1,
          contractSize: 100_000,
          leverage: 10,
          margin: 1000,
          marginUsed: 1000,
          liquidationPrice: null,
          pnl: 0,
          currentPrice: null,
          status: 'OPEN',
          openedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          symbol: 'EURUSD',
          rawPrice: 1.105,
          lastPrice: 1.105,
          last: 1.105,
          bid: 1.1048,
          ask: 1.1052,
          spread: 0.0004,
          markup: 0,
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        },
      ),
    ).toBe(1.1048);

    expect(
      getLivePositionMark(
        {
          id: '2',
          userId: 'user-1',
          accountId: 'account-1',
          orderId: 'order-2',
          symbol: 'EURUSD',
          side: 'SELL',
          entryPrice: 1.1,
          exitPrice: null,
          volume: 1,
          contractSize: 100_000,
          leverage: 10,
          margin: 1000,
          marginUsed: 1000,
          liquidationPrice: null,
          pnl: 0,
          currentPrice: null,
          status: 'OPEN',
          openedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          symbol: 'EURUSD',
          rawPrice: 1.105,
          lastPrice: 1.105,
          last: 1.105,
          bid: 1.1048,
          ask: 1.1052,
          spread: 0.0004,
          markup: 0,
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        },
      ),
    ).toBe(1.1052);
  });

  it('derives floating pnl from live quote marks', () => {
    expect(
      calculateLivePositionPnl(
        {
          id: '1',
          userId: 'user-1',
          accountId: 'account-1',
          orderId: 'order-1',
          symbol: 'BTCUSD',
          side: 'BUY',
          entryPrice: 62000,
          exitPrice: null,
          volume: 0.5,
          contractSize: 1,
          leverage: 10,
          margin: 3100,
          marginUsed: 3100,
          liquidationPrice: null,
          pnl: 0,
          currentPrice: null,
          status: 'OPEN',
          openedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          symbol: 'BTCUSD',
          rawPrice: 62100,
          lastPrice: 62100,
          last: 62100,
          bid: 62090,
          ask: 62110,
          spread: 20,
          markup: 0,
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        },
      ),
    ).toBe(45);
  });
});
