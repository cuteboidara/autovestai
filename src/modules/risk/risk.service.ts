import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, OrderSide, Position, PositionStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { PriceSnapshot } from '../../common/interfaces/price-snapshot.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber, zeroDecimal } from '../../common/utils/decimal';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { PricingService } from '../pricing/pricing.service';
import { SymbolsService } from '../symbols/symbols.service';

@Injectable()
export class RiskService {
  private readonly maxLeverage: number;
  private readonly marginCallLevel = 100;
  private readonly stopOutLevel = 50;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly pricingService: PricingService,
    private readonly configService: ConfigService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly symbolsService: SymbolsService,
  ) {
    this.maxLeverage = this.configService.getOrThrow<number>('risk.maxLeverage');
  }

  assertValidLeverage(leverage: number, symbol?: string): void {
    const symbolMaxLeverage = symbol
      ? this.brokerSettingsService.getSymbolConfig(symbol).maxLeverage
      : this.maxLeverage;

    if (!Number.isInteger(leverage) || leverage < 1 || leverage > symbolMaxLeverage) {
      throw new BadRequestException(
        `Leverage must be an integer between 1 and ${symbolMaxLeverage}`,
      );
    }
  }

  calculateRequiredMargin(params: {
    volumeLots: number;
    price: number;
    contractSize: number;
    leverage: number;
  }): number {
    return toDecimal(params.contractSize)
      .mul(params.volumeLots)
      .mul(params.price)
      .div(params.leverage)
      .toDecimalPlaces(8)
      .toNumber();
  }

  calculateRequiredMarginForSymbol(params: {
    symbol: string;
    volumeLots: number;
    price: number;
    leverage: number;
  }): number {
    this.assertValidLeverage(params.leverage, params.symbol);

    const instrument = this.symbolsService.getSymbolOrThrow(params.symbol);

    return this.calculateRequiredMargin({
      volumeLots: params.volumeLots,
      price: params.price,
      contractSize: toNumber(instrument.lotSize) ?? 1,
      leverage: params.leverage,
    });
  }

  getMaxLeverage(symbol?: string): number {
    return symbol
      ? this.brokerSettingsService.getSymbolConfig(symbol).maxLeverage
      : this.maxLeverage;
  }

  getLiquidationThresholds() {
    return {
      marginCallLevel: this.marginCallLevel,
      stopOutLevel: this.stopOutLevel,
    };
  }

  calculateMarginRequirementRatio(leverage: number): number {
    this.assertValidLeverage(leverage);

    return toDecimal(1)
      .div(leverage)
      .mul(100)
      .toDecimalPlaces(8)
      .toNumber();
  }

  calculatePositionPnl(position: Position, quote: PriceSnapshot): number {
    return this.calculatePositionPnlFromValues({
      symbol: position.symbol,
      side: position.side,
      entryPrice: toNumber(position.entryPrice) ?? 0,
      volume: toNumber(position.volume) ?? 0,
      contractSize: toNumber(position.contractSize) ?? 1,
      quote,
    });
  }

  calculatePositionPnlFromValues(params: {
    symbol?: string;
    side: OrderSide;
    entryPrice: number;
    volume: number;
    contractSize?: number;
    quote: PriceSnapshot;
  }): number {
    const entryPrice = toDecimal(params.entryPrice);
    const volume = toDecimal(params.volume);
    const contractSize = toDecimal(
      params.contractSize ??
        (params.symbol ? toNumber(this.symbolsService.getSymbolOrThrow(params.symbol).lotSize) : 1) ??
        1,
    );

    if (params.side === OrderSide.BUY) {
      return toDecimal(params.quote.bid)
        .minus(entryPrice)
        .mul(volume)
        .mul(contractSize)
        .toDecimalPlaces(8)
        .toNumber();
    }

    return entryPrice
      .minus(params.quote.ask)
      .mul(volume)
      .mul(contractSize)
      .toDecimalPlaces(8)
      .toNumber();
  }

  calculateMarginLevel(equity: number, usedMargin: number): number | null {
    if (usedMargin <= 0) {
      return null;
    }

    return toDecimal(equity)
      .div(usedMargin)
      .mul(100)
      .toDecimalPlaces(8)
      .toNumber();
  }

  calculateLiquidationPrice(params: {
    entryPrice: number;
    side: OrderSide;
    volume: number;
    marginUsed: number;
    contractSize?: number;
  }): number {
    const stopOutLoss = toDecimal(params.marginUsed)
      .mul(this.stopOutLevel)
      .div(100);
    const contractSize = Math.max(params.contractSize ?? 1, 0.00000001);
    const priceMove = stopOutLoss.div(toDecimal(params.volume).mul(contractSize));

    if (params.side === OrderSide.BUY) {
      return toDecimal(params.entryPrice)
        .minus(priceMove)
        .toDecimalPlaces(8)
        .toNumber();
    }

    return toDecimal(params.entryPrice)
      .plus(priceMove)
      .toDecimalPlaces(8)
      .toNumber();
  }

  async getAccountMetrics(userId: string, accountId?: string) {
    const account = await this.resolveAccountEntity(userId, accountId);

    const openPositions = await this.prismaService.position.findMany({
      where: {
        accountId: account.id,
        status: PositionStatus.OPEN,
      },
    });

    const pnlValues = await Promise.all(
      openPositions.map(async (position) => {
        const priceSnapshot = await this.pricingService.getLatestQuote(position.symbol);
        return this.calculatePositionPnl(position, priceSnapshot);
      }),
    );

    const unrealizedPnl = pnlValues
      .reduce((sum, pnl) => sum.plus(pnl), zeroDecimal())
      .toDecimalPlaces(8)
      .toNumber();
    const usedMargin = openPositions
      .reduce(
        (sum, position) => sum.plus(position.marginUsed),
        zeroDecimal(),
      )
      .toDecimalPlaces(8)
      .toNumber();
    const balance = toNumber(account.balance) ?? 0;
    const lockedMargin = usedMargin;
    const equity = toDecimal(balance).plus(unrealizedPnl).toDecimalPlaces(8).toNumber();
    const freeMargin = toDecimal(equity).minus(lockedMargin).toDecimalPlaces(8).toNumber();
    const marginLevel = this.calculateMarginLevel(equity, usedMargin);

    return {
      account,
      unrealizedPnl,
      lockedMargin,
      usedMargin,
      balance,
      equity,
      freeMargin,
      marginLevel,
      marginCallLevel: this.marginCallLevel,
      stopOutLevel: this.stopOutLevel,
    };
  }

  async assertOrderCanBeOpened(params: {
    userId: string;
    accountId?: string;
    symbol: string;
    volume: number;
    price: number;
    leverage: number;
  }) {
    this.assertValidLeverage(params.leverage, params.symbol);

    if (params.volume <= 0) {
      throw new BadRequestException('Volume must be greater than zero');
    }

    const metrics = await this.getAccountMetrics(params.userId, params.accountId);
    const requiredMargin = this.calculateRequiredMarginForSymbol({
      symbol: params.symbol,
      volumeLots: params.volume,
      price: params.price,
      leverage: params.leverage,
    });

    if (metrics.freeMargin < requiredMargin) {
      throw new BadRequestException('Insufficient free margin');
    }

    return {
      requiredMargin,
      accountMetrics: metrics,
    };
  }

  private async resolveAccountEntity(userId: string, accountId?: string) {
    if (accountId) {
      const account = await this.prismaService.account.findFirst({
        where: {
          id: accountId,
          userId,
          status: {
            not: AccountStatus.CLOSED,
          },
        },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      return account;
    }

    const account = await this.prismaService.account.findFirst({
      where: {
        userId,
        status: AccountStatus.ACTIVE,
        isDefault: true,
      },
    });

    if (account) {
      return account;
    }

    const fallback = await this.prismaService.account.findFirst({
      where: {
        userId,
        status: {
          not: AccountStatus.CLOSED,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!fallback) {
      throw new NotFoundException('Account not found');
    }

    return fallback;
  }
}
