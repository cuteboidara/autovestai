import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Symbol as TradingSymbol } from '@prisma/client';

import { StooqPricingAdapter } from '../stooq.adapter';
import {
  PricingProviderStatus,
  PricingUpdateHandler,
} from './pricing-provider.types';
import { RateLimitedFetcher } from './rate-limited-fetcher';

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

@Injectable()
export class YahooProvider implements OnModuleDestroy {
  private readonly logger = new Logger(YahooProvider.name);
  private readonly yahooUrl = 'https://query2.finance.yahoo.com/v7/finance/quote';
  private readonly pollMs = 15_000;
  private readonly batchSize = 40;
  private instruments: TradingSymbol[] = [];
  private timer?: NodeJS.Timeout;
  private backoffDelayMs = 0;
  private updateHandler?: PricingUpdateHandler;
  private status: PricingProviderStatus = {
    provider: 'yahoo-finance',
    transport: 'polling',
    status: 'disconnected',
    symbolCount: 0,
    lastUpdateAt: null,
    lastError: null,
  };

  constructor(
    private readonly fetcher: RateLimitedFetcher,
    private readonly stooqPricingAdapter: StooqPricingAdapter,
  ) {}

  onModuleDestroy(): void {
    this.stop();
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
      status: this.instruments.length > 0 ? 'polling' : 'disconnected',
      lastError: null,
    };

    if (this.instruments.length === 0) {
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
    return { ...this.status };
  }

  private async fetchQuotes() {
    const updatedAt = new Date().toISOString();
    const unresolved = new Map(this.instruments.map((instrument) => [instrument.symbol, instrument]));

    try {
      for (const batch of this.chunk(this.instruments, this.batchSize)) {
        const providerSymbols = batch
          .map((instrument) => instrument.quoteSymbol?.trim())
          .filter((value): value is string => Boolean(value));

        if (providerSymbols.length === 0) {
          continue;
        }

        const url = `${this.yahooUrl}?symbols=${encodeURIComponent(providerSymbols.join(','))}`;
        const payload = await this.fetcher.fetchJson<YahooQuoteResponse>(url, {
          retries: 1,
          retryDelayMs: 10_000,
          headers: {
            accept: 'application/json',
          },
        });
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
      }

      await this.fetchStooqFallback(unresolved, updatedAt);

      this.status = {
        ...this.status,
        status: 'polling',
        lastUpdateAt: updatedAt,
        lastError: null,
      };
      // Reset backoff on successful fetch
      this.backoffDelayMs = 0;
    } catch (error) {
      // Exponential backoff: start at 30s, double up to 5 min
      this.backoffDelayMs = this.backoffDelayMs === 0
        ? 30_000
        : Math.min(this.backoffDelayMs * 2, 300_000);
      this.status = {
        ...this.status,
        status: 'degraded',
        lastError: (error as Error).message,
      };
      this.logger.warn(
        `Yahoo polling failed: ${(error as Error).message}. Backing off for ${this.backoffDelayMs}ms.`,
      );
      if (this.backoffDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.backoffDelayMs));
      }
      await this.fetchStooqFallback(unresolved, updatedAt).catch((fallbackError) => {
        this.logger.warn(
          `Stooq fallback failed: ${
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          }`,
        );
      });
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
