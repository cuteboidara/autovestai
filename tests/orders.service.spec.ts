import { BadRequestException } from '@nestjs/common';
import {
  AccountStatus,
  AccountType,
  OrderSide,
  OrderSourceType,
  OrderStatus,
  OrderType,
  Prisma,
  SymbolCategory,
} from '@prisma/client';

import { KYC_APPROVAL_REQUIRED_MESSAGE } from '../src/modules/kyc/kyc.constants';
import { OrdersService } from '../src/modules/orders/orders.service';

describe('OrdersService', () => {
  it('marks an order rejected when margin checks fail during execution', async () => {
    const baseOrder = {
      id: 'order-1',
      userId: 'user-1',
      type: OrderType.MARKET,
      side: OrderSide.BUY,
      symbol: 'BTCUSDT',
      volume: new Prisma.Decimal(1),
      leverage: 10,
      requestedPrice: null,
      executionPrice: null,
      sourceType: OrderSourceType.MANUAL,
      metadata: null,
      status: OrderStatus.PROCESSING,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prismaService = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(baseOrder),
        update: jest.fn().mockResolvedValue({
          ...baseOrder,
          status: OrderStatus.REJECTED,
          rejectionReason: 'Insufficient free margin',
        }),
      },
    };
    const service = new OrdersService(
      prismaService as never,
      {
        getLatestQuote: jest.fn().mockResolvedValue({
          symbol: 'BTCUSDT',
          rawPrice: 62_000,
          lastPrice: 62_000,
          bid: 61_990,
          ask: 62_010,
          spread: 20,
          markup: 10,
          source: 'test',
          marketState: 'LIVE',
          timestamp: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }),
        assertQuoteHealthy: jest.fn(),
      } as never,
      {
        assertValidLeverage: jest.fn(),
        assertOrderCanBeOpened: jest
          .fn()
          .mockRejectedValue(new BadRequestException('Insufficient free margin')),
      } as never,
      {} as never,
      {
        emitOrderUpdate: jest.fn(),
        emitPositionUpdate: jest.fn(),
      } as never,
      {} as never,
      {
        isTradingEnabled: jest.fn().mockReturnValue(true),
        getSymbolConfig: jest.fn().mockReturnValue({
          tradingEnabled: true,
        }),
      } as never,
      {
        calculateBrokerRevenue: jest.fn().mockReturnValue({
          tradeNotional: 0,
          spreadMarkupRevenue: 0,
          commissionRevenue: 0,
          totalRevenue: 0,
        }),
      } as never,
      {} as never,
      {
        log: jest.fn(),
      } as never,
      {
        getSymbolOrThrow: jest.fn().mockReturnValue({
          symbol: 'BTCUSDT',
          isActive: true,
          category: SymbolCategory.CRYPTO,
          minTradeSizeLots: new Prisma.Decimal(0.01),
          maxTradeSizeLots: new Prisma.Decimal(100),
          lotSize: new Prisma.Decimal(1),
        }),
        normalize: jest.fn((symbol: string) => symbol.toUpperCase()),
        isMarketOpen: jest.fn().mockReturnValue(true),
      } as never,
      {
        evaluateOrderRejected: jest.fn(),
        evaluateOrderPlaced: jest.fn(),
      } as never,
      {
        assertPlatformAccessApproved: jest.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      {} as never,
    );

    const result = await service.processOrderExecution('order-1');

    expect(result).toBeNull();
    expect(prismaService.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.REJECTED,
          rejectionReason: 'Insufficient free margin',
        }),
      }),
    );
  });

  it('rejects order placement for users without approved KYC', async () => {
    const service = new OrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        resolveAccountForUser: jest.fn().mockResolvedValue({
          id: 'account-1',
          type: AccountType.LIVE,
          status: AccountStatus.ACTIVE,
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        assertPlatformAccessApproved: jest
          .fn()
          .mockRejectedValue(new BadRequestException(KYC_APPROVAL_REQUIRED_MESSAGE)),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.placeOrder('user-1', {
        type: OrderType.MARKET,
        side: OrderSide.BUY,
        symbol: 'BTCUSDT',
        volume: 1,
        leverage: 10,
      }),
    ).rejects.toThrow(KYC_APPROVAL_REQUIRED_MESSAGE);
  });

  it('rejects order placement when the symbol is not enabled for rollout', async () => {
    const orderCreate = jest.fn();
    const service = new OrdersService(
      {
        order: {
          create: orderCreate,
        },
      } as never,
      {} as never,
      {
        assertValidLeverage: jest.fn(),
      } as never,
      {} as never,
      {} as never,
      {
        resolveAccountForUser: jest.fn().mockResolvedValue({
          id: 'account-1',
          type: AccountType.LIVE,
          status: AccountStatus.ACTIVE,
        }),
      } as never,
      {
        isTradingEnabled: jest.fn().mockReturnValue(true),
        getSymbolConfig: jest.fn().mockReturnValue({
          tradingEnabled: true,
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {
        getSymbolOrThrow: jest.fn().mockReturnValue({
          symbol: 'SPY',
          isActive: false,
          category: SymbolCategory.ETFS,
          minTradeSizeLots: new Prisma.Decimal(0.01),
          maxTradeSizeLots: new Prisma.Decimal(100),
          lotSize: new Prisma.Decimal(100),
        }),
        normalize: jest.fn((symbol: string) => symbol.toUpperCase()),
        isMarketOpen: jest.fn().mockReturnValue(true),
      } as never,
      {} as never,
      {
        assertPlatformAccessApproved: jest.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.placeOrder('user-1', {
        type: OrderType.MARKET,
        side: OrderSide.BUY,
        symbol: 'SPY',
        volume: 1,
        leverage: 5,
      }),
    ).rejects.toThrow('Instrument is inactive: SPY');
    expect(orderCreate).not.toHaveBeenCalled();
  });
});
