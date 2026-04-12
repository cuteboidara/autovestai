import { AuthResponse, LoginRequest, RegisterRequest, UserSession } from '@/types/auth';

import { apiRequest } from './http';

export const authApi = {
  login(payload: LoginRequest) {
    return apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  register(payload: RegisterRequest) {
    return apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  refresh(refreshToken: string) {
    return apiRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      retry: false,
      authMode: 'none',
      skipAuthRefresh: true,
    });
  },
  logout() {
    return apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      retry: false,
    });
  },
  logoutAll() {
    return apiRequest<{ success: boolean }>('/auth/logout-all', {
      method: 'POST',
      retry: false,
    });
  },
  listSessions() {
    return apiRequest<UserSession[]>('/sessions');
  },
  revokeSession(sessionId: string) {
    return apiRequest<UserSession>(`/sessions/${sessionId}`, {
      method: 'DELETE',
      retry: false,
    });
  },
};
