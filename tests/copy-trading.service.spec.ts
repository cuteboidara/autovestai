import { BadRequestException } from '@nestjs/common';
import { OrderSourceType, OrderStatus } from '@prisma/client';

import { KYC_APPROVAL_REQUIRED_MESSAGE } from '../src/modules/kyc/kyc.constants';
import { CopyTradingService } from '../src/modules/copy-trading/copy-trading.service';

describe('CopyTradingService', () => {
  it('queues eligible provider trades for mirror processing', async () => {
    const enqueueMasterOpen = jest.fn().mockResolvedValue(undefined);
    const service = new CopyTradingService(
      {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'order-1',
            userId: 'master-user',
            accountId: 'account-1',
            sourceType: OrderSourceType.MANUAL,
            status: OrderStatus.EXECUTED,
          }),
        },
        signalProvider: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'provider-1',
          }),
        },
        position: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'position-1',
          }),
        },
      } as never,
      {
        isCopyTradingEnabled: jest.fn().mockReturnValue(true),
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        assertPlatformAccessApproved: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        invalidatePublicResource: jest.fn(),
      } as never,
      {
        getAccountMetrics: jest.fn(),
      } as never,
      {
        enqueueMasterOpen,
        enqueueMasterClose: jest.fn(),
      } as never,
      {
        onProviderTrade: jest.fn(),
        onProviderClose: jest.fn(),
      } as never,
      {
        sendCopyProviderApproved: jest.fn().mockResolvedValue(undefined),
        sendCopyStarted: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await service.handleExecutedOrder('order-1');

    expect(enqueueMasterOpen).toHaveBeenCalledWith('position-1');
  });

  it('rejects signal-provider registration for users without approved KYC', async () => {
    const service = new CopyTradingService(
      {} as never,
      {
        isCopyTradingEnabled: jest.fn().mockReturnValue(true),
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        assertPlatformAccessApproved: jest
          .fn()
          .mockRejectedValue(new BadRequestException(KYC_APPROVAL_REQUIRED_MESSAGE)),
      } as never,
      {
        invalidatePublicResource: jest.fn(),
      } as never,
      {
        getAccountMetrics: jest.fn(),
      } as never,
      {
        enqueueMasterOpen: jest.fn(),
        enqueueMasterClose: jest.fn(),
      } as never,
      {
        onProviderTrade: jest.fn(),
        onProviderClose: jest.fn(),
      } as never,
      {
        sendCopyProviderApproved: jest.fn().mockResolvedValue(undefined),
        sendCopyStarted: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await expect(
      service.registerProvider('user-1', {
        accountId: 'account-1',
        displayName: 'Desk Trader',
        minCopyAmount: 100,
        feePercent: 10,
      }),
    ).rejects.toThrow(KYC_APPROVAL_REQUIRED_MESSAGE);
  });
});
