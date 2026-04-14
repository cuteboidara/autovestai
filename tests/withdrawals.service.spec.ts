import { Prisma, TransactionStatus, TransactionType, WithdrawalStatus } from '@prisma/client';

import { WithdrawalsService } from '../src/modules/wallet/withdrawals.service';

describe('WithdrawalsService', () => {
  function createService(overrides?: {
    prismaService?: Record<string, unknown>;
    accountsService?: Record<string, unknown>;
  }) {
    return new WithdrawalsService(
      (overrides?.prismaService ?? {
        wallet: {
          findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
        },
        transaction: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue(undefined),
        },
        withdrawalRequest: {
          findUnique: jest.fn(),
        },
        $transaction: jest.fn(),
      }) as never,
      (overrides?.accountsService ?? {
        resolveLiveAccountForUser: jest.fn().mockResolvedValue({
          id: 'account-1',
          userId: 'user-1',
        }),
        getAccountMetrics: jest.fn().mockResolvedValue({
          freeMargin: 500,
        }),
        syncLegacyWalletSnapshot: jest.fn().mockResolvedValue(undefined),
      }) as never,
      {
        areWithdrawalsEnabled: jest.fn().mockReturnValue(true),
      } as never,
      {
        log: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        postSystemAlert: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        assertPlatformAccessApproved: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        evaluateWithdrawalRequest: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        invalidateUserResources: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        sendDirectEmailToUser: jest.fn().mockResolvedValue({ success: true }),
      } as never,
      {
        sendWithdrawalRequested: jest.fn().mockResolvedValue(undefined),
        sendWithdrawalApproved: jest.fn().mockResolvedValue(undefined),
        sendWithdrawalRejected: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
  }

  it('does not debit balances when a withdrawal request is submitted', async () => {
    const txAccountUpdate = jest.fn();
    const prismaService = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          account: {
            update: txAccountUpdate,
          },
          withdrawalRequest: {
            create: jest.fn().mockResolvedValue({
              id: 'withdrawal-1',
              userId: 'user-1',
              accountId: 'account-1',
              amount: new Prisma.Decimal(100),
              fee: new Prisma.Decimal(2),
              netAmount: new Prisma.Decimal(98),
              network: 'TRC20',
              toAddress: 'TTEST123',
              status: WithdrawalStatus.PENDING,
              adminNote: null,
              reviewedById: null,
              reviewedAt: null,
              createdAt: new Date('2026-04-12T10:00:00.000Z'),
              updatedAt: new Date('2026-04-12T10:00:00.000Z'),
            }),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({
              id: 'tx-1',
              userId: 'user-1',
              walletId: 'wallet-1',
              accountId: 'account-1',
              type: TransactionType.WITHDRAW,
              amount: new Prisma.Decimal(100),
              asset: 'USDT',
              status: TransactionStatus.PENDING,
              reference: null,
              metadata: {
                withdrawalRequestId: 'withdrawal-1',
              },
              approvedById: null,
              approvedAt: null,
              createdAt: new Date('2026-04-12T10:00:00.000Z'),
              updatedAt: new Date('2026-04-12T10:00:00.000Z'),
            }),
          },
        })),
    };
    const accountsService = {
      resolveLiveAccountForUser: jest.fn().mockResolvedValue({
        id: 'account-1',
        userId: 'user-1',
      }),
      getAccountMetrics: jest.fn().mockResolvedValue({
        freeMargin: 500,
      }),
      syncLegacyWalletSnapshot: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService({
      prismaService,
      accountsService,
    });

    await service.requestWithdrawal('user-1', {
      amount: 100,
      network: 'TRC20',
      toAddress: 'TTEST123',
    });

    expect(txAccountUpdate).not.toHaveBeenCalled();
  });

  it('debits balance and equity only when a withdrawal is approved', async () => {
    const pendingWithdrawal = {
      id: 'withdrawal-1',
      userId: 'user-1',
      accountId: 'account-1',
      amount: new Prisma.Decimal(100),
      fee: new Prisma.Decimal(2),
      netAmount: new Prisma.Decimal(98),
      network: 'TRC20',
      toAddress: 'TTEST123',
      status: WithdrawalStatus.PENDING,
      adminNote: null,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
    };
    const txAccountUpdate = jest.fn().mockResolvedValue(undefined);
    const linkedLedgerUpdate = jest.fn().mockResolvedValue(undefined);
    const prismaService = {
      withdrawalRequest: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(pendingWithdrawal)
          .mockResolvedValueOnce(pendingWithdrawal),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tx-1',
            userId: 'user-1',
            walletId: 'wallet-1',
            accountId: 'account-1',
            type: TransactionType.WITHDRAW,
            amount: new Prisma.Decimal(100),
            asset: 'USDT',
            status: TransactionStatus.PENDING,
            reference: null,
            metadata: {
              withdrawalRequestId: 'withdrawal-1',
            },
            approvedById: null,
            approvedAt: null,
            createdAt: new Date('2026-04-12T10:00:00.000Z'),
            updatedAt: new Date('2026-04-12T10:00:00.000Z'),
          },
        ]),
        update: linkedLedgerUpdate,
      },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          withdrawalRequest: {
            findUnique: jest.fn().mockResolvedValue(pendingWithdrawal),
            update: jest.fn().mockResolvedValue({
              ...pendingWithdrawal,
              status: WithdrawalStatus.APPROVED,
              reviewedById: 'admin-1',
              reviewedAt: new Date('2026-04-12T10:05:00.000Z'),
              updatedAt: new Date('2026-04-12T10:05:00.000Z'),
            }),
          },
          account: {
            findUnique: jest.fn().mockResolvedValue({
              balance: new Prisma.Decimal(150),
              equity: new Prisma.Decimal(150),
            }),
            update: txAccountUpdate,
          },
        })),
    };
    const accountsService = {
      getAccountMetrics: jest.fn().mockResolvedValue({
        freeMargin: 150,
      }),
      syncLegacyWalletSnapshot: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService({
      prismaService,
      accountsService,
    });

    await service.approveWithdrawal('withdrawal-1', 'admin-1', 'approved');

    expect(txAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: {
        balance: {
          decrement: new Prisma.Decimal(100),
        },
        equity: {
          decrement: new Prisma.Decimal(100),
        },
      },
    });
    expect(linkedLedgerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TransactionStatus.APPROVED,
        }),
      }),
    );
  });

  it('does not refund account balances when a pending withdrawal is rejected', async () => {
    const pendingWithdrawal = {
      id: 'withdrawal-1',
      userId: 'user-1',
      accountId: 'account-1',
      amount: new Prisma.Decimal(100),
      fee: new Prisma.Decimal(2),
      netAmount: new Prisma.Decimal(98),
      network: 'TRC20',
      toAddress: 'TTEST123',
      status: WithdrawalStatus.PENDING,
      adminNote: null,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
    };
    const txAccountUpdate = jest.fn().mockResolvedValue(undefined);
    const prismaService = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tx-1',
            userId: 'user-1',
            walletId: 'wallet-1',
            accountId: 'account-1',
            type: TransactionType.WITHDRAW,
            amount: new Prisma.Decimal(100),
            asset: 'USDT',
            status: TransactionStatus.PENDING,
            reference: null,
            metadata: {
              withdrawalRequestId: 'withdrawal-1',
            },
            approvedById: null,
            approvedAt: null,
            createdAt: new Date('2026-04-12T10:00:00.000Z'),
            updatedAt: new Date('2026-04-12T10:00:00.000Z'),
          },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          withdrawalRequest: {
            findUnique: jest.fn().mockResolvedValue(pendingWithdrawal),
            update: jest.fn().mockResolvedValue({
              ...pendingWithdrawal,
              status: WithdrawalStatus.REJECTED,
              reviewedById: 'admin-1',
              reviewedAt: new Date('2026-04-12T10:05:00.000Z'),
              updatedAt: new Date('2026-04-12T10:05:00.000Z'),
            }),
          },
          account: {
            update: txAccountUpdate,
          },
        })),
    };
    const service = createService({
      prismaService,
    });

    await service.rejectWithdrawal('withdrawal-1', 'admin-1', 'rejected');

    expect(txAccountUpdate).not.toHaveBeenCalled();
  });

  it('refunds account balances when an approved withdrawal is rejected', async () => {
    const approvedWithdrawal = {
      id: 'withdrawal-1',
      userId: 'user-1',
      accountId: 'account-1',
      amount: new Prisma.Decimal(100),
      fee: new Prisma.Decimal(2),
      netAmount: new Prisma.Decimal(98),
      network: 'TRC20',
      toAddress: 'TTEST123',
      status: WithdrawalStatus.APPROVED,
      adminNote: null,
      reviewedById: 'admin-1',
      reviewedAt: new Date('2026-04-12T10:05:00.000Z'),
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
      updatedAt: new Date('2026-04-12T10:05:00.000Z'),
    };
    const txAccountUpdate = jest.fn().mockResolvedValue(undefined);
    const prismaService = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tx-1',
            userId: 'user-1',
            walletId: 'wallet-1',
            accountId: 'account-1',
            type: TransactionType.WITHDRAW,
            amount: new Prisma.Decimal(100),
            asset: 'USDT',
            status: TransactionStatus.APPROVED,
            reference: null,
            metadata: {
              withdrawalRequestId: 'withdrawal-1',
            },
            approvedById: 'admin-1',
            approvedAt: new Date('2026-04-12T10:05:00.000Z'),
            createdAt: new Date('2026-04-12T10:00:00.000Z'),
            updatedAt: new Date('2026-04-12T10:05:00.000Z'),
          },
        ]),
        update: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          withdrawalRequest: {
            findUnique: jest.fn().mockResolvedValue(approvedWithdrawal),
            update: jest.fn().mockResolvedValue({
              ...approvedWithdrawal,
              status: WithdrawalStatus.REJECTED,
              reviewedAt: new Date('2026-04-12T10:10:00.000Z'),
              updatedAt: new Date('2026-04-12T10:10:00.000Z'),
            }),
          },
          account: {
            update: txAccountUpdate,
          },
        })),
    };
    const service = createService({
      prismaService,
    });

    await service.rejectWithdrawal('withdrawal-1', 'admin-1', 'rejected');

    expect(txAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: {
        balance: {
          increment: new Prisma.Decimal(100),
        },
        equity: {
          increment: new Prisma.Decimal(100),
        },
      },
    });
  });
});
