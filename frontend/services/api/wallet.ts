import {
  DepositAddressResponse,
  WalletDeposit,
  DepositRequest,
  PlatformDepositWallet,
  SupportedDepositNetwork,
  WithdrawalRequestRecord,
  WalletSnapshotResponse,
  WalletTransaction,
  WithdrawRequest,
} from '@/types/wallet';

import { apiRequest } from './http';

export const walletApi = {
  getWallet() {
    return apiRequest<WalletSnapshotResponse>('/wallet');
  },
  getDepositAddress(network: SupportedDepositNetwork) {
    return apiRequest<DepositAddressResponse>(
      `/wallet/address?network=${encodeURIComponent(network)}`,
    );
  },
  getAddress(network: SupportedDepositNetwork) {
    return apiRequest<DepositAddressResponse>(
      `/wallet/address?network=${encodeURIComponent(network)}`,
    );
  },
  generateAddress(network: SupportedDepositNetwork) {
    return apiRequest<DepositAddressResponse>('/wallet/generate-address', {
      method: 'POST',
      body: { network },
      retry: false,
    });
  },
  getAddresses(accountId?: string) {
    return apiRequest<DepositAddressResponse[]>(
      `/wallet/addresses${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`,
    );
  },
  listTransactions(query?: string) {
    return apiRequest<WalletTransaction[]>(`/wallet/transactions${query ? `?${query}` : ''}`);
  },
  listDeposits(query?: string) {
    return apiRequest<WalletDeposit[]>(`/wallet/deposits${query ? `?${query}` : ''}`);
  },
  listWithdrawals(query?: string) {
    return apiRequest<WithdrawalRequestRecord[]>(
      `/wallet/withdrawals${query ? `?${query}` : ''}`,
    );
  },
  requestDeposit(payload: DepositRequest) {
    return apiRequest<WalletTransaction>('/deposit', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  requestWithdrawal(payload: WithdrawRequest) {
    return apiRequest<WalletTransaction>('/withdraw', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  getPlatformDepositWallets(filters?: { network?: string; coin?: string }) {
    const params = new URLSearchParams();

    if (filters?.network) {
      params.set('network', filters.network);
    }

    if (filters?.coin) {
      params.set('coin', filters.coin);
    }

    const queryString = params.toString();

    return apiRequest<PlatformDepositWallet[]>(
      `/wallet/deposit-address${queryString ? `?${queryString}` : ''}`,
    );
  },
};
