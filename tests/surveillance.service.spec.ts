import { SurveillanceService } from '../src/modules/surveillance/surveillance.service';

describe('SurveillanceService', () => {
  it('flags repeated rejected orders', async () => {
    const prismaService = {
      order: {
        count: jest.fn().mockResolvedValue(5),
      },
    };
    const service = new SurveillanceService(
      prismaService as never,
      {} as never,
      {
        log: jest.fn(),
      } as never,
    );
    const createAlertSpy = jest
      .spyOn(service as any, 'createAlertIfNeeded')
      .mockResolvedValue(null);

    await service.evaluateOrderRejected({
      userId: 'user-1',
      orderId: 'order-1',
      symbol: 'BTCUSDT',
      reason: 'Insufficient free margin',
    });

    expect(createAlertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        alertType: 'repeated_rejected_orders',
        userId: 'user-1',
        symbol: 'BTCUSDT',
      }),
    );
  });
});
