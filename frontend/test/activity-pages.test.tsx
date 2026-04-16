import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OrdersPage from '@/app/(client)/orders/page';
import PositionsPage from '@/app/(client)/positions/page';
import { useMarketDataStore } from '@/store/market-data-store';
import { useOrdersStore } from '@/store/orders-store';
import { usePositionsStore } from '@/store/positions-store';

const {
  searchParamsState,
  replaceMock,
  pushMock,
  listSymbolsMock,
  getPriceMock,
  getPricesMock,
  ordersListMock,
  positionsListMock,
} = vi.hoisted(() => ({
  searchParamsState: {
    value: new URLSearchParams(),
  },
  replaceMock: vi.fn(),
  pushMock: vi.fn(),
  listSymbolsMock: vi.fn(),
  getPriceMock: vi.fn(),
  getPricesMock: vi.fn(),
  ordersListMock: vi.fn(),
  positionsListMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => searchParamsState.value,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/context/account-context', () => ({
  useAccountContext: () => ({
    accounts: [],
    activeAccount: {
      id: 'wallet-12345678',
      accountNo: 'WALLET12',
      type: 'LIVE',
    },
    activeAccountId: 'wallet-12345678',
    loading: false,
    switcherOpen: false,
    setSwitcherOpen: vi.fn(),
    refreshAccounts: vi.fn(),
    setActiveAccount: vi.fn(),
    createAccount: vi.fn(),
    resetDemoAccount: vi.fn(),
    closeAccount: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-live-prices', () => ({
  useLivePriceSubscription: vi.fn(),
  useLiveQuote: vi.fn(() => undefined),
}));

vi.mock('@/services/api/market-data', () => ({
  marketDataApi: {
    listSymbols: listSymbolsMock,
    getPrice: getPriceMock,
    getPrices: getPricesMock,
  },
}));

vi.mock('@/services/api/orders', () => ({
  ordersApi: {
    list: ordersListMock,
    place: vi.fn(),
  },
}));

vi.mock('@/services/api/positions', () => ({
  positionsApi: {
    list: positionsListMock,
    close: vi.fn(),
  },
}));

vi.mock('@/store/notification-store', () => ({
  useNotificationStore: (selector: (state: { push: typeof pushMock }) => unknown) =>
    selector({ push: pushMock }),
}));

describe('Dedicated activity pages', () => {
  beforeEach(() => {
    searchParamsState.value = new URLSearchParams();
    replaceMock.mockReset();
    pushMock.mockReset();
    listSymbolsMock.mockResolvedValue([
      { symbol: 'BTCUSD', digits: 2, description: 'Bitcoin' },
      { symbol: 'ETHUSD', digits: 2, description: 'Ethereum' },
    ]);
    getPriceMock.mockResolvedValue({
      symbol: 'BTCUSD',
      bid: 62000,
      ask: 62010,
      delayed: false,
      marketStatus: 'LIVE',
      marketState: 'LIVE',
    });
    useOrdersStore.setState({ orders: [] });
    usePositionsStore.setState({ positions: [] });
    useMarketDataStore.setState({
      watchlist: ['BTCUSD'],
      selectedSymbol: 'BTCUSD',
      selectedResolution: '1',
      connectionStatus: 'connected',
      quotes: {},
      candles: {},
    });
    getPricesMock.mockImplementation(async (symbols: string[]) =>
      symbols.map((symbol) => ({
        symbol,
        bid: 62000,
        ask: 62010,
        last: 62005,
        lastPrice: 62005,
        rawPrice: 62005,
        spread: 10,
        markup: 0,
        delayed: false,
        marketStatus: 'LIVE',
        marketState: 'LIVE',
        healthStatus: 'ok',
        healthReason: 'quote healthy',
        ageMs: 0,
        tradingAvailable: true,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      })),
    );
  });

  it('renders the dedicated orders page instead of redirecting through the terminal', async () => {
    ordersListMock.mockResolvedValue([
      {
        id: 'order-pending',
        userId: 'user-1',
        accountId: 'wallet-12345678',
        type: 'LIMIT',
        side: 'BUY',
        symbol: 'ETHUSD',
        volume: 1.25,
        leverage: 10,
        requestedPrice: 3100,
        executionPrice: null,
        sourceType: 'MANUAL',
        status: 'PENDING',
        createdAt: '2026-04-16T09:00:00.000Z',
        updatedAt: '2026-04-16T09:01:00.000Z',
      },
      {
        id: 'order-history',
        userId: 'user-1',
        accountId: 'wallet-12345678',
        type: 'MARKET',
        side: 'SELL',
        symbol: 'BTCUSD',
        volume: 0.5,
        leverage: 5,
        requestedPrice: null,
        executionPrice: 62005,
        sourceType: 'MANUAL',
        status: 'EXECUTED',
        createdAt: '2026-04-16T08:00:00.000Z',
        updatedAt: '2026-04-16T08:01:00.000Z',
      },
    ]);
    positionsListMock.mockResolvedValue([]);

    render(<OrdersPage />);

    expect(await screen.findByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect((await screen.findAllByText('ETHUSD')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Open Terminal/i })).toHaveAttribute('href', '/trade');
    expect(ordersListMock).toHaveBeenCalledWith('accountId=wallet-12345678');
  });

  it('renders the dedicated closed positions page with its own tab state', async () => {
    searchParamsState.value = new URLSearchParams('tab=closed');
    ordersListMock.mockResolvedValue([]);
    positionsListMock.mockResolvedValue([
      {
        id: 'position-closed',
        userId: 'user-1',
        accountId: 'wallet-12345678',
        orderId: 'order-1',
        symbol: 'BTCUSD',
        side: 'BUY',
        entryPrice: 61000,
        exitPrice: 62000,
        volume: 0.5,
        leverage: 10,
        margin: 1000,
        marginUsed: 1000,
        liquidationPrice: null,
        pnl: 500,
        currentPrice: null,
        status: 'CLOSED',
        openedAt: '2026-04-16T07:00:00.000Z',
        closedAt: '2026-04-16T08:00:00.000Z',
        createdAt: '2026-04-16T07:00:00.000Z',
        updatedAt: '2026-04-16T08:00:00.000Z',
      },
    ]);

    render(<PositionsPage />);

    expect(await screen.findByRole('heading', { name: 'Positions' })).toBeInTheDocument();
    expect((await screen.findAllByText('BTCUSD')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Closed Positions').length).toBeGreaterThan(0);
    expect(positionsListMock).toHaveBeenCalledWith('wallet-12345678', 'ALL');
  });
});
