import { Prisma } from '@prisma/client';

import {
  determineTreasuryReconciliationStatus,
  TreasuryService,
} from '../src/modules/treasury/treasury.service';

function createTreasuryService(options?: {
  liabilities?: number;
  pendingDeposits?: number;
  pendingWithdrawals?: number;
  approvedButNotSent?: number;
  onChainBalance?: number | null;
}) {
  const liabilities = options?.liabilities ?? 100;
  const pendingDeposits = options?.pendingDeposits ?? 0;
  const pendingWithdrawals = options?.pendingWithdrawals ?? 0;
  const approvedButNotSent = options?.approvedButNotSent ?? 0;
  const onChainBalance =
    options && 'onChainBalance' in options ? options.onChainBalance : 100;
  const prismaService = {
    wallet: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          balance: new Prisma.Decimal(liabilities),
        },
      }),
    },
    transaction: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({
          _sum: {
            amount: new Prisma.Decimal(pendingDeposits),
          },
        })
        .mockResolvedValueOnce({
          _sum: {
            amount: new Prisma.Decimal(pendingWithdrawals),
          },
        }),
      findMany: jest.fn().mockResolvedValue(
        approvedButNotSent > 0
          ? [
              {
                amount: new Prisma.Decimal(approvedButNotSent),
                reference: null,
                metadata: null,
              },
            ]
          : [],
      ),
    },
  };
  const auditService = {
    log: jest.fn(),
  };
  const config = {
    'treasury.network': 'TRC20',
    'treasury.masterWalletAddress': 'TTEST_WALLET',
    'treasury.explorerBaseUrl': 'https://tronscan.org/#/address/',
    'treasury.monitoringMode': 'manual',
    'treasury.staleSnapshotHours': 24,
    'treasury.pendingWithdrawalWarningThreshold': 10000,
    'treasury.reconciliationTolerance': 0.01,
  };
  const configService = {
    get: jest.fn((key: keyof typeof config) => config[key]),
  };
  const manualTreasuryBalanceProvider = {
    getObservedBalance: jest.fn().mockResolvedValue(
      onChainBalance === null
        ? null
        : {
            id: 'snapshot-1',
            asset: 'USDT',
            network: 'TRC20',
            walletAddress: 'TTEST_WALLET',
            balance: onChainBalance,
            source: 'manual' as const,
            sourceReference: 'manual-check',
            observedAt: new Date('2026-04-05T10:00:00.000Z'),
            createdByUserId: 'admin-1',
            createdAt: new Date('2026-04-05T10:00:00.000Z'),
            createdByUser: {
              id: 'admin-1',
              email: 'owner@example.com',
            },
          },
    ),
  };
  const explorerTreasuryBalanceProvider = {
    getObservedBalance: jest.fn(),
  };
  const service = new TreasuryService(
    prismaService as never,
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
    manualTreasuryBalanceProvider as never,
    explorerTreasuryBalanceProvider as never,
  );

  return {
    service,
    manualTreasuryBalanceProvider,
  };
}

describe('TreasuryService', () => {
  it('calculates the treasury summary totals', async () => {
    const { service } = createTreasuryService({
      liabilities: 100,
      pendingDeposits: 20,
      pendingWithdrawals: 15,
      approvedButNotSent: 5,
      onChainBalance: 150,
    });

    const summary = await service.getSummary();

    expect(summary.internalClientLiabilities).toBe(100);
    expect(summary.pendingDepositsTotal).toBe(20);
    expect(summary.pendingWithdrawalsTotal).toBe(15);
    expect(summary.approvedButNotSentWithdrawalsTotal).toBe(5);
    expect(summary.grossTreasuryAfterPendingWithdrawals).toBe(135);
    expect(summary.netTreasuryAfterPendingOutflows).toBe(130);
    expect(summary.availableOperatingSurplusDeficit).toBe(45);
    expect(summary.reconciliationDifference).toBe(50);
  });

  it('derives reconciliation status from balance and warning state', () => {
    expect(
      determineTreasuryReconciliationStatus({
        onChainBalance: 100,
        internalClientLiabilities: 100,
        reconciliationTolerance: 0.01,
        warnings: [],
      }),
    ).toBe('ok');

    expect(
      determineTreasuryReconciliationStatus({
        onChainBalance: 101,
        internalClientLiabilities: 100,
        reconciliationTolerance: 0.01,
        warnings: [
          {
            code: 'reconciliation_mismatch',
            severity: 'warning',
            message: 'Mismatch',
          },
        ],
      }),
    ).toBe('warning');

    expect(
      determineTreasuryReconciliationStatus({
        onChainBalance: 90,
        internalClientLiabilities: 100,
        reconciliationTolerance: 0.01,
        warnings: [
          {
            code: 'liabilities_exceed_treasury',
            severity: 'error',
            message: 'Liabilities exceed treasury',
          },
        ],
      }),
    ).toBe('error');
  });

  it('returns a no snapshot warning when no treasury balance exists', async () => {
    const { service } = createTreasuryService({
      onChainBalance: null,
    });

    const summary = await service.getSummary();
    const warningCodes = summary.warnings.map((warning) => warning.code);

    expect(warningCodes).toContain('no_balance_snapshot');
    expect(warningCodes).toContain('on_chain_balance_unavailable');
    expect(summary.reconciliationStatus).toBe('error');
  });

  it('warns when liabilities exceed treasury', async () => {
    const { service } = createTreasuryService({
      liabilities: 100,
      onChainBalance: 80,
    });

    const summary = await service.getSummary();

    expect(summary.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'liabilities_exceed_treasury',
          severity: 'error',
        }),
      ]),
    );
    expect(summary.reconciliationStatus).toBe('error');
  });
});
