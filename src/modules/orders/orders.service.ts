import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  Order,
  Account,
  AccountType,
  OrderSide,
  OrderSourceType,
  OrderStatus,
  OrderType,
  PositionStatus,
  Prisma,
  Symbol as TradingSymbol,
  SymbolCategory,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderQueueService } from '../../common/queue/order-queue.service';
import { toDecimal, toNumber } from '../../common/utils/decimal';
import {
  serializeOrder,
  serializePosition,
  serializeTradeExecution,
} from '../../common/utils/serializers';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { AccountsService } from '../accounts/accounts.service';
import { AffiliatesService } from '../affiliates/affiliates.service';
import { AuditService } from '../audit/audit.service';
import { CopyTradingService } from '../copy-trading/copy-trading.service';
import { DealingDeskService } from '../dealing-desk/dealing-desk.service';
import { PricingService } from '../pricing/pricing.service';
import { RebatesService } from '../rebates/rebates.service';
import { RiskService } from '../risk/risk.service';
import { SymbolsService } from '../symbols/symbols.service';
import { SurveillanceService } from '../surveillance/surveillance.service';
import { TradingEventsService } from '../trading/trading-events.service';
import { KycService } from '../kyc/kyc.service';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { PlaceOrderDto } from './dto/place-order.dto';

interface ManagedOrderRequest {
  userId: string;
  dto: PlaceOrderDto;
  sourceType?: OrderSourceType;
  metadata?: Prisma.InputJsonObject;
  queueExecution?: boolean;
}

