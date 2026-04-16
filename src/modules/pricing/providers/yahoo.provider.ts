import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Symbol as TradingSymbol } from '@prisma/client';

import { StooqPricingAdapter } from '../stooq.adapter';
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

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      regularMarketPrice?: number;
      regularMarketTime?: number;
      regularMarketChangePercent?: number;
      regularMarketDayHigh?: number;
      regularMarketDayLow?: number;
      bid?: number;
      ask?: number;
      marketState?: string;
    }>;
  };
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

@Injectable()
export class YahooProvider implements OnModuleDestroy {
  private readonly logger = new Logger(YahooProvider.name);
  private readonly yahooUrl = 'https://query2.finance.yahoo.com/v7/finance/quote';
  private readonly pollMs = 15_000;
  private readonly batchSize = 40;
  private readonly providerEnabled: boolean;
  private readonly staleAfterMs = this.pollMs * 4;
  private instruments: TradingSymbol[] = [];
  private timer?: NodeJS.Timeout;
  private backoffDelayMs = 0;
  private retryAtMs = 0;
  private pollInFlight = false;
  private updateHandler?: PricingUpdateHandler;
  private crumb: string | null = null;
  private cookie: string | null = null;
  private crumbExpiresAt = 0;
  private status: PricingProviderStatus = createProviderStatus('yahoo-finance', 'polling');

  onModuleDestroy(): void {
    this.stop();
  }

  constructor(
    private readonly stooqPricingAdapter: StooqPricingAdapter,
    private readonly configService: ConfigService,
  ) {
    this.providerEnabled =
      this.configService.get<boolean>('pricing.yahooEnabled') ?? true;
  }

