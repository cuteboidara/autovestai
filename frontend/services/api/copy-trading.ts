import {
  CopyFollower,
  CopyMaster,
  CopyMasterStats,
  CopyRelationRecord,
  CopyTrade,
  ListProvidersParams,
  RegisterSignalProviderPayload,
  SignalProviderProfile,
  SignalProviderSummary,
  StartCopyPayload,
  UpdateCopyRelationPayload,
  UpdateSignalProviderPayload,
} from '@/types/copy-trading';

import { apiRequest } from './http';

function buildProviderQuery(params?: ListProvidersParams) {
  if (!params) {
    return '';
  }

  const search = new URLSearchParams();

  if (params.sortBy) {
    search.set('sortBy', params.sortBy);
  }

  if (params.minReturn !== undefined) {
    search.set('minReturn', String(params.minReturn));
  }

  if (params.maxDrawdown !== undefined) {
    search.set('maxDrawdown', String(params.maxDrawdown));
  }

  const value = search.toString();
  return value ? `?${value}` : '';
}

export const copyTradingApi = {
  listProviders(params?: ListProvidersParams) {
    return apiRequest<SignalProviderSummary[]>(
      `/copy-trading/providers${buildProviderQuery(params)}`,
      { authMode: 'none' },
    );
  },
  getProvider(id: string) {
    return apiRequest<SignalProviderProfile>(`/copy-trading/providers/${id}`, {
      authMode: 'none',
    });
  },
  getMyProvider() {
    return apiRequest<SignalProviderSummary | null>('/copy-trading/providers/me');
  },
  registerProvider(payload: RegisterSignalProviderPayload) {
    return apiRequest<SignalProviderSummary>('/copy-trading/providers/register', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  updateMyProvider(payload: UpdateSignalProviderPayload) {
    return apiRequest<SignalProviderSummary>('/copy-trading/providers/me', {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  startCopy(providerId: string, payload: StartCopyPayload) {
    return apiRequest<CopyRelationRecord>(`/copy-trading/copy/${providerId}`, {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  updateCopy(id: string, payload: UpdateCopyRelationPayload) {
    return apiRequest<CopyRelationRecord>(`/copy-trading/copy/${id}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  stopCopy(id: string) {
    return apiRequest<{ success: boolean }>(`/copy-trading/copy/${id}`, {
      method: 'DELETE',
      retry: false,
    });
  },
  listMyCopies() {
    return apiRequest<CopyRelationRecord[]>('/copy-trading/my-copies');
  },

  // Legacy endpoints retained for older admin/client surfaces.
  applyMaster(payload: {
    displayName: string;
    performanceFeePercent: number;
    minFollowerBalance: number;
  }) {
    return apiRequest<CopyMaster>('/copy-trading/masters/apply', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  getMyMaster() {
    return apiRequest<CopyMaster | null>('/copy-trading/masters/me');
  },
  listMasters() {
    return apiRequest<CopyMaster[]>('/copy-trading/masters');
  },
  approveMaster(id: string, reason?: string) {
    return apiRequest<CopyMaster>(`/copy-trading/masters/${id}/approve`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
  rejectMaster(id: string, reason?: string) {
    return apiRequest<CopyMaster>(`/copy-trading/masters/${id}/reject`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
  suspendMaster(id: string, reason?: string) {
    return apiRequest<CopyMaster>(`/copy-trading/masters/${id}/suspend`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
  follow(payload: Record<string, unknown>) {
    return apiRequest<CopyFollower>('/copy-trading/follow', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  unfollow(followId: string) {
    return apiRequest<{ success: boolean }>('/copy-trading/unfollow', {
      method: 'POST',
      body: { followId },
      retry: false,
    });
  },
  listFollowing() {
    return apiRequest<CopyFollower[]>('/copy-trading/following');
  },
  updateFollow(id: string, payload: Record<string, unknown>) {
    return apiRequest<CopyFollower>(`/copy-trading/follow/${id}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  getMasterStats(id: string) {
    return apiRequest<CopyMasterStats>(`/copy-trading/masters/${id}/stats`);
  },
  getMyTrades() {
    return apiRequest<CopyTrade[]>('/copy-trading/trades/me');
  },
};
