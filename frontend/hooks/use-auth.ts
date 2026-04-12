'use client';

import { useMemo } from 'react';

import {
  getAuthenticatedHomeRoute,
  getUserKycStatus,
  isKycApproved,
  requiresKycApproval,
} from '@/lib/kyc-access';
import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  const state = useAuthStore();

  return useMemo(
    () => {
      const isSuperAdmin =
        state.user?.role === 'ADMIN' &&
        (state.user.adminRole === 'SUPER_ADMIN' ||
          state.user.adminRoles.some((role) => role.name === 'super_admin'));

      return {
        ...state,
        isAuthenticated: Boolean(state.token && state.user),
        isAdmin: state.user?.role === 'ADMIN',
        kycStatus: getUserKycStatus(state.user),
        isKycApproved: isKycApproved(state.user),
        requiresKycApproval: requiresKycApproval(state.user),
        getAuthenticatedHomeRoute: () => getAuthenticatedHomeRoute(state.user),
        hasPermission: (permission: string) =>
          state.user?.role === 'ADMIN' &&
          (isSuperAdmin || state.user.permissions.includes(permission)),
        hasAnyPermission: (permissions: string[]) =>
          state.user?.role === 'ADMIN' &&
          (isSuperAdmin ||
            permissions.some((permission) => state.user?.permissions.includes(permission))),
      };
    },
    [state],
  );
}
