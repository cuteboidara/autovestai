import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountSwitcher } from '@/components/accounts/account-switcher';

const {
  routerPushMock,
  createAccountMock,
  setActiveAccountMock,
  pushNotificationMock,
  setSwitcherOpenMock,
  accountContextState,
} = vi.hoisted(() => {
  const routerPushMock: ReturnType<typeof vi.fn> = vi.fn();
  const createAccountMock: ReturnType<typeof vi.fn> = vi.fn();
  const setActiveAccountMock: ReturnType<typeof vi.fn> = vi.fn();
  const pushNotificationMock: ReturnType<typeof vi.fn> = vi.fn();
  const setSwitcherOpenMock: ReturnType<typeof vi.fn> = vi.fn();
  const accountContextState = {
    accounts: [
      {
        id: 'live-1',
        userId: 'user-1',
        type: 'LIVE' as const,
        name: 'Live Account',
        accountNo: 'FF865311',
        balance: 1500,
        balanceAsset: 'USDT',
        currency: 'USDT',
        usedMargin: 0,
        lockedMargin: 0,
        unrealizedPnl: 0,
        equity: 1500,
        freeMargin: 1500,
        marginLevel: null,
        status: 'ACTIVE' as const,
        isDefault: true,
        openPositions: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'demo-1',
        userId: 'user-1',
        type: 'DEMO' as const,
        name: 'Demo Account',
        accountNo: 'DM001234',
        balance: 10000,
        balanceAsset: 'USDT',
        currency: 'USDT',
        usedMargin: 0,
        lockedMargin: 0,
        unrealizedPnl: 0,
        equity: 10000,
        freeMargin: 10000,
        marginLevel: null,
        status: 'ACTIVE' as const,
        isDefault: false,
        openPositions: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    activeAccount: null as
      | {
          id: string;
          type: 'LIVE' | 'DEMO';
          name: string;
          accountNo: string;
          balance: number;
        }
      | null,
    activeAccountId: 'live-1',
    loading: false,
    switcherOpen: false,
    setSwitcherOpen: vi.fn() as ReturnType<typeof vi.fn>,
    refreshAccounts: vi.fn(),
    setActiveAccount: setActiveAccountMock,
    createAccount: createAccountMock,
    resetDemoAccount: vi.fn(),
    closeAccount: vi.fn(),
  };

  return {
    routerPushMock,
    createAccountMock,
    setActiveAccountMock,
    pushNotificationMock,
    setSwitcherOpenMock,
    accountContextState,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
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
  useAccountContext: () => accountContextState,
}));

vi.mock('@/store/notification-store', () => ({
  useNotificationStore: (
    selector: (state: { push: typeof pushNotificationMock }) => unknown,
  ) => selector({ push: pushNotificationMock }),
}));

describe('AccountSwitcher', () => {
  beforeEach(() => {
    accountContextState.activeAccount = accountContextState.accounts[0];
    accountContextState.activeAccountId = 'live-1';
    accountContextState.switcherOpen = false;
    accountContextState.setSwitcherOpen = setSwitcherOpenMock;
    createAccountMock.mockReset();
    setActiveAccountMock.mockReset();
    pushNotificationMock.mockReset();
    routerPushMock.mockReset();
    setSwitcherOpenMock.mockReset();
    setSwitcherOpenMock.mockImplementation((open: boolean) => {
      accountContextState.switcherOpen = open;
    });
  });

  it('renders the active account and switches to another account from the dropdown', async () => {
    const user = userEvent.setup();
    setActiveAccountMock.mockResolvedValue(accountContextState.accounts[1]);

    const { rerender } = render(<AccountSwitcher homeHref="/accounts" />);

    expect(screen.getByText('AutovestAI')).toBeInTheDocument();
    expect(screen.getByText('LIVE FF865311')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { expanded: false }));
    rerender(<AccountSwitcher homeHref="/accounts" />);

    const demoAccountMenuItem = screen
      .getAllByRole('menuitem')
      .find((item) => item.textContent?.includes('Demo Account'));

    expect(demoAccountMenuItem).toBeDefined();
    await user.click(demoAccountMenuItem!);

    await waitFor(() => {
      expect(setActiveAccountMock).toHaveBeenCalledWith('demo-1');
    });
  });

  it('creates and redirects after opening a new live account from the dropdown', async () => {
    const user = userEvent.setup();
    createAccountMock.mockResolvedValue({
      ...accountContextState.accounts[0],
      id: 'live-2',
      accountNo: 'FF999999',
    });

    const { rerender } = render(<AccountSwitcher homeHref="/accounts" />);

    await user.click(screen.getByRole('button', { expanded: false }));
    rerender(<AccountSwitcher homeHref="/accounts" />);
    await user.click(screen.getByRole('button', { name: 'Open Live Account' }));

    await waitFor(() => {
      expect(createAccountMock).toHaveBeenCalledWith(
        { type: 'LIVE' },
        { activate: true },
      );
    });
    expect(routerPushMock).toHaveBeenCalledWith('/wallet?tab=deposit');
  });
});
