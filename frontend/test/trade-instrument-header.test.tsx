import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { TradeInstrumentHeader } from '@/components/trade/trade-instrument-header';
import { SymbolInfo } from '@/types/market-data';

const symbolInfo: SymbolInfo = {
  symbol: 'BTCUSD',
  displayName: 'Bitcoin',
  assetClass: 'CRYPTO',
  enabled: true,
  tradingViewSymbol: 'AUTOVEST:BTCUSD',
  name: 'Bitcoin',
  ticker: 'BTCUSD',
  description: 'Bitcoin',
  category: 'CRYPTO',
  marketGroup: null,
  type: 'crypto',
  session: '24x7',
  timezone: 'UTC',
  minmov: 1,
  pricescale: 100,
  has_intraday: true,
  supported_resolutions: ['1', '5'],
  data_status: 'streaming',
  quoteSource: 'BINANCE',
  marketStatus: 'LIVE',
  healthStatus: 'ok',
  tradingAvailable: true,
  lotSize: 1,
  minLot: 0.01,
  maxLot: 100,
  tickSize: 0.01,
  maxLeverage: 25,
  marginRetailPct: 50,
  marginProPct: 20,
  swapLong: -1,
  swapShort: -1,
  digits: 2,
  minTickIncrement: 0.01,
  minTradeSizeLots: 0.01,
  maxTradeSizeLots: 100,
  pipValue: '0.01 USD per 0.01',
  tradingHours: '24/7',
  isActive: true,
};

describe('TradeInstrumentHeader', () => {
  it('updates bid, ask, last, and spread from the live quote payload', () => {
    const { rerender } = render(
      <TradeInstrumentHeader
        symbol="BTCUSD"
        symbolInfo={symbolInfo}
        quote={{
          symbol: 'BTCUSD',
          rawPrice: 62000,
          last: 62000,
          lastPrice: 62000,
          bid: 61990,
          ask: 62010,
          spread: 20,
          markup: 10,
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          marketState: 'LIVE',
          marketStatus: 'LIVE',
        }}
        spreadDisplay="20.00"
        marketStatus="LIVE"
        timeframes={[{ label: '1M', value: '1', enabled: true }]}
        selectedTimeframe="1"
        onSelectTimeframe={() => undefined}
      />,
    );

    expect(screen.getAllByText('62,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('61,990').length).toBeGreaterThan(0);
    expect(screen.getAllByText('62,010').length).toBeGreaterThan(0);
    expect(screen.getByText('20.00')).toBeInTheDocument();

    rerender(
      <TradeInstrumentHeader
        symbol="BTCUSD"
        symbolInfo={symbolInfo}
        quote={{
          symbol: 'BTCUSD',
          rawPrice: 62040,
          last: 62040,
          lastPrice: 62040,
          bid: 62030,
          ask: 62050,
          spread: 20,
          markup: 10,
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          marketState: 'LIVE',
          marketStatus: 'LIVE',
        }}
        spreadDisplay="20.00"
        marketStatus="LIVE"
        timeframes={[{ label: '1M', value: '1', enabled: true }]}
        selectedTimeframe="1"
        onSelectTimeframe={() => undefined}
      />,
    );

    expect(screen.getAllByText('62,040').length).toBeGreaterThan(0);
    expect(screen.getAllByText('62,030').length).toBeGreaterThan(0);
    expect(screen.getAllByText('62,050').length).toBeGreaterThan(0);
  });
});
