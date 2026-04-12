'use client';

import { io, Socket } from 'socket.io-client';

import { env } from './env';

type EventHandler = (payload: unknown) => void;

class SocketManager {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private priceSubscriptions = new Set<string>();
  private candleSubscriptions = new Set<string>();

  connect(token: string | null) {
    if (this.socket) {
      this.socket.auth = token ? { token: `Bearer ${token}` } : {};

      if (!this.socket.connected && !this.socket.active) {
        this.socket.connect();
      }

      return this.socket;
    }

    this.socket = io(`${env.wsUrl}/realtime`, {
      transports: ['websocket'],
      auth: token ? { token: `Bearer ${token}` } : undefined,
      autoConnect: true,
      reconnection: true,
    });

    for (const event of [
      'connect',
      'disconnect',
      'price_update',
      'candle_update',
      'order_update',
      'position_update',
      'wallet_update',
      'liquidation_event',
      'exposure_update',
      'hedge_action_created',
    ]) {
      this.socket.on(event, (payload) => {
        if (event === 'connect') {
          this.replaySubscriptions();
        }

        this.handlers.get(event)?.forEach((handler) => handler(payload));
      });
    }

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  getSocket() {
    return this.socket;
  }

  on(event: string, handler: EventHandler) {
    const bucket = this.handlers.get(event) ?? new Set<EventHandler>();
    bucket.add(handler);
    this.handlers.set(event, bucket);

    return () => {
      bucket.delete(handler);
    };
  }

  emit(event: string, payload: Record<string, unknown>) {
    this.socket?.emit(event, payload);
  }

  subscribePrice(symbol: string) {
    this.priceSubscriptions.add(symbol);
    this.emit('subscribe_price', { symbol });
  }

  unsubscribePrice(symbol: string) {
    this.priceSubscriptions.delete(symbol);
    this.emit('unsubscribe_price', { symbol });
  }

  subscribeCandles(symbol: string, resolution: string) {
    this.candleSubscriptions.add(this.buildCandleSubscriptionKey(symbol, resolution));
    this.emit('subscribe_candles', { symbol, resolution });
  }

  unsubscribeCandles(symbol: string, resolution: string) {
    this.candleSubscriptions.delete(this.buildCandleSubscriptionKey(symbol, resolution));
    this.emit('unsubscribe_candles', { symbol, resolution });
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }

  private replaySubscriptions() {
    for (const symbol of this.priceSubscriptions) {
      this.emit('subscribe_price', { symbol });
    }

    for (const key of this.candleSubscriptions) {
      const [symbol, resolution] = key.split('::');
      this.emit('subscribe_candles', { symbol, resolution });
    }
  }

  private buildCandleSubscriptionKey(symbol: string, resolution: string) {
    return `${symbol}::${resolution}`;
  }
}

export const socketManager = new SocketManager();
