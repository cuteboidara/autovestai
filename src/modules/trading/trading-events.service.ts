import { Injectable, Logger } from '@nestjs/common';

import { MarketQuotePayload } from '../market-data/market-quote.presenter';
import { TradingGateway } from './trading.gateway';

@Injectable()
export class TradingEventsService {
  private readonly logger = new Logger(TradingEventsService.name);
  private priceEmissionCount = 0;
  private lastPriceEmissionLogAt = 0;
  private readonly priceEmissionLogWindowMs = 60_000;

  constructor(private readonly tradingGateway: TradingGateway) {}

  broadcastPriceUpdate(snapshot: MarketQuotePayload): void {
    const room = this.tradingGateway.buildPriceRoom(snapshot.symbol);
    const roomClients = this.tradingGateway.getRoomClientCount(room);

    this.tradingGateway.server?.to(room).emit('price_update', snapshot);
    this.recordPriceEmission(snapshot.symbol, roomClients);
  }

  broadcastCandleUpdate(payload: {
    symbol: string;
    resolution: string;
    candle: unknown;
  }): void {
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildCandleRoom(payload.symbol, payload.resolution))
      .emit('candle_update', payload);
  }

  emitWalletUpdate(userId: string, payload: unknown): void {
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildUserRoom(userId))
      .emit('wallet_update', payload);
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildUserRoom(userId))
      .emit('wallet.update', payload);
  }

  emitPositionUpdate(userId: string, payload: unknown): void {
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildUserRoom(userId))
      .emit('position_update', payload);
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildUserRoom(userId))
      .emit('position.update', payload);
  }

  emitOrderUpdate(userId: string, payload: unknown): void {
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildUserRoom(userId))
      .emit('order_update', payload);
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildUserRoom(userId))
      .emit('order.update', payload);
  }

  emitLiquidationEvent(userId: string, payload: unknown): void {
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildUserRoom(userId))
      .emit('liquidation_event', payload);
  }

  emitExposureUpdate(payload: unknown): void {
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildAdminRoom())
      .emit('exposure_update', payload);
  }

  emitHedgeActionCreated(payload: unknown): void {
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildAdminRoom())
      .emit('hedge_action_created', payload);
  }

  private recordPriceEmission(symbol: string, roomClients: number): void {
    this.priceEmissionCount += 1;
    const now = Date.now();

    if (now - this.lastPriceEmissionLogAt < this.priceEmissionLogWindowMs) {
      return;
    }

    this.lastPriceEmissionLogAt = now;
    this.logger.debug(
      `Realtime price emission volume: emitted=${this.priceEmissionCount} latestSymbol=${symbol} latestRoomClients=${roomClients}`,
    );
    this.priceEmissionCount = 0;
  }
}
