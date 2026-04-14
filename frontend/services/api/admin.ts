import {
  AdminCopyProvider,
  AdminCopyTrade,
  AdminOrderRecord,
  AdminDepositAddressRecord,
  AdminIncomingWalletTransaction,
  AdminOpenPosition,
  AdminOverview,
  AdminWithdrawalRecord,
  CreateManagedAdminResponse,
  FailedQueueJobRecord,
  OperationalMetrics,
  ReadinessChecklistItem,
  AdminUserDetail,
  AdminUserListItem,
  BrokerSettingsResponse,
  HedgeAction,
  ManagedAdminUser,
  SymbolConfigRecord,
  AdminSymbolRecord,
  SurveillanceAlert,
  SurveillanceCase,
  AuditLogRecord,
} from '@/types/admin';
import { AffiliateCommission, AffiliateProfile } from '@/types/affiliates';
import { ReconciliationRun } from '@/types/reconciliation';
import {
  TreasuryBalanceSnapshot,
  TreasuryLiabilitiesBreakdown,
  TreasuryMovement,
  TreasuryReconciliationReport,
  TreasurySummary,
} from '@/types/treasury';
import { WalletTransaction } from '@/types/wallet';

import { apiRequest } from './http';

export const adminApi = {
  getOverview() {
    return apiRequest<AdminOverview>('/admin/overview');
  },
  getMetrics() {
    return apiRequest<OperationalMetrics>('/admin/metrics');
  },
  getReadiness() {
    return apiRequest<ReadinessChecklistItem[]>('/admin/readiness');
  },
  listFailedQueueJobs() {
    return apiRequest<FailedQueueJobRecord[]>('/admin/queues/failed-jobs');
  },
  retryAllFailedQueueJobs() {
    return apiRequest<{
      queue: string;
      totalFailed: number;
      retried: number;
      failedToRetry: Array<{ id: string; reason: string }>;
    }>('/admin/queues/retry-all', {
      method: 'POST',
      retry: false,
    });
  },
  getSettings() {
    return apiRequest<BrokerSettingsResponse>('/admin/settings');
  },
  updateSettings(payload: Record<string, unknown>) {
    return apiRequest<unknown>('/admin/settings', {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  getSymbolConfig() {
    return apiRequest<SymbolConfigRecord[]>('/admin/symbol-config');
  },
  getSymbols() {
    return apiRequest<AdminSymbolRecord[]>('/admin/symbols');
  },
  updateSymbolConfig(symbol: string, payload: Record<string, unknown>) {
    return apiRequest<unknown>(`/admin/symbol-config/${symbol}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  updateSymbol(symbol: string, payload: Record<string, unknown>) {
    return apiRequest<AdminSymbolRecord>(`/admin/symbols/${symbol}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  listUsers(search?: string) {
    return apiRequest<AdminUserListItem[]>(
      `/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    );
  },
  getUserDetail(id: string) {
    return apiRequest<AdminUserDetail>(`/admin/users/${id}`);
  },
  listWalletTransactions(query?: string) {
    return apiRequest<WalletTransaction[]>(`/admin/wallet/transactions${query ? `?${query}` : ''}`);
  },
  listPendingTransactions() {
    return apiRequest<WalletTransaction[]>('/admin/transactions/pending');
  },
  listDepositAddresses() {
    return apiRequest<AdminDepositAddressRecord[]>('/admin/wallet/deposit-addresses');
  },
  listIncomingTransactions() {
    return apiRequest<AdminIncomingWalletTransaction[]>('/admin/wallet/incoming-transactions');
  },
  listWithdrawals(status?: string) {
    return apiRequest<AdminWithdrawalRecord[]>(
      `/admin/withdrawals${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    );
  },
  approveWithdrawal(id: string, reason?: string) {
    return apiRequest<AdminWithdrawalRecord>(`/admin/withdrawals/${id}/approve`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
  rejectWithdrawal(id: string, reason?: string) {
    return apiRequest<AdminWithdrawalRecord>(`/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
  markWithdrawalAsSent(id: string, payload: { txHash: string; adminNote?: string }) {
    return apiRequest<AdminWithdrawalRecord>(`/admin/withdrawals/${id}/mark-sent`, {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  getTreasurySummary() {
    return apiRequest<TreasurySummary>('/admin/treasury/summary');
  },
  listTreasuryBalanceSnapshots(limit?: number) {
    return apiRequest<TreasuryBalanceSnapshot[]>(
      `/admin/treasury/balance-snapshots${limit ? `?limit=${limit}` : ''}`,
    );
  },
  createTreasuryBalanceSnapshot(payload: {
    balance: number;
    observedAt?: string;
    sourceNote?: string;
  }) {
    return apiRequest<TreasuryBalanceSnapshot>('/admin/treasury/balance-snapshots', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  listTreasuryMovements(query?: Record<string, string>) {
    const params = new URLSearchParams(query);
    const queryString = params.toString();

    return apiRequest<TreasuryMovement[]>(
      `/admin/treasury/movements${queryString ? `?${queryString}` : ''}`,
    );
  },
  getTreasuryReconciliation() {
    return apiRequest<TreasuryReconciliationReport>('/admin/treasury/reconciliation');
  },
  getTreasuryLiabilitiesBreakdown() {
    return apiRequest<TreasuryLiabilitiesBreakdown>('/admin/treasury/liabilities-breakdown');
  },
  runReconciliation() {
    return apiRequest<ReconciliationRun>('/admin/reconciliation/run', {
      method: 'POST',
      retry: false,
    });
  },
  getReconciliationLatest() {
    return apiRequest<ReconciliationRun | null>('/admin/reconciliation/latest');
  },
  listReconciliationRuns(query?: Record<string, string>) {
    const params = new URLSearchParams(query);
    const queryString = params.toString();

    return apiRequest<ReconciliationRun[]>(
      `/admin/reconciliation/runs${queryString ? `?${queryString}` : ''}`,
    );
  },
  getReconciliationRun(id: string) {
    return apiRequest<ReconciliationRun>(`/admin/reconciliation/runs/${id}`);
  },
  approveTransaction(id: string, reason?: string) {
    return apiRequest<WalletTransaction>(`/admin/transactions/${id}/approve`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
  rejectTransaction(id: string, reason?: string) {
    return apiRequest<WalletTransaction>(`/admin/transactions/${id}/reject`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
  suspendUser(id: string) {
    return apiRequest<AdminUserDetail>(`/admin/users/${id}/suspend`, {
      method: 'POST',
      retry: false,
    });
  },
  activateUser(id: string) {
    return apiRequest<AdminUserDetail>(`/admin/users/${id}/activate`, {
      method: 'POST',
      retry: false,
    });
  },
  creditUser(id: string, payload: { amount: number; reason?: string; accountId?: string }) {
    return apiRequest<WalletTransaction>(`/admin/users/${id}/credit`, {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  listCopyMasters() {
    return apiRequest<AdminCopyProvider[]>(
      '/admin/copy-trading/masters',
    );
  },
  listCopyTrades(status?: string) {
    return apiRequest<AdminCopyTrade[]>(
      `/admin/copy-trading/trades${status ? `?status=${status}` : ''}`,
    );
  },
  listOpenPositions() {
    return apiRequest<AdminOpenPosition[]>('/admin/positions/open');
  },
  listOrders() {
    return apiRequest<AdminOrderRecord[]>('/admin/orders');
  },
  listAffiliates() {
    return apiRequest<Array<AffiliateProfile & { referralCount: number; user: { email: string } }>>(
      '/admin/affiliates',
    );
  },
  listAffiliateCommissions() {
    return apiRequest<AffiliateCommission[]>('/admin/affiliates/commissions');
  },
  listSurveillanceAlerts(query?: Record<string, string>) {
    const params = new URLSearchParams(query);
    const queryString = params.toString();

    return apiRequest<SurveillanceAlert[]>(
      `/admin/surveillance/alerts${queryString ? `?${queryString}` : ''}`,
    );
  },
  getSurveillanceAlert(id: string) {
    return apiRequest<SurveillanceAlert>(`/admin/surveillance/alerts/${id}`);
  },
  acknowledgeSurveillanceAlert(id: string) {
    return apiRequest<SurveillanceAlert>(`/admin/surveillance/alerts/${id}/acknowledge`, {
      method: 'POST',
      retry: false,
    });
  },
  closeSurveillanceAlert(id: string) {
    return apiRequest<SurveillanceAlert>(`/admin/surveillance/alerts/${id}/close`, {
      method: 'POST',
      retry: false,
    });
  },
  listSurveillanceCases(query?: Record<string, string>) {
    const params = new URLSearchParams(query);
    const queryString = params.toString();

    return apiRequest<SurveillanceCase[]>(
      `/admin/surveillance/cases${queryString ? `?${queryString}` : ''}`,
    );
  },
  createSurveillanceCase(payload: {
    userId?: string;
    alertId?: string;
    assignedToUserId?: string;
    notesJson?: Record<string, unknown>;
  }) {
    return apiRequest<SurveillanceCase>('/admin/surveillance/cases', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  updateSurveillanceCase(
    id: string,
    payload: {
      status?: SurveillanceCase['status'];
      assignedToUserId?: string;
      notesJson?: Record<string, unknown>;
    },
  ) {
    return apiRequest<SurveillanceCase>(`/admin/surveillance/cases/${id}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  getHedgeActions() {
    return apiRequest<HedgeAction[]>('/dealing-desk/hedge-actions');
  },
  listAuditLogs(query?: Record<string, string>) {
    const params = new URLSearchParams(query);
    const queryString = params.toString();

    return apiRequest<AuditLogRecord[]>(
      `/admin/audit${queryString ? `?${queryString}` : ''}`,
    );
  },
  getAuditLog(id: string) {
    return apiRequest<AuditLogRecord>(`/admin/audit/${id}`);
  },
  listAdminAccounts(search?: string) {
    return apiRequest<ManagedAdminUser[]>(
      `/admin/admin-users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    );
  },
  createAdminAccount(payload: {
    firstName: string;
    lastName: string;
    email: string;
    role: ManagedAdminUser['role'];
    temporaryPassword?: string;
  }) {
    return apiRequest<CreateManagedAdminResponse>('/admin/admin-users', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  getAdminAccount(id: string) {
    return apiRequest<ManagedAdminUser>(`/admin/admin-users/${id}`);
  },
  updateAdminAccount(
    id: string,
    payload: {
      role?: ManagedAdminUser['role'];
      isActive?: boolean;
      permissions?: string[];
    },
  ) {
    return apiRequest<ManagedAdminUser>(`/admin/admin-users/${id}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  deactivateAdminAccount(id: string) {
    return apiRequest<ManagedAdminUser>(`/admin/admin-users/${id}`, {
      method: 'DELETE',
      retry: false,
    });
  },
  resetAdminAccountPassword(id: string) {
    return apiRequest<{ success: boolean }>(
      `/admin/admin-users/${id}/reset-password`,
      {
        method: 'POST',
        retry: false,
      },
    );
  },
  changeMyPassword(payload: { currentPassword: string; newPassword: string }) {
    return apiRequest<{ success: boolean }>('/admin/admin-users/me/change-password', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
};
