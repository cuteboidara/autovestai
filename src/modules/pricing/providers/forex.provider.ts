import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Symbol as TradingSymbol } from '@prisma/client';

import {
  PricingProviderStatus,
  PricingUpdateHandler,
} from './pricing-provider.types';
import { RateLimitedFetcher } from './rate-limited-fetcher';

interface ForexApiResponse {
  rates?: Record<string, number>;
  conversion_rates?: Record<string, number>;
}

const FOREX_API_URLS = [
  'https://open.er-api.com/v6/latest/USD',
  'https://api.exchangerate-api.com/v4/latest/USD',
] as const;

@Injectable()
export class ForexProvider implements OnModuleDestroy {
  private readonly logger = new Logger(ForexProvider.name);
  private readonly pollMs = 30_000;
  private instruments: TradingSymbol[] = [];
  private timer?: NodeJS.Timeout;
  private updateHandler?: PricingUpdateHandler;
  private status: PricingProviderStatus = {
    provider: 'forex-api',
    transport: 'polling',
    status: 'disconnected',
    symbolCount: 0,
    lastUpdateAt: null,
    lastError: null,
  };

  constructor(private readonly fetcher: RateLimitedFetcher) {}

  onModuleDestroy(): void {
    this.stop();
  }

  async start(
    instruments: TradingSymbol[],
    onUpdate: PricingUpdateHandler,
  ): Promise<void> {
    this.stop();
    this.instruments = instruments;
    this.updateHandler = onUpdate;
    this.status = {
      ...this.status,
      symbolCount: instruments.length,
      status: instruments.length > 0 ? 'polling' : 'disconnected',
      lastError: null,
    };

    if (instruments.length === 0) {
      return;
    }

    await this.fetchForexRates();
    this.timer = setInterval(() => {
      void this.fetchForexRates();
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

  private async fetchForexRates() {
    try {
      let payload: ForexApiResponse | null = null;

      for (const url of FOREX_API_URLS) {
        try {
          payload = await this.fetcher.fetchJson<ForexApiResponse>(url, {
            retries: 1,
          });
          break;
        } catch (error) {
          this.logger.warn(
            `Forex API request failed for ${url}: ${(error as Error).message}`,
          );
        }
      }

      if (!payload) {
        throw new Error('All forex API endpoints failed');
      }

      const rates = payload.rates ?? payload.conversion_rates ?? {};

      if (Object.keys(rates).length === 0) {
        throw new Error('No forex rates returned');
      }

      const timestamp = new Date().toISOString();

      for (const instrument of this.instruments) {
        const rawPrice = this.derivePrice(instrument.symbol, rates);

        if (rawPrice === null) {
          continue;
        }

        void this.updateHandler?.('forex-api', {
          symbol: instrument.symbol,
          rawPrice,
          timestamp,
          marketState: 'LIVE',
        });
      }

      this.status = {
        ...this.status,
        status: 'polling',
        lastUpdateAt: timestamp,
        lastError: null,
      };
    } catch (error) {
      this.status = {
        ...this.status,
        status: 'degraded',
        lastError: (error as Error).message,
      };
      this.logger.warn(`Forex polling failed: ${(error as Error).message}`);
    }
  }

  private derivePrice(symbol: string, rates: Record<string, number>) {
    if (!/^[A-Z]{6}$/.test(symbol)) {
      return null;
    }

    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    const usdToBase = base === 'USD' ? 1 : rates[base];
    const usdToQuote = quote === 'USD' ? 1 : rates[quote];

    if (!usdToBase || !usdToQuote) {
      return null;
    }

    return usdToQuote / usdToBase;
  }
}
