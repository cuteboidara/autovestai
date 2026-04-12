import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  OrderSide,
  Position,
  PositionStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { ResponseCacheService } from '../../common/cache/response-cache.service';
import { positionSelect } from '../../common/prisma/selects';
import { PriceSnapshot } from '../../common/interfaces/price-snapshot.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber } from '../../common/utils/decimal';
import {
  serializePosition,
  serializeTradeExecution,
} from '../../common/utils/serializers';
import { AccountsService } from '../accounts/accounts.service';
import { AuditService } from '../audit/audit.service';
import { CopyTradingService } from '../copy-trading/copy-trading.service';
import { DealingDeskService } from '../dealing-desk/dealing-desk.service';
import { PricingService } from '../pricing/pricing.service';
import { RiskService } from '../risk/risk.service';
import { SurveillanceService } from '../surveillance/surveillance.service';
import { TradingEventsService } from '../trading/trading-events.service';
import { ClosePositionDto } from './dto/close-position.dto';
import { PositionListStatus } from './dto/list-positions-query.dto';

type CloseReason =
  | 'MANUAL'
  | 'LIQUIDATION'
  | 'COPY_MASTER_CLOSE'
  | 'DEMO_RESET'
  | 'STOP_LOSS'
  | 'TAKE_PROFIT';

@Injectable()
export class PositionsService {
  private readonly logger = new Logger(PositionsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly pricingService: PricingService,
    private readonly riskService: RiskService,
    private readonly auditService: AuditService,
    private readonly surveillanceService: SurveillanceService,
    private readonly tradingEventsService: TradingEventsService,
    private readonly responseCacheService: ResponseCacheService,
    @Inject(forwardRef(() => AccountsService))
    private readonly accountsService: AccountsService,
    @Inject(forwardRef(() => CopyTradingService))
    private readonly copyTradingService: CopyTradingService,
    private readonly dealingDeskService: DealingDeskService,
  ) {}

  async listUserPositions(
    userId: string,
    accountId?: string,
    status: PositionListStatus = PositionListStatus.OPEN,
  ) {
    const account = await this.accountsService.resolveAccountForUser(userId, accountId);
    const positions = await this.prismaService.position.findMany({
      where: {
        accountId: account.id,
        status:
          status === PositionListStatus.ALL
            ? undefined
            : status === PositionListStatus.CLOSED
              ? PositionStatus.CLOSED
              : PositionStatus.OPEN,
      },
      select: positionSelect,
      orderBy: [{ status: 'asc' }, { openedAt: 'desc' }],
    });

    return Promise.all(
      positions.map(async (position) => {
        if (position.status === PositionStatus.CLOSED) {
          return serializePosition(position, toNumber(position.exitPrice) ?? undefined);
        }

        const quote = await this.pricingService.getLatestQuote(position.symbol);
        const unrealizedPnl = this.riskService.calculatePositionPnl(position, quote);

        return {
          ...serializePosition(position, quote.rawPrice),
          currentBid: quote.bid,
          currentAsk: quote.ask,
          unrealizedPnl,
        };
      }),
    );
  }

  async closePosition(userId: string, dto: ClosePositionDto) {
    const position = await this.prismaService.position.findFirst({
      where: {
        id: dto.positionId,
        userId,
        status: PositionStatus.OPEN,
      },
      select: positionSelect,
    });

    if (!position) {
      throw new NotFoundException('Open position not found');
    }

    return this.closeOpenPosition(position, 'MANUAL');
  }

  async liquidatePosition(positionId: string) {
    const position = await this.prismaService.position.findFirst({
      where: {
        id: positionId,
        status: PositionStatus.OPEN,
      },
      select: positionSelect,
    });

    if (!position) {
      return null;
    }

    return this.closeOpenPosition(position, 'LIQUIDATION');
  }

  async closePositionBySystem(positionId: string, reason: CloseReason = 'COPY_MASTER_CLOSE') {
    const position = await this.prismaService.position.findFirst({
      where: {
        id: positionId,
        status: PositionStatus.OPEN,
      },
      select: positionSelect,
    });

    if (!position) {
      return null;
    }

    return this.closeOpenPosition(position, reason);
  }

