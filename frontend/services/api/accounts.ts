import {
  AccountActionResult,
  AccountSummary,
  CreateAccountRequest,
} from '@/types/account';

import { apiRequest } from './http';

export const accountsApi = {
  list() {
    return apiRequest<AccountSummary[]>('/accounts');
  },
  get(accountId: string) {
    return apiRequest<AccountSummary>(`/accounts/${accountId}`);
  },
  create(payload: CreateAccountRequest) {
    return apiRequest<AccountSummary>('/accounts', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  setDefault(accountId: string) {
    return apiRequest<AccountSummary>(`/accounts/${accountId}/set-default`, {
      method: 'PATCH',
      retry: false,
    });
  },
  resetDemo(accountId: string) {
    return apiRequest<AccountSummary>(`/accounts/${accountId}/reset-demo`, {
      method: 'PATCH',
      retry: false,
    });
  },
  close(accountId: string) {
    return apiRequest<AccountActionResult>(`/accounts/${accountId}`, {
      method: 'DELETE',
      retry: false,
    });
  },
};
