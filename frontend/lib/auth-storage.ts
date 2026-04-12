import { AuthResponse } from '@/types/auth';

const ACCESS_TOKEN_KEY = 'autovestai.token';
const REFRESH_TOKEN_KEY = 'autovestai.refreshToken';
const SESSION_ID_KEY = 'autovestai.sessionId';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function getStoredAccessToken(): string | null {
  return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getStoredRefreshToken(): string | null {
  return getStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function getStoredSessionId(): string | null {
  return getStorage()?.getItem(SESSION_ID_KEY) ?? null;
}

export function saveStoredAuthSession(auth: Pick<AuthResponse, 'accessToken' | 'refreshToken' | 'sessionId'>) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken);
  storage.setItem(SESSION_ID_KEY, auth.sessionId);
}

export function clearStoredAuthSession() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(SESSION_ID_KEY);
}
