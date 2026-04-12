import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Symbol as TradingSymbol, SymbolCategory } from '@prisma/client';
import WebSocket = require('ws');

export interface TwelveDataQuoteTick {
  symbol: string;
  rawPrice: number;
  timestamp: string;
  providerSymbol: string;
}

type TickHandler = (tick: TwelveDataQuoteTick) => Promise<void> | void;

const TWELVE_DATA_SYMBOL_OVERRIDES: Record<string, string> = {
  'BRNT-CASH': 'BZ1!',
  'CAC-CASH': 'CAC40',
  'CL-CASH': 'CL1!',
  'DAX-CASH': 'DAX',
  'DOW-CASH': 'DJI',
  'FTSE-CASH': 'FTSE',
  'NGAS-CASH': 'NG1!',
  'NK-CASH': 'NI225',
  'NSDQ-CASH': 'NDX',
  'RTY-CASH': 'RUT',
  'SP-CASH': 'SPX',
  XAGUSD: 'XAG/USD',
  XAUUSD: 'XAU/USD',
  XPDUSD: 'XPD/USD',
  XPTUSD: 'XPT/USD',
};

function normalizeProviderSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

@Injectable()
export class TwelveDataAdapter implements OnModuleDestroy {
  private readonly logger = new Logger(TwelveDataAdapter.name);
  private readonly baseUrl = 'wss://ws.twelvedata.com/v1/quotes/price';
  private readonly apiKey: string;
  private readonly configuredRealtimeSymbols: Set<string>;
  private readonly reconnectInitialDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly providerSymbolsByInternalSymbol = new Map<string, string>();
  private readonly internalSymbolsByProviderSymbol = new Map<string, string>();
  private socket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempt = 0;
  private tickHandler?: TickHandler;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('pricing.twelveDataApiKey')?.trim() ?? '';
    this.configuredRealtimeSymbols = new Set(
      (this.configService.get<string[]>('pricing.twelveDataWsSymbols') ?? []).map(
        normalizeProviderSymbol,
      ),
    );
    this.reconnectInitialDelayMs = this.configService.getOrThrow<number>(
      'pricing.reconnectInitialDelayMs',
    );
    this.reconnectMaxDelayMs = this.configService.getOrThrow<number>(
      'pricing.reconnectMaxDelayMs',
    );
  }

  onModuleDestroy(): void {
    this.close();
  }

  isEnabled() {
    return Boolean(this.apiKey);
  }

  supportsInstrument(
    instrument: Pick<TradingSymbol, 'symbol' | 'category' | 'quoteSymbol'>,
  ): boolean {
    return this.getProviderSymbol(instrument) !== null;
  }

  isRealtimeInstrument(
    instrument: Pick<TradingSymbol, 'symbol' | 'category' | 'quoteSymbol'>,
  ): boolean {
    const providerSymbol = this.getProviderSymbol(instrument);

    return Boolean(
      this.apiKey &&
        providerSymbol &&
        this.configuredRealtimeSymbols.has(normalizeProviderSymbol(providerSymbol)),
    );
  }

  selectRealtimeInstruments(instruments: TradingSymbol[]) {
    return instruments.filter((instrument) => this.isRealtimeInstrument(instrument));
  }

  connect(instruments: TradingSymbol[], tickHandler: TickHandler): void {
    this.tickHandler = tickHandler;
    this.providerSymbolsByInternalSymbol.clear();
    this.internalSymbolsByProviderSymbol.clear();

    const realtimeInstruments = this.selectRealtimeInstruments(instruments);

    for (const instrument of realtimeInstruments) {
      const providerSymbol = this.getProviderSymbol(instrument);

      if (!providerSymbol) {
        continue;
      }

      this.providerSymbolsByInternalSymbol.set(instrument.symbol, providerSymbol);
      this.internalSymbolsByProviderSymbol.set(
        normalizeProviderSymbol(providerSymbol),
        instrument.symbol,
      );
    }

    if (!this.apiKey) {
      this.logger.log(
        'TWELVE_DATA_API_KEY not configured, using polling fallback for non-crypto prices',
      );
      return;
    }

    if (this.providerSymbolsByInternalSymbol.size === 0) {
      this.logger.log(
        'No Twelve Data realtime symbols configured, using polling fallback for non-crypto prices',
      );
      return;
    }

    this.openSocket();
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = undefined;
    }
  }

  getProviderSymbol(
    instrument: Pick<TradingSymbol, 'symbol' | 'category' | 'quoteSymbol'>,
  ): string | null {
    if (TWELVE_DATA_SYMBOL_OVERRIDES[instrument.symbol]) {
      return TWELVE_DATA_SYMBOL_OVERRIDES[instrument.symbol];
    }

    if (
      (instrument.category === SymbolCategory.FOREX ||
        instrument.category === SymbolCategory.METALS) &&
      /^[A-Z]{6}$/.test(instrument.symbol)
    ) {
      return `${instrument.symbol.slice(0, 3)}/${instrument.symbol.slice(3, 6)}`;
    }

    if (
      instrument.category === SymbolCategory.STOCKS ||
      instrument.category === SymbolCategory.ETFS
    ) {
      const candidate = (instrument.quoteSymbol ?? instrument.symbol).trim().toUpperCase();
      return /^[A-Z0-9.]+$/.test(candidate) ? candidate : null;
    }

    return null;
  }

  private openSocket(): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const wsUrl = `${this.baseUrl}?apikey=${encodeURIComponent(this.apiKey)}`;
    this.logger.log(
      `Connecting Twelve Data WebSocket for ${this.providerSymbolsByInternalSymbol.size} symbols`,
    );
    this.socket = new WebSocket(wsUrl);

    this.socket.on('open', () => {
      this.reconnectAttempt = 0;
      this.logger.log('Twelve Data WebSocket connected');
      this.sendSubscription();
    });

    this.socket.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(data);
    });

    this.socket.on('error', (error) => {
      this.logger.error(`Twelve Data WebSocket error: ${error.message}`);
    });

    this.socket.on('close', (code, reason) => {
      this.socket = undefined;
      const closeReason = reason.toString().trim();

      this.logger.warn(
        closeReason
          ? `Twelve Data WebSocket disconnected (${code}): ${closeReason}`
          : `Twelve Data WebSocket disconnected (${code})`,
      );

      if (this.providerSymbolsByInternalSymbol.size === 0) {
        return;
      }

      this.scheduleReconnect();
    });
  }

  private sendSubscription(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const symbols = Array.from(this.providerSymbolsByInternalSymbol.values()).join(',');
    if (!symbols) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        action: 'subscribe',
        params: {
          symbols,
        },
      }),
    );
  }

  private handleMessage(data: WebSocket.RawData): void {
    try {
      const payload = JSON.parse(data.toString()) as {
        event?: string;
        symbol?: string;
        price?: string | number;
        timestamp?: number | string;
        status?: string;
        message?: string;
      };

      if (payload.event !== 'price') {
        if (
          payload.status === 'error' ||
          payload.event === 'error' ||
          payload.event === 'subscribe-status'
        ) {
          const message = payload.message ?? payload.status ?? payload.event;
          this.logger.log(`Twelve Data message: ${message}`);
        }

        return;
      }

      const providerSymbol = normalizeProviderSymbol(payload.symbol ?? '');
      const symbol = this.internalSymbolsByProviderSymbol.get(providerSymbol);
      const rawPrice =
        typeof payload.price === 'number'
          ? payload.price
          : Number.parseFloat(String(payload.price ?? ''));

      if (!symbol || !Number.isFinite(rawPrice) || rawPrice <= 0) {
        return;
      }

      void this.tickHandler?.({
        symbol,
        rawPrice,
        timestamp: this.toIsoTimestamp(payload.timestamp),
        providerSymbol,
      });
    } catch (error) {
      this.logger.warn(`Failed to parse Twelve Data payload: ${(error as Error).message}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempt += 1;
    const delay = Math.min(
      this.reconnectInitialDelayMs * 2 ** (this.reconnectAttempt - 1),
      this.reconnectMaxDelayMs,
    );

    this.reconnectTimer = setTimeout(() => {
      this.openSocket();
    }, delay);
  }

  private toIsoTimestamp(value: number | string | undefined): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const timestampMs = value > 1_000_000_000_000 ? value : value * 1000;
      return new Date(timestampMs).toISOString();
    }

    if (typeof value === 'string') {
      const numeric = Number(value);

      if (Number.isFinite(numeric) && value.trim() !== '') {
        return this.toIsoTimestamp(numeric);
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    return new Date().toISOString();
  }
}
