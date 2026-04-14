import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TradePage from '@/app/(client)/trade/page';
import { useAdminStore } from '@/store/admin-store';
import { useMarketDataStore } from '@/store/market-data-store';
import { useOrdersStore } from '@/store/orders-store';
import { usePositionsStore } from '@/store/positions-store';
import { useWalletStore } from '@/store/wallet-store';

const {
  listSymbolsMock,
  getPriceMock,
  getWalletMock,
  ordersListMock,
  positionsListMock,
  pathnameState,
  searchParamsState,
  authState,
} = vi.hoisted(() => ({
  listSymbolsMock: vi.fn(),
  getPriceMock: vi.fn(),
  getWalletMock: vi.fn(),
  ordersListMock: vi.fn(),
  positionsListMock: vi.fn(),
  pathnameState: {
    value: '/trade',
  },
  searchParamsState: {
    value: new URLSearchParams('tab=open'),
  },
  authState: {
    user: {
      id: 'user-12345678',
      email: 'trader@example.com',
      role: 'USER',
      permissions: [],
      adminRoles: [],
      kyc: {
        status: 'APPROVED',
      },
    },
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({
    replace: vi.fn(),
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

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({
          children,
          layout: _layout,
          drag: _drag,
          dragConstraints: _dragConstraints,
          initial: _initial,
          animate: _animate,
          exit: _exit,
          transition: _transition,
          whileTap: _whileTap,
          onDragEnd: _onDragEnd,
          ...props
        }: React.HTMLAttributes<HTMLElement> & {
          layout?: unknown;
          drag?: unknown;
          dragConstraints?: unknown;
          initial?: unknown;
          animate?: unknown;
          exit?: unknown;
          transition?: unknown;
          whileTap?: unknown;
          onDragEnd?: unknown;
        }) => React.createElement(tag, props, children),
    },
  ),
}));

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('@/services/api/market-data', () => ({
  marketDataApi: {
    listSymbols: listSymbolsMock,
    getPrice: getPriceMock,
  },
}));

vi.mock('@/services/api/wallet', () => ({
  walletApi: {
    getWallet: getWalletMock,
  },
}));

vi.mock('@/services/api/orders', () => ({
  ordersApi: {
    list: ordersListMock,
  },
}));

vi.mock('@/services/api/positions', () => ({
  positionsApi: {
    list: positionsListMock,
    close: vi.fn(),
  },
}));

vi.mock('@/lib/socket-manager', () => ({
  socketManager: {
    connect: vi.fn(),
    subscribePrice: vi.fn(),
    unsubscribePrice: vi.fn(),
  },
}));

vi.mock('@/components/trade/trading-view-panel', () => ({
  TradingViewPanel: ({ symbol, resolution }: { symbol: string; resolution: string }) => (
    <div data-testid="trading-view-panel">
      {symbol}:{resolution}
    </div>
  ),
}));

vi.mock('@/components/trade/order-ticket', () => ({
  OrderTicket: ({
    selectedSymbol,
    accountDisabledReason,
  }: {
    selectedSymbol: string;
    accountDisabledReason?: string | null;
  }) => (
    <div data-testid="order-ticket">
      {selectedSymbol} {accountDisabledReason ?? 'enabled'}
    </div>
  ),
}));

describe('TradePage', () => {
  beforeEach(() => {
    authState.user.kyc.status = 'APPROVED';
    searchParamsState.value = new URLSearchParams('tab=open');
    useMarketDataStore.setState({
      watchlist: ['BTCUSD'],
      selectedSymbol: 'BTCUSD',
      selectedResolution: '1',
      quotes: {},
      candles: {},
    });
    useWalletStore.setState({ wallet: null, transactions: [] });
    useOrdersStore.setState({ orders: [] });
    usePositionsStore.setState({ positions: [] });
    useAdminStore.setState({ websocketConnected: true });

    listSymbolsMock.mockResolvedValue([
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
      },
    ]);
    getPriceMock.mockResolvedValue({
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
    });
    ordersListMock.mockResolvedValue([]);
    positionsListMock.mockResolvedValue([]);
  });

  it('renders the terminal header and summary strip with live account data', async () => {
    getWalletMock.mockResolvedValue({
      wallet: {
        id: 'wallet-12345678',
        userId: 'user-12345678',
        balance: 1250,
        balanceAsset: 'USDT',
        lockedMargin: 0,
        usedMargin: 320,
        unrealizedPnl: 40,
        equity: 1290,
        freeMargin: 970,
        marginLevel: 403.13,
      },
      transactions: [],
    });

    render(<TradePage />);

    expect(await screen.findByTestId('terminal-header')).toBeInTheDocument();
    expect(screen.getByText('Acct WALLET12')).toBeInTheDocument();

    const summary = await screen.findByTestId('terminal-summary-strip');
    expect(summary).toHaveTextContent('1,250.00 USDT');
    expect(summary).toHaveTextContent('1,290.00 USDT');
    expect(summary).toHaveTextContent('40.00 USDT');
    expect(screen.getByTestId('order-ticket')).toHaveTextContent('enabled');
  });

  it('keeps the trade route in a flex viewport layout and reserves space for the mobile drawer', async () => {
    getWalletMock.mockResolvedValue({
      wallet: {
        id: 'wallet-12345678',
        userId: 'user-12345678',
        balance: 1250,
        balanceAsset: 'USDT',
        lockedMargin: 0,
        usedMargin: 320,
        unrealizedPnl: 40,
        equity: 1290,
        freeMargin: 970,
        marginLevel: 403.13,
      },
      transactions: [],
    });

    render(<TradePage />);

    expect(await screen.findByTestId('trade-page-layout')).toBeInTheDocument();

    const layout = screen.getByTestId('trade-page-layout');
    const scrollRegion = screen.getByTestId('trade-terminal-scroll-region');

    expect(layout.className).toContain('flex');
    expect(layout.className).toContain('h-full');
    expect(layout.className).toContain('min-h-0');
    expect(layout.className).toContain('flex-col');
    expect(scrollRegion.className).toContain(
      'pb-[calc(88px+env(safe-area-inset-bottom))]',
    );
  });

  it('renders the trading disabled banner and empty state for unfunded or unapproved accounts', async () => {
    authState.user.kyc.status = 'PENDING';
    getWalletMock.mockResolvedValue({
      wallet: {
        id: 'wallet-12345678',
        userId: 'user-12345678',
        balance: 0,
        balanceAsset: 'USDT',
        lockedMargin: 0,
        usedMargin: 0,
        unrealizedPnl: 0,
        equity: 0,
        freeMargin: 0,
        marginLevel: null,
      },
      transactions: [],
    });

    render(<TradePage />);

    const banner = await screen.findByTestId('trading-disabled-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getAllByText(/Trading is currently unavailable/i).length).toBeGreaterThan(0);
    expect(within(banner).getByRole('link', { name: 'Deposit' })).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Complete KYC' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByTestId('terminal-empty-state')[0]).toHaveTextContent(
        'No open positions',
      );
    });
  });

  it('renders the pending orders empty state when the orders tab is active', async () => {
    searchParamsState.value = new URLSearchParams('tab=orders');
    getWalletMock.mockResolvedValue({
      wallet: {
        id: 'wallet-12345678',
        userId: 'user-12345678',
        balance: 1250,
        balanceAsset: 'USDT',
        lockedMargin: 0,
        usedMargin: 0,
        unrealizedPnl: 0,
        equity: 1250,
        freeMargin: 1250,
        marginLevel: null,
      },
      transactions: [],
    });

    render(<TradePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('terminal-empty-state')[0]).toHaveTextContent(
        'No pending orders',
      );
    });
  });
});
