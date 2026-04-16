import { TradingEventsService } from '../src/modules/trading/trading-events.service';

describe('TradingEventsService', () => {
  it('emits price updates to the symbol room instead of globally broadcasting', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const service = new TradingEventsService({
      server: { to },
      buildPriceRoom: jest.fn().mockReturnValue('price:EURUSD'),
      getRoomClientCount: jest.fn().mockReturnValue(2),
    } as never);

    service.broadcastPriceUpdate({
      symbol: 'EURUSD',
      displayName: 'Euro / US Dollar',
      assetClass: 'FOREX',
      enabled: true,
      tradingViewSymbol: 'AUTOVEST:EURUSD',
      quoteSource: 'FOREX_API',
      rawPrice: 1.0825,
      last: 1.0825,
      lastPrice: 1.0825,
      bid: 1.0824,
      ask: 1.0826,
      spread: 0.0002,
      markup: 0,
      changePct: null,
      dayHigh: null,
      dayLow: null,
      delayed: false,
      source: 'twelve-data',
      marketState: 'LIVE',
      marketStatus: 'LIVE',
      healthStatus: 'ok',
      healthReason: 'quote healthy',
      ageMs: 0,
      tradingAvailable: true,
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });

    expect(to).toHaveBeenCalledWith('price:EURUSD');
    expect(emit).toHaveBeenCalledWith(
      'price_update',
      expect.objectContaining({ symbol: 'EURUSD', bid: 1.0824, ask: 1.0826 }),
    );
  });
});
