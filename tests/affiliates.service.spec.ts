import { AffiliateCommissionStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

import { KYC_APPROVAL_REQUIRED_MESSAGE } from '../src/modules/kyc/kyc.constants';
import { AffiliatesService } from '../src/modules/affiliates/affiliates.service';

describe('AffiliatesService', () => {
  it('creates pending commissions for upstream affiliates on executed orders', async () => {
    const prismaService = {
      affiliateCommission: {
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new AffiliatesService(
      prismaService as never,
      {
        isAffiliateProgramEnabled: jest.fn().mockReturnValue(true),
        getAffiliateLevelRates: jest.fn().mockReturnValue({
          level1Percent: 30,
          level2Percent: 10,
          level3Percent: 5,
        }),
      } as never,
      {
        calculateAffiliateRebate: jest.fn().mockReturnValue({
          rebateAmount: 9,
        }),
      } as never,
      {
        log: jest.fn(),
      } as never,
      {
        assertPlatformAccessApproved: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
    jest
      .spyOn(service as any, 'resolveUplineAffiliatesForUser')
      .mockResolvedValue([
        {
          level: 1,
          affiliate: {
            id: 'affiliate-1',
          },
        },
      ]);

    await service.processExecutedOrder({
      userId: 'user-1',
      orderId: 'order-1',
      symbol: 'BTCUSDT',
      volume: 1,
      tradeNotional: 10000,
      spreadMarkupRevenue: 25,
      commissionRevenue: 5,
    });

    expect(prismaService.affiliateCommission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            affiliateId: 'affiliate-1',
            referredUserId: 'user-1',
            status: AffiliateCommissionStatus.PENDING,
          }),
        ],
      }),
    );
  });

  it('rejects affiliate applications for users without approved KYC', async () => {
    const service = new AffiliatesService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        assertPlatformAccessApproved: jest
          .fn()
          .mockRejectedValue(new BadRequestException(KYC_APPROVAL_REQUIRED_MESSAGE)),
      } as never,
    );

    await expect(
      service.apply('user-1', {
        referralCodePrefix: 'AUTO',
      }),
    ).rejects.toThrow(KYC_APPROVAL_REQUIRED_MESSAGE);
  });
});
