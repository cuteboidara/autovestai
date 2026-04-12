import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import KycPage from '@/app/kyc/page';

const {
  refreshUserMock,
  logoutMock,
  pushMock,
  getMineMock,
  submitMock,
} = vi.hoisted(() => ({
  refreshUserMock: vi.fn(),
  logoutMock: vi.fn(),
  pushMock: vi.fn(),
  getMineMock: vi.fn(),
  submitMock: vi.fn(),
}));

const authState = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    role: 'USER',
    permissions: [],
    adminRoles: [],
    kyc: {
      status: 'PENDING' as 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED',
      rejectionReason: null as string | null,
    },
  },
  refreshUser: refreshUserMock,
  logout: logoutMock,
};

vi.mock('@/components/layout/protected-route', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/store/auth-store', () => ({
  useAuthStore: (
    selector: (state: typeof authState) => unknown,
  ) => selector(authState),
}));

vi.mock('@/store/notification-store', () => ({
  useNotificationStore: (
    selector: (state: { push: typeof pushMock }) => unknown,
  ) =>
    selector({
      push: pushMock,
    }),
}));

vi.mock('@/services/api/kyc', () => ({
  kycApi: {
    getMine: getMineMock,
    submit: submitMock,
  },
}));

describe('KycPage', () => {
  beforeEach(() => {
    authState.user.kyc.status = 'PENDING';
    authState.user.kyc.rejectionReason = null;
    refreshUserMock.mockReset();
    logoutMock.mockReset();
    pushMock.mockReset();
    getMineMock.mockReset();
    submitMock.mockReset();
  });

  it('renders the pending review state', async () => {
    refreshUserMock.mockResolvedValue(authState.user);
    getMineMock.mockResolvedValue({
      status: 'PENDING',
      createdAt: '2026-04-05T10:00:00.000Z',
    });

    render(<KycPage />);

    expect(await screen.findByText('Review in progress')).toBeInTheDocument();
    expect(
      screen.getByText(/Platform access stays disabled until compliance changes the status to approved/i),
    ).toBeInTheDocument();
  });

  it('allows rejected users to resubmit', async () => {
    authState.user.kyc.status = 'REJECTED';
    authState.user.kyc.rejectionReason = 'Document image was unreadable.';
    refreshUserMock.mockResolvedValue(authState.user);
    getMineMock.mockResolvedValue({
      status: 'REJECTED',
      rejectionReason: 'Document image was unreadable.',
      fullName: 'Jane Doe',
      dateOfBirth: '1990-01-01',
      country: 'TR',
      addressLine1: 'Istiklal Cd 1',
      city: 'Istanbul',
      postalCode: '34000',
      documentType: 'Passport',
      documentNumber: 'P123456',
      documentFrontUrl: 'front',
      documentBackUrl: 'back',
      selfieUrl: 'selfie',
    });
    submitMock.mockResolvedValue({
      status: 'PENDING',
    });
    const user = userEvent.setup();

    render(<KycPage />);
    await screen.findByText('Resubmit your compliance pack');

    await user.click(await screen.findByRole('button', { name: 'Resubmit KYC' }));

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Jane Doe',
          documentNumber: 'P123456',
        }),
      );
    });
  });
});
