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
    configService?: Record<string, unknown>;
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
      (overrides?.configService ?? {
        get: jest.fn().mockReturnValue(undefined),
      }) as never,
    );
  }

  it('stores incomplete deposits without crediting balances', async () => {
    const txTransactionCreate = jest.fn().mockResolvedValue(undefined);
    const prismaService = {
      deposit: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn(),
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
            update: jest.fn(),
          },
          transaction: {
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
    const service = createService({
      prismaService,
      accountsService,
      responseCacheService,
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
        confirmations: 0,
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
          metadata: expect.objectContaining({
            autoDetected: true,
            depositId: 'deposit-1',
            depositStatus: DepositStatus.PENDING,
            confirmations: 0,
          }),
        }),
      }),
    );
    expect(accountsService.syncLegacyWalletSnapshot).toHaveBeenCalledWith(
      'user-1',
      'account-1',
    );
    expect(responseCacheService.invalidateUserResources).toHaveBeenCalled();
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
          metadata: expect.objectContaining({
            autoDetected: true,
            depositId: 'deposit-1',
            depositStatus: DepositStatus.COMPLETED,
            confirmations: 1,
          }),
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

  it('falls back to ethereum rpc for ERC20 scans when no etherscan key is configured', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as never);
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(
      new Date('2026-04-12T10:05:00.000Z').getTime(),
    );
    const processDeposit = jest.fn().mockResolvedValue(undefined);
    const depositAddressFindMany = jest.fn().mockResolvedValue([
      {
        id: 'address-1',
        userId: 'user-1',
        accountId: 'account-1',
        address: '0x717e93Dfb9588a0Fe25094774A5c5d809B085b1a',
        network: Network.ERC20,
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
      },
    ]);

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest
          .fn()
          .mockResolvedValue('{"jsonrpc":"2.0","result":"0x64","id":"eth_blockNumber"}'),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            jsonrpc: '2.0',
            result: [
              {
                transactionHash:
                  '0xe8c208398bd5ae8e4c237658580db56a2a94dfa0ca382c99b776fa6e7d31d5b4',
                blockNumber: '0x5f',
                topics: [
                  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                  '0x000000000000000000000000642ae78fafbb8032da552d619ad43f1d81e4dd7c',
                  '0x000000000000000000000000717e93dfb9588a0fe25094774a5c5d809b085b1a',
                ],
                data: '0x989680',
              },
            ],
            id: 'eth_getLogs',
          }),
        ),
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest
          .fn()
          .mockResolvedValue('{"jsonrpc":"2.0","result":{"timestamp":"0x6618ff10"},"id":"eth_getBlockByNumber"}'),
      } as never);

    const service = createService({
      prismaService: {
        depositAddress: {
          findMany: depositAddressFindMany,
        },
      },
      configService: {
        get: jest.fn((key: string) => {
          if (key === 'wallet.etherscanApiKey') {
            return '';
          }

          if (key === 'wallet.ethRpcUrl') {
            return 'https://rpc.primary.test';
          }

          return undefined;
        }),
      },
    });
    (service as any).processDeposit = processDeposit;

    await service.checkERC20Deposits();

    expect(depositAddressFindMany).toHaveBeenCalled();
    expect(processDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        accountId: 'account-1',
        address: '0x717e93Dfb9588a0Fe25094774A5c5d809B085b1a',
      }),
      expect.objectContaining({
        txHash: '0xe8c208398bd5ae8e4c237658580db56a2a94dfa0ca382c99b776fa6e7d31d5b4',
        network: Network.ERC20,
        amount: 10,
        fromAddress: '0x642ae78fafbb8032da552d619ad43f1d81e4dd7c',
        toAddress: '0x717e93Dfb9588a0Fe25094774A5c5d809B085b1a',
        confirmations: 6,
      }),
    );

    fetchSpy.mockRestore();
    dateNowSpy.mockRestore();
  });
});
