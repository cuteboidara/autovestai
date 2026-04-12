import { OrderSide, PositionStatus, Prisma } from '@prisma/client';

import { PositionsService } from '../src/modules/positions/positions.service';

function createQuote() {
  return {
    symbol: 'BTCUSDT',
    rawPrice: 60_005,
    lastPrice: 60_005,
    bid: 60_000,
    ask: 60_010,
    spread: 10,
    markup: 10,
    source: 'test',
    marketState: 'LIVE' as const,
    timestamp: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

function createPosition() {
  return {
    id: 'position-1',
    userId: 'user-1',
    accountId: 'account-1',
    orderId: 'order-1',
    symbol: 'BTCUSDT',
    side: OrderSide.BUY,
    entryPrice: new Prisma.Decimal(62_000),
    exitPrice: null,
    volume: new Prisma.Decimal(1),
    contractSize: new Prisma.Decimal(1),
    leverage: 10,
    margin: new Prisma.Decimal(6_200),
    marginUsed: new Prisma.Decimal(6_200),
    liquidationPrice: new Prisma.Decimal(58_900),
    pnl: new Prisma.Decimal(0),
    status: PositionStatus.OPEN,
    openedAt: new Date(),
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('PositionsService', () => {
  it('liquidates an open position and emits liquidation updates', async () => {
    const position = createPosition();
    const closedPosition = {
      ...position,
      status: PositionStatus.CLOSED,
      exitPrice: new Prisma.Decimal(60_000),
      pnl: new Prisma.Decimal(-2_000),
      closedAt: new Date(),
    };
    const tradingEventsService = {
      emitPositionUpdate: jest.fn(),
      emitLiquidationEvent: jest.fn(),
    };
    const responseCacheService = {
      invalidateUserResources: jest.fn(),
    };
    const accountsService = {
      syncLegacyWalletSnapshot: jest.fn().mockResolvedValue(undefined),
    };
    const prismaService = {
      position: {
        findFirst: jest.fn().mockResolvedValue(position),
        update: jest.fn().mockResolvedValue(closedPosition),
      },
      tradeExecution: {
        create: jest.fn().mockResolvedValue({
          id: 'exec-1',
          userId: 'user-1',
          orderId: 'order-1',
          symbol: 'BTCUSDT',
          side: OrderSide.BUY,
          volume: new Prisma.Decimal(1),
          price: new Prisma.Decimal(60_000),
          realizedPnl: new Prisma.Decimal(-2_000),
          metadata: null,
          createdAt: new Date(),
        }),
      },
      transaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          position: {
            findFirst: jest.fn().mockResolvedValue(position),
            update: jest.fn().mockResolvedValue(closedPosition),
          },
          account: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'account-1',
              userId: 'user-1',
              balance: new Prisma.Decimal(10_000),
            }),
            update: jest.fn(),
          },
          tradeExecution: {
            create: jest.fn().mockResolvedValue({
              id: 'exec-1',
              userId: 'user-1',
              orderId: 'order-1',
              symbol: 'BTCUSDT',
              side: OrderSide.BUY,
              volume: new Prisma.Decimal(1),
              price: new Prisma.Decimal(60_000),
              realizedPnl: new Prisma.Decimal(-2_000),
              metadata: null,
              createdAt: new Date(),
            }),
          },
          transaction: {
            create: jest.fn(),
          },
        })),
    };
    const service = new PositionsService(
      prismaService as never,
      {
        getLatestQuote: jest.fn().mockResolvedValue(createQuote()),
        getSymbolHealth: jest.fn().mockReturnValue({
          healthy: true,
        }),
      } as never,
      {
        calculatePositionPnl: jest.fn().mockReturnValue(-2_000),
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        evaluatePositionClose: jest.fn(),
      } as never,
      tradingEventsService as never,
      responseCacheService as never,
      accountsService as never,
      {
        handlePositionClosed: jest.fn(),
      } as never,
      {
        updateExposureForSymbol: jest.fn(),
      } as never,
    );

    const result = await service.liquidatePosition('position-1');

    expect(result).toMatchObject({
      liquidated: true,
      realizedPnl: -2_000,
      closePrice: 60_000,
    });
    expect(tradingEventsService.emitLiquidationEvent).toHaveBeenCalled();
  });

  it('returns null when liquidation quote health is unhealthy', async () => {
    const service = new PositionsService(
      {
        position: {
          findFirst: jest.fn().mockResolvedValue(createPosition()),
        },
      } as never,
      {
        getLatestQuote: jest.fn().mockResolvedValue(createQuote()),
        getSymbolHealth: jest.fn().mockReturnValue({
          healthy: false,
        }),
      } as never,
      {
        calculatePositionPnl: jest.fn(),
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        evaluatePositionClose: jest.fn(),
      } as never,
      {
        emitPositionUpdate: jest.fn(),
        emitLiquidationEvent: jest.fn(),
      } as never,
      {
        invalidateUserResources: jest.fn(),
      } as never,
      {
        syncLegacyWalletSnapshot: jest.fn(),
      } as never,
      {
        handlePositionClosed: jest.fn(),
      } as never,
      {
        updateExposureForSymbol: jest.fn(),
      } as never,
    );

    await expect(service.liquidatePosition('position-1')).resolves.toBeNull();
  });

  it('returns null when liquidation loses the position race inside the transaction', async () => {
    const position = createPosition();
    const tradingEventsService = {
      emitPositionUpdate: jest.fn(),
      emitLiquidationEvent: jest.fn(),
    };
    const service = new PositionsService(
      {
        position: {
          findFirst: jest.fn().mockResolvedValue(position),
        },
        $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
          callback({
            position: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            wallet: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            tradeExecution: {
              create: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
            },
          })),
      } as never,
      {
        getLatestQuote: jest.fn().mockResolvedValue(createQuote()),
        getSymbolHealth: jest.fn().mockReturnValue({
          healthy: true,
        }),
      } as never,
      {
        calculatePositionPnl: jest.fn().mockReturnValue(-2_000),
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        evaluatePositionClose: jest.fn(),
      } as never,
      tradingEventsService as never,
      {
        invalidateUserResources: jest.fn(),
      } as never,
      {
        syncLegacyWalletSnapshot: jest.fn(),
      } as never,
      {
        handlePositionClosed: jest.fn(),
      } as never,
      {
        updateExposureForSymbol: jest.fn(),
      } as never,
    );

    await expect(service.liquidatePosition('position-1')).resolves.toBeNull();
    expect(tradingEventsService.emitLiquidationEvent).not.toHaveBeenCalled();
  });
});
