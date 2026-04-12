import { AccountStatus, AccountType, Prisma, PositionStatus } from '@prisma/client';

import { AccountsService } from './accounts.service';

jest.mock('node:crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from([0xab, 0xcd, 0xef])),
}));

function createAccountRecord(overrides?: Partial<{
  id: string;
  userId: string;
  type: AccountType;
  name: string;
  accountNo: string;
  balance: Prisma.Decimal;
  equity: Prisma.Decimal;
  currency: string;
  status: AccountStatus;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}>) {
  return {
    id: 'account-1',
    userId: 'user-1',
    type: AccountType.LIVE,
    name: 'Live Account #1',
    accountNo: 'FFABCDEF',
    balance: new Prisma.Decimal(0),
    equity: new Prisma.Decimal(0),
    currency: 'USDT',
    status: AccountStatus.ACTIVE,
    isDefault: true,
    createdAt: new Date('2026-04-08T20:00:00.000Z'),
    updatedAt: new Date('2026-04-08T20:00:00.000Z'),
    ...overrides,
  };
}

describe('AccountsService', () => {
  function createService() {
    const prismaService = {
      account: {
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      position: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      wallet: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const responseCacheService = {
      invalidateUserResources: jest.fn(),
    };
    const pricingService = {
      getLatestQuote: jest.fn(),
    };
    const auditService = {
      log: jest.fn(),
    };
    const tradingEventsService = {
      emitWalletUpdate: jest.fn(),
    };
    const positionsService = {
      closePositionBySystem: jest.fn(),
    };

    return {
      prismaService,
      responseCacheService,
      pricingService,
      auditService,
      tradingEventsService,
      positionsService,
      service: new AccountsService(
        prismaService as never,
        responseCacheService as never,
        pricingService as never,
        auditService as never,
        tradingEventsService as never,
        positionsService as never,
      ),
    };
  }

  it('creates a first live account with a generated LIVE account number', async () => {
    const {
      service,
      prismaService,
      auditService,
      tradingEventsService,
    } = createService();
    const createdAccount = createAccountRecord();

    prismaService.account.count.mockResolvedValue(0);
    prismaService.account.findUnique.mockResolvedValue(null);
    prismaService.account.create.mockResolvedValue(createdAccount);
    prismaService.account.findFirst.mockResolvedValue(createdAccount);
    prismaService.position.findMany.mockResolvedValue([]);

    const result = await service.createAccount('user-1', { type: AccountType.LIVE });

    expect(prismaService.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AccountType.LIVE,
          accountNo: 'FFABCDEF',
          balance: new Prisma.Decimal(0),
          isDefault: true,
        }),
      }),
    );
    expect(result).toMatchObject({
      type: AccountType.LIVE,
      accountNo: 'FFABCDEF',
      balance: 0,
      isDefault: true,
    });
    expect(prismaService.wallet.upsert).toHaveBeenCalled();
    expect(tradingEventsService.emitWalletUpdate).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalled();
  });

  it('creates a demo account with a funded virtual balance', async () => {
    const { service, prismaService } = createService();
    const demoAccount = createAccountRecord({
      id: 'account-demo',
      type: AccountType.DEMO,
      name: 'Demo Account',
      accountNo: 'DMABCDEF',
      balance: new Prisma.Decimal(10_000),
      equity: new Prisma.Decimal(10_000),
      isDefault: false,
    });

    prismaService.account.count.mockResolvedValue(1);
    prismaService.account.findUnique.mockResolvedValue(null);
    prismaService.account.create.mockResolvedValue(demoAccount);
    prismaService.position.findMany.mockResolvedValue([]);

    const result = await service.createAccount('user-1', { type: AccountType.DEMO });

    expect(prismaService.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AccountType.DEMO,
          accountNo: 'DMABCDEF',
          balance: new Prisma.Decimal(10_000),
          isDefault: false,
        }),
      }),
    );
    expect(result).toMatchObject({
      type: AccountType.DEMO,
      balance: 10_000,
      isDefault: false,
    });
    expect(prismaService.wallet.upsert).not.toHaveBeenCalled();
  });

  it('sets the requested account as the default account', async () => {
    const {
      service,
      prismaService,
      tradingEventsService,
    } = createService();
    const activeAccount = createAccountRecord({
      id: 'account-live-2',
      name: 'Live Account #2',
      accountNo: 'FF222222',
      isDefault: false,
    });
    const defaultAccount = {
      ...activeAccount,
      isDefault: true,
    };

    prismaService.account.findFirst
      .mockResolvedValueOnce(activeAccount)
      .mockResolvedValueOnce(defaultAccount)
      .mockResolvedValueOnce(defaultAccount);
    prismaService.position.findMany.mockResolvedValue([]);
    prismaService.account.updateMany.mockResolvedValue({ count: 2 });
    prismaService.account.update.mockResolvedValue(defaultAccount);
    prismaService.$transaction.mockResolvedValue([null, defaultAccount]);

    const result = await service.setDefaultAccount('user-1', activeAccount.id);

    expect(prismaService.account.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { isDefault: false },
    });
    expect(prismaService.account.update).toHaveBeenCalledWith({
      where: { id: activeAccount.id },
      data: { isDefault: true },
    });
    expect(result).toMatchObject({
      id: activeAccount.id,
      isDefault: true,
    });
    expect(prismaService.wallet.upsert).toHaveBeenCalled();
    expect(tradingEventsService.emitWalletUpdate).toHaveBeenCalled();
  });

  it('resets a demo account balance and closes its open positions', async () => {
    const {
      service,
      prismaService,
      positionsService,
    } = createService();
    const demoAccount = createAccountRecord({
      id: 'account-demo-2',
      type: AccountType.DEMO,
      name: 'Demo Account',
      accountNo: 'DM222222',
      balance: new Prisma.Decimal(5_500),
      equity: new Prisma.Decimal(5_500),
      isDefault: true,
    });
    const resetAccount = {
      ...demoAccount,
      balance: new Prisma.Decimal(10_000),
      equity: new Prisma.Decimal(10_000),
    };
    const openPosition = {
      id: 'position-1',
      accountId: demoAccount.id,
      status: PositionStatus.OPEN,
      openedAt: new Date('2026-04-08T20:05:00.000Z'),
    };

    prismaService.account.findFirst
      .mockResolvedValueOnce(demoAccount)
      .mockResolvedValueOnce(resetAccount)
      .mockResolvedValueOnce(resetAccount);
    prismaService.position.findMany
      .mockResolvedValueOnce([openPosition])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaService.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          account: {
            update: jest.fn().mockResolvedValue(resetAccount),
          },
          transaction: {
            create: jest.fn(),
          },
        }),
    );

    const result = await service.resetDemoBalance('user-1', demoAccount.id);

    expect(positionsService.closePositionBySystem).toHaveBeenCalledWith(
      openPosition.id,
      'DEMO_RESET',
    );
    expect(result).toMatchObject({
      id: demoAccount.id,
      balance: 10_000,
      isDefault: true,
    });
    expect(prismaService.wallet.upsert).toHaveBeenCalled();
  });
});
