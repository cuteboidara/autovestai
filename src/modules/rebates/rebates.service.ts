import { Injectable } from '@nestjs/common';

import { toDecimal } from '../../common/utils/decimal';

@Injectable()
export class RebatesService {
  calculateAffiliateRebate(params: {
    tradeNotional: number;
    spreadMarkupRevenue: number;
    commissionRevenue: number;
    rebateConfig: number;
    hierarchyLevel: number;
  }) {
    const grossRevenue = this.calculateBrokerRevenue({
      tradeNotional: params.tradeNotional,
      spreadMarkupRevenue: params.spreadMarkupRevenue,
      commissionRevenue: params.commissionRevenue,
    });
    const rebateAmount = toDecimal(grossRevenue.totalRevenue)
      .mul(params.rebateConfig)
      .div(100)
      .toDecimalPlaces(8)
      .toNumber();

    return {
      rebateAmount,
      reason: `affiliate_level_${params.hierarchyLevel}_rebate`,
      metadata: {
        hierarchyLevel: params.hierarchyLevel,
        tradeNotional: params.tradeNotional,
        spreadMarkupRevenue: params.spreadMarkupRevenue,
        commissionRevenue: params.commissionRevenue,
        rebatePercent: params.rebateConfig,
      },
    };
  }

  calculateBrokerRevenue(params: {
    tradeNotional: number;
    spreadMarkupRevenue: number;
    commissionRevenue: number;
  }) {
    const totalRevenue = toDecimal(params.spreadMarkupRevenue)
      .plus(params.commissionRevenue)
      .toDecimalPlaces(8)
      .toNumber();

    return {
      tradeNotional: params.tradeNotional,
      spreadMarkupRevenue: params.spreadMarkupRevenue,
      commissionRevenue: params.commissionRevenue,
      totalRevenue,
    };
  }

  calculateNetRevenueAfterRebates(params: {
    tradeNotional: number;
    spreadMarkupRevenue: number;
    commissionRevenue: number;
    totalRebates: number;
  }) {
    const grossRevenue = this.calculateBrokerRevenue({
      tradeNotional: params.tradeNotional,
      spreadMarkupRevenue: params.spreadMarkupRevenue,
      commissionRevenue: params.commissionRevenue,
    });

    return {
      ...grossRevenue,
      totalRebates: params.totalRebates,
      netRevenue: toDecimal(grossRevenue.totalRevenue)
        .minus(params.totalRebates)
        .toDecimalPlaces(8)
        .toNumber(),
    };
  }
}
