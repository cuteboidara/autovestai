import { BadRequestException } from '@nestjs/common';
import { OrderSide, Prisma } from '@prisma/client';

import { RiskService } from '../src/modules/risk/risk.service';

function createQuote(overrides: Partial<{
  rawPrice: number;
  lastPrice: number;
  bid: number;
  ask: number;
  spread: number;
  markup: number;
}> = {}) {
  return {
    symbol: 'BTCUSDT',
    rawPrice: overrides.rawPrice ?? 111,
    lastPrice: overrides.lastPrice ?? overrides.rawPrice ?? 111,
    bid: overrides.bid ?? 110,
    ask: overrides.ask ?? 112,
    spread: overrides.spread ?? 2,
    markup: overrides.markup ?? 1,
    source: 'test',
    marketState: 'LIVE' as const,
    timestamp: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

describe('RiskService', () => {
  let service: RiskService;

  beforeEach(() => {
    service = new RiskService(
      {} as never,
      {} as never,
      {
        getOrThrow: jest.fn().mockReturnValue(20),
      } as never,
      {
        getSymbolConfig: jest.fn().mockReturnValue({
          maxLeverage: 25,
        }),
      } as never,
      {
        getSymbolOrThrow: jest.fn().mockReturnValue({
          symbol: 'BTCUSDT',
          lotSize: new Prisma.Decimal(1),
        }),
      } as never,
    );
  });

  it('calculates required margin with leverage', () => {
    expect(
      service.calculateRequiredMargin({
        volumeLots: 2,
        price: 50_000,
        contractSize: 1,
        leverage: 10,
      }),
    ).toBe(10_000);
  });

  it('changes required margin when leverage changes', () => {
    expect(
      service.calculateRequiredMarginForSymbol({
        symbol: 'BTCUSDT',
        volumeLots: 1,
        price: 1_000,
        leverage: 10,
      }),
    ).toBe(100);

    expect(
      service.calculateRequiredMarginForSymbol({
        symbol: 'BTCUSDT',
        volumeLots: 1,
        price: 1_000,
        leverage: 20,
      }),
    ).toBe(50);
  });

  it('calculates buy and sell pnl from bid/ask quotes', () => {
    expect(
      service.calculatePositionPnlFromValues({
        side: OrderSide.BUY,
        entryPrice: 100,
        volume: 2,
        quote: createQuote({
          rawPrice: 111,
          bid: 110,
          ask: 112,
        }),
      }),
    ).toBe(20);

    expect(
      service.calculatePositionPnlFromValues({
        side: OrderSide.SELL,
        entryPrice: 100,
        volume: 2,
        quote: createQuote({
          rawPrice: 89,
          lastPrice: 89,
          bid: 88,
          ask: 90,
        }),
      }),
    ).toBe(20);
  });

  it('rejects leverage above the symbol limit', () => {
    expect(() => service.assertValidLeverage(26, 'BTCUSDT')).toThrow(
      BadRequestException,
    );
  });
});
