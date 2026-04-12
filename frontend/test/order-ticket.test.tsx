import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderTicket } from '@/components/trade/order-ticket';
import { usePlatformStore } from '@/store/platform-store';
import { SymbolInfo } from '@/types/market-data';

const { placeMock, pushMock } = vi.hoisted(() => ({
  placeMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('@/services/api/orders', () => ({
  ordersApi: {
    place: placeMock,
  },
}));

vi.mock('@/store/notification-store', () => ({
  useNotificationStore: (selector: (state: { push: typeof pushMock }) => unknown) =>
    selector({ push: pushMock }),
}));

describe('OrderTicket', () => {
  const baseProps = {
    selectedSymbol: 'BTCUSD',
    symbols: [
      {
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
        lotSize: 1,
        minLot: 0.01,
        maxLot: 100,
        tickSize: 0.01,
        marginRetailPct: 50,
        marginProPct: 20,
        swapLong: -62877.61,
        swapShort: -62877.61,
        digits: 2,
        minTickIncrement: 0.01,
        minTradeSizeLots: 0.01,
        maxTradeSizeLots: 100,
        pipValue: '0.01 USD per 0.01',
        tradingHours: '22:00-22:00',
        isActive: true,
        supported_resolutions: ['1', '5'],
        data_status: 'streaming',
        quoteSource: 'BINANCE',
        marketStatus: 'LIVE',
        healthStatus: 'ok',
        tradingAvailable: true,
        maxLeverage: 25,
      },
    ] satisfies SymbolInfo[],
    quote: {
      symbol: 'BTCUSD',
      rawPrice: 62000,
      lastPrice: 62000,
      bid: 61990,
      ask: 62010,
      spread: 20,
      markup: 10,
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      marketState: 'LIVE',
      marketStatus: 'LIVE',
      tradingAvailable: true,
    },
    onSymbolChange: vi.fn(),
    onSubmitted: vi.fn().mockResolvedValue(undefined),
  } satisfies React.ComponentProps<typeof OrderTicket>;

  beforeEach(() => {
    placeMock.mockReset();
    pushMock.mockReset();
    usePlatformStore.setState({ status: null });
  });

  it('renders buy and sell states and updates the execution preview', async () => {
    const user = userEvent.setup();
    render(<OrderTicket {...baseProps} />);

    expect(screen.getByText('SELL')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
    expect(screen.getAllByText('62,010').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /sell/i }));

    expect(screen.getAllByText('61,990').length).toBeGreaterThan(0);
  });

  it('submits limit orders with the entered limit price', async () => {
    const user = userEvent.setup();
    placeMock.mockResolvedValue({ success: true });

    render(<OrderTicket {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Limit' }));
    await user.type(screen.getByPlaceholderText('Enter pending price'), '61800');
    await user.click(screen.getByRole('button', { name: 'BUY BTCUSD' }));

    expect(placeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'BTCUSD',
        type: 'LIMIT',
        price: 61800,
      }),
    );
  });

  it('updates required margin when leverage changes', async () => {
    const user = userEvent.setup();
    render(<OrderTicket {...baseProps} />);

    expect(screen.getByText('62.01 USDT')).toBeInTheDocument();

    const leverageInput = screen.getByDisplayValue('10');
    await user.clear(leverageInput);
    await user.type(leverageInput, '5');

    expect(screen.getByText('124.02 USDT')).toBeInTheDocument();
  });

  it('warns on stale quotes without disabling order entry when trading remains available', () => {
    usePlatformStore.setState({
      status: {
        maintenanceModeEnabled: false,
        maintenanceMessage: '',
        features: {
          tradingEnabled: true,
          registrationsEnabled: true,
          withdrawalsEnabled: true,
          copyTradingEnabled: true,
          affiliateProgramEnabled: true,
          affiliatePayoutsEnabled: true,
        },
        symbolHealth: {
          BTCUSD: {
            symbol: 'BTCUSD',
            healthy: true,
            status: 'stale',
            reason: 'quote age 20000ms exceeds warning threshold 15000ms',
            source: 'binance',
            timestamp: new Date().toISOString(),
            ageMs: 20000,
            tradingAvailable: true,
            marketState: 'LIVE',
          },
        },
        timestamp: new Date().toISOString(),
      },
    });

    render(<OrderTicket {...baseProps} />);

    expect(
      screen.getByText(/quote age 20000ms exceeds warning threshold 15000ms/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BUY BTCUSD' })).toBeEnabled();
  });

  it('resets the order size back to the default after a successful submission', async () => {
    const user = userEvent.setup();
    placeMock.mockResolvedValue({ success: true });

    render(<OrderTicket {...baseProps} />);

    const volumeInput = screen.getByDisplayValue('0.01');
    await user.clear(volumeInput);
    await user.type(volumeInput, '0.05');
    await user.click(screen.getByRole('button', { name: 'BUY BTCUSD' }));

    expect(await screen.findByDisplayValue('0.01')).toBeInTheDocument();
  });

  it('blocks trading for symbols that are not enabled for rollout', () => {
    render(
      <OrderTicket
        {...baseProps}
        symbols={[
          {
            ...baseProps.symbols[0],
            enabled: false,
            isActive: false,
            marketStatus: 'DISABLED',
            healthStatus: 'disabled',
            tradingAvailable: false,
          },
        ]}
        quote={{
          ...baseProps.quote,
          marketStatus: 'DISABLED',
          tradingAvailable: false,
        }}
      />,
    );

    expect(screen.getByText(/not live for trading yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BUY BTCUSD' })).toBeDisabled();
  });
});
