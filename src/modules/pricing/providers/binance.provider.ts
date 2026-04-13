import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Symbol as TradingSymbol } from '@prisma/client';
import WebSocket = require('ws');

import {
  PricingProviderStatus,
  PricingUpdateHandler,
} from './pricing-provider.types';

@Injectable()
export class BinanceProvider implements OnModuleDestroy {
  private readonly logger = new Logger(BinanceProvider.name);
  private readonly reconnectInitialDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly baseWsUrl: string;
  private readonly internalSymbolByProviderSymbol = new Map<string, string>();
  private socket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private readonly maxReconnectAttempts = 3;
  private reconnectAttempt = 0;
  private firstPriceReceived = false;
  private disabled = false;
  private updateHandler?: PricingUpdateHandler;
  private status: PricingProviderStatus = {
    provider: 'binance',
    transport: 'streaming',
    status: 'disconnected',
    symbolCount: 0,
    lastUpdateAt: null,
    lastError: null,
  };

  constructor(private readonly configService: ConfigService) {
    this.baseWsUrl = this.configService.get<string>('pricing.binanceWsUrl')?.trim()
      ? this.configService.getOrThrow<string>('pricing.binanceWsUrl')
      : 'wss://stream.binance.com:9443/stream';
    this.reconnectInitialDelayMs = this.configService.getOrThrow<number>(
      'pricing.reconnectInitialDelayMs',
    );
    this.reconnectMaxDelayMs = this.configService.getOrThrow<number>(
      'pricing.reconnectMaxDelayMs',
    );
  }

  onModuleDestroy(): void {
    this.stop();
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  start(instruments: TradingSymbol[], onUpdate: PricingUpdateHandler): void {
    this.stop();
    this.disabled = false;
    this.updateHandler = onUpdate;
    this.internalSymbolByProviderSymbol.clear();

    for (const instrument of instruments) {
      if (!instrument.quoteSymbol) {
        continue;
      }

      this.internalSymbolByProviderSymbol.set(
        instrument.quoteSymbol.trim().toUpperCase(),
        instrument.symbol,
      );
    }

    this.status = {
      ...this.status,
      symbolCount: this.internalSymbolByProviderSymbol.size,
      lastError: null,
      status:
        this.internalSymbolByProviderSymbol.size > 0 ? 'connecting' : 'disconnected',
    };

    if (this.internalSymbolByProviderSymbol.size === 0) {
      return;
    }

    this.openSocket();
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = undefined;
    }

    this.status = {
      ...this.status,
      status: this.status.symbolCount > 0 ? 'disconnected' : 'disconnected',
    };
  }

  getStatus() {
    return { ...this.status };
  }

  private openSocket(): void {
    const providerSymbols = Array.from(this.internalSymbolByProviderSymbol.keys()).map((symbol) =>
      symbol.toLowerCase(),
    );

    if (providerSymbols.length === 0) {
      return;
    }

    const streamUrl = `${this.baseWsUrl}?streams=${providerSymbols
      .map((symbol) => `${symbol}@ticker`)
      .join('/')}`;

    this.status = {
      ...this.status,
      status: 'connecting',
    };

    this.logger.log(`Connecting Binance combined stream for ${providerSymbols.length} symbols`);
    this.socket = new WebSocket(streamUrl);

    this.socket.on('open', () => {
      this.reconnectAttempt = 0;
      this.firstPriceReceived = false;
      this.status = {
        ...this.status,
        status: 'connected',
        lastError: null,
      };
      this.logger.log('Binance combined stream connected');

      this.pingTimer = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.ping();
        }
      }, 3 * 60 * 1000);
    });

    this.socket.on('message', (payload: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(payload.toString()) as {
          data?: {
            s?: string;
            c?: string;
            b?: string;
            a?: string;
            E?: number;
          };
        };
        const providerSymbol = parsed.data?.s?.trim().toUpperCase();
        const symbol = providerSymbol
          ? this.internalSymbolByProviderSymbol.get(providerSymbol)
          : undefined;
        const price = Number.parseFloat(String(parsed.data?.c ?? ''));
        const bid = Number.parseFloat(String(parsed.data?.b ?? ''));
        const ask = Number.parseFloat(String(parsed.data?.a ?? ''));

        if (!symbol || !Number.isFinite(price) || price <= 0) {
          return;
        }

        if (!this.firstPriceReceived) {
          this.firstPriceReceived = true;
          this.logger.log(`Binance first price received: ${symbol} @ ${price}`);
        }

        const timestamp =
          typeof parsed.data?.E === 'number'
            ? new Date(parsed.data.E).toISOString()
            : new Date().toISOString();

        this.status = {
          ...this.status,
          status: 'connected',
          lastUpdateAt: timestamp,
          lastError: null,
        };

        void this.updateHandler?.('binance', {
          symbol,
          rawPrice: price,
          bid: Number.isFinite(bid) ? bid : undefined,
          ask: Number.isFinite(ask) ? ask : undefined,
          timestamp,
          marketState: 'LIVE',
        });
      } catch (error) {
        this.logger.warn(`Failed to parse Binance payload: ${(error as Error).message}`);
      }
    });

    this.socket.on('error', (error) => {
      this.status = {
        ...this.status,
        status: 'degraded',
        lastError: error.message,
      };
      this.logger.warn(`Binance stream error: ${error.message}`);
    });

    this.socket.on('close', () => {
      this.socket = undefined;

      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = undefined;
      }

      this.status = {
        ...this.status,
        status: this.status.symbolCount > 0 ? 'disconnected' : 'disconnected',
      };

      if (this.status.symbolCount === 0) {
        return;
      }

      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempt += 1;

    if (this.reconnectAttempt > this.maxReconnectAttempts) {
      this.disabled = true;
      this.status = {
        ...this.status,
        status: 'disconnected',
        lastError: `Disabled after ${this.maxReconnectAttempts} failed connection attempts (geo-blocked or unreachable)`,
      };
      this.logger.warn(
        `Binance stream disabled after ${this.maxReconnectAttempts} failed attempts. Relying on fallback providers.`,
      );
      return;
    }

    const delayMs = Math.min(
      this.reconnectInitialDelayMs * 2 ** (this.reconnectAttempt - 1),
      this.reconnectMaxDelayMs,
    );

    this.logger.warn(
      `Binance stream disconnected (attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts}). Reconnecting in ${delayMs}ms.`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.openSocket();
    }, delayMs);
  }
}
