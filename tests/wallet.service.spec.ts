import { BadRequestException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';

import { KYC_APPROVAL_REQUIRED_MESSAGE } from '../src/modules/kyc/kyc.constants';
import { WalletService } from '../src/modules/wallet/wallet.service';

describe('WalletService', () => {
  function createService(options?: {
    approved?: boolean;
    prisma?: Record<string, unknown>;
    accounts?: Record<string, unknown>;
    brokerSettingsService?: Record<string, unknown>;
    auditService?: Record<string, unknown>;
    adminChatService?: Record<string, unknown>;
    kycService?: Record<string, unknown>;
    surveillanceService?: Record<string, unknown>;
    withdrawalsService?: Record<string, unknown>;
    responseCacheService?: Record<string, unknown>;
    emailService?: Record<string, unknown>;
  }) {
    return new WalletService(
      (options?.prisma ?? {}) as never,
      (options?.accounts ??
        {
          syncLegacyWalletSnapshot: jest.fn().mockResolvedValue(undefined),
        }) as never,
      {} as never,
      {} as never,
      (options?.brokerSettingsService ??
        {
          areWithdrawalsEnabled: jest.fn().mockReturnValue(true),
        }) as never,
      (options?.auditService ??
        {
          log: jest.fn().mockResolvedValue(undefined),
        }) as never,
      (options?.adminChatService ??
        {
          postSystemAlert: jest.fn().mockResolvedValue(undefined),
        }) as never,
      (options?.kycService ??
        {
          assertPlatformAccessApproved: options?.approved
            ? jest.fn().mockResolvedValue(undefined)
            : jest
                .fn()
                .mockRejectedValue(new BadRequestException(KYC_APPROVAL_REQUIRED_MESSAGE)),
        }) as never,
      (options?.surveillanceService ??
        {
          evaluateDepositRequest: jest.fn().mockResolvedValue(undefined),
        }) as never,
      {} as never,
      {} as never,
      (options?.withdrawalsService ??
        {
          requestWithdrawal: options?.approved
            ? jest.fn().mockResolvedValue({
                transaction: {
                  id: 'tx-1',
                },
              })
            : jest
                .fn()
                .mockRejectedValue(new BadRequestException(KYC_APPROVAL_REQUIRED_MESSAGE)),
          approveWithdrawal: jest.fn(),
          rejectWithdrawal: jest.fn(),
        }) as never,
      (options?.responseCacheService ??
        {
          invalidateUserResources: jest.fn().mockResolvedValue(undefined),
        }) as never,
      (options?.emailService ??
        {
          sendDepositPending: jest.fn().mockResolvedValue(undefined),
          sendDepositRejected: jest.fn().mockResolvedValue(undefined),
          sendDepositApproved: jest.fn().mockResolvedValue(undefined),
        }) as never,
    );
  }

  it('rejects non-USDT deposit requests', async () => {
    const service = createService({ approved: true });

    await expect(
      service.requestDeposit('user-1', {
        amount: 100,
        asset: 'BTC',
        network: 'USDT-TRC20',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-USDT withdrawal requests', async () => {
    const service = createService({ approved: true });

    await expect(
      service.requestWithdrawal('user-1', {
        amount: 100,
        asset: 'ETH',
        address: '0xabc',
        network: 'USDT-ERC20',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects wallet deposit requests for users without approved KYC', async () => {
    const service = createService();

    await expect(
      service.requestDeposit('user-1', {
        amount: 100,
        asset: 'USDT',
        network: 'USDT-TRC20',
      }),
    ).rejects.toThrow(KYC_APPROVAL_REQUIRED_MESSAGE);
  });

  it('rejects wallet withdrawal requests for users without approved KYC', async () => {
    const service = createService();

    await expect(
      service.requestWithdrawal('user-1', {
        amount: 100,
        asset: 'USDT',
        address: 'TTEST123',
        network: 'USDT-TRC20',
      }),
    ).rejects.toThrow(KYC_APPROVAL_REQUIRED_MESSAGE);
  });

  it('returns environment fallback platform wallets when the database is empty', async () => {
    const previousAddress = process.env.DEPOSIT_WALLET_USDT_TRC20;
    const previousMinimum = process.env.DEPOSIT_WALLET_MIN_USDT_TRC20;
    process.env.DEPOSIT_WALLET_USDT_TRC20 = 'TVfExampleFallbackWallet';
    process.env.DEPOSIT_WALLET_MIN_USDT_TRC20 = '25';

    const service = createService({
      approved: true,
      prisma: {
        depositWallet: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    });

    try {
      await expect(service.getPlatformDepositWallets('user-1')).resolves.toEqual([
        expect.objectContaining({
          network: 'TRC20',
          coin: 'USDT',
          address: 'TVfExampleFallbackWallet',
          minDeposit: 25,
          source: 'environment',
          envKey: 'DEPOSIT_WALLET_USDT_TRC20',
        }),
      ]);
    } finally {
      if (previousAddress === undefined) {
        delete process.env.DEPOSIT_WALLET_USDT_TRC20;
      } else {
        process.env.DEPOSIT_WALLET_USDT_TRC20 = previousAddress;
      }

      if (previousMinimum === undefined) {
        delete process.env.DEPOSIT_WALLET_MIN_USDT_TRC20;
      } else {
        process.env.DEPOSIT_WALLET_MIN_USDT_TRC20 = previousMinimum;
      }
    }
  });

  it('routes linked withdrawal approvals through the withdrawal workflow', async () => {
    const withdrawalsService = {
      approveWithdrawal: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }),
      rejectWithdrawal: jest.fn(),
      requestWithdrawal: jest.fn(),
    };
    const transactionFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
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
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
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
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: 'admin-1',
        approvedAt: new Date('2026-04-12T10:05:00.000Z'),
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:05:00.000Z'),
      });
    const service = createService({
      prisma: {
        transaction: {
          findUnique: transactionFindUnique,
        },
      },
      withdrawalsService,
    });

    await expect(service.decideTransaction('tx-1', 'admin-1', true, 'approved')).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-1',
        status: TransactionStatus.APPROVED,
        amount: 100,
      }),
    );

    expect(withdrawalsService.approveWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      'admin-1',
      'approved',
    );
    expect(withdrawalsService.rejectWithdrawal).not.toHaveBeenCalled();
  });

  it('routes linked withdrawal rejections through the withdrawal workflow', async () => {
    const withdrawalsService = {
      approveWithdrawal: jest.fn(),
      rejectWithdrawal: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }),
      requestWithdrawal: jest.fn(),
    };
    const transactionFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
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
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: null,
        approvedAt: null,
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.REJECTED,
        reference: null,
        metadata: {
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: 'admin-1',
        approvedAt: new Date('2026-04-12T10:05:00.000Z'),
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:05:00.000Z'),
      });
    const service = createService({
      prisma: {
        transaction: {
          findUnique: transactionFindUnique,
        },
      },
      withdrawalsService,
    });

    await expect(service.decideTransaction('tx-1', 'admin-1', false)).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-1',
        status: TransactionStatus.REJECTED,
        amount: 100,
      }),
    );

    expect(withdrawalsService.rejectWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      'admin-1',
      'Rejected by admin',
    );
    expect(withdrawalsService.approveWithdrawal).not.toHaveBeenCalled();
  });

  it('allows generic rejection of already approved linked withdrawals', async () => {
    const withdrawalsService = {
      approveWithdrawal: jest.fn(),
      rejectWithdrawal: jest.fn().mockResolvedValue({ id: 'withdrawal-1' }),
      requestWithdrawal: jest.fn(),
    };
    const transactionFindUnique = jest
      .fn()
      .mockResolvedValueOnce({
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
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: 'admin-1',
        approvedAt: new Date('2026-04-12T10:05:00.000Z'),
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:05:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'tx-1',
        userId: 'user-1',
        walletId: 'wallet-1',
        accountId: 'account-1',
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        asset: 'USDT',
        status: TransactionStatus.REJECTED,
        reference: null,
        metadata: {
          network: 'TRC20',
          withdrawalRequestId: 'withdrawal-1',
        },
        approvedById: 'admin-1',
        approvedAt: new Date('2026-04-12T10:10:00.000Z'),
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        updatedAt: new Date('2026-04-12T10:10:00.000Z'),
      });
    const service = createService({
      prisma: {
        transaction: {
          findUnique: transactionFindUnique,
        },
      },
      withdrawalsService,
    });

    await expect(service.decideTransaction('tx-1', 'admin-1', false)).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-1',
        status: TransactionStatus.REJECTED,
      }),
    );

    expect(withdrawalsService.rejectWithdrawal).toHaveBeenCalledWith(
      'withdrawal-1',
      'admin-1',
      'Rejected by admin',
    );
  });

  it('allows approving manually declared platform deposits without on-chain detection', async () => {
    const pendingTransaction = {
      id: 'tx-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      accountId: 'account-1',
      type: TransactionType.DEPOSIT,
      amount: new Prisma.Decimal(100),
      asset: 'USDT',
      status: TransactionStatus.PENDING,
      reference: null,
      metadata: {
        network: 'TRC20',
        declaredByClient: true,
        platformWalletId: 'wallet-config-1',
      },
      approvedById: null,
      approvedAt: null,
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
    };
    const approvedTransaction = {
      ...pendingTransaction,
      status: TransactionStatus.APPROVED,
      approvedById: 'admin-1',
      approvedAt: new Date('2026-04-12T10:05:00.000Z'),
      updatedAt: new Date('2026-04-12T10:05:00.000Z'),
    };
    const accountUpdate = jest.fn().mockResolvedValue(undefined);
    const transactionUpdate = jest.fn().mockResolvedValue(approvedTransaction);
    const prismaService = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue(pendingTransaction),
      },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          transaction: {
            findUnique: jest.fn().mockResolvedValue(pendingTransaction),
            update: transactionUpdate,
          },
          account: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'account-1',
            }),
            update: accountUpdate,
          },
        }),
      ),
      deposit: {
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createService({
      prisma: prismaService,
      accounts: {
        syncLegacyWalletSnapshot: jest.fn().mockResolvedValue(undefined),
      },
      responseCacheService: {
        invalidateUserResources: jest.fn().mockResolvedValue(undefined),
      },
    });

    await expect(service.decideTransaction('tx-1', 'admin-1', true, 'approved')).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-1',
        status: TransactionStatus.APPROVED,
        amount: 100,
      }),
    );

    expect(accountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'account-1' },
      }),
    );
    expect(transactionUpdate).toHaveBeenCalled();
  });

  it('rejects deposit approval when no matching on-chain deposit has been detected', async () => {
    const pendingTransaction = {
      id: 'tx-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      accountId: 'account-1',
      type: TransactionType.DEPOSIT,
      amount: new Prisma.Decimal(100),
      asset: 'USDT',
      status: TransactionStatus.PENDING,
      reference: '0xdeposit',
      metadata: {
        network: 'ERC20',
        transactionHash: '0xdeposit',
      },
      approvedById: null,
      approvedAt: null,
      createdAt: new Date('2026-04-12T10:00:00.000Z'),
      updatedAt: new Date('2026-04-12T10:00:00.000Z'),
    };
    const service = createService({
      prisma: {
        transaction: {
          findUnique: jest.fn().mockResolvedValue(pendingTransaction),
        },
        $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
          callback({
            transaction: {
              findUnique: jest.fn().mockResolvedValue(pendingTransaction),
            },
            deposit: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          }),
        ),
      },
      withdrawalsService: {
        requestWithdrawal: jest.fn(),
        approveWithdrawal: jest.fn(),
        rejectWithdrawal: jest.fn(),
      },
    });

    await expect(service.decideTransaction('tx-1', 'admin-1', true, 'approved')).rejects.toThrow(
      'Deposit must be detected on-chain before it can be approved',
    );
  });
});
