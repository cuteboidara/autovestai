import { Prisma } from '@prisma/client';

import { PnlEngineService } from '../src/modules/positions/pnl-engine.service';

describe('PnlEngineService', () => {
  it('keeps open risk when liquidation returns null and logs retry requirement', async () => {
    const calculateMarginLevel = jest.fn((equity: number, usedMargin: number) => {
      if (usedMargin <= 0) {
        return null;
      }

      return Number(((equity / usedMargin) * 100).toFixed(8));
    });
    const positionsService = {
      liquidatePosition: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          realizedPnl: -10,
        }),
    };
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const tradingEventsService = {
      emitLiquidationEvent: jest.fn(),
    };
    const service = new PnlEngineService(
      {
        wallet: {
          findMany: jest.fn(),
        },
      } as never,
      {} as never,
      {
        calculateMarginLevel,
      } as never,
      positionsService as never,
      auditService as never,
      tradingEventsService as never,
    );

    await (service as any).handleLiquidationIfNeeded(
      'user-1',
      {
        id: 'wallet-1',
        userId: 'user-1',
        balance: new Prisma.Decimal(100),
        lockedMargin: new Prisma.Decimal(110),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      [
        {
          position: {
            id: 'position-failed',
            symbol: 'BTCUSDT',
            marginUsed: new Prisma.Decimal(50),
          },
          pnl: -40,
          currentBid: 0,
          currentAsk: 0,
          currentPrice: 0,
        },
        {
          position: {
            id: 'position-success',
            symbol: 'ETHUSD',
            marginUsed: new Prisma.Decimal(60),
          },
          pnl: -10,
          currentBid: 0,
          currentAsk: 0,
          currentPrice: 0,
        },
      ],
      {
        equity: 50,
        usedMargin: 110,
        marginLevel: 45.45454545,
      },
    );

    expect(positionsService.liquidatePosition).toHaveBeenCalledTimes(2);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'POSITION_LIQUIDATION_RETRY_REQUIRED',
        entityId: 'position-failed',
      }),
    );
    expect(tradingEventsService.emitLiquidationEvent).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        positionId: 'position-failed',
        status: 'retry_required',
      }),
    );
    expect(calculateMarginLevel).toHaveBeenLastCalledWith(50, 50);
  });
});