interface ExecutedManagedOrder {
  order: Order;
  position: Prisma.PositionGetPayload<Record<string, never>>;
  execution: Prisma.TradeExecutionGetPayload<Record<string, never>>;
  executionPrice: number;
  quote: {
    rawPrice: number;
    bid: number;
    ask: number;
    markup: number;
  };
  revenue: {
    tradeNotional: number;
    spreadMarkupRevenue: number;
    commissionRevenue: number;
    totalRevenue: number;
  };
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly pricingService: PricingService,
    private readonly riskService: RiskService,
    private readonly orderQueueService: OrderQueueService,
    private readonly tradingEventsService: TradingEventsService,
    @Inject(forwardRef(() => AccountsService))
    private readonly accountsService: AccountsService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly rebatesService: RebatesService,
    private readonly affiliatesService: AffiliatesService,
    private readonly auditService: AuditService,
    private readonly symbolsService: SymbolsService,
    private readonly surveillanceService: SurveillanceService,
    private readonly kycService: KycService,
    @Inject(forwardRef(() => CopyTradingService))
    private readonly copyTradingService: CopyTradingService,
    private readonly dealingDeskService: DealingDeskService,
  ) {}

  async placeOrder(userId: string, dto: PlaceOrderDto) {
    const account = await this.accountsService.resolveAccountForUser(
      userId,
      dto.accountId,
    );
    this.assertAccountTradeable(account);

    if (account.type !== AccountType.DEMO) {
      await this.kycService.assertPlatformAccessApproved(userId);
    }

    return this.executeManagedOrder({
      userId,
      dto,
      sourceType: OrderSourceType.MANUAL,
      queueExecution: true,
    });
  }

  async listOrders(userId: string, query: ListOrdersQueryDto) {
    const account = await this.accountsService.resolveAccountForUser(
      userId,
      query.accountId,
    );
    const orders = await this.prismaService.order.findMany({
      where: {
        userId,
        accountId: account.id,
        status: query.status,
        symbol: query.symbol,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return orders.map(serializeOrder);
  }

  async executeManagedOrder(params: ManagedOrderRequest) {
    const normalizedDto = this.normalizeOrderDto(params.dto);
    const instrument = this.symbolsService.getSymbolOrThrow(normalizedDto.symbol);
    const account = await this.accountsService.resolveAccountForUser(
      params.userId,
      normalizedDto.accountId,
    );
    this.assertAccountTradeable(account);
    const idempotentOrder = await this.findIdempotentOrder(
      params.userId,
      normalizedDto.clientRequestId,
    );

    if (idempotentOrder) {
      this.assertIdempotentOrderMatches(idempotentOrder, normalizedDto, account.id);
      return this.buildExistingManagedOrderResponse(
        idempotentOrder,
        params.queueExecution === false,
      );
    }

    this.assertTradingAllowed(instrument.symbol);
    this.assertInstrumentTradeable(instrument, normalizedDto.type, {
      placement: true,
    });
    this.riskService.assertValidLeverage(normalizedDto.leverage, instrument.symbol);
    this.assertOrderDto(normalizedDto, instrument);
    await this.assertOrderPreflight(
      params.userId,
      account.id,
      normalizedDto,
      instrument,
    );

    let order: Order;

    try {
      order = await this.prismaService.order.create({
        data: {
          userId: params.userId,
          accountId: account.id,
          clientRequestId: normalizedDto.clientRequestId,
          type: normalizedDto.type,
          side: normalizedDto.side,
          symbol: instrument.symbol,
          volume: toDecimal(normalizedDto.volume),
          leverage: normalizedDto.leverage,
          requestedPrice:
            normalizedDto.price !== undefined ? toDecimal(normalizedDto.price) : undefined,
          sourceType: params.sourceType ?? OrderSourceType.MANUAL,
          metadata: this.mergeMetadata(params.metadata ?? null, {
            stopLoss: normalizedDto.stopLoss ?? null,
            takeProfit: normalizedDto.takeProfit ?? null,
          }),
          status: OrderStatus.PENDING,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        normalizedDto.clientRequestId
      ) {
        const existing = await this.findIdempotentOrder(
          params.userId,
          normalizedDto.clientRequestId,
        );

        if (existing) {
          this.assertIdempotentOrderMatches(existing, normalizedDto, account.id);
          return this.buildExistingManagedOrderResponse(
            existing,
            params.queueExecution === false,
          );
        }
      }

      throw error;
    }

    await this.auditService.log({
      actorUserId:
        (params.sourceType ?? OrderSourceType.MANUAL) === OrderSourceType.MANUAL
          ? params.userId
          : null,
      actorRole:
        (params.sourceType ?? OrderSourceType.MANUAL) === OrderSourceType.MANUAL
          ? 'user'
          : 'system',
      action: 'ORDER_PLACED',
      entityType: 'order',
      entityId: order.id,
      targetUserId: params.userId,
      metadataJson: {
        sourceType: order.sourceType,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        volume: toNumber(order.volume),
      },
    });
    await this.surveillanceService.evaluateOrderPlaced({
      userId: params.userId,
      orderId: order.id,
      symbol: order.symbol,
    });

    this.tradingEventsService.emitOrderUpdate(params.userId, serializeOrder(order));

    if (params.queueExecution !== false) {
      await this.orderQueueService.enqueueOrderExecution(order.id);
      return {
        order: serializeOrder(order),
        execution: 'queued',
      };
    }

    const result = await this.processOrderExecution(order.id, {
      rethrowOnFailure: true,
    });

    if (!result) {
      throw new BadRequestException('Order could not be executed immediately');
    }

    return result;
  }

  async executeManagedOrderNow(
    params: Omit<ManagedOrderRequest, 'queueExecution'>,
  ): Promise<ExecutedManagedOrder> {
    const result = await this.executeManagedOrder({
      ...params,
      queueExecution: false,
    });

    if (!('position' in result)) {
      throw new BadRequestException('Expected direct execution result');
    }

    return result;
  }

  async processOrderExecution(
    orderId: string,
    options?: {
      rethrowOnFailure?: boolean;
    },
  ): Promise<ExecutedManagedOrder | null> {
    const claimed = await this.prismaService.order.updateMany({
      where: {
        id: orderId,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.OPEN],
        },
      },
      data: {
        status: OrderStatus.PROCESSING,
      },
    });

    if (claimed.count === 0) {
      return null;
    }

    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    try {
      const instrument = this.symbolsService.getSymbolOrThrow(order.symbol);
      const contractSize = this.getContractSize(instrument);

      this.assertTradingAllowed(order.symbol);
      this.assertInstrumentTradeable(instrument, order.type);
      const marketSnapshot = await this.pricingService.getLatestQuote(order.symbol);

      if (order.type === OrderType.LIMIT && marketSnapshot.marketState === 'CLOSED') {
        const openOrder = await this.prismaService.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.OPEN,
          },
        });

        this.tradingEventsService.emitOrderUpdate(order.userId, serializeOrder(openOrder));
        return null;
      }

      this.pricingService.assertQuoteHealthy(order.symbol, marketSnapshot);
      const executionPrice = this.resolveExecutionPrice(order, marketSnapshot);

      if (executionPrice === null) {
        const openOrder = await this.prismaService.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.OPEN,
          },
        });

        this.tradingEventsService.emitOrderUpdate(order.userId, serializeOrder(openOrder));
        return null;
      }

      const volume = toNumber(order.volume) ?? 0;
      const { requiredMargin } = await this.riskService.assertOrderCanBeOpened({
        userId: order.userId,
        accountId: order.accountId,
        symbol: order.symbol,
        volume,
        price: executionPrice,
        leverage: order.leverage,
      });
      const liquidationPrice = this.riskService.calculateLiquidationPrice({
        entryPrice: executionPrice,
        side: order.side,
        volume,
        marginUsed: requiredMargin,
        contractSize,
      });
      const initialPnl = this.riskService.calculatePositionPnlFromValues({
        symbol: order.symbol,
        side: order.side,
        entryPrice: executionPrice,
        volume,
        contractSize,
        quote: marketSnapshot,
      });
      const spreadMarkupRevenue = toDecimal(contractSize)
        .mul(volume)
        .mul(marketSnapshot.markup)
        .div(2)
        .toDecimalPlaces(8)
        .toNumber();
      const tradeNotional = toDecimal(executionPrice)
        .mul(volume)
        .mul(contractSize)
        .toDecimalPlaces(8)
        .toNumber();
      const revenue = this.rebatesService.calculateBrokerRevenue({
        tradeNotional,
        spreadMarkupRevenue,
        commissionRevenue: 0,
      });

      const result = await this.prismaService.$transaction(async (tx) => {
        const account = await tx.account.findFirst({
          where: {
            id: order.accountId,
            userId: order.userId,
          },
        });

        if (!account) {
          throw new NotFoundException('Account not found');
        }

        const executedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.EXECUTED,
            executionPrice: toDecimal(executionPrice),
            rejectionReason: null,
          },
        });

        const position = await tx.position.create({
          data: {
            userId: order.userId,
            accountId: order.accountId,
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            entryPrice: toDecimal(executionPrice),
            volume: order.volume,
            contractSize: toDecimal(contractSize),
            leverage: order.leverage,
            margin: toDecimal(requiredMargin),
            marginUsed: toDecimal(requiredMargin),
            liquidationPrice: toDecimal(liquidationPrice),
            pnl: toDecimal(initialPnl),
            status: PositionStatus.OPEN,
          },
        });

        const execution = await tx.tradeExecution.create({
          data: {
            userId: order.userId,
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            volume: order.volume,
            price: toDecimal(executionPrice),
            metadata: this.mergeMetadata(order.metadata, {
              action: 'OPEN_POSITION',
              counterparty: 'B_BOOK',
              orderSource: order.sourceType,
              brokerRevenue: revenue.totalRevenue,
              spreadMarkupRevenue: revenue.spreadMarkupRevenue,
            }),
          },
        });

        await tx.transaction.create({
          data: {
            userId: order.userId,
            accountId: order.accountId,
            walletId: null,
            type: TransactionType.TRADE,
            amount: new Prisma.Decimal(0),
            status: TransactionStatus.COMPLETED,
            asset: 'USDT',
            metadata: this.mergeMetadata(order.metadata, {
              action: 'OPEN_POSITION',
              orderId: order.id,
              symbol: order.symbol,
              side: order.side,
              volume,
              contractSize,
              executionPrice,
              margin: requiredMargin,
              liquidationPrice,
              initialPnl,
              counterparty: 'B_BOOK',
              brokerRevenue: revenue.totalRevenue,
              spreadMarkupRevenue: revenue.spreadMarkupRevenue,
            }),
          },
        });

        return {
          order: executedOrder,
          position,
          execution,
        };
      });

      this.logger.log(
        `Executed ${order.type} ${order.side} order ${order.id} for ${order.userId} on ${order.symbol} at ${executionPrice}`,
      );

      await this.auditService.log({
        actorUserId:
          order.sourceType === OrderSourceType.MANUAL ? order.userId : null,
        actorRole:
          order.sourceType === OrderSourceType.MANUAL ? 'user' : 'system',
        action: 'ORDER_EXECUTED',
        entityType: 'order',
        entityId: order.id,
        targetUserId: order.userId,
        metadataJson: {
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          executionPrice,
          volume,
          sourceType: order.sourceType,
        },
      });

      this.tradingEventsService.emitOrderUpdate(order.userId, serializeOrder(result.order));
      this.tradingEventsService.emitPositionUpdate(order.userId, {
        type: 'opened',
        position: serializePosition(
          result.position,
          order.side === OrderSide.BUY ? marketSnapshot.bid : marketSnapshot.ask,
        ),
        execution: serializeTradeExecution(result.execution),
      });
      await this.accountsService.syncLegacyWalletSnapshot(
        order.userId,
        order.accountId,
      );

      await Promise.allSettled([
        this.affiliatesService.processExecutedOrder({
          userId: order.userId,
          orderId: order.id,
          symbol: order.symbol,
          volume,
          tradeNotional,
          spreadMarkupRevenue,
          commissionRevenue: 0,
        }),
        this.copyTradingService.handleExecutedOrder(order.id),
        this.dealingDeskService.updateExposureForSymbol(order.symbol),
      ]);

      return {
        ...result,
        executionPrice,
        quote: marketSnapshot,
        revenue,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Order execution failed unexpectedly';

      const rejectedOrder = await this.prismaService.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REJECTED,
          rejectionReason: message,
        },
      });

      this.logger.warn(`Rejected order ${order.id}: ${message}`);
      await this.auditService.log({
        actorUserId:
          order.sourceType === OrderSourceType.MANUAL ? order.userId : null,
        actorRole:
          order.sourceType === OrderSourceType.MANUAL ? 'user' : 'system',
        action: 'ORDER_REJECTED',
        entityType: 'order',
        entityId: order.id,
        targetUserId: order.userId,
        metadataJson: {
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          reason: message,
          sourceType: order.sourceType,
        },
      });
      await this.surveillanceService.evaluateOrderRejected({
        userId: order.userId,
        orderId: order.id,
        symbol: order.symbol,
        reason: message,
      });
      this.tradingEventsService.emitOrderUpdate(order.userId, serializeOrder(rejectedOrder));

      if (options?.rethrowOnFailure) {
        throw new BadRequestException(message);
      }

      return null;
    }
  }

  async processLimitSweep(symbol: string): Promise<void> {
    const normalized = this.symbolsService.getSymbolOrThrow(symbol).symbol;

    const openOrders = await this.prismaService.order.findMany({
      where: {
        symbol: normalized,
        type: OrderType.LIMIT,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.OPEN],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    for (const order of openOrders) {
      await this.processOrderExecution(order.id);
    }
  }

  private assertOrderDto(dto: PlaceOrderDto, instrument: TradingSymbol) {
    if (dto.type === OrderType.LIMIT && dto.price === undefined) {
      throw new BadRequestException('Limit orders require a price');
    }

    if (dto.type === OrderType.MARKET && dto.price !== undefined) {
      throw new BadRequestException('Market orders must not include a limit price');
    }

    const minTradeSizeLots = toNumber(instrument.minTradeSizeLots) ?? 0;
    const maxTradeSizeLots = toNumber(instrument.maxTradeSizeLots) ?? Number.MAX_SAFE_INTEGER;

    if (dto.volume < minTradeSizeLots || dto.volume > maxTradeSizeLots) {
      throw new BadRequestException(
        `Trade size for ${instrument.symbol} must be between ${minTradeSizeLots} and ${maxTradeSizeLots} lots`,
      );
    }
  }

  private async assertOrderPreflight(
    userId: string,
    accountId: string,
    dto: PlaceOrderDto,
    instrument: TradingSymbol,
  ) {
    const quote = await this.pricingService.getLatestQuote(instrument.symbol);
    this.pricingService.assertQuoteHealthy(instrument.symbol, quote);

    await this.riskService.assertOrderCanBeOpened({
      userId,
      accountId,
      symbol: instrument.symbol,
      volume: dto.volume,
      price:
        dto.type === OrderType.LIMIT
          ? dto.price ?? 0
          : dto.side === OrderSide.BUY
            ? quote.ask
            : quote.bid,
      leverage: dto.leverage,
    });
  }

  private assertTradingAllowed(symbol: string) {
    const normalized = this.symbolsService.getSymbolOrThrow(symbol).symbol;

    if (!this.brokerSettingsService.isTradingEnabled()) {
      throw new BadRequestException('Trading is temporarily disabled');
    }

    const symbolConfig = this.brokerSettingsService.getSymbolConfig(normalized);

    if (!symbolConfig.tradingEnabled) {
      throw new BadRequestException(`Trading is disabled for ${normalized}`);
    }
  }

  private assertAccountTradeable(account: Account) {
    if (account.status !== 'ACTIVE') {
      throw new BadRequestException('The selected account is suspended');
    }
  }

  private async findIdempotentOrder(
    userId: string,
    clientRequestId?: string,
  ): Promise<Order | null> {
    if (!clientRequestId) {
      return null;
    }

    return this.prismaService.order.findFirst({
      where: {
        userId,
        clientRequestId,
      },
    });
  }

  private assertIdempotentOrderMatches(
    order: Order,
    dto: PlaceOrderDto,
    accountId: string,
  ) {
    const sameRequest =
      order.accountId === accountId &&
      order.type === dto.type &&
      order.side === dto.side &&
      order.symbol === this.symbolsService.normalize(dto.symbol) &&
      order.leverage === dto.leverage &&
      (toNumber(order.volume) ?? 0) === dto.volume &&
      (toNumber(order.requestedPrice) ?? null) === (dto.price ?? null);

    if (!sameRequest) {
      throw new BadRequestException(
        'clientRequestId was already used for a different order payload',
      );
    }
  }

  private async buildExistingManagedOrderResponse(
    order: Order,
    directExecution: boolean,
  ): Promise<
    | ExecutedManagedOrder
    | {
        order: ReturnType<typeof serializeOrder>;
        execution: string;
      }
  > {
    if (order.status === OrderStatus.REJECTED) {
      if (directExecution) {
        throw new BadRequestException(order.rejectionReason ?? 'Order was already rejected');
      }

      return {
        order: serializeOrder(order),
        execution: 'duplicate',
      };
    }

    if (order.status === OrderStatus.EXECUTED) {
      const [position, execution] = await Promise.all([
        this.prismaService.position.findUnique({
          where: { orderId: order.id },
        }),
        this.prismaService.tradeExecution.findFirst({
          where: {
            orderId: order.id,
            metadata: {
              path: ['action'],
              equals: 'OPEN_POSITION',
            },
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      if (!position || !execution) {
        throw new BadRequestException(
          'Existing executed order is missing position or execution records',
        );
      }

      const quote = await this.pricingService.getLatestQuote(order.symbol);
      const executionPrice =
        toNumber(order.executionPrice) ?? toNumber(execution.price) ?? 0;
      const volume = toNumber(order.volume) ?? 0;
      const contractSize = toNumber(position.contractSize) ?? 1;
      const tradeNotional = toDecimal(executionPrice)
        .mul(volume)
        .mul(contractSize)
        .toDecimalPlaces(8)
        .toNumber();
      const spreadMarkupRevenue =
        this.extractMetadataNumber(execution.metadata, 'spreadMarkupRevenue') ??
        toDecimal(contractSize)
          .mul(volume)
          .mul(quote.markup)
          .div(2)
          .toDecimalPlaces(8)
          .toNumber();
      const revenue = {
        tradeNotional,
        spreadMarkupRevenue,
        commissionRevenue:
          this.extractMetadataNumber(execution.metadata, 'commissionRevenue') ?? 0,
        totalRevenue:
          this.extractMetadataNumber(execution.metadata, 'brokerRevenue') ??
          this.rebatesService.calculateBrokerRevenue({
            tradeNotional,
            spreadMarkupRevenue,
            commissionRevenue: 0,
          }).totalRevenue,
      };

      return {
        order,
        position,
        execution,
        executionPrice,
        quote,
        revenue,
      };
    }

    if (directExecution) {
      const executed = await this.processOrderExecution(order.id, {
        rethrowOnFailure: true,
      });

      if (executed) {
        return executed;
      }

      throw new BadRequestException('Order is already pending execution');
    }

    return {
      order: serializeOrder(order),
      execution: 'duplicate',
    };
  }

  private resolveExecutionPrice(order: Order, quote: { bid: number; ask: number }): number | null {
    if (order.type === OrderType.MARKET) {
      return order.side === OrderSide.BUY ? quote.ask : quote.bid;
    }

    const requestedPrice = toNumber(order.requestedPrice);

    if (requestedPrice === null) {
      throw new BadRequestException('Limit order missing requested price');
    }

    const isTriggered =
      order.side === OrderSide.BUY
        ? quote.ask <= requestedPrice
        : quote.bid >= requestedPrice;

    if (!isTriggered) {
      return null;
    }

    if (order.side === OrderSide.BUY) {
      return Math.min(requestedPrice, quote.ask);
    }

    return Math.max(requestedPrice, quote.bid);
  }

  private mergeMetadata(
    metadata: Prisma.JsonValue | Prisma.InputJsonValue | null,
    extra: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    const existing =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Prisma.JsonObject)
        : {};

    return {
      ...existing,
      ...extra,
    } as Prisma.InputJsonObject;
  }

  private extractMetadataNumber(
    metadata: Prisma.JsonValue | null,
    key: string,
  ): number | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    const raw = (metadata as Prisma.JsonObject)[key];

    if (typeof raw === 'number') {
      return raw;
    }

    if (typeof raw === 'string') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private normalizeOrderDto(dto: PlaceOrderDto): PlaceOrderDto {
    return {
      ...dto,
      symbol: this.symbolsService.normalize(dto.symbol),
    };
  }

  private assertInstrumentTradeable(
    instrument: TradingSymbol,
    orderType: OrderType,
    options?: {
      placement?: boolean;
    },
  ) {
    if (!instrument.isActive) {
      throw new BadRequestException(`Instrument is inactive: ${instrument.symbol}`);
    }

    if (
      this.requiresMarketHours(instrument) &&
      !this.symbolsService.isMarketOpen(instrument) &&
      (options?.placement || orderType === OrderType.MARKET)
    ) {
      throw new BadRequestException('Market closed for this instrument');
    }
  }

  private requiresMarketHours(instrument: TradingSymbol) {
    return instrument.category !== SymbolCategory.CRYPTO;
  }

  private getContractSize(instrument: TradingSymbol) {
    return toNumber(instrument.lotSize) ?? 1;
  }
}