  private async closeOpenPosition(position: Position, reason: CloseReason) {
    const quote = await this.pricingService.getLatestQuote(position.symbol);
    const quoteHealth = this.pricingService.getSymbolHealth(position.symbol);

    if (!quoteHealth.healthy) {
      if (reason === 'MANUAL') {
        this.pricingService.assertQuoteHealthy(position.symbol, quote);
      }

      return null;
    }

    const closePrice = this.resolveClosePrice(position.side, quote);

    const result = await this.prismaService.$transaction(async (tx) => {
      const livePosition = await tx.position.findFirst({
        where: {
          id: position.id,
          status: PositionStatus.OPEN,
        },
      });

      if (!livePosition) {
        if (reason === 'LIQUIDATION' || reason === 'COPY_MASTER_CLOSE') {
          return null;
        }

        throw new BadRequestException('Position is already closed');
      }

      const realizedPnl = this.riskService.calculatePositionPnl(livePosition, quote);
      const account = await tx.account.findFirst({
        where: {
          id: livePosition.accountId,
          userId: livePosition.userId,
        },
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      const closedPosition = await tx.position.update({
        where: { id: livePosition.id },
        data: {
          status: PositionStatus.CLOSED,
          exitPrice: toDecimal(closePrice),
          pnl: toDecimal(realizedPnl),
          closedAt: new Date(),
        },
      });

      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: {
            increment: toDecimal(realizedPnl),
          },
        },
      });

      const execution = await tx.tradeExecution.create({
        data: {
          userId: livePosition.userId,
          orderId: livePosition.orderId,
          symbol: livePosition.symbol,
          side: livePosition.side,
          volume: livePosition.volume,
          price: toDecimal(closePrice),
          realizedPnl: toDecimal(realizedPnl),
          metadata: {
            action: 'CLOSE_POSITION',
            trigger: reason,
            positionId: livePosition.id,
            counterparty: 'B_BOOK',
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId: livePosition.userId,
          accountId: livePosition.accountId,
          walletId: null,
          type: TransactionType.TRADE,
          amount: toDecimal(realizedPnl),
          status: TransactionStatus.COMPLETED,
          asset: 'USDT',
          metadata: {
            action: 'CLOSE_POSITION',
            trigger: reason,
            positionId: livePosition.id,
            symbol: livePosition.symbol,
            realizedPnl,
            exitPrice: closePrice,
            counterparty: 'B_BOOK',
          },
        },
      });

      return {
        position: closedPosition,
        execution,
        realizedPnl,
      };
    });

    if (!result) {
      return null;
    }

    this.logger.log(
      `${reason} closed position ${position.id} for ${position.userId} at ${closePrice} with pnl ${result.realizedPnl}`,
    );

    const action =
      reason === 'LIQUIDATION'
        ? 'POSITION_LIQUIDATED'
        : 'POSITION_CLOSED';
    await this.auditService.log({
      actorUserId: reason === 'MANUAL' ? position.userId : null,
      actorRole: reason === 'MANUAL' ? 'user' : 'system',
      action,
      entityType: 'position',
      entityId: position.id,
      targetUserId: position.userId,
      metadataJson: {
        symbol: position.symbol,
        reason,
        closePrice,
        realizedPnl: result.realizedPnl,
      },
    });
    await this.surveillanceService.evaluatePositionClose({
      userId: position.userId,
      positionId: position.id,
      symbol: position.symbol,
      reason,
    });

    const payloadType = reason === 'LIQUIDATION' ? 'liquidated' : 'closed';
    const positionPayload = {
      type: payloadType,
      position: {
        ...serializePosition(result.position, quote.rawPrice),
        currentBid: quote.bid,
        currentAsk: quote.ask,
      },
      execution: serializeTradeExecution(result.execution),
    };

    this.tradingEventsService.emitPositionUpdate(position.userId, positionPayload);

    if (reason === 'LIQUIDATION') {
      this.tradingEventsService.emitLiquidationEvent(position.userId, {
        positionId: result.position.id,
        symbol: result.position.symbol,
        closePrice,
        realizedPnl: result.realizedPnl,
        timestamp: new Date().toISOString(),
      });
    }

    await this.accountsService.syncLegacyWalletSnapshot(position.userId);
    await this.responseCacheService.invalidateUserResources(position.userId, [
      'positions',
      'accounts',
      'transactions',
    ]);
    await Promise.allSettled([
      this.copyTradingService.handlePositionClosed(result.position.id),
      this.dealingDeskService.updateExposureForSymbol(result.position.symbol),
    ]);

    return {
      position: positionPayload.position,
      realizedPnl: result.realizedPnl,
      closePrice,
      liquidated: reason === 'LIQUIDATION',
    };
  }

  private resolveClosePrice(side: OrderSide, quote: PriceSnapshot): number {
    return side === OrderSide.BUY ? quote.bid : quote.ask;
  }
}
