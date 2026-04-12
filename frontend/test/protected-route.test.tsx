import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ProtectedRoute } from '@/components/layout/protected-route';

const replaceMock = vi.fn();
const authState = {
  hydrated: true,
  user: null as unknown,
  isAuthenticated: false,
  isAdmin: false,
  isKycApproved: false,
  getAuthenticatedHomeRoute: () => '/kyc',
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  usePathname: () => '/admin',
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => authState,
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    authState.hydrated = true;
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isAdmin = false;
    authState.isKycApproved = false;
    authState.getAuthenticatedHomeRoute = () => '/kyc';
  });

  it('redirects unauthenticated users to login', async () => {
    render(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login?next=%2Fadmin');
    });
  });

  it('redirects non-admin users away from admin routes', async () => {
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      kyc: {
        status: 'PENDING',
      },
      permissions: [],
      adminRoles: [],
    };
    authState.isAuthenticated = true;
    authState.getAuthenticatedHomeRoute = () => '/kyc';

    render(
      <ProtectedRoute requireAdmin>
        <div>admin</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/kyc');
    });
  });

  it('redirects non-approved users away from protected client routes', async () => {
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      kyc: {
        status: 'PENDING',
      },
      permissions: [],
      adminRoles: [],
    };
    authState.isAuthenticated = true;

    render(
      <ProtectedRoute>
        <div>client</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/kyc');
    });
  });

  it('redirects approved users away from the KYC checkpoint', async () => {
    authState.user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      kyc: {
        status: 'APPROVED',
      },
      permissions: [],
      adminRoles: [],
    };
    authState.isAuthenticated = true;
    authState.isKycApproved = true;
    authState.getAuthenticatedHomeRoute = () => '/dashboard';

    render(
      <ProtectedRoute allowUnapprovedKyc>
        <div>kyc</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    });
  });
});
