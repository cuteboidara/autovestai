import { RebatesService } from '../src/modules/rebates/rebates.service';

describe('RebatesService', () => {
  const service = new RebatesService();

  it('calculates affiliate rebate from broker revenue', () => {
    const result = service.calculateAffiliateRebate({
      tradeNotional: 10000,
      spreadMarkupRevenue: 25,
      commissionRevenue: 5,
      rebateConfig: 30,
      hierarchyLevel: 1,
    });

    expect(result.rebateAmount).toBe(9);
    expect(result.reason).toBe('affiliate_level_1_rebate');
  });

  it('calculates gross and net broker revenue', () => {
    expect(
      service.calculateBrokerRevenue({
        tradeNotional: 10000,
        spreadMarkupRevenue: 12,
        commissionRevenue: 3,
      }),
    ).toEqual({
      tradeNotional: 10000,
      spreadMarkupRevenue: 12,
      commissionRevenue: 3,
      totalRevenue: 15,
    });

    expect(
      service.calculateNetRevenueAfterRebates({
        tradeNotional: 10000,
        spreadMarkupRevenue: 12,
        commissionRevenue: 3,
        totalRebates: 4.5,
      }).netRevenue,
    ).toBe(10.5);
  });
});
