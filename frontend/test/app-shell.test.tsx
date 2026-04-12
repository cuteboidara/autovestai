import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/layout/app-shell';
import type { AppNavGroup } from '@/components/navigation/navigation.types';

const {
  routerPushMock,
  logoutMock,
  getWalletMock,
  setWalletSnapshotMock,
  pathnameState,
  searchParamsState,
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  logoutMock: vi.fn().mockResolvedValue(undefined),
  getWalletMock: vi.fn(),
  setWalletSnapshotMock: vi.fn(),
  pathnameState: {
    value: '/wallet/addresses',
  },
  searchParamsState: {
    value: new URLSearchParams(),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({
    push: routerPushMock,
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

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        email: 'trader@example.com',
        role: 'USER',
      },
      logout: logoutMock,
      token: null,
      sessionId: 'session-12345678',
    }),
}));

vi.mock('@/store/wallet-store', () => ({
  useWalletStore: (selector: (state: unknown) => unknown) =>
    selector({
      wallet: {
        balance: 1250,
      },
      setSnapshot: setWalletSnapshotMock,
    }),
}));

vi.mock('@/services/api/wallet', () => ({
  walletApi: {
    getWallet: getWalletMock,
  },
}));

const navGroups: AppNavGroup[] = [
  {
    label: 'Trading',
    items: [
      { href: '/dashboard', label: 'Dashboard', matchMode: 'exact' },
      { href: '/wallet', label: 'Wallet' },
      { href: '/wallet?tab=deposit', label: 'Deposit' },
    ],
  },
];

describe('AppShell', () => {
  beforeEach(() => {
    routerPushMock.mockReset();
    logoutMock.mockClear();
    getWalletMock.mockReset();
    setWalletSnapshotMock.mockReset();
    pathnameState.value = '/wallet/addresses';
    searchParamsState.value = new URLSearchParams();
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('highlights the correct sidebar section for nested routes', () => {
    render(
      <AppShell title="Client Portal" navGroups={navGroups}>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getByRole('link', { name: 'Wallet' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens and closes the mobile navigation drawer cleanly', async () => {
    render(
      <AppShell title="Client Portal" navGroups={navGroups}>
        <div>content</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    const dialog = screen.getByRole('dialog', { name: 'Primary navigation' });
    expect(dialog).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(dialog).getByRole('link', { name: 'Deposit' })).toHaveAttribute(
      'href',
      '/wallet?tab=deposit',
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Primary navigation' })).not.toBeInTheDocument();
    });
  });
});
