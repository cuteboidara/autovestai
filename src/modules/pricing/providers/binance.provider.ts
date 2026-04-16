import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Symbol as TradingSymbol } from '@prisma/client';
import WebSocket = require('ws');

import {
  PricingProviderStatus,
  PricingUpdateHandler,
} from './pricing-provider.types';
import {
  applyStaleProviderStatus,
  createProviderStatus,
  disabledProviderStatus,
  okProviderStatus,
  providerStatusWithFailure,
} from './provider-health.util';

@Injectable()
export class BinanceProvider implements OnModuleDestroy {
  private readonly logger = new Logger(BinanceProvider.name);
  private readonly reconnectInitialDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly providerEnabled: boolean;
  private readonly baseWsUrl: string;
  private readonly staleAfterMs = 120_000;
  private readonly circuitOpenMs = 30 * 60_000;
  private readonly internalSymbolByProviderSymbol = new Map<string, string>();
  private socket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private pingTimer?: NodeJS.Timeout;
  private readonly maxReconnectAttempts = 3;
  private reconnectAttempt = 0;
  private firstPriceReceived = false;
  private circuitOpenUntilMs = 0;
  private lastConnectionError: unknown = null;
  private updateHandler?: PricingUpdateHandler;
  private status: PricingProviderStatus = createProviderStatus('binance', 'streaming');

  constructor(private readonly configService: ConfigService) {
    this.providerEnabled =
      this.configService.get<boolean>('pricing.binanceEnabled') ?? true;
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
    return !this.providerEnabled;
  }

  start(instruments: TradingSymbol[], onUpdate: PricingUpdateHandler): void {
    this.stop();
    this.updateHandler = onUpdate;
    this.reconnectAttempt = 0;
    this.circuitOpenUntilMs = 0;
    this.lastConnectionError = null;
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
      status: 'DEGRADED',
      reason: 'awaiting_first_update',
      message:
        this.internalSymbolByProviderSymbol.size > 0
          ? 'Awaiting the first successful Binance tick.'
          : 'No active Binance symbols are configured.',
      retryAt: null,
      recommendedAction: null,
      consecutiveFailures: 0,
    };

    if (!this.providerEnabled) {
      this.status = disabledProviderStatus(
        this.status,
        'disabled_by_config',
        'Binance is disabled by configuration.',
        'Set BINANCE_PROVIDER_ENABLED=true only in environments where Binance connectivity is expected to work.',
      );
      return;
    }

    if (this.internalSymbolByProviderSymbol.size === 0) {
      this.status = disabledProviderStatus(
        this.status,
        'no_symbols_configured',
        'No active Binance symbols are configured.',
        null,
      );
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
  }

  getStatus() {
    return applyStaleProviderStatus({ ...this.status }, this.staleAfterMs);
  }

  private openSocket(): void {
    if (Date.now() < this.circuitOpenUntilMs) {
      return;
    }

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
      status: 'DEGRADED',
      reason: this.status.lastUpdateAt ? 'stale_quotes' : 'awaiting_first_update',
      message: this.status.lastUpdateAt
        ? 'Binance reconnect in progress.'
        : 'Connecting to Binance stream.',
      retryAt: null,
      recommendedAction: null,
    };

    this.logger.log(`Connecting Binance combined stream for ${providerSymbols.length} symbols`);
    this.socket = new WebSocket(streamUrl);

    this.socket.on('open', () => {
      this.reconnectAttempt = 0;
      this.firstPriceReceived = false;
      this.lastConnectionError = null;
      this.status = {
        ...this.status,
        status: 'DEGRADED',
        reason: this.status.lastUpdateAt ? 'stale_quotes' : 'awaiting_first_update',
        message: this.status.lastUpdateAt
          ? 'Binance stream reconnected; awaiting a fresh tick.'
          : 'Binance stream connected; awaiting the first tick.',
        retryAt: null,
        recommendedAction: null,
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

        this.status = okProviderStatus(this.status, timestamp);

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
      this.lastConnectionError = error;
      this.logger.warn(`Binance stream error: ${error.message}`);
    });

    this.socket.on('close', () => {
      this.socket = undefined;

      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = undefined;
      }

      if (this.status.symbolCount === 0 || !this.providerEnabled) {
        return;
      }

      this.scheduleReconnect(
        this.lastConnectionError ?? new Error('Binance WebSocket closed before a quote was received'),
      );
    });
  }

  private scheduleReconnect(error: unknown): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempt += 1;

    if (this.reconnectAttempt > this.maxReconnectAttempts) {
      this.circuitOpenUntilMs = Date.now() + this.circuitOpenMs;
      this.status = providerStatusWithFailure(
        this.status,
        'Binance',
        error,
        this.circuitOpenUntilMs,
      );
      this.logger.warn(
        `Binance stream circuit opened after ${this.maxReconnectAttempts} failed attempts. Retrying after ${this.circuitOpenMs}ms.`,
      );
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempt = 0;
        this.circuitOpenUntilMs = 0;
        this.openSocket();
      }, this.circuitOpenMs);
      return;
    }

    const delayMs = Math.min(
      this.reconnectInitialDelayMs * 2 ** (this.reconnectAttempt - 1),
      this.reconnectMaxDelayMs,
    );
    this.status = providerStatusWithFailure(
      this.status,
      'Binance',
      error,
      Date.now() + delayMs,
    );

    this.logger.warn(
      `Binance stream disconnected (attempt ${this.reconnectAttempt}/${this.maxReconnectAttempts}). Reconnecting in ${delayMs}ms.`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.openSocket();
    }, delayMs);
  }
}
