import { Prisma, QuoteSource, SymbolCategory } from '@prisma/client';

import { MarketDataService } from '../src/modules/market-data/market-data.service';

describe('MarketDataService', () => {
  it('returns synthetic bars for enabled symbols when persisted history is empty', async () => {
    const service = new MarketDataService(
      {
        getLatestQuote: jest.fn().mockResolvedValue({
          symbol: 'SP-CASH',
          rawPrice: 5200,
          lastPrice: 5200,
          bid: 5199.75,
          ask: 5200.25,
          spread: 0.5,
          markup: 0,
          source: 'test',
          marketState: 'LIVE',
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }),
        getSymbolHealth: jest.fn().mockReturnValue({
          symbol: 'SP-CASH',
          healthy: true,
          status: 'ok',
          reason: 'quote healthy',
          source: 'test',
          timestamp: new Date().toISOString(),
          ageMs: 0,
          marketState: 'LIVE',
          tradingAvailable: true,
        }),
      } as never,
      {
        getRecentCandles: jest.fn().mockResolvedValue([]),
      } as never,
      {
        getSymbolOrThrow: jest.fn().mockReturnValue({
          symbol: 'SP-CASH',
          description: 'E-mini S&P500 Index',
          category: SymbolCategory.INDICES,
          marketGroup: null,
          lotSize: new Prisma.Decimal(50),
          marginRetailPct: new Prisma.Decimal(5),
          marginProPct: new Prisma.Decimal(2),
          swapLong: new Prisma.Decimal(-1),
          swapShort: new Prisma.Decimal(-1),
          digits: 1,
          minTickIncrement: new Prisma.Decimal(0.1),
          minTradeSizeLots: new Prisma.Decimal(0.01),
          maxTradeSizeLots: new Prisma.Decimal(100),
          pipValue: '5 USD per 0.1',
          tradingHours: '23:01-24:00 00:00-22:00; 23:01-24:00 00:00-21:55',
          isActive: true,
          defaultSpread: new Prisma.Decimal(0.5),
          quoteSource: QuoteSource.YAHOO,
          quoteSymbol: '^GSPC',
        }),
        getTradingViewSymbol: jest.fn().mockReturnValue('AUTOVEST:SP-CASH'),
        getTradingViewType: jest.fn().mockReturnValue('index'),
        getTradingViewSession: jest.fn().mockReturnValue('2301-2200'),
        getMinMovement: jest.fn().mockReturnValue(1),
        getPriceScale: jest.fn().mockReturnValue(10),
        isMarketOpen: jest.fn().mockReturnValue(true),
        roundPrice: jest.fn((_symbol, price: number) => Number(price.toFixed(1))),
        listSymbols: jest.fn().mockReturnValue([]),
      } as never,
      {
        getSymbolConfig: jest.fn().mockReturnValue({
          maxLeverage: 20,
        }),
      } as never,
    );

    const to = Math.floor(Date.now() / 1000);
    const from = to - 60 * 60;
    const response = await service.getHistory({
      symbol: 'SP-CASH',
      resolution: '1',
      from: String(from),
      to: String(to),
    });

    expect(response.s).toBe('ok');
    expect(response.t.length).toBeGreaterThan(0);
    expect(response.o.length).toBe(response.t.length);
    expect(response.h.length).toBe(response.t.length);
    expect(response.l.length).toBe(response.t.length);
    expect(response.c.length).toBe(response.t.length);
  });
});
