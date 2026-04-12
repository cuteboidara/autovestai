import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
  AccountStatus,
  Position,
  PositionStatus,
  SignalProvider,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { roundTo, toDecimal, toNumber } from '../../common/utils/decimal';
import { AccountsService } from '../accounts/accounts.service';
import { PlaceOrderDto } from '../orders/dto/place-order.dto';
import { OrdersService } from '../orders/orders.service';
import { PositionsService } from '../positions/positions.service';
import { PricingService } from '../pricing/pricing.service';
import { SymbolsService } from '../symbols/symbols.service';

@Injectable()
export class CopyExecutionService {
  private readonly logger = new Logger(CopyExecutionService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => AccountsService))
    private readonly accountsService: AccountsService,
    private readonly pricingService: PricingService,
    private readonly symbolsService: SymbolsService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => PositionsService))
    private readonly positionsService: PositionsService,
  ) {}

  async onProviderTrade(
    provider: SignalProvider,
    providerTrade: Position,
  ): Promise<void> {
    const providerMetrics = await this.accountsService.getAccountMetrics(provider.accountId);
    const providerBalance = providerMetrics.balance;

    if (providerBalance <= 0) {
      return;
    }

    const relations = await this.prismaService.copyRelation.findMany({
      where: {
        providerId: provider.id,
        status: 'ACTIVE',
      },
      include: {
        copyAccount: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    for (const relation of relations) {
      try {
        await this.openMirroredTrade({
          provider,
          relation,
          providerTrade,
          providerBalance,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to mirror position ${providerTrade.id} to relation ${relation.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async onProviderClose(
    provider: SignalProvider,
    providerTrade: Position,
  ): Promise<void> {
    const mirroredPositions = await this.prismaService.position.findMany({
      where: {
        copiedFromTradeId: providerTrade.id,
        status: PositionStatus.OPEN,
      },
      orderBy: { openedAt: 'asc' },
    });

    for (const mirroredPosition of mirroredPositions) {
      try {
        const closeResult = await this.positionsService.closePositionBySystem(
          mirroredPosition.id,
          'COPY_MASTER_CLOSE',
        );

        if (!closeResult) {
          continue;
        }

        await this.settleCopyClose({
          provider,
          providerTrade,
          mirroredPosition,
          realizedPnl: closeResult.realizedPnl,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to close mirrored position ${mirroredPosition.id} for provider trade ${providerTrade.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async openMirroredTrade(params: {
    provider: SignalProvider;
    relation: Awaited<ReturnType<PrismaService['copyRelation']['findMany']>>[number] & {
      copyAccount: Awaited<ReturnType<PrismaService['account']['findUnique']>>;
    };
    providerTrade: Position;
    providerBalance: number;
  }) {
    const { provider, relation, providerTrade, providerBalance } = params;

    if (!relation.copyAccount || relation.copyAccount.status !== AccountStatus.ACTIVE) {
      return;
    }

    if (relation.copyAccount.userId !== relation.copierId) {
      return;
    }

    const instrument = this.symbolsService.getSymbolOrThrow(providerTrade.symbol);
    const minTradeSizeLots = toNumber(instrument.minTradeSizeLots) ?? 0;
    const maxTradeSizeLots = toNumber(instrument.maxTradeSizeLots) ?? Number.MAX_SAFE_INTEGER;
    const providerLots = toNumber(providerTrade.volume) ?? 0;
    const allocatedAmount = toNumber(relation.allocatedAmount) ?? 0;
    const copyRatio = toNumber(relation.copyRatio) ?? 1;
    const copiedLots = roundTo(
      providerLots * copyRatio * (allocatedAmount / providerBalance),
      8,
    );

    if (copiedLots < minTradeSizeLots) {
      return;
    }

    const mirroredLots = Math.min(copiedLots, maxTradeSizeLots);
    const quote = await this.pricingService.getLatestQuote(providerTrade.symbol);
    this.pricingService.assertQuoteHealthy(providerTrade.symbol, quote);
    const currentExposure = await this.getCurrentRelationExposure(
      provider,
      relation.id,
      relation.copyAccountId,
    );
    const indicativePrice = providerTrade.side === 'BUY' ? quote.ask : quote.bid;
    const requiredMargin = this.accountsService
      .getAccountMetrics(relation.copyAccountId)
      .then(() =>
        this.ordersService.executeManagedOrderNow({
          userId: relation.copierId,
          dto: {
            accountId: relation.copyAccountId,
            clientRequestId: `copy:${providerTrade.id}:${relation.id}`,
            type: 'MARKET',
            side: providerTrade.side,
            symbol: providerTrade.symbol,
            volume: mirroredLots,
            leverage: providerTrade.leverage,
          } as PlaceOrderDto,
          sourceType: 'COPY',
          metadata: {
            providerId: provider.id,
            providerTradeId: providerTrade.id,
            copyRelationId: relation.id,
            indicativePrice,
          },
        }),
      );

    const estimatedMargin = await this.calculateRequiredMargin({
      symbol: providerTrade.symbol,
      volumeLots: mirroredLots,
      price: indicativePrice,
      leverage: providerTrade.leverage,
    });

    if (currentExposure + estimatedMargin > allocatedAmount) {
      return;
    }

    const result = await requiredMargin;

    await this.prismaService.position.updateMany({
      where: {
        id: result.position.id,
      },
      data: {
        copiedFromTradeId: providerTrade.id,
      },
    });
  }

  private async settleCopyClose(params: {
    provider: SignalProvider;
    providerTrade: Position;
    mirroredPosition: Position;
    realizedPnl: number;
  }) {
    const { provider, providerTrade, mirroredPosition, realizedPnl } = params;
    const relation = await this.prismaService.copyRelation.findFirst({
      where: {
        providerId: provider.id,
        copierId: mirroredPosition.userId,
        copyAccountId: mirroredPosition.accountId,
      },
    });

    if (!relation) {
      return;
    }

    const feePercent = toNumber(provider.feePercent) ?? 0;
    const fee =
      realizedPnl > 0
        ? roundTo((realizedPnl * feePercent) / 100, 8)
        : 0;

    await this.prismaService.$transaction(async (tx) => {
      await tx.copyRelation.update({
        where: { id: relation.id },
        data: {
          totalCopiedPnl: {
            increment: toDecimal(realizedPnl),
          },
          feesPaid: {
            increment: toDecimal(fee),
          },
        },
      });

      if (fee <= 0) {
        return;
      }

      await tx.account.update({
        where: { id: relation.copyAccountId },
        data: {
          balance: {
            decrement: toDecimal(fee),
          },
        },
      });

      await tx.account.update({
        where: { id: provider.accountId },
        data: {
          balance: {
            increment: toDecimal(fee),
          },
        },
      });

      const metadata = {
        action: 'COPY_TRADING_FEE',
        providerId: provider.id,
        providerTradeId: providerTrade.id,
        mirroredPositionId: mirroredPosition.id,
        copyRelationId: relation.id,
        realizedPnl,
        feePercent,
      };

      await tx.transaction.create({
        data: {
          userId: relation.copierId,
          accountId: relation.copyAccountId,
          walletId: null,
          type: TransactionType.TRADE,
          amount: toDecimal(-fee),
          status: TransactionStatus.COMPLETED,
          asset: 'USDT',
          metadata: {
            ...metadata,
            direction: 'DEBIT',
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId: provider.userId,
          accountId: provider.accountId,
          walletId: null,
          type: TransactionType.TRADE,
          amount: toDecimal(fee),
          status: TransactionStatus.COMPLETED,
          asset: 'USDT',
          metadata: {
            ...metadata,
            direction: 'CREDIT',
          },
        },
      });
    });

    await Promise.allSettled([
      this.accountsService.syncLegacyWalletSnapshot(relation.copierId, relation.copyAccountId),
      this.accountsService.syncLegacyWalletSnapshot(provider.userId, provider.accountId),
    ]);
  }

  private async getCurrentRelationExposure(
    provider: SignalProvider,
    copyRelationId: string,
    copyAccountId: string,
  ): Promise<number> {
    const positions = await this.prismaService.position.findMany({
      where: {
        accountId: copyAccountId,
        status: PositionStatus.OPEN,
        copiedFromTrade: {
          is: {
            userId: provider.userId,
            accountId: provider.accountId,
          },
        },
        order: {
          metadata: {
            path: ['copyRelationId'],
            equals: copyRelationId,
          },
        },
      },
      orderBy: { openedAt: 'asc' },
    });

    return positions.reduce((sum, position) => sum + (toNumber(position.marginUsed) ?? 0), 0);
  }

  private async calculateRequiredMargin(params: {
    symbol: string;
    volumeLots: number;
    price: number;
    leverage: number;
  }): Promise<number> {
    const instrument = this.symbolsService.getSymbolOrThrow(params.symbol);
    const contractSize = toNumber(instrument.lotSize) ?? 1;

    return roundTo(
      (params.volumeLots * params.price * contractSize) / params.leverage,
      8,
    );
  }
}
