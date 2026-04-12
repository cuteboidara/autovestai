'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  clearStoredAuthSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredSessionId,
  saveStoredAuthSession,
} from '@/lib/auth-storage';
import { authApi } from '@/services/api/auth';
import { usersApi } from '@/services/api/users';
import { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@/types/auth';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  loading: boolean;
  bootstrap: () => Promise<void>;
  login: (payload: LoginRequest) => Promise<AuthResponse>;
  register: (payload: RegisterRequest) => Promise<AuthResponse>;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  logoutAllOtherSessions: () => Promise<void>;
  clearSession: () => void;
  setHydrated: (value: boolean) => void;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: getStoredAccessToken(),
      refreshToken: getStoredRefreshToken(),
      sessionId: getStoredSessionId(),
      user: null,
      hydrated: false,
      loading: false,
      async bootstrap() {
        const token = getStoredAccessToken();
        const refreshToken = getStoredRefreshToken();

        if (!token && !refreshToken) {
          set({ hydrated: true, user: null });
          return;
        }

        try {
          const user = await usersApi.getCurrentUser();
          set({
            token: getStoredAccessToken(),
            refreshToken: getStoredRefreshToken(),
            sessionId: getStoredSessionId(),
            user,
            hydrated: true,
          });
        } catch (_error) {
          get().clearSession();
        }
      },
      async login(payload) {
        set({ loading: true });
        try {
          const response = await authApi.login(payload);
          saveStoredAuthSession(response);
          set({
            token: response.accessToken,
            refreshToken: response.refreshToken,
            sessionId: response.sessionId,
            user: response.user,
            loading: false,
            hydrated: true,
          });

          return response;
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },
      async register(payload) {
        set({ loading: true });
        try {
          const response = await authApi.register(payload);
          saveStoredAuthSession(response);
          set({
            token: response.accessToken,
            refreshToken: response.refreshToken,
            sessionId: response.sessionId,
            user: response.user,
            loading: false,
            hydrated: true,
          });

          return response;
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },
      async logout() {
        try {
          if (get().token) {
            await authApi.logout();
          }
        } catch (_error) {
        } finally {
          get().clearSession();
        }
      },
      async logoutAllOtherSessions() {
        await authApi.logoutAll();
      },
      async refreshUser() {
        try {
          const user = await usersApi.getCurrentUser();
          set({ user });
          return user;
        } catch (_error) {
          get().clearSession();
          return null;
        }
      },
      clearSession() {
        clearStoredAuthSession();
        set({
          token: null,
          refreshToken: null,
          sessionId: null,
          user: null,
          hydrated: true,
          loading: false,
        });
      },
      setHydrated(value) {
        set({
          token: getStoredAccessToken(),
          refreshToken: getStoredRefreshToken(),
          sessionId: getStoredSessionId(),
        });
        set({ hydrated: value });
      },
      setUser(user) {
        set({ user });
      },
    }),
    {
      name: 'autovestai-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        sessionId: state.sessionId,
      }),
    },
  ),
);
