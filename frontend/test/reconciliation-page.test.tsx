import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminReconciliationPage from '@/app/(admin)/admin/reconciliation/page';

const {
  hasPermissionMock,
  pushMock,
  getReconciliationLatestMock,
  listReconciliationRunsMock,
  runReconciliationMock,
} = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
  pushMock: vi.fn(),
  getReconciliationLatestMock: vi.fn(),
  listReconciliationRunsMock: vi.fn(),
  runReconciliationMock: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    hasPermission: hasPermissionMock,
  }),
}));

vi.mock('@/store/notification-store', () => ({
  useNotificationStore: (
    selector: (state: { push: typeof pushMock }) => unknown,
  ) =>
    selector({
      push: pushMock,
    }),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    getReconciliationLatest: getReconciliationLatestMock,
    listReconciliationRuns: listReconciliationRunsMock,
    runReconciliation: runReconciliationMock,
  },
}));

const baseRun = {
  id: 'run-1',
  asset: 'USDT',
  network: 'TRC20',
  treasuryWalletAddress: 'TTEST_WALLET',
  latestTreasuryBalanceSnapshotId: 'snapshot-1',
  latestTreasuryBalanceSnapshot: {
    id: 'snapshot-1',
    asset: 'USDT',
    network: 'TRC20',
    walletAddress: 'TTEST_WALLET',
    balance: 125,
    source: 'manual' as const,
    sourceReference: 'manual-check',
    observedAt: '2026-04-05T10:00:00.000Z',
    createdByUserId: 'admin-1',
    createdAt: '2026-04-05T10:00:00.000Z',
    createdByUser: {
      id: 'admin-1',
      email: 'owner@example.com',
    },
  },
  treasuryBalance: 125,
  internalClientLiabilities: 100,
  pendingDepositsTotal: 12,
  pendingWithdrawalsTotal: 7,
  approvedButNotSentWithdrawalsTotal: 5,
  grossDifference: 25,
  operationalDifference: 20,
  toleranceUsed: 1,
  status: 'WARNING' as const,
  warnings: [
    {
      code: 'TREASURY_BALANCE_SNAPSHOT_STALE',
      severity: 'warning' as const,
      title: 'Treasury balance snapshot is stale',
      detail: 'Latest treasury balance snapshot is older than 12 hours.',
    },
  ],
  warningCount: 1,
  source: 'ON_DEMAND' as const,
  initiatedByUserId: 'admin-1',
  initiatedByUser: {
    id: 'admin-1',
    email: 'owner@example.com',
  },
  formulas: {
    grossDifference: 'treasuryBalance - internalClientLiabilities',
    operationalDifference:
      'treasuryBalance - internalClientLiabilities - approvedButNotSentWithdrawalsTotal',
  },
  createdAt: '2026-04-05T12:00:00.000Z',
};

describe('AdminReconciliationPage', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset();
    pushMock.mockReset();
    getReconciliationLatestMock.mockReset();
    listReconciliationRunsMock.mockReset();
    runReconciliationMock.mockReset();

    hasPermissionMock.mockImplementation(
      (permission: string) =>
        permission === 'treasury.view' || permission === 'treasury.manage',
    );
    getReconciliationLatestMock.mockResolvedValue(baseRun);
    listReconciliationRunsMock.mockResolvedValue([baseRun]);
    runReconciliationMock.mockResolvedValue({
      ...baseRun,
      id: 'run-2',
      status: 'OK',
      warnings: [],
      warningCount: 0,
      createdAt: '2026-04-05T13:00:00.000Z',
    });
  });

  it('renders the latest reconciliation state', async () => {
    render(<AdminReconciliationPage />);

    expect(screen.getByText('Reconciliation Console')).toBeInTheDocument();
    await screen.findByText('Reconciliation History');

    expect(getReconciliationLatestMock).toHaveBeenCalled();
    expect(screen.getByText('TTEST_WALLET')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('Selected Run')).toBeInTheDocument();
  });

  it('renders warning details from the latest run', async () => {
    render(<AdminReconciliationPage />);

    expect(
      (await screen.findAllByText('Treasury balance snapshot is stale')).length,
    ).toBeGreaterThan(0);

    expect(
      screen.getAllByText('Latest treasury balance snapshot is older than 12 hours.')
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('warning').length).toBeGreaterThan(0);
  });

  it('runs reconciliation from the page action', async () => {
    const user = userEvent.setup();

    render(<AdminReconciliationPage />);
    await screen.findByText('Run Reconciliation');

    await user.click(screen.getByRole('button', { name: 'Run reconciliation now' }));

    await waitFor(() => {
      expect(runReconciliationMock).toHaveBeenCalled();
    });
  });
});
