import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Account, Position, PositionStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber, zeroDecimal } from '../../common/utils/decimal';
import {
  serializeAccountAsWallet,
  serializePosition,
  serializeTransaction,
} from '../../common/utils/serializers';
import { AuditService } from '../audit/audit.service';
import { PricingService } from '../pricing/pricing.service';
import { RiskService } from '../risk/risk.service';
import { TradingEventsService } from '../trading/trading-events.service';
import { PositionsService } from './positions.service';

interface MarkedPosition {
  position: OpenPositionWithOrder;
  pnl: number;
  currentBid: number;
  currentAsk: number;
  currentPrice: number;
}

type OpenPositionWithOrder = Position & {
  order: {
    metadata: Prisma.JsonValue | null;
  };
};

@Injectable()
export class PnlEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PnlEngineService.name);
  private readonly intervalMs = 1000;
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly pricingService: PricingService,
    private readonly riskService: RiskService,
    private readonly positionsService: PositionsService,
    private readonly auditService: AuditService,
    private readonly tradingEventsService: TradingEventsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processLoop();
    }, this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async processLoop(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const positions = await this.prismaService.position.findMany({
        where: { status: PositionStatus.OPEN },
        include: {
          order: {
            select: {
              metadata: true,
            },
          },
        },
        orderBy: { openedAt: 'asc' },
      });

      if (positions.length === 0) {
        return;
      }

      const symbolQuotes = new Map(
        await Promise.all(
          Array.from(new Set(positions.map((position) => position.symbol))).map(
            async (symbol) => [symbol, await this.pricingService.getLatestQuote(symbol)] as const,
          ),
        ),
      );
      const symbolHealth = new Map(
        Array.from(symbolQuotes.keys()).map((symbol) => [
          symbol,
          this.pricingService.getSymbolHealth(symbol),
        ]),
      );

      const markedPositions = await Promise.all(
        positions.map(async (position) => {
          const quote = symbolQuotes.get(position.symbol);
          const health = symbolHealth.get(position.symbol);

          if (!quote || !health?.healthy) {
            return null;
          }

          const protectiveTrigger = this.resolveProtectiveTrigger(position, quote);

          if (protectiveTrigger) {
            await this.positionsService.closePositionBySystem(
              position.id,
              protectiveTrigger,
            );
            return null;
          }

          const pnl = this.riskService.calculatePositionPnl(position, quote);
          const persistedPnl = toNumber(position.pnl) ?? 0;

          if (persistedPnl !== pnl) {
            await this.prismaService.position.update({
              where: { id: position.id },
              data: {
                pnl: toDecimal(pnl),
              },
            });
          }

          return {
            position,
            pnl,
            currentBid: quote.bid,
            currentAsk: quote.ask,
            currentPrice: quote.rawPrice,
          } satisfies MarkedPosition;
        }),
      );

      const activeMarkedPositions = markedPositions.filter(
        (value): value is MarkedPosition => value !== null,
      );

      const accountMap = await this.loadAccountMap(
        Array.from(new Set(activeMarkedPositions.map((item) => item.position.accountId))),
      );

      const byAccount = new Map<string, MarkedPosition[]>();

      for (const marked of activeMarkedPositions) {
        const bucket = byAccount.get(marked.position.accountId) ?? [];
        bucket.push(marked);
        byAccount.set(marked.position.accountId, bucket);
      }

      for (const [accountId, userPositions] of byAccount) {
        const account = accountMap.get(accountId);

        if (!account) {
          continue;
        }

        const unrealizedPnl = userPositions
          .reduce((sum, item) => sum.plus(item.pnl), zeroDecimal())
          .toDecimalPlaces(8)
          .toNumber();
        const usedMargin = userPositions
          .reduce((sum, item) => sum.plus(item.position.marginUsed), zeroDecimal())
          .toDecimalPlaces(8)
          .toNumber();
        const balance = toNumber(account.balance) ?? 0;
        const equity = toDecimal(balance).plus(unrealizedPnl).toDecimalPlaces(8).toNumber();
        const freeMargin = toDecimal(equity).minus(usedMargin).toDecimalPlaces(8).toNumber();
        const marginLevel = this.riskService.calculateMarginLevel(equity, usedMargin);

        if ((toNumber(account.equity) ?? 0) !== equity) {
          await this.prismaService.account.update({
            where: { id: account.id },
            data: {
              equity: toDecimal(equity),
            },
          });
        }

        this.tradingEventsService.emitPositionUpdate(account.userId, {
          type: 'mark_to_market',
          accountId: account.id,
          positions: userPositions.map((item) => ({
            ...serializePosition(item.position, item.currentPrice),
            pnl: item.pnl,
            currentBid: item.currentBid,
            currentAsk: item.currentAsk,
            unrealizedPnl: item.pnl,
          })),
          account: {
            id: account.id,
            type: account.type,
            accountNo: account.accountNo,
            balance,
            equity,
            usedMargin,
            freeMargin,
            marginLevel,
            marginCall: marginLevel !== null && marginLevel <= 100,
            stopOut: marginLevel !== null && marginLevel <= 50,
          },
        });

        if (account.isDefault) {
          const transactions = await this.prismaService.transaction.findMany({
            where: {
              userId: account.userId,
              accountId: account.id,
            },
            orderBy: { createdAt: 'desc' },
            take: 25,
          });

          this.tradingEventsService.emitWalletUpdate(account.userId, {
            wallet: serializeAccountAsWallet(account, {
              unrealizedPnl,
              equity,
              freeMargin,
              usedMargin,
              marginLevel,
            }),
            // FIX: Preserve recent activity in the wallet store during mark-to-market
            // websocket updates instead of replacing it with an empty array.
            transactions: transactions.map(serializeTransaction),
            activeAccountId: account.id,
          });
        }

        await this.handleLiquidationIfNeeded(account.userId, account, userPositions, {
          equity,
          usedMargin,
          marginLevel,
        });
      }
    } catch (error) {
      this.logger.error(`PnL engine loop failed: ${(error as Error).message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private async handleLiquidationIfNeeded(
    userId: string,
    account: Account,
    userPositions: MarkedPosition[],
    metrics: {
      equity: number;
      usedMargin: number;
      marginLevel: number | null;
    },
  ): Promise<void> {
    if (metrics.marginLevel === null || metrics.marginLevel > 50) {
      return;
    }

    this.logger.warn(
      `Stop out triggered for ${userId} at margin level ${metrics.marginLevel.toFixed(4)}`,
    );

    const liquidationQueue = [...userPositions].sort((left, right) => left.pnl - right.pnl);
    let currentUsedMargin = metrics.usedMargin;
    let currentBalance = toNumber(account.balance) ?? 0;
    let remainingPnl = userPositions
      .reduce((sum, item) => sum.plus(item.pnl), zeroDecimal())
      .toDecimalPlaces(8)
      .toNumber();
    let marginLevel: number | null = metrics.marginLevel;

    while (liquidationQueue.length > 0 && marginLevel !== null && marginLevel <= 50) {
      const candidate = liquidationQueue.shift();

      if (!candidate) {
        break;
      }

      const liquidationResult = await this.positionsService.liquidatePosition(
        candidate.position.id,
      );

      if (!liquidationResult) {
        this.logger.warn(
          `Liquidation retry required for ${candidate.position.id} (${candidate.position.symbol})`,
        );
        this.tradingEventsService.emitLiquidationEvent(userId, {
          positionId: candidate.position.id,
          symbol: candidate.position.symbol,
          status: 'retry_required',
          reason: 'liquidation_failed',
          timestamp: new Date().toISOString(),
        });
        await this.auditService
          .log({
            actorRole: 'system',
            action: 'POSITION_LIQUIDATION_RETRY_REQUIRED',
            entityType: 'position',
            entityId: candidate.position.id,
            targetUserId: userId,
            metadataJson: {
              symbol: candidate.position.symbol,
              marginLevel,
              reason: 'liquidation_failed',
            },
          })
          .catch((error) => {
            this.logger.warn(
              `Failed to record liquidation retry for ${candidate.position.id}: ${
                (error as Error).message
              }`,
            );
          });
        continue;
      }

      currentUsedMargin = toDecimal(currentUsedMargin)
        .minus(candidate.position.marginUsed)
        .toDecimalPlaces(8)
        .toNumber();
      currentBalance = toDecimal(currentBalance)
        .plus(liquidationResult.realizedPnl)
        .toDecimalPlaces(8)
        .toNumber();
      remainingPnl = toDecimal(remainingPnl)
        .minus(candidate.pnl)
        .toDecimalPlaces(8)
        .toNumber();

      const equity = toDecimal(currentBalance)
        .plus(remainingPnl)
        .toDecimalPlaces(8)
        .toNumber();
      marginLevel = this.riskService.calculateMarginLevel(equity, currentUsedMargin);
    }
  }

  private async loadAccountMap(accountIds: string[]): Promise<Map<string, Account>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    const accounts = await this.prismaService.account.findMany({
      where: {
        id: {
          in: accountIds,
        },
      },
    });

    return new Map(accounts.map((account) => [account.id, account]));
  }

  private resolveProtectiveTrigger(
    position: OpenPositionWithOrder,
    quote: {
      bid: number;
      ask: number;
    },
  ): 'STOP_LOSS' | 'TAKE_PROFIT' | null {
    const metadata =
      position.order.metadata &&
      typeof position.order.metadata === 'object' &&
      !Array.isArray(position.order.metadata)
        ? (position.order.metadata as Record<string, unknown>)
        : {};
    const stopLoss = this.parseMetadataNumber(metadata.stopLoss);
    const takeProfit = this.parseMetadataNumber(metadata.takeProfit);
    const bid = quote.bid;
    const ask = quote.ask;

    if (position.side === 'BUY') {
      if (stopLoss !== null && bid <= stopLoss) {
        return 'STOP_LOSS';
      }

      if (takeProfit !== null && bid >= takeProfit) {
        return 'TAKE_PROFIT';
      }

      return null;
    }

    if (stopLoss !== null && ask >= stopLoss) {
      return 'STOP_LOSS';
    }

    if (takeProfit !== null && ask <= takeProfit) {
      return 'TAKE_PROFIT';
    }

    return null;
  }

  private parseMetadataNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}