  async start(
    instruments: TradingSymbol[],
    onUpdate: PricingUpdateHandler,
  ): Promise<void> {
    this.stop();
    this.instruments = instruments.filter((instrument) => Boolean(instrument.quoteSymbol));
    this.updateHandler = onUpdate;
    this.status = {
      ...this.status,
      symbolCount: this.instruments.length,
      status: 'DEGRADED',
      reason: 'awaiting_first_update',
      message:
        this.instruments.length > 0
          ? 'Awaiting the first successful Yahoo poll.'
          : 'No active Yahoo symbols are configured.',
      retryAt: null,
      recommendedAction: null,
      consecutiveFailures: 0,
    };

    if (!this.providerEnabled) {
      this.status = disabledProviderStatus(
        this.status,
        'disabled_by_config',
        'Yahoo Finance polling is disabled by configuration.',
        'Set YAHOO_PROVIDER_ENABLED=true to enable the Yahoo polling provider.',
      );
      return;
    }

    if (this.instruments.length === 0) {
      this.status = disabledProviderStatus(
        this.status,
        'no_symbols_configured',
        'No active Yahoo symbols are configured.',
        null,
      );
      return;
    }

    await this.fetchQuotes();
    this.timer = setInterval(() => {
      void this.fetchQuotes();
    }, this.pollMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  getStatus() {
    return applyStaleProviderStatus({ ...this.status }, this.staleAfterMs);
  }

  private async ensureCrumb(): Promise<void> {
    if (this.crumb && this.cookie && Date.now() < this.crumbExpiresAt) {
      return;
    }

    try {
      // Step 1: Get consent cookie from Yahoo
      const consentResponse = await fetch('https://fc.yahoo.com/', {
        headers: { 'user-agent': USER_AGENT },
        redirect: 'manual',
      });
      const setCookieHeaders = consentResponse.headers.getSetCookie?.() ?? [];
      const cookies = setCookieHeaders
        .map((h) => h.split(';')[0])
        .filter(Boolean)
        .join('; ');

      // Step 2: Get crumb using the cookie
      const crumbResponse = await fetch(
        'https://query2.finance.yahoo.com/v1/test/getcrumb',
        {
          headers: {
            'user-agent': USER_AGENT,
            cookie: cookies,
          },
        },
      );

      if (!crumbResponse.ok) {
        throw new Error(`Crumb request failed: HTTP ${crumbResponse.status}`);
      }

      const crumb = await crumbResponse.text();

      if (!crumb || crumb.length < 5) {
        throw new Error(`Invalid crumb received: "${crumb}"`);
      }

      this.crumb = crumb.trim();
      this.cookie = cookies;
      // Refresh crumb every 30 minutes
      this.crumbExpiresAt = Date.now() + 30 * 60 * 1000;
      this.logger.log('Yahoo crumb+cookie obtained successfully');
    } catch (error) {
      this.crumb = null;
      this.cookie = null;
      throw new Error(
        `Yahoo crumb auth failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async fetchQuotes() {
    if (this.pollInFlight || Date.now() < this.retryAtMs) {
      return;
    }

    this.pollInFlight = true;
    const updatedAt = new Date().toISOString();
    const unresolved = new Map(this.instruments.map((instrument) => [instrument.symbol, instrument]));

    try {
      await this.ensureCrumb();

      for (const batch of this.chunk(this.instruments, this.batchSize)) {
        const providerSymbols = batch
          .map((instrument) => instrument.quoteSymbol?.trim())
          .filter((value): value is string => Boolean(value));

        if (providerSymbols.length === 0) {
          continue;
        }

        const url = `${this.yahooUrl}?symbols=${encodeURIComponent(providerSymbols.join(','))}&crumb=${encodeURIComponent(this.crumb!)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12_000);

        try {
          const response = await fetch(url, {
            headers: {
              accept: 'application/json',
              'user-agent': USER_AGENT,
              cookie: this.cookie!,
            },
            signal: controller.signal,
          });

          if (response.status === 401 || response.status === 403) {
            // Invalidate crumb and retry on next poll
            this.crumb = null;
            this.cookie = null;
            throw new Error(`HTTP ${response.status} — crumb expired`);
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = (await response.json()) as YahooQuoteResponse;
          const results = payload.quoteResponse?.result ?? [];
          const quoteByProviderSymbol = new Map(
            results
              .filter((quote) => quote.symbol)
              .map((quote) => [String(quote.symbol).trim().toUpperCase(), quote] as const),
          );

          for (const instrument of batch) {
            const providerSymbol = instrument.quoteSymbol?.trim().toUpperCase();

            if (!providerSymbol) {
              continue;
            }

            const quote = quoteByProviderSymbol.get(providerSymbol);
            const rawPrice = Number(quote?.regularMarketPrice);

            if (!quote || !Number.isFinite(rawPrice) || rawPrice <= 0) {
              continue;
            }

            unresolved.delete(instrument.symbol);

            const bid = Number(quote.bid);
            const ask = Number(quote.ask);
            const timestamp =
              typeof quote.regularMarketTime === 'number'
                ? new Date(quote.regularMarketTime * 1000).toISOString()
                : updatedAt;
            const marketState =
              quote.marketState && quote.marketState.toUpperCase() !== 'REGULAR'
                ? 'CLOSED'
                : 'LIVE';

            void this.updateHandler?.('yahoo-finance', {
              symbol: instrument.symbol,
              rawPrice,
              bid: Number.isFinite(bid) && bid > 0 ? bid : undefined,
              ask: Number.isFinite(ask) && ask > 0 ? ask : undefined,
              changePct: Number.isFinite(Number(quote.regularMarketChangePercent))
                ? Number(quote.regularMarketChangePercent)
                : null,
              dayHigh: Number.isFinite(Number(quote.regularMarketDayHigh))
                ? Number(quote.regularMarketDayHigh)
                : null,
              dayLow: Number.isFinite(Number(quote.regularMarketDayLow))
                ? Number(quote.regularMarketDayLow)
                : null,
              timestamp,
              marketState,
              delayed: marketState !== 'LIVE',
            });
          }
        } finally {
          clearTimeout(timer);
        }
      }

      await this.fetchStooqFallback(unresolved, updatedAt);

      this.retryAtMs = 0;
      this.status = okProviderStatus(this.status, updatedAt);
      this.backoffDelayMs = 0;
    } catch (error) {
      this.backoffDelayMs = this.backoffDelayMs === 0
        ? 30_000
        : Math.min(this.backoffDelayMs * 2, 300_000);
      this.retryAtMs = Date.now() + this.backoffDelayMs;
      this.status = providerStatusWithFailure(
        this.status,
        'Yahoo Finance',
        error,
        this.retryAtMs,
      );
      this.logger.warn(
        `Yahoo polling failed: ${this.status.message}. Backing off for ${this.backoffDelayMs}ms.`,
      );
      await this.fetchStooqFallback(unresolved, updatedAt).catch((fallbackError) => {
        this.logger.warn(
          `Stooq fallback failed: ${
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          }`,
        );
      });
    } finally {
      this.pollInFlight = false;
    }
  }

  private async fetchStooqFallback(
    unresolved: Map<string, TradingSymbol>,
    updatedAt: string,
  ) {
    const fallbackInstruments = Array.from(unresolved.values()).filter((instrument) =>
      this.stooqPricingAdapter.supportsInstrument(instrument),
    );

    if (fallbackInstruments.length === 0) {
      return;
    }

    const quotes = await this.stooqPricingAdapter.fetchQuotes(fallbackInstruments);

    for (const instrument of fallbackInstruments) {
      const quote = quotes.get(instrument.symbol);

      if (!quote) {
        continue;
      }

      unresolved.delete(instrument.symbol);
      void this.updateHandler?.('stooq', {
        symbol: instrument.symbol,
        rawPrice: quote.rawPrice,
        timestamp: quote.timestamp || updatedAt,
        marketState: 'LIVE',
        delayed: true,
      });
    }
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }
}
