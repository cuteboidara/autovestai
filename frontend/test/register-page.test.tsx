import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RegisterPage from '@/app/(public)/register/page';

const { replaceMock, registerMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  registerMock: vi.fn(),
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
  useAuthStore: (selector: (state: { register: typeof registerMock }) => unknown) =>
    selector({
      register: registerMock,
    }),
}));

vi.mock('@/store/platform-store', () => ({
  usePlatformStore: (
    selector: (state: { status: { features: { registrationsEnabled: boolean } } | null }) => unknown,
  ) =>
    selector({
      status: {
        features: {
          registrationsEnabled: true,
        },
      },
    }),
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    registerMock.mockReset();
  });

  it('redirects non-approved users to the KYC checkpoint after signup', async () => {
    registerMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        permissions: [],
        adminRoles: [],
        kyc: {
          status: 'NOT_SUBMITTED',
        },
      },
    });
    const user = userEvent.setup();

    render(<RegisterPage />);

    expect(screen.getByTestId('auth-card')).toBeInTheDocument();
    expect(screen.getByTestId('auth-hero-panel')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/kyc');
    });
  });
});
