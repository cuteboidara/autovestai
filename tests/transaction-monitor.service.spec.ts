import { DepositStatus, Network, Prisma, TransactionStatus } from '@prisma/client';

import { BlockchainMonitorService } from '../src/modules/wallet/blockchain-monitor.service';

describe('BlockchainMonitorService', () => {
  function createService(overrides?: {
    prismaService?: Record<string, unknown>;
    accountsService?: Record<string, unknown>;
    responseCacheService?: Record<string, unknown>;
    auditService?: Record<string, unknown>;
    adminChatService?: Record<string, unknown>;
    crmService?: Record<string, unknown>;
  }) {
    return new BlockchainMonitorService(
      (overrides?.prismaService ?? {
        deposit: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          update: jest.fn(),
        },
        wallet: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'wallet-1',
          }),
        },
        $transaction: jest.fn(),
      }) as never,
      (overrides?.accountsService ?? {
        syncLegacyWalletSnapshot: jest.fn().mockResolvedValue(undefined),
      }) as never,
      (overrides?.responseCacheService ?? {
        invalidateUserResources: jest.fn().mockResolvedValue(undefined),
      }) as never,
      (overrides?.auditService ?? {
        log: jest.fn().mockResolvedValue(undefined),
      }) as never,
      (overrides?.adminChatService ?? {
        postSystemAlert: jest.fn().mockResolvedValue(undefined),
      }) as never,
      (overrides?.crmService ?? {
        sendDirectEmailToUser: jest.fn().mockResolvedValue({ success: true }),
      }) as never,
      {
        getClient: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue('OK'),
        }),
      } as never,
      {
        get: jest.fn().mockReturnValue(undefined),
      } as never,
    );
  }

  it('stores incomplete deposits without crediting balances', async () => {
    const prismaService = {
      deposit: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = createService({ prismaService });

    await (service as any).processDeposit(
      {
        userId: 'user-1',
        accountId: 'account-1',
        address: 'tron-address',
        network: Network.TRC20,
      },
      {
        txHash: 'trx-1',
        network: Network.TRC20,
        amount: 100,
        fromAddress: 'from-address',
        toAddress: 'tron-address',
        confirmations: 0,
        detectedAt: new Date(),
      },
    );

    expect(prismaService.deposit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          txHash: 'trx-1',
          status: DepositStatus.PENDING,
          amount: new Prisma.Decimal(100),
        }),
      }),
    );
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });

  it('records completed deposits as pending admin review without crediting balances', async () => {
    const txTransactionCreate = jest.fn().mockResolvedValue(undefined);
    const prismaService = {
      deposit: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-1',
        }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          deposit: {
            create: jest.fn().mockResolvedValue({
              id: 'deposit-1',
            }),
            update: jest.fn().mockResolvedValue({
              id: 'deposit-1',
            }),
          },
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: txTransactionCreate,
            update: jest.fn(),
          },
        })),
    };
    const accountsService = {
      syncLegacyWalletSnapshot: jest.fn().mockResolvedValue(undefined),
    };
    const responseCacheService = {
      invalidateUserResources: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const adminChatService = {
      postSystemAlert: jest.fn().mockResolvedValue(undefined),
    };
    const crmService = {
      sendDirectEmailToUser: jest.fn().mockResolvedValue({ success: true }),
    };
    const service = createService({
      prismaService,
      accountsService,
      responseCacheService,
      auditService,
      adminChatService,
      crmService,
    });

    await (service as any).processDeposit(
      {
        userId: 'user-1',
        accountId: 'account-1',
        address: 'tron-address',
        network: Network.TRC20,
      },
      {
        txHash: 'trx-1',
        network: Network.TRC20,
        amount: 100,
        fromAddress: 'from-address',
        toAddress: 'tron-address',
        confirmations: 1,
        detectedAt: new Date(),
      },
    );

    expect(txTransactionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          walletId: 'wallet-1',
          type: 'DEPOSIT',
          asset: 'USDT',
          status: TransactionStatus.PENDING,
          reference: 'trx-1',
        }),
      }),
    );
    expect(accountsService.syncLegacyWalletSnapshot).toHaveBeenCalledWith(
      'user-1',
      'account-1',
    );
    expect(responseCacheService.invalidateUserResources).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalled();
    expect(adminChatService.postSystemAlert).toHaveBeenCalled();
    expect(crmService.sendDirectEmailToUser).toHaveBeenCalled();
  });
});
