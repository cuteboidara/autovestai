import { act, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TradePage from '@/app/(client)/trade/page';
import { useMarketDataStore } from '@/store/market-data-store';
import { useOrdersStore } from '@/store/orders-store';
import { usePositionsStore } from '@/store/positions-store';
import { useWalletStore } from '@/store/wallet-store';

const {
  listSymbolsMock,
  getPriceMock,
  getPricesMock,
  getPlatformStatusMock,
  getWalletMock,
  ordersListMock,
  positionsListMock,
  pathnameState,
  searchParamsState,
  authState,
} = vi.hoisted(() => ({
  listSymbolsMock: vi.fn(),
  getPriceMock: vi.fn(),
  getPricesMock: vi.fn(),
  getPlatformStatusMock: vi.fn(),
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
    getPrices: getPricesMock,
  },
}));

vi.mock('@/services/api/wallet', () => ({
  walletApi: {
    getWallet: getWalletMock,
  },
}));

vi.mock('@/services/api/platform', () => ({
  platformApi: {
    getStatus: getPlatformStatusMock,
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
      connectionStatus: 'connected',
      quotes: {},
      candles: {},
    });
    useWalletStore.setState({ wallet: null, transactions: [] });
    useOrdersStore.setState({ orders: [] });
    usePositionsStore.setState({ positions: [] });

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
      last: 62000,
      bid: 61990,
      ask: 62010,
      spread: 20,
      markup: 10,
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      marketState: 'LIVE',
      marketStatus: 'LIVE',
      healthStatus: 'ok',
      healthReason: 'quote healthy',
      ageMs: 0,
      tradingAvailable: true,
    });
    getPricesMock.mockImplementation(async (symbols: string[]) =>
      symbols.map((symbol) => ({
        symbol,
        rawPrice: 62000,
        lastPrice: 62000,
        last: 62000,
        bid: 61990,
        ask: 62010,
        spread: 20,
        markup: 10,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        marketState: 'LIVE',
        marketStatus: 'LIVE',
        healthStatus: 'ok',
        healthReason: 'quote healthy',
        ageMs: 0,
        tradingAvailable: true,
      })),
    );
    getPlatformStatusMock.mockResolvedValue({
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
          status: 'ok',
          reason: 'quote healthy',
          source: 'binance',
          timestamp: new Date().toISOString(),
          ageMs: 0,
          tradingAvailable: true,
          marketState: 'LIVE',
        },
      },
      timestamp: new Date().toISOString(),
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
    expect(summary).toHaveTextContent('930.00 USDT');
    expect(summary).toHaveTextContent('0.00 USDT');
    expect(screen.getByTestId('order-ticket')).toHaveTextContent('enabled');
  });

  it('keeps the trade route in a single-row terminal layout when activity is hidden by default', async () => {
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
    expect(scrollRegion.className).toContain('lg:grid-rows-[minmax(0,1fr)]');
    expect(scrollRegion.className).not.toContain('lg:grid-rows-[minmax(0,1fr)_auto]');
    expect(scrollRegion.className).not.toContain(
      'pb-[calc(88px+env(safe-area-inset-bottom))]',
    );
    expect(screen.queryByLabelText('Expand activity panel')).not.toBeInTheDocument();
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

    expect(await screen.findByTestId('order-ticket')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-empty-state')).not.toBeInTheDocument();
  });

  it('keeps pending activity content out of the render tree when the orders tab is active', async () => {
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

    expect(await screen.findByTestId('trading-view-panel')).toBeInTheDocument();
    expect(screen.queryByText('Pending Orders')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terminal-empty-state')).not.toBeInTheDocument();
  });

  it('falls back to a quote refresh when the live socket is disconnected', async () => {
    vi.useFakeTimers();
    try {
      useMarketDataStore.setState({ connectionStatus: 'disconnected' });
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
      expect(screen.getByTestId('trade-page-layout')).toBeInTheDocument();

      expect(getPriceMock).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(3_000);
        await Promise.resolve();
      });
      expect(getPriceMock).toHaveBeenCalledWith('BTCUSD');
      expect(getPlatformStatusMock).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
