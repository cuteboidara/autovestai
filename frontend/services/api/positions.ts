import { PositionRecord } from '@/types/trading';

import { apiRequest } from './http';

export type PositionsListStatus = 'OPEN' | 'CLOSED' | 'ALL';

export const positionsApi = {
  list(accountId?: string | null, status: PositionsListStatus = 'OPEN') {
    const params = new URLSearchParams();

    // FIX: The trade terminal needs closed history on the first load, not only via websocket.
    params.set('status', status);

    if (accountId) {
      params.set('accountId', accountId);
    }

    return apiRequest<PositionRecord[]>(
      `/positions?${params.toString()}`,
    );
  },
  close(positionId: string) {
    return apiRequest<unknown>('/positions/close', {
      method: 'POST',
      body: { positionId },
      retry: false,
    });
  },
};
