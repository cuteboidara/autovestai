import { Prisma, QuoteSource, SymbolCategory } from '@prisma/client';

import { PricingService } from '../src/modules/pricing/pricing.service';

describe('PricingService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-16T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    const broadcastPriceUpdate = jest.fn();
    const enqueueLimitSweep = jest.fn().mockResolvedValue(undefined);
    const redisSet = jest.fn().mockResolvedValue('OK');
    const redisGet = jest.fn().mockResolvedValue(null);
    const instrument = {
      symbol: 'EURUSD',
      description: 'Euro / US Dollar',
      category: SymbolCategory.FOREX,
      isActive: true,
      quoteSource: QuoteSource.FOREX_API,
      defaultSpread: new Prisma.Decimal(0.0002),
      minTickIncrement: new Prisma.Decimal(0.0001),
      quoteSymbol: 'EUR/USD',
    };

    const service = new PricingService(
      {
        getOrThrow: jest.fn((key: string) => {
          switch (key) {
            case 'pricing.binanceWsUrl':
              return 'wss://stream.binance.example/ws';
            case 'pricing.quoteStaleMs':
              return 60_000;
            case 'pricing.reconnectInitialDelayMs':
              return 2_000;
            case 'pricing.reconnectMaxDelayMs':
              return 30_000;
            default:
              throw new Error(`Unexpected config key ${key}`);
          }
        }),
      } as never,
      {
        getClient: jest.fn(() => ({
          set: redisSet,
          get: redisGet,
        })),
      } as never,
      {
        enqueueLimitSweep,
      } as never,
      {
        broadcastPriceUpdate,
      } as never,
      {
        handlePriceUpdate: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getSymbolConfig: jest.fn(() => ({
          spreadMarkup: 0,
          tradingEnabled: true,
        })),
        isTradingEnabled: jest.fn().mockReturnValue(true),
      } as never,
      {
        normalize: jest.fn((symbol: string) => symbol.trim().toUpperCase()),
        hasSymbol: jest.fn().mockReturnValue(true),
        getSymbolOrThrow: jest.fn().mockReturnValue(instrument),
        getTradingViewSymbol: jest.fn().mockReturnValue('AUTOVEST:EURUSD'),
        roundPrice: jest.fn((_symbol: unknown, price: number) => Number(price.toFixed(5))),
        isMarketOpen: jest.fn().mockReturnValue(true),
        listSymbols: jest.fn().mockReturnValue([]),
      } as never,
      {
        stop: jest.fn(),
        getStatus: jest.fn().mockReturnValue({}),
      } as never,
      {
        stop: jest.fn(),
        getStatus: jest.fn().mockReturnValue({}),
      } as never,
      {
        stop: jest.fn(),
        getStatus: jest.fn().mockReturnValue({}),
      } as never,
      {
        stop: jest.fn(),
        getStatus: jest.fn().mockReturnValue({}),
      } as never,
      {
        fetchQuotes: jest.fn(),
      } as never,
      {
        close: jest.fn(),
        getStatus: jest.fn().mockReturnValue({}),
      } as never,
    );

    return {
      service,
      broadcastPriceUpdate,
    };
  }

  it('does not let polling quotes overwrite a fresh streaming quote', async () => {
    const { service, broadcastPriceUpdate } = createService();

    await service['upsertPrice']('EURUSD', 1.1, 'twelve-data', {
      timestamp: '2026-04-16T10:00:00.000Z',
      marketState: 'LIVE',
    });

    broadcastPriceUpdate.mockClear();

    await service['upsertPrice']('EURUSD', 1.09, 'yahoo-finance', {
      timestamp: '2026-04-16T10:00:10.000Z',
      marketState: 'LIVE',
    });

    expect(service['prices'].get('EURUSD')?.source).toBe('twelve-data');
    expect(broadcastPriceUpdate).not.toHaveBeenCalled();
  });

  it('broadcasts stale transitions when a live quote ages past the stale threshold', async () => {
    const { service, broadcastPriceUpdate } = createService();

    await service['upsertPrice']('EURUSD', 1.1, 'twelve-data', {
      timestamp: '2026-04-16T10:00:00.000Z',
      marketState: 'LIVE',
    });

    broadcastPriceUpdate.mockClear();
    jest.setSystemTime(new Date('2026-04-16T10:06:01.000Z'));

    await service['sweepAgedQuotes']();

    expect(broadcastPriceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'EURUSD',
        marketStatus: 'STALE',
        healthStatus: 'stale',
      }),
    );
    expect(service['prices'].get('EURUSD')?.marketState).toBe('STALE');
  });
});
