import { Prisma, ReconciliationStatus, TreasuryBalanceSource } from '@prisma/client';

import { AuthenticatedUser } from '../src/common/interfaces/authenticated-user.interface';
import {
  ReconciliationService,
} from '../src/modules/reconciliation/reconciliation.service';
import { TreasurySummaryDto } from '../src/modules/treasury/dto/treasury-response.dto';

function createSummary(overrides?: Partial<TreasurySummaryDto>): TreasurySummaryDto {
  const now = new Date();

  return {
    walletAddress: 'TTEST_WALLET',
    asset: 'USDT',
    network: 'TRC20',
    explorerBaseUrl: 'https://tronscan.org/#/address/',
    explorerUrl: 'https://tronscan.org/#/address/TTEST_WALLET',
    monitoringMode: 'manual',
    onChainBalance: 100,
    liveBalanceAvailable: false,
    balanceSource: 'manual',
    latestBalanceSnapshot: {
      id: 'snapshot-1',
      asset: 'USDT',
      network: 'TRC20',
      walletAddress: 'TTEST_WALLET',
      balance: 100,
      source: 'manual',
      sourceReference: 'manual-check',
      observedAt: now,
      createdByUserId: 'admin-1',
      createdAt: now,
      createdByUser: {
        id: 'admin-1',
        email: 'owner@example.com',
      },
    },
    internalClientLiabilities: 100,
    pendingDepositsTotal: 0,
    pendingWithdrawalsTotal: 0,
    approvedButNotSentWithdrawalsTotal: 0,
    grossTreasuryAfterPendingWithdrawals: 100,
    netTreasuryAfterPendingOutflows: 100,
    availableOperatingSurplusDeficit: 0,
    reconciliationDifference: 0,
    lastCheckedAt: now,
    reconciliationStatus: 'ok',
    warnings: [],
    ...overrides,
  };
}

