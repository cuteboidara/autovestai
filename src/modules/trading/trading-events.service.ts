import { Injectable } from '@nestjs/common';

import { PriceSnapshot } from '../../common/interfaces/price-snapshot.interface';
import { TradingGateway } from './trading.gateway';

@Injectable()
export class TradingEventsService {
  constructor(private readonly tradingGateway: TradingGateway) {}

  broadcastPriceUpdate(snapshot: PriceSnapshot): void {
    this.tradingGateway.server
      ?.to(this.tradingGateway.buildPriceRoom(snapshot.symbol))
      .emit('price_update', snapshot);
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
}
