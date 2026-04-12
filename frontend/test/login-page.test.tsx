import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from '@/app/(public)/login/page';

const { replaceMock, loginMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p {...props}>{children}</p>
    ),
  },
}));

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (selector: (state: { login: typeof loginMock }) => unknown) =>
    selector({
      login: loginMock,
    }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    loginMock.mockReset();
  });

  it('redirects non-approved users to the KYC checkpoint after login', async () => {
    loginMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        permissions: [],
        adminRoles: [],
        kyc: {
          status: 'PENDING',
        },
      },
    });
    const user = userEvent.setup();

    render(<LoginPage />);

    expect(screen.getByTestId('auth-card')).toBeInTheDocument();
    expect(screen.getByTestId('auth-hero-panel')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/kyc');
    });
  });

  it('redirects approved users to the dashboard after login', async () => {
    loginMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        permissions: [],
        adminRoles: [],
        kyc: {
          status: 'APPROVED',
        },
      },
    });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    });
  });
});
