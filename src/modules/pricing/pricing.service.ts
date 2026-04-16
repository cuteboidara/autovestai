import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuoteSource, Symbol as TradingSymbol } from '@prisma/client';
import WebSocket = require('ws');

import { PriceSnapshot } from '../../common/interfaces/price-snapshot.interface';
import { OrderQueueService } from '../../common/queue/order-queue.service';
import { isRecoverableQueueError } from '../../common/queue/queue-recovery.util';
import { RedisService } from '../../common/redis/redis.service';
import { toNumber } from '../../common/utils/decimal';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { createMarketQuotePayload } from '../market-data/market-quote.presenter';
import {
  deriveBootstrapPrice,
} from '../symbols/symbol.constants';
import { SymbolsService } from '../symbols/symbols.service';
import { TradingEventsService } from '../trading/trading-events.service';
import { CandleService } from './candle.service';
import { getPrimaryProviderForSymbol } from './instrument-provider-registry';
import { PRICE_CACHE_PREFIX } from './pricing.constants';
import { BinanceProvider } from './providers/binance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { ForexProvider } from './providers/forex.provider';
import { PricingProviderStatus } from './providers/pricing-provider.types';
import { YahooProvider } from './providers/yahoo.provider';
import { StooqPricingAdapter } from './stooq.adapter';
import { TwelveDataAdapter } from './twelve-data.adapter';

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketTime?: number;
        currentTradingPeriod?: {
          regular?: {
            start?: number;
            end?: number;
          };
        };
      };
    }>;
  };
}

interface ForexQuoteResponse {
  rates?: Record<string, number>;
  conversion_rates?: Record<string, number>;
}

interface UpsertPriceOptions {
  timestamp?: string;
  marketState?: PriceSnapshot['marketState'];
  bid?: number;
  ask?: number;
  changePct?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  delayed?: boolean;
}

type ProviderPollKey = 'forex' | 'stooq';
type QuoteSourceTransport = 'streaming' | 'polling' | 'bootstrap';

