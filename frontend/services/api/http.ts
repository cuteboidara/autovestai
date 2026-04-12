import { isAdminScopedApiPath } from '@/lib/admin-route';
import { env } from '@/lib/env';
import {
  clearStoredAuthSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  saveStoredAuthSession,
} from '@/lib/auth-storage';
import { getDeviceFingerprint } from '@/lib/device';
import { AuthResponse } from '@/types/auth';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  retry?: boolean;
  authMode?: 'access' | 'none';
  skipAuthRefresh?: boolean;
  headers?: Record<string, string>;
}

function normalizeErrorMessage(data: unknown, status: number) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data
  ) {
    const message = (data as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }

  if (typeof data === 'string' && data.length > 0) {
    return data;
  }

  return `Request failed with status ${status}`;
}

async function doRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const authMode = options.authMode ?? 'access';
  const accessToken =
    options.token ?? (authMode === 'access' ? getStoredAccessToken() : null);
  const deviceFingerprint = getDeviceFingerprint();
  const isMultipart =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (!isMultipart && options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (deviceFingerprint) {
    headers['x-device-fingerprint'] = deviceFingerprint;
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  if (isAdminScopedApiPath(path)) {
    headers['x-admin-path'] = env.adminPath;
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.body === undefined
        ? undefined
        : isMultipart
          ? (options.body as FormData)
          : JSON.stringify(options.body),
    cache: 'no-store',
  });

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch (_error) {
      data = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(normalizeErrorMessage(data, response.status), response.status, data);
  }

  return data as T;
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await doRequest<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    retry: false,
    authMode: 'none',
    skipAuthRefresh: true,
  });

  saveStoredAuthSession(response);

  return response.accessToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const shouldRetry = options.retry ?? method === 'GET';

  try {
    return await doRequest<T>(path, options);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      !options.skipAuthRefresh &&
      (options.authMode ?? 'access') === 'access'
    ) {
      try {
        const refreshedToken = await refreshAccessToken();

        if (!refreshedToken) {
          clearStoredAuthSession();
          throw error;
        }

        return await doRequest<T>(path, {
          ...options,
          token: refreshedToken,
          skipAuthRefresh: true,
        });
      } catch (refreshError) {
        clearStoredAuthSession();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('autovestai:auth-expired'));
        }
        throw refreshError;
      }
    }

    if (!shouldRetry || !(error instanceof TypeError)) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    return doRequest<T>(path, options);
  }
}
