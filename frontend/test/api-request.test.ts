import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequest } from '@/services/api/http';

describe('apiRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes array validation messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: ['Volume must be positive', 'Price is required'] }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    await expect(apiRequest('/orders', { method: 'POST', retry: false })).rejects.toMatchObject({
      message: 'Volume must be positive, Price is required',
      status: 400,
    });
  });

  it('refreshes the access token and retries once on 401', async () => {
    window.localStorage.setItem('autovestai.token', 'expired-access');
    window.localStorage.setItem('autovestai.refreshToken', 'refresh-token');
    window.localStorage.setItem('autovestai.sessionId', 'session-1');

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            sessionId: 'session-2',
            user: {
              id: 'user-1',
              email: 'user@example.com',
              role: 'USER',
              permissions: [],
              adminRoles: [],
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

    const result = await apiRequest<{ ok: boolean }>('/users/me');

    expect(result).toEqual({ ok: true });
    expect(window.localStorage.getItem('autovestai.token')).toBe('new-access');
    expect(window.localStorage.getItem('autovestai.refreshToken')).toBe('new-refresh');
    expect(window.localStorage.getItem('autovestai.sessionId')).toBe('session-2');
  });
});