@Injectable()
export class PricingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PricingService.name);
  private readonly prices = new Map<string, PriceSnapshot>();
  private readonly delayedQuoteMs = 120_000;
  private readonly staleQuoteMs = 300_000;
  private readonly quoteStaleMs: number;
  private readonly reconnectInitialDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly lastSweepEnqueueAt = new Map<string, number>();
  private readonly limitSweepThrottleMs = 1_000;
  private readonly limitSweepEnqueueBackoffMs = 5_000;
  private readonly limitSweepEnqueueLogThrottleMs = 5_000;
  private readonly binanceWsUrl: string;
  private readonly yahooChartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
  private readonly forexRatesUrl = 'https://open.er-api.com/v6/latest/USD';
  private readonly yahooPollMs = 30_000;
  private readonly forexPollMs = 30_000;
  private readonly stooqPollMs = 30_000;
  private readonly passiveQuoteStaleMs = 5 * 60_000;
  private readonly requestTimeoutMs = 12_000;
  private readonly failureBackoffScheduleMs = [60_000, 120_000, 240_000] as const;
  private readonly yahooRetryMs = 5 * 60_000;
  private readonly throttledLogWindowMs = 60 * 60_000;
  private readonly yahooUserAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  private readonly binanceSymbolMap = new Map<string, string>();
  private readonly providerBackoffState = new Map<
    ProviderPollKey,
    { attempt: number; nextAttemptAt: number }
  >();
  private readonly yahooRetryAfterAt = new Map<string, number>();
  private readonly throttledLogAt = new Map<string, number>();
  private readonly twelveDataRealtimeSymbols = new Set<string>();
  private limitSweepEnqueueBlockedUntil = 0;
  private lastLimitSweepEnqueueLogAt = 0;
  private binanceSocket?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private stooqTimer?: NodeJS.Timeout;
  private yahooTimer?: NodeJS.Timeout;
  private forexTimer?: NodeJS.Timeout;
  private quoteFreshnessTimer?: NodeJS.Timeout;
  private reconnectAttempt = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly orderQueueService: OrderQueueService,
    private readonly tradingEventsService: TradingEventsService,
    private readonly candleService: CandleService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly symbolsService: SymbolsService,
    private readonly binanceProvider: BinanceProvider,
    private readonly coinGeckoProvider: CoinGeckoProvider,
    private readonly forexProvider: ForexProvider,
    private readonly yahooProvider: YahooProvider,
    private readonly stooqPricingAdapter: StooqPricingAdapter,
    private readonly twelveDataAdapter: TwelveDataAdapter,
  ) {
    this.binanceWsUrl = this.configService.getOrThrow<string>('pricing.binanceWsUrl');
    this.quoteStaleMs = this.configService.getOrThrow<number>('pricing.quoteStaleMs');
    this.reconnectInitialDelayMs = this.configService.getOrThrow<number>(
      'pricing.reconnectInitialDelayMs',
    );
    this.reconnectMaxDelayMs = this.configService.getOrThrow<number>(
      'pricing.reconnectMaxDelayMs',
    );
  }

  async onModuleInit(): Promise<void> {
    await this.symbolsService.reload();
    // Run in background — don't block app startup
    this.bootstrapQuotes()
      .then(async () => {
        await this.startFreePricingProviders();
        this.startQuoteFreshnessMonitor();
      })
      .catch((err: Error) =>
        this.logger.error(`Background pricing init failed: ${err.message}`),
      );
  }

  async onModuleDestroy(): Promise<void> {
    this.clearTimer(this.reconnectTimer);
    this.clearTimer(this.stooqTimer);
    this.clearTimer(this.yahooTimer);
    this.clearTimer(this.forexTimer);
    this.clearTimer(this.quoteFreshnessTimer);

    if (this.binanceSocket) {
      this.binanceSocket.removeAllListeners();
      this.binanceSocket.close();
    }

    this.binanceProvider.stop();
    this.coinGeckoProvider.stop();
    this.forexProvider.stop();
    this.yahooProvider.stop();
    this.twelveDataAdapter.close();
  }

  async getLatestQuote(symbol: string): Promise<PriceSnapshot> {
    const normalized = this.assertSupportedSymbol(symbol);
    const cached = this.prices.get(normalized);

    if (cached) {
      return this.applyQuoteAgeState(cached);
    }

    const raw = await this.redisService
      .getClient()
      .get(this.buildCacheKey(normalized))
      .catch(() => null);

    if (raw) {
      const parsed = JSON.parse(raw) as PriceSnapshot;
      this.prices.set(normalized, parsed);
      return this.applyQuoteAgeState(parsed);
    }

    const instrument = this.symbolsService.getSymbolOrThrow(normalized);
    const fallback = this.buildQuote(
      instrument,
      deriveBootstrapPrice(instrument.symbol, instrument.category),
      'bootstrap',
      { marketState: 'BOOTSTRAP' },
    );

    this.prices.set(normalized, fallback);
    return this.applyQuoteAgeState(fallback);
  }

  async getLatestPrice(symbol: string): Promise<PriceSnapshot> {
    return this.getLatestQuote(symbol);
  }

  async getAllQuotes(): Promise<Record<string, PriceSnapshot>> {
    const entries = await Promise.all(
      this.symbolsService.listSymbols().map(
        async (symbol) => [symbol.symbol, await this.getLatestQuote(symbol.symbol)] as const,
      ),
    );

    return Object.fromEntries(entries);
  }

  async getAllPrices(): Promise<Record<string, PriceSnapshot>> {
    return this.getAllQuotes();
  }

  assertQuoteHealthy(symbol: string, quote?: PriceSnapshot): PriceSnapshot {
    const resolved = quote ?? this.prices.get(this.assertSupportedSymbol(symbol));

    if (!resolved) {
      throw new BadRequestException(`No quote available for ${symbol}`);
    }

    const health = this.getQuoteHealth(symbol, resolved);

    if (!health.tradingAvailable) {
      throw new BadRequestException(
        `Trading is unavailable for ${symbol}: ${health.reason}`,
      );
    }

    return resolved;
  }

  getSymbolHealth(symbol: string) {
    const normalized = this.assertSupportedSymbol(symbol);
    return this.getQuoteHealth(normalized, this.prices.get(normalized));
  }

  getAllSymbolHealth() {
    return Object.fromEntries(
      this.symbolsService
        .listSymbols()
        .map((symbol) => [symbol.symbol, this.getSymbolHealth(symbol.symbol)]),
    );
  }

  getProviderHealth() {
    return {
      coingecko: this.coinGeckoProvider.getStatus(),
      binance: this.binanceProvider.getStatus(),
      twelveData: this.twelveDataAdapter.getStatus(),
      forexApi: this.forexProvider.getStatus(),
      yahooFinance: this.yahooProvider.getStatus(),
    };
  }

  getSampleQuotes(symbols: string[]) {
    return symbols.map((symbol) => {
      const normalized = this.symbolsService.normalize(symbol);
      const snapshot = this.prices.get(normalized);
      const resolvedSnapshot = snapshot ? this.applyQuoteAgeState(snapshot) : null;

      return {
        symbol: normalized,
        lastPrice: resolvedSnapshot?.lastPrice ?? null,
        lastUpdated: resolvedSnapshot?.lastUpdated ?? null,
        provider: resolvedSnapshot?.source ?? null,
        marketState: resolvedSnapshot?.marketState ?? null,
        delayed: resolvedSnapshot?.delayed ?? false,
      };
    });
  }

  assertSupportedSymbol(symbol: string) {
    const normalized = this.symbolsService.normalize(symbol);

    if (!this.symbolsService.hasSymbol(normalized)) {
      throw new BadRequestException(`Unsupported symbol: ${symbol}`);
    }

    return normalized;
  }

  private async bootstrapQuotes() {
    for (const instrument of this.symbolsService.listSymbols()) {
      await this.upsertPrice(
        instrument.symbol,
        deriveBootstrapPrice(instrument.symbol, instrument.category),
        'bootstrap',
        { marketState: 'BOOTSTRAP' },
      );
    }
  }

  private async startFreePricingProviders() {
    const activeInstruments = this.symbolsService.listSymbols({ activeOnly: true });
    const coinGeckoInstruments = activeInstruments.filter(
      (instrument) => this.getPrimaryProvider(instrument) === 'coingecko',
    );
    const forexInstruments = activeInstruments.filter(
      (instrument) => this.getPrimaryProvider(instrument) === 'forex-api',
    );
    const yahooInstruments = activeInstruments.filter(
      (instrument) => this.getPrimaryProvider(instrument) === 'yahoo-finance',
    );

    // Also feed metals (XAUUSD, XAGUSD) to Yahoo as a fallback —
    // Yahoo supports GC=F / SI=F via quoteSymbol, so if Forex API
    // fails to derive a price the Yahoo poll will cover them.
    const metalsForYahooFallback = forexInstruments.filter(
      (i) => i.symbol === 'XAUUSD' || i.symbol === 'XAGUSD',
    );
    const yahooWithMetals = [
      ...yahooInstruments,
      ...metalsForYahooFallback.filter(
        (m) => !yahooInstruments.some((y) => y.symbol === m.symbol),
      ),
    ];

    this.connectTwelveDataFeed();

    // CoinGecko — primary crypto provider (no geo-block, no API key)
    this.coinGeckoProvider
      .start(coinGeckoInstruments, (source, update) =>
        this.upsertPrice(update.symbol, update.rawPrice, source, update),
      )
      .catch((err: Error) =>
        this.logger.warn(`CoinGecko provider start failed: ${err.message}`),
      );

    // Binance — secondary crypto provider; will auto-disable after 3 failed attempts
    this.binanceProvider.start(coinGeckoInstruments, (source, update) =>
      this.upsertPrice(update.symbol, update.rawPrice, source, update),
    );

    // Fire-and-forget — don't block bootstrap on external API calls
    this.forexProvider
      .start(forexInstruments, (source, update) =>
        this.upsertPrice(update.symbol, update.rawPrice, source, update),
      )
      .catch((err: Error) =>
        this.logger.warn(`Forex provider start failed: ${err.message}`),
      );
    this.yahooProvider
      .start(yahooWithMetals, (source, update) =>
        this.upsertPrice(update.symbol, update.rawPrice, source, update),
      )
      .catch((err: Error) =>
        this.logger.warn(`Yahoo provider start failed: ${err.message}`),
      );

    this.logger.log(
      `Free pricing providers initialized: CoinGecko ${coinGeckoInstruments.length}, Binance ${coinGeckoInstruments.length} (secondary), TwelveData ${this.twelveDataRealtimeSymbols.size}, Forex ${forexInstruments.length}, Yahoo ${yahooWithMetals.length}`,
    );
  }

  private getPrimaryProvider(instrument: TradingSymbol) {
    return getPrimaryProviderForSymbol(instrument.symbol);
  }

  private connectBinanceFeed(): void {
    const instruments = this.symbolsService.listSymbolsBySource(QuoteSource.BINANCE, {
      activeOnly: true,
    });
    const streamSymbols = instruments
      .map((symbol) => symbol.quoteSymbol?.toLowerCase())
      .filter((value): value is string => Boolean(value));

    if (streamSymbols.length === 0) {
      return;
    }

    for (const instrument of instruments) {
      if (instrument.quoteSymbol) {
        this.binanceSymbolMap.set(instrument.quoteSymbol.toUpperCase(), instrument.symbol);
      }
    }

    const wsUrl = this.buildBinanceWsUrl(streamSymbols);

    if (this.binanceSocket && this.binanceSocket.readyState === WebSocket.OPEN) {
      return;
    }

    this.logger.log('Connecting to Binance price stream');
    this.binanceSocket = new WebSocket(wsUrl);

    this.binanceSocket.on('open', () => {
      this.reconnectAttempt = 0;
      this.logger.log('Binance price stream connected');
    });

    this.binanceSocket.on('message', (data: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(data.toString()) as {
          data?: {
            s?: string;
            c?: string;
          };
        };
        const providerSymbol = parsed.data?.s?.toUpperCase();
        const lastPrice = parsed.data?.c;

        if (!providerSymbol || !lastPrice) {
          return;
        }

        const symbol = this.binanceSymbolMap.get(providerSymbol);

        if (!symbol) {
          return;
        }

        void this.upsertPrice(symbol, Number(lastPrice), 'binance', {
          marketState: 'LIVE',
        });
      } catch (error) {
        this.logger.warn(`Failed to parse Binance payload: ${(error as Error).message}`);
      }
    });

    this.binanceSocket.on('error', (error) => {
      this.logger.error(`Binance feed error: ${error.message}`);
    });

    this.binanceSocket.on('close', () => {
      this.logger.warn('Binance feed disconnected, scheduling reconnect');
      this.scheduleReconnect();
    });
  }

  private connectTwelveDataFeed(): void {
    const instruments = this.symbolsService
      .listSymbols({ activeOnly: true })
      .filter((instrument) => instrument.quoteSource !== QuoteSource.BINANCE);

    this.twelveDataRealtimeSymbols.clear();

    for (const instrument of this.twelveDataAdapter.selectRealtimeInstruments(instruments)) {
      this.twelveDataRealtimeSymbols.add(instrument.symbol);
    }

    this.twelveDataAdapter.connect(instruments, async (tick) => {
      const instrument = this.symbolsService.getSymbolOrThrow(tick.symbol);
      await this.upsertPrice(instrument.symbol, tick.rawPrice, 'twelve-data', {
        timestamp: tick.timestamp,
        marketState: this.symbolsService.isMarketOpen(instrument) ? 'LIVE' : 'CLOSED',
      });
    });
  }

  private async pollForexQuotes(): Promise<void> {
    if (!this.shouldRunProviderPoll('forex')) {
      return;
    }

    const instruments = this.symbolsService.listSymbolsBySource(QuoteSource.FOREX_API, {
      activeOnly: true,
    }).filter((instrument) => this.shouldUsePollingFallback(instrument.symbol));

    if (instruments.length === 0) {
      return;
    }

    try {
      const response = await this.fetchJson<ForexQuoteResponse>(this.forexRatesUrl);
      const rates = response.rates ?? response.conversion_rates ?? {};

      if (Object.keys(rates).length === 0) {
        throw new Error('No forex conversion rates returned');
      }

      for (const instrument of instruments) {
        const price = this.deriveForexPrice(instrument.symbol, rates);

        if (price === null) {
          continue;
        }

        await this.upsertPrice(instrument.symbol, price, 'forex-api', {
          marketState: this.symbolsService.isMarketOpen(instrument) ? 'LIVE' : 'CLOSED',
        });
      }

      this.recordProviderPollSuccess('forex');
    } catch (error) {
      this.recordProviderPollFailure('forex');
      this.logThrottledWarning(
        'provider:forex',
        `Failed to refresh forex quotes: ${(error as Error).message}`,
      );
    }
  }

  private async pollStooqQuotes(): Promise<void> {
    if (!this.shouldRunProviderPoll('stooq')) {
      return;
    }

    const instruments = this.symbolsService
      .listSymbolsBySource(QuoteSource.YAHOO, {
        activeOnly: true,
      })
      .filter(
        (instrument) =>
          this.shouldUsePollingFallback(instrument.symbol) &&
          this.stooqPricingAdapter.supportsInstrument(instrument),
      );

    if (instruments.length === 0) {
      return;
    }

    try {
      const quotes = await this.stooqPricingAdapter.fetchQuotes(instruments);

      await Promise.all(
        instruments.map(async (instrument) => {
          const quote = quotes.get(instrument.symbol);

          if (!quote) {
            await this.markUnavailable(instrument, 'stooq', 'STALE');
            this.logThrottledWarning(
              `stooq:${instrument.symbol}`,
              `No Stooq quote returned for ${instrument.symbol}`,
            );
            return;
          }

          await this.upsertPrice(instrument.symbol, quote.rawPrice, 'stooq', {
            timestamp: quote.timestamp,
            marketState: this.symbolsService.isMarketOpen(instrument) ? 'LIVE' : 'CLOSED',
          });
        }),
      );

      this.recordProviderPollSuccess('stooq');
    } catch (error) {
      this.recordProviderPollFailure('stooq');
      this.logThrottledWarning(
        'provider:stooq',
        `Failed to refresh Stooq quotes: ${(error as Error).message}`,
      );
    }
  }

  private async pollYahooQuotes(): Promise<void> {
    const instruments = this.symbolsService.listSymbolsBySource(QuoteSource.YAHOO, {
      activeOnly: true,
    }).filter(
      (instrument) =>
        this.shouldUsePollingFallback(instrument.symbol) &&
        !this.stooqPricingAdapter.supportsInstrument(instrument),
    );

    if (instruments.length === 0) {
      return;
    }

    for (const batch of this.chunk(instruments, 8)) {
      const results = await Promise.allSettled(
        batch.map(async (instrument) => {
          if (this.shouldSkipYahooRetry(instrument.symbol)) {
            return;
          }

          const quote = await this.fetchYahooChartQuote(instrument);
          await this.upsertPrice(instrument.symbol, quote.rawPrice, 'yahoo-chart', {
            timestamp: quote.timestamp,
            marketState: quote.marketState,
          });
          this.yahooRetryAfterAt.delete(instrument.symbol);
        }),
      );

      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        const instrument = batch[index];

        if (result.status === 'fulfilled') {
          continue;
        }

        await this.handleYahooQuoteFailure(instrument, result.reason);
      }
    }
  }

  private async markClosed(instrument: TradingSymbol, source: string) {
    const existing = this.prices.get(instrument.symbol);
    await this.upsertPrice(
      instrument.symbol,
      existing?.rawPrice ?? deriveBootstrapPrice(instrument.symbol, instrument.category),
      source,
      { marketState: 'CLOSED' },
    );
  }

  private shouldUsePollingFallback(symbol: string) {
    if (!this.twelveDataRealtimeSymbols.has(symbol)) {
      return true;
    }

    const snapshot = this.prices.get(symbol);

    if (!snapshot || snapshot.source !== 'twelve-data') {
      return true;
    }

    const ageMs = Date.now() - new Date(snapshot.lastUpdated).getTime();
    return !Number.isFinite(ageMs) || ageMs > this.quoteStaleMs * 2;
  }

  private async fetchYahooChartQuote(instrument: TradingSymbol) {
    const providerSymbol = instrument.quoteSymbol ?? instrument.symbol;
    const url = `${this.yahooChartUrl}/${encodeURIComponent(providerSymbol)}?interval=1d&range=1d`;
    const response = await this.fetchJson<YahooChartResponse>(url, {
      'user-agent': this.yahooUserAgent,
    });
    const meta = response.chart?.result?.[0]?.meta;
    const rawPrice = meta?.regularMarketPrice ?? meta?.previousClose;

    if (!Number.isFinite(rawPrice) || !rawPrice || rawPrice <= 0) {
      throw new Error('No chart price returned');
    }

    const timestamp = meta?.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString();

    return {
      rawPrice,
      timestamp,
      marketState: this.normalizeYahooChartMarketState(meta, instrument),
    };
  }

  private normalizeYahooChartMarketState(
    meta:
      | {
          currentTradingPeriod?: {
            regular?: {
              start?: number;
              end?: number;
            };
          };
        }
      | undefined,
    instrument: TradingSymbol,
  ): PriceSnapshot['marketState'] {
    const now = Date.now();
    const regularPeriod = meta?.currentTradingPeriod?.regular;

    if (!regularPeriod?.start || !regularPeriod?.end) {
      return this.symbolsService.isMarketOpen(instrument) ? 'LIVE' : 'CLOSED';
    }

    const start = regularPeriod.start * 1000;
    const end = regularPeriod.end * 1000;
    return now >= start && now <= end ? 'LIVE' : 'CLOSED';
  }

  private deriveForexPrice(symbol: string, usdRates: Record<string, number>) {
    if (symbol.length !== 6) {
      return null;
    }

    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    const usdToBase = base === 'USD' ? 1 : usdRates[base];
    const usdToQuote = quote === 'USD' ? 1 : usdRates[quote];

    if (!usdToBase || !usdToQuote) {
      return null;
    }

    return usdToQuote / usdToBase;
  }

  private async fetchJson<T>(url: string, headers?: HeadersInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': this.yahooUserAgent,
          ...headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async markUnavailable(
    instrument: TradingSymbol,
    source: string,
    marketState: PriceSnapshot['marketState'] = 'STALE',
  ) {
    const existing = this.prices.get(instrument.symbol);
    await this.upsertPrice(
      instrument.symbol,
      existing?.rawPrice ?? deriveBootstrapPrice(instrument.symbol, instrument.category),
      source,
      { marketState },
    );
  }

  private async upsertPrice(
    symbol: string,
    price: number,
    source: string,
    options?: UpsertPriceOptions,
  ): Promise<void> {
    const normalizedSymbol = this.assertSupportedSymbol(symbol);
    const instrument = this.symbolsService.getSymbolOrThrow(normalizedSymbol);
    const current = this.prices.get(normalizedSymbol);

    if (this.shouldSkipIncomingQuote(current, source)) {
      return;
    }

    const snapshot = this.applyQuoteAgeState(
      this.buildQuote(instrument, price, source, options),
    );
    const currentSnapshot = current ? this.applyQuoteAgeState(current) : null;
    const shouldBroadcast =
      !currentSnapshot || this.hasMeaningfulQuoteChange(currentSnapshot, snapshot);

    this.prices.set(normalizedSymbol, snapshot);

    if (shouldBroadcast) {
      this.tradingEventsService.broadcastPriceUpdate(
        this.buildClientQuotePayload(instrument, snapshot),
      );
    }

    if (shouldBroadcast && snapshot.marketState === 'LIVE') {
      this.maybeEnqueueLimitSweep(normalizedSymbol);
    }

    await this.persistQuoteSnapshot(normalizedSymbol, snapshot, {
      updateCandles: shouldBroadcast && snapshot.marketState === 'LIVE',
    });
  }

  private buildQuote(
    instrument: TradingSymbol,
    rawPrice: number,
    source: string,
    options?: UpsertPriceOptions,
  ): PriceSnapshot {
    const markup = this.brokerSettingsService.getSymbolConfig(instrument.symbol).spreadMarkup;
    const baseSpread = toNumber(instrument.defaultSpread) ?? 0;
    const spread = baseSpread + markup;
    const halfSpread = spread / 2;
    const roundedRaw = this.symbolsService.roundPrice(instrument, rawPrice);
    const bid =
      typeof options?.bid === 'number' && Number.isFinite(options.bid)
        ? this.symbolsService.roundPrice(instrument, options.bid)
        : this.symbolsService.roundPrice(
            instrument,
            Math.max(roundedRaw - halfSpread, 0.00000001),
          );
    const ask =
      typeof options?.ask === 'number' && Number.isFinite(options.ask)
        ? this.symbolsService.roundPrice(instrument, options.ask)
        : this.symbolsService.roundPrice(instrument, roundedRaw + halfSpread);
    const timestamp = options?.timestamp ?? new Date().toISOString();

    return {
      symbol: instrument.symbol,
      rawPrice: roundedRaw,
      lastPrice: roundedRaw,
      bid,
      ask,
      spread: this.symbolsService.roundPrice(instrument, Math.max(ask - bid, spread)),
      markup: this.symbolsService.roundPrice(instrument, markup),
      source,
      marketState: options?.marketState ?? 'LIVE',
      changePct: options?.changePct ?? null,
      dayHigh: options?.dayHigh ?? null,
      dayLow: options?.dayLow ?? null,
      delayed: options?.delayed ?? false,
      timestamp,
      lastUpdated: timestamp,
    };
  }

  private applyQuoteAgeState(snapshot: PriceSnapshot): PriceSnapshot {
    const ageMs = Date.now() - new Date(snapshot.lastUpdated).getTime();
    const hasFiniteAge = Number.isFinite(ageMs);
    const providerMarkedStale = snapshot.marketState === 'STALE';
    const providerLockedState =
      snapshot.marketState === 'CLOSED' || snapshot.marketState === 'BOOTSTRAP';
    const ageMarkedStale = hasFiniteAge && ageMs > this.staleQuoteMs;
    const ageMarkedDelayed =
      hasFiniteAge && ageMs > this.delayedQuoteMs && ageMs <= this.staleQuoteMs;
    const marketState = providerLockedState
      ? snapshot.marketState
      : providerMarkedStale || ageMarkedStale
        ? 'STALE'
        : 'LIVE';

    return {
      ...snapshot,
      marketState,
      delayed: marketState === 'LIVE' ? snapshot.delayed || ageMarkedDelayed : false,
    };
  }

  private startQuoteFreshnessMonitor(): void {
    this.clearTimer(this.quoteFreshnessTimer);
    const intervalMs = Math.max(Math.min(Math.floor(this.quoteStaleMs / 3), 5_000), 2_000);

    this.quoteFreshnessTimer = setInterval(() => {
      void this.sweepAgedQuotes();
    }, intervalMs);
  }

  private async sweepAgedQuotes(): Promise<void> {
    const updates = Array.from(this.prices.entries())
      .map(([symbol, snapshot]) => {
        const nextSnapshot = this.applyQuoteAgeState(snapshot);

        return this.hasMeaningfulQuoteChange(snapshot, nextSnapshot)
          ? ([symbol, nextSnapshot] as const)
          : null;
      })
      .filter((entry): entry is readonly [string, PriceSnapshot] => entry !== null);

    if (updates.length === 0) {
      return;
    }

    await Promise.all(
      updates.map(async ([symbol, snapshot]) => {
        const instrument = this.symbolsService.getSymbolOrThrow(symbol);
        this.prices.set(symbol, snapshot);
        this.logThrottledWarning(
          `quote-state:${symbol}:${snapshot.marketState}:${snapshot.delayed ? 'delayed' : 'fresh'}`,
          `Quote state transition detected for ${symbol}: marketState=${snapshot.marketState} delayed=${snapshot.delayed ? 'yes' : 'no'} source=${snapshot.source}`,
        );
        this.tradingEventsService.broadcastPriceUpdate(
          this.buildClientQuotePayload(instrument, snapshot),
        );
        await this.persistQuoteSnapshot(symbol, snapshot, { updateCandles: false });
      }),
    );
  }

  private shouldSkipIncomingQuote(
    current: PriceSnapshot | undefined,
    source: string,
  ): boolean {
    if (!current || this.getSourceTransport(source) !== 'polling') {
      return false;
    }

    const currentSnapshot = this.applyQuoteAgeState(current);
    return (
      this.getSourceTransport(currentSnapshot.source) === 'streaming' &&
      currentSnapshot.marketState === 'LIVE' &&
      !currentSnapshot.delayed
    );
  }

  private getSourceTransport(source: string): QuoteSourceTransport {
    switch (source) {
      case 'binance':
      case 'twelve-data':
        return 'streaming';
      case 'bootstrap':
        return 'bootstrap';
      default:
        return 'polling';
    }
  }

  private hasMeaningfulQuoteChange(
    current: PriceSnapshot,
    next: PriceSnapshot,
  ): boolean {
    return (
      current.rawPrice !== next.rawPrice ||
      current.lastPrice !== next.lastPrice ||
      current.bid !== next.bid ||
      current.ask !== next.ask ||
      current.spread !== next.spread ||
      current.markup !== next.markup ||
      current.source !== next.source ||
      current.marketState !== next.marketState ||
      Boolean(current.delayed) !== Boolean(next.delayed) ||
      current.changePct !== next.changePct ||
      current.dayHigh !== next.dayHigh ||
      current.dayLow !== next.dayLow
    );
  }

  private buildClientQuotePayload(
    instrument: TradingSymbol,
    snapshot: PriceSnapshot,
  ) {
    return createMarketQuotePayload({
      instrument,
      snapshot,
      health: this.getQuoteHealth(instrument.symbol, snapshot),
      tradingViewSymbol: this.symbolsService.getTradingViewSymbol(instrument),
    });
  }

  private async persistQuoteSnapshot(
    symbol: string,
    snapshot: PriceSnapshot,
    options: {
      updateCandles: boolean;
    },
  ): Promise<void> {
    const redisPromise = this.redisService
      .getClient()
      .set(this.buildCacheKey(symbol), JSON.stringify(snapshot));
    const candlePromise = options.updateCandles
      ? this.candleService.handlePriceUpdate(snapshot)
      : Promise.resolve();

    const persistenceResults = await Promise.allSettled([redisPromise, candlePromise]);
    const [redisResult, candleResult] = persistenceResults;

    if (redisResult.status === 'rejected') {
      this.logger.warn(
        `Failed to cache quote for ${symbol}: ${redisResult.reason instanceof Error ? redisResult.reason.message : String(redisResult.reason)}`,
      );
    }

    if (candleResult.status === 'rejected') {
      this.logger.warn(
        `Failed to update candles for ${symbol}: ${candleResult.reason instanceof Error ? candleResult.reason.message : String(candleResult.reason)}`,
      );
    }
  }

  private maybeEnqueueLimitSweep(symbol: string): void {
    const now = Date.now();

    if (now < this.limitSweepEnqueueBlockedUntil) {
      return;
    }

    const lastEnqueuedAt = this.lastSweepEnqueueAt.get(symbol) ?? 0;

    // FIX: 250ms sweeps per symbol were saturating the order queue and Prisma pool during quote bursts.
    if (now - lastEnqueuedAt < this.limitSweepThrottleMs) {
      return;
    }

    this.lastSweepEnqueueAt.set(symbol, now);
    void this.orderQueueService
      .enqueueLimitSweep(symbol)
      .then(() => {
        this.limitSweepEnqueueBlockedUntil = 0;
      })
      .catch((error: Error) => {
        if (isRecoverableQueueError(error)) {
          this.limitSweepEnqueueBlockedUntil = Date.now() + this.limitSweepEnqueueBackoffMs;
          this.logLimitSweepEnqueueFailure(symbol, error.message);
          return;
        }

        this.logger.error(`Failed to enqueue limit sweep for ${symbol}: ${error.message}`);
      });
  }

  private logLimitSweepEnqueueFailure(symbol: string, message: string): void {
    const now = Date.now();

    if (now - this.lastLimitSweepEnqueueLogAt < this.limitSweepEnqueueLogThrottleMs) {
      return;
    }

    this.lastLimitSweepEnqueueLogAt = now;
    this.logger.warn(
      `Limit sweep queue unavailable while enqueuing ${symbol}: ${message}. Pausing new enqueue attempts for ${this.limitSweepEnqueueBackoffMs}ms.`,
    );
  }

  private scheduleReconnect(): void {
    this.clearTimer(this.reconnectTimer);
    this.reconnectAttempt += 1;
    const delay = Math.min(
      this.reconnectInitialDelayMs * 2 ** (this.reconnectAttempt - 1),
      this.reconnectMaxDelayMs,
    );

    this.reconnectTimer = setTimeout(() => {
      this.connectBinanceFeed();
    }, delay);
  }

  private clearTimer(timer: NodeJS.Timeout | undefined): void {
    if (timer) {
      clearTimeout(timer);
    }
  }

  private buildCacheKey(symbol: string): string {
    return `${PRICE_CACHE_PREFIX}:${symbol}`;
  }

  private buildBinanceWsUrl(streams: string[]) {
    const [base] = this.binanceWsUrl.split('?');
    return `${base}?streams=${streams.map((stream) => `${stream}@ticker`).join('/')}`;
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }

  private shouldRunProviderPoll(key: ProviderPollKey) {
    const state = this.providerBackoffState.get(key);
    return !state || Date.now() >= state.nextAttemptAt;
  }

  private recordProviderPollSuccess(key: ProviderPollKey) {
    this.providerBackoffState.delete(key);
  }

  private recordProviderPollFailure(key: ProviderPollKey) {
    const attempt = Math.min(
      (this.providerBackoffState.get(key)?.attempt ?? 0) + 1,
      this.failureBackoffScheduleMs.length,
    );
    const delay = this.failureBackoffScheduleMs[attempt - 1];

    this.providerBackoffState.set(key, {
      attempt,
      nextAttemptAt: Date.now() + delay,
    });
  }

  private shouldSkipYahooRetry(symbol: string) {
    return (this.yahooRetryAfterAt.get(symbol) ?? 0) > Date.now();
  }

  private scheduleYahooRetry(symbol: string) {
    this.yahooRetryAfterAt.set(symbol, Date.now() + this.yahooRetryMs);
  }

  private async handleYahooQuoteFailure(instrument: TradingSymbol, reason: unknown) {
    const message = reason instanceof Error ? reason.message : String(reason);
    this.scheduleYahooRetry(instrument.symbol);
    await this.markUnavailable(instrument, 'yahoo-chart', 'STALE');
    this.logThrottledWarning(
      `yahoo:${instrument.symbol}`,
      `Failed to refresh Yahoo chart quote for ${instrument.symbol}: ${message}`,
    );
  }

  private logThrottledWarning(key: string, message: string) {
    const lastLoggedAt = this.throttledLogAt.get(key) ?? 0;

    if (Date.now() - lastLoggedAt < this.throttledLogWindowMs) {
      return;
    }

    this.throttledLogAt.set(key, Date.now());
    this.logger.warn(message);
  }

  private getQuoteHealth(symbol: string, snapshot?: PriceSnapshot) {
    const normalized = this.symbolsService.normalize(symbol);
    const symbolConfig = this.brokerSettingsService.getSymbolConfig(normalized);
    const instrument = this.symbolsService.getSymbolOrThrow(normalized);
    const symbolDisabled = !instrument.isActive || !symbolConfig.tradingEnabled;
    const disabledReason = !instrument.isActive
      ? 'symbol is not enabled for the current rollout'
      : `trading is disabled for ${normalized}`;

    if (!snapshot) {
      return {
        symbol: normalized,
        healthy: false,
        status: symbolDisabled ? 'disabled' : 'down',
        reason: symbolDisabled ? disabledReason : 'no quote cached',
        source: null,
        timestamp: null,
        ageMs: null,
        marketState: 'STALE',
        tradingAvailable: false,
      };
    }

    const resolvedSnapshot = this.applyQuoteAgeState(snapshot);
    const ageMs = Date.now() - new Date(resolvedSnapshot.lastUpdated).getTime();
    const stale = !Number.isFinite(ageMs) || resolvedSnapshot.marketState === 'STALE';
    const delayed = resolvedSnapshot.delayed;
    const marketClosed = resolvedSnapshot.marketState === 'CLOSED';
    const bootstrapLikeSource =
      resolvedSnapshot.marketState === 'BOOTSTRAP' || resolvedSnapshot.source === 'bootstrap';
    const healthy =
      !symbolDisabled &&
      !bootstrapLikeSource &&
      !marketClosed &&
      !stale &&
      !delayed;
    const tradingAvailable =
      !symbolDisabled &&
      !bootstrapLikeSource &&
      !marketClosed &&
      Number.isFinite(ageMs) &&
      instrument.isActive &&
      this.brokerSettingsService.isTradingEnabled() &&
      symbolConfig.tradingEnabled;

    return {
      symbol: normalized,
      healthy,
      status: symbolDisabled
        ? 'disabled'
        : marketClosed
          ? 'closed'
          : bootstrapLikeSource
            ? 'down'
            : stale
              ? 'stale'
              : delayed
                ? 'delayed'
              : healthy
                ? 'ok'
                : 'degraded',
      reason: healthy
        ? 'quote healthy'
        : symbolDisabled
          ? disabledReason
        : marketClosed
          ? 'market closed for this instrument'
          : bootstrapLikeSource
            ? 'live price feed has not produced a trusted quote yet'
            : stale
              ? `quote age ${Math.max(ageMs, 0)}ms exceeds stale threshold ${this.staleQuoteMs}ms`
              : delayed
                ? `quote age ${Math.max(ageMs, 0)}ms exceeds delayed threshold ${this.delayedQuoteMs}ms`
                : 'quote health degraded',
      source: resolvedSnapshot.source,
      timestamp: resolvedSnapshot.lastUpdated,
      ageMs: Number.isFinite(ageMs) ? Math.max(ageMs, 0) : null,
      marketState: resolvedSnapshot.marketState,
      tradingAvailable,
    };
  }
}
