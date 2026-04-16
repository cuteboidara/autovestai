import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLivePriceSubscription, useLiveQuote } from '@/hooks/use-live-prices';
import { useMarketDataStore } from '@/store/market-data-store';

const { connectMock, subscribePriceMock, unsubscribePriceMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  subscribePriceMock: vi.fn(),
  unsubscribePriceMock: vi.fn(),
}));

vi.mock('@/lib/socket-manager', () => ({
  socketManager: {
    connect: connectMock,
    subscribePrice: subscribePriceMock,
    unsubscribePrice: unsubscribePriceMock,
  },
}));

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: { token: string | null }) => unknown) =>
    selector({ token: 'token-1' }),
}));

function SubscriptionProbe({ symbols }: { symbols: string[] }) {
  useLivePriceSubscription(symbols);
  return null;
}

function QuoteProbe({
  symbol,
  label,
  onRender,
}: {
  symbol: string;
  label: string;
  onRender: () => void;
}) {
  onRender();
  const quote = useLiveQuote(symbol);

  return <div data-testid={label}>{quote?.bid ?? '--'}</div>;
}

describe('use-live-prices hooks', () => {
  beforeEach(() => {
    connectMock.mockReset();
    subscribePriceMock.mockReset();
    unsubscribePriceMock.mockReset();
    useMarketDataStore.setState({
      watchlist: ['EURUSD'],
      selectedSymbol: 'EURUSD',
      selectedResolution: '1',
      connectionStatus: 'connected',
      quotes: {},
      candles: {},
    });
  });

  it('diffs symbol subscriptions instead of unsubscribing and resubscribing the full set', () => {
    const { rerender, unmount } = render(
      <SubscriptionProbe symbols={['eurusd', 'btcusd']} />,
    );

    expect(connectMock).toHaveBeenCalledWith('token-1');
    expect(subscribePriceMock.mock.calls).toEqual([['BTCUSD'], ['EURUSD']]);

    subscribePriceMock.mockClear();
    unsubscribePriceMock.mockClear();

    rerender(<SubscriptionProbe symbols={['eurusd', 'xauusd']} />);

    expect(subscribePriceMock.mock.calls).toEqual([['XAUUSD']]);
    expect(unsubscribePriceMock.mock.calls).toEqual([['BTCUSD']]);

    unmount();

    expect(unsubscribePriceMock.mock.calls).toEqual([
      ['BTCUSD'],
      ['EURUSD'],
      ['XAUUSD'],
    ]);
  });

  it('keeps unrelated symbol consumers from rerendering on another symbol tick', () => {
    let eurusdRenders = 0;
    let btcusdRenders = 0;

    render(
      <>
        <QuoteProbe
          symbol="EURUSD"
          label="eurusd"
          onRender={() => {
            eurusdRenders += 1;
          }}
        />
        <QuoteProbe
          symbol="BTCUSD"
          label="btcusd"
          onRender={() => {
            btcusdRenders += 1;
          }}
        />
      </>,
    );

    expect(eurusdRenders).toBe(1);
    expect(btcusdRenders).toBe(1);

    act(() => {
      useMarketDataStore.getState().upsertQuote({
        symbol: 'EURUSD',
        rawPrice: 1.1,
        lastPrice: 1.1,
        last: 1.1,
        bid: 1.09,
        ask: 1.11,
        spread: 0.02,
        markup: 0,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        marketState: 'LIVE',
        marketStatus: 'LIVE',
      });
    });

    expect(screen.getByTestId('eurusd')).toHaveTextContent('1.09');
    expect(eurusdRenders).toBe(2);
    expect(btcusdRenders).toBe(1);

    act(() => {
      useMarketDataStore.getState().upsertQuote({
        symbol: 'BTCUSD',
        rawPrice: 62000,
        lastPrice: 62000,
        last: 62000,
        bid: 61990,
        ask: 62010,
        spread: 20,
        markup: 0,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        marketState: 'LIVE',
        marketStatus: 'LIVE',
      });
    });

    expect(screen.getByTestId('btcusd')).toHaveTextContent('61990');
    expect(eurusdRenders).toBe(2);
    expect(btcusdRenders).toBe(2);
  });
});
