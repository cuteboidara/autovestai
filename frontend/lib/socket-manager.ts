'use client';

import { io, Socket } from 'socket.io-client';

import { LiveConnectionStatus } from '@/types/market-data';

import { env } from './env';

type EventHandler = (payload: unknown) => void;

class SocketManager {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private priceSubscriptions = new Map<string, number>();
  private candleSubscriptions = new Map<string, number>();
  private connectionStatus: Exclude<LiveConnectionStatus, 'stale'> = 'disconnected';
  private manualDisconnect = false;

  connect(token: string | null) {
    if (this.socket) {
      this.socket.auth = token ? { token: `Bearer ${token}` } : {};
      this.manualDisconnect = false;

      if (!this.socket.connected && !this.socket.active) {
        this.setConnectionStatus('reconnecting');
        this.socket.connect();
      }

      return this.socket;
    }

    this.manualDisconnect = false;
    this.socket = io(`${env.wsUrl}/realtime`, {
      transports: ['websocket'],
      auth: token ? { token: `Bearer ${token}` } : undefined,
      autoConnect: true,
      reconnection: true,
    });
    this.setConnectionStatus('reconnecting');

    for (const event of [
      'connect',
      'disconnect',
      'connect_error',
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
          this.setConnectionStatus('connected');
          this.replaySubscriptions();
        } else if (event === 'disconnect') {
          this.setConnectionStatus(this.manualDisconnect ? 'disconnected' : 'reconnecting');
        } else if (event === 'connect_error') {
          this.setConnectionStatus('reconnecting');
        }

        this.handlers.get(event)?.forEach((handler) => handler(payload));
      });
    }

    return this.socket;
  }

  disconnect() {
    this.manualDisconnect = true;
    this.setConnectionStatus('disconnected');
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
    const normalizedSymbol = this.normalizeSymbol(symbol);
    if (!normalizedSymbol) {
      return;
    }

    const nextCount = (this.priceSubscriptions.get(normalizedSymbol) ?? 0) + 1;
    this.priceSubscriptions.set(normalizedSymbol, nextCount);

    if (nextCount === 1) {
      this.emitWhenConnected('subscribe_price', { symbol: normalizedSymbol });
    }
  }

  unsubscribePrice(symbol: string) {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    if (!normalizedSymbol) {
      return;
    }

    const currentCount = this.priceSubscriptions.get(normalizedSymbol) ?? 0;

    if (currentCount <= 1) {
      this.priceSubscriptions.delete(normalizedSymbol);
      this.emitWhenConnected('unsubscribe_price', { symbol: normalizedSymbol });
      return;
    }

    this.priceSubscriptions.set(normalizedSymbol, currentCount - 1);
  }

  subscribeCandles(symbol: string, resolution: string) {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    if (!normalizedSymbol) {
      return;
    }

    const key = this.buildCandleSubscriptionKey(normalizedSymbol, resolution);
    const nextCount = (this.candleSubscriptions.get(key) ?? 0) + 1;
    this.candleSubscriptions.set(key, nextCount);

    if (nextCount === 1) {
      this.emitWhenConnected('subscribe_candles', {
        symbol: normalizedSymbol,
        resolution,
      });
    }
  }

  unsubscribeCandles(symbol: string, resolution: string) {
    const normalizedSymbol = this.normalizeSymbol(symbol);
    if (!normalizedSymbol) {
      return;
    }

    const key = this.buildCandleSubscriptionKey(normalizedSymbol, resolution);
    const currentCount = this.candleSubscriptions.get(key) ?? 0;

    if (currentCount <= 1) {
      this.candleSubscriptions.delete(key);
      this.emitWhenConnected('unsubscribe_candles', {
        symbol: normalizedSymbol,
        resolution,
      });
      return;
    }

    this.candleSubscriptions.set(key, currentCount - 1);
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  private replaySubscriptions() {
    for (const symbol of this.priceSubscriptions.keys()) {
      this.emit('subscribe_price', { symbol });
    }

    for (const key of this.candleSubscriptions.keys()) {
      const [symbol, resolution] = key.split('::');
      this.emit('subscribe_candles', { symbol, resolution });
    }
  }

  private buildCandleSubscriptionKey(symbol: string, resolution: string) {
    return `${symbol}::${resolution}`;
  }

  private emitWhenConnected(event: string, payload: Record<string, unknown>) {
    if (!this.socket?.connected) {
      return;
    }

    this.emit(event, payload);
  }

  private normalizeSymbol(symbol: string) {
    return symbol.trim().toUpperCase();
  }

  private setConnectionStatus(status: Exclude<LiveConnectionStatus, 'stale'>) {
    this.connectionStatus = status;
    this.handlers.get('connection_state')?.forEach((handler) => handler(status));
  }
}

export const socketManager = new SocketManager();