function createService(summaryOverrides?: Partial<TreasurySummaryDto>) {
  const summary = createSummary(summaryOverrides);
  const reconciliationRunCreateMock = jest.fn().mockImplementation(({ data }) =>
    Promise.resolve({
      id: 'run-1',
      asset: data.asset,
      network: data.network,
      treasuryWalletAddress: data.treasuryWalletAddress ?? null,
      latestTreasuryBalanceSnapshotId: data.latestTreasuryBalanceSnapshotId ?? null,
      treasuryBalance: data.treasuryBalance,
      internalClientLiabilities: data.internalClientLiabilities,
      pendingDepositsTotal: data.pendingDepositsTotal,
      pendingWithdrawalsTotal: data.pendingWithdrawalsTotal,
      approvedButNotSentWithdrawalsTotal: data.approvedButNotSentWithdrawalsTotal,
      grossDifference: data.grossDifference,
      operationalDifference: data.operationalDifference,
      toleranceUsed: data.toleranceUsed,
      status: data.status,
      warningsJson: data.warningsJson,
      source: data.source,
      initiatedByUserId: data.initiatedByUserId ?? null,
      createdAt: new Date('2026-04-05T12:00:00.000Z'),
      latestTreasuryBalanceSnapshot: summary.latestBalanceSnapshot
        ? {
            id: summary.latestBalanceSnapshot.id,
            asset: summary.latestBalanceSnapshot.asset,
            network: summary.latestBalanceSnapshot.network,
            walletAddress: summary.latestBalanceSnapshot.walletAddress,
            balance: new Prisma.Decimal(summary.latestBalanceSnapshot.balance),
            source:
              summary.latestBalanceSnapshot.source === 'manual'
                ? TreasuryBalanceSource.MANUAL
                : TreasuryBalanceSource.API,
            sourceReference: summary.latestBalanceSnapshot.sourceReference,
            observedAt: summary.latestBalanceSnapshot.observedAt,
            createdByUserId: summary.latestBalanceSnapshot.createdByUserId,
            createdAt: summary.latestBalanceSnapshot.createdAt,
            createdByUser: summary.latestBalanceSnapshot.createdByUser,
          }
        : null,
      initiatedByUser: data.initiatedByUserId
        ? {
            id: data.initiatedByUserId,
            email: 'owner@example.com',
          }
        : null,
    }),
  );
  const prismaService = {
    reconciliationRun: {
      create: reconciliationRunCreateMock,
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const treasuryService = {
    getSummary: jest.fn().mockResolvedValue(summary),
  };
  const auditService = {
    log: jest.fn(),
  };
  const config = {
    'treasury.asset': 'USDT',
    'treasury.network': 'TRC20',
    'treasury.masterWalletAddress': 'TTEST_WALLET',
    'reconciliation.tolerance': 1,
    'reconciliation.staleSnapshotHours': 12,
    'reconciliation.highPendingWithdrawalsThreshold': 1000,
    'reconciliation.approvedOutflowThreshold': 1000,
    'reconciliation.enableScheduledRuns': false,
    'reconciliation.scheduleIntervalHours': 12,
  };
  const configService = {
    get: jest.fn((key: keyof typeof config) => config[key]),
  };
  const service = new ReconciliationService(
    prismaService as never,
    treasuryService as never,
    auditService as never,
    configService as never,
    {
      getTreasuryWalletSettings: jest.fn().mockReturnValue({
        network: 'TRC20',
        masterWalletTrc20: 'TTEST_WALLET',
        masterWalletErc20: null,
        masterWalletAddress: 'TTEST_WALLET',
      }),
    } as never,
  );
  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'owner@example.com',
    role: 'ADMIN',
    permissions: ['treasury.view', 'treasury.manage'],
    adminRoles: [{ id: 'role-1', name: 'super_admin' }],
  };

  return {
    service,
    prismaService,
    treasuryService,
    auditService,
    reconciliationRunCreateMock,
    admin,
  };
}

describe('ReconciliationService', () => {
  it('returns OK when treasury is within tolerance', async () => {
    const { service } = createService();

    const run = await service.runReconciliation();

    expect(run.status).toBe(ReconciliationStatus.OK);
    expect(run.grossDifference).toBe(0);
    expect(run.operationalDifference).toBe(0);
    expect(run.warnings).toEqual([]);
  });

  it('returns WARNING when the treasury snapshot is stale', async () => {
    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const { service } = createService({
      latestBalanceSnapshot: {
        id: 'snapshot-1',
        asset: 'USDT',
        network: 'TRC20',
        walletAddress: 'TTEST_WALLET',
        balance: 100,
        source: 'manual',
        sourceReference: 'manual-check',
        observedAt: staleDate,
        createdByUserId: 'admin-1',
        createdAt: staleDate,
        createdByUser: {
          id: 'admin-1',
          email: 'owner@example.com',
        },
      },
    });

    const run = await service.runReconciliation();

    expect(run.status).toBe(ReconciliationStatus.WARNING);
    expect(run.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'TREASURY_BALANCE_SNAPSHOT_STALE',
          severity: 'warning',
        }),
      ]),
    );
  });

  it('returns ERROR when liabilities exceed treasury', async () => {
    const { service } = createService({
      onChainBalance: 80,
      internalClientLiabilities: 100,
      reconciliationDifference: -20,
      grossTreasuryAfterPendingWithdrawals: 80,
      netTreasuryAfterPendingOutflows: 80,
      availableOperatingSurplusDeficit: -20,
    });

    const run = await service.runReconciliation();

    expect(run.status).toBe(ReconciliationStatus.ERROR);
    expect(run.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'LIABILITIES_EXCEED_TREASURY',
          severity: 'critical',
        }),
      ]),
    );
  });

  it('uses approved-but-not-sent withdrawals in operational difference', async () => {
    const { service } = createService({
      onChainBalance: 100,
      internalClientLiabilities: 90,
      approvedButNotSentWithdrawalsTotal: 15,
      reconciliationDifference: 10,
      availableOperatingSurplusDeficit: -5,
      netTreasuryAfterPendingOutflows: 85,
    });

    const run = await service.runReconciliation();

    expect(run.grossDifference).toBe(10);
    expect(run.operationalDifference).toBe(-5);
    expect(run.status).toBe(ReconciliationStatus.ERROR);
    expect(run.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'APPROVED_WITHDRAWALS_NOT_SENT_HIGH',
          severity: 'critical',
        }),
      ]),
    );
  });

  it('persists and audits on-demand reconciliation runs', async () => {
    const { service, reconciliationRunCreateMock, auditService, admin } = createService({
      onChainBalance: 150,
      internalClientLiabilities: 100,
      reconciliationDifference: 50,
      availableOperatingSurplusDeficit: 50,
      grossTreasuryAfterPendingWithdrawals: 150,
      netTreasuryAfterPendingOutflows: 150,
    });

    const run = await service.runReconciliation({
      initiatedBy: admin,
    });

    expect(reconciliationRunCreateMock).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: admin.id,
        action: 'RECONCILIATION_RUN_CREATED',
        entityType: 'reconciliation_run',
        entityId: run.id,
      }),
    );
  });
});
