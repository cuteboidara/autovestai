import { AuthUser } from '@/types/auth';

import { apiRequest } from './http';

export const usersApi = {
  getCurrentUser() {
    return apiRequest<AuthUser>('/users/me');
  },
  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return apiRequest<{ success: boolean }>('/users/me/password', {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
};
