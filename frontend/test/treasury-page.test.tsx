import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminTreasuryPage from '@/app/(admin)/admin/treasury/page';

const {
  hasPermissionMock,
  pushMock,
  getTreasurySummaryMock,
  getTreasuryReconciliationMock,
  listTreasuryMovementsMock,
  listTreasuryBalanceSnapshotsMock,
  getTreasuryLiabilitiesBreakdownMock,
  createTreasuryBalanceSnapshotMock,
} = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
  pushMock: vi.fn(),
  getTreasurySummaryMock: vi.fn(),
  getTreasuryReconciliationMock: vi.fn(),
  listTreasuryMovementsMock: vi.fn(),
  listTreasuryBalanceSnapshotsMock: vi.fn(),
  getTreasuryLiabilitiesBreakdownMock: vi.fn(),
  createTreasuryBalanceSnapshotMock: vi.fn(),
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
    getTreasurySummary: getTreasurySummaryMock,
    getTreasuryReconciliation: getTreasuryReconciliationMock,
    listTreasuryMovements: listTreasuryMovementsMock,
    listTreasuryBalanceSnapshots: listTreasuryBalanceSnapshotsMock,
    getTreasuryLiabilitiesBreakdown: getTreasuryLiabilitiesBreakdownMock,
    createTreasuryBalanceSnapshot: createTreasuryBalanceSnapshotMock,
  },
}));

const baseSummary = {
  walletAddress: 'TTEST_WALLET',
  asset: 'USDT',
  network: 'TRC20',
  explorerBaseUrl: 'https://tronscan.org/#/address/',
  explorerUrl: 'https://tronscan.org/#/address/TTEST_WALLET',
  monitoringMode: 'manual' as const,
  onChainBalance: 125,
  liveBalanceAvailable: false,
  balanceSource: 'manual' as const,
  latestBalanceSnapshot: {
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
  internalClientLiabilities: 100,
  pendingDepositsTotal: 12,
  pendingWithdrawalsTotal: 7,
  approvedButNotSentWithdrawalsTotal: 5,
  grossTreasuryAfterPendingWithdrawals: 118,
  netTreasuryAfterPendingOutflows: 113,
  availableOperatingSurplusDeficit: 20,
  reconciliationDifference: 25,
  lastCheckedAt: '2026-04-05T10:00:00.000Z',
  reconciliationStatus: 'warning' as const,
  warnings: [
    {
      code: 'reconciliation_mismatch',
      severity: 'warning' as const,
      message: 'Treasury reconciliation mismatch exceeds tolerance.',
    },
  ],
};

const baseReconciliation = {
  latestOnChainBalanceSnapshot: baseSummary.latestBalanceSnapshot,
  internalClientLiabilities: 100,
  pendingDepositsTotal: 12,
  pendingWithdrawalsTotal: 7,
  approvedButNotSentWithdrawalsTotal: 5,
  reconciliationDifference: 25,
  status: 'warning' as const,
  warnings: baseSummary.warnings,
  generatedAt: '2026-04-05T10:05:00.000Z',
};

const baseMovements = [
  {
    id: 'move-1',
    type: 'DEPOSIT' as const,
    userId: 'user-1',
    userEmail: 'client@example.com',
    amount: 12,
    asset: 'USDT',
    network: 'USDT-TRC20',
    status: 'PENDING',
    txHash: 'tx-123',
    explorerUrl: null,
    source: 'client_request',
    reference: null,
    approvedAt: null,
    createdAt: '2026-04-05T09:00:00.000Z',
    updatedAt: '2026-04-05T09:00:00.000Z',
  },
];

const baseLiabilitiesBreakdown = {
  totalLiabilities: 100,
  totalActiveUsersWithBalance: 3,
  concentrationPercentageTop5: 72.5,
  topUsers: [
    {
      userId: 'user-1',
      email: 'client@example.com',
      balance: 55,
      concentrationPercentage: 55,
    },
  ],
};

describe('AdminTreasuryPage', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset();
    pushMock.mockReset();
    getTreasurySummaryMock.mockReset();
    getTreasuryReconciliationMock.mockReset();
    listTreasuryMovementsMock.mockReset();
    listTreasuryBalanceSnapshotsMock.mockReset();
    getTreasuryLiabilitiesBreakdownMock.mockReset();
    createTreasuryBalanceSnapshotMock.mockReset();

    hasPermissionMock.mockImplementation(
      (permission: string) =>
        permission === 'treasury.view' || permission === 'treasury.manage',
    );
    getTreasurySummaryMock.mockResolvedValue(baseSummary);
    getTreasuryReconciliationMock.mockResolvedValue(baseReconciliation);
    listTreasuryMovementsMock.mockResolvedValue(baseMovements);
    listTreasuryBalanceSnapshotsMock.mockResolvedValue([baseSummary.latestBalanceSnapshot]);
    getTreasuryLiabilitiesBreakdownMock.mockResolvedValue(baseLiabilitiesBreakdown);
    createTreasuryBalanceSnapshotMock.mockResolvedValue(baseSummary.latestBalanceSnapshot);
  });

  it('renders treasury summary data', async () => {
    render(<AdminTreasuryPage />);

    expect(screen.getByText('Treasury Dashboard')).toBeInTheDocument();
    await screen.findByText('Treasury Wallet');

    expect(getTreasurySummaryMock).toHaveBeenCalled();
    expect(screen.getByText('TTEST_WALLET')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('Liabilities Breakdown')).toBeInTheDocument();
  });

  it('renders warning state details', async () => {
    render(<AdminTreasuryPage />);

    await screen.findByText('Treasury reconciliation mismatch exceeds tolerance.');

    expect(screen.getAllByText('warning').length).toBeGreaterThan(0);
    expect(screen.getByText('No live balance available')).toBeInTheDocument();
  });

  it('submits a manual treasury snapshot', async () => {
    const user = userEvent.setup();

    render(<AdminTreasuryPage />);
    await screen.findByText('Balance Snapshot Form');

    await user.type(screen.getByLabelText('Observed balance'), '123.45');
    await user.type(screen.getByLabelText('Source note'), 'Desk verification');
    await user.click(screen.getByRole('button', { name: 'Record snapshot' }));

    await waitFor(() => {
      expect(createTreasuryBalanceSnapshotMock).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: 123.45,
          sourceNote: 'Desk verification',
        }),
      );
    });
  });
});
