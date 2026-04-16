import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Symbol as TradingSymbol } from '@prisma/client';

import {
  PricingProviderStatus,
  PricingUpdateHandler,
} from './pricing-provider.types';
import { RateLimitedFetcher } from './rate-limited-fetcher';
import {
  applyStaleProviderStatus,
  createProviderStatus,
  disabledProviderStatus,
  okProviderStatus,
  providerStatusWithFailure,
} from './provider-health.util';

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
  private readonly providerEnabled: boolean;
  private readonly staleAfterMs = this.pollMs * 3;
  private readonly failureBackoffScheduleMs = [30_000, 60_000, 120_000] as const;
  private instruments: TradingSymbol[] = [];
  private timer?: NodeJS.Timeout;
  private updateHandler?: PricingUpdateHandler;
  private retryAtMs = 0;
  private status: PricingProviderStatus = createProviderStatus('forex-api', 'polling');

  constructor(
    private readonly fetcher: RateLimitedFetcher,
    private readonly configService: ConfigService,
  ) {
    this.providerEnabled =
      this.configService.get<boolean>('pricing.forexEnabled') ?? true;
  }

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
      status: 'DEGRADED',
      reason: 'awaiting_first_update',
      message:
        instruments.length > 0
          ? 'Awaiting the first successful forex poll.'
          : 'No active forex instruments are configured.',
      retryAt: null,
      recommendedAction: null,
      consecutiveFailures: 0,
    };

    if (!this.providerEnabled) {
      this.status = disabledProviderStatus(
        this.status,
        'disabled_by_config',
        'Forex polling is disabled by configuration.',
        'Set FOREX_PROVIDER_ENABLED=true to enable the forex polling provider.',
      );
      return;
    }

    if (instruments.length === 0) {
      this.status = disabledProviderStatus(
        this.status,
        'no_symbols_configured',
        'No active forex instruments are configured.',
        null,
      );
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
    return applyStaleProviderStatus({ ...this.status }, this.staleAfterMs);
  }

  private async fetchForexRates() {
    if (Date.now() < this.retryAtMs) {
      return;
    }

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

      this.retryAtMs = 0;
      this.status = okProviderStatus(this.status, timestamp);
    } catch (error) {
      const backoffMs =
        this.failureBackoffScheduleMs[
          Math.min(this.status.consecutiveFailures, this.failureBackoffScheduleMs.length - 1)
        ];
      this.retryAtMs = Date.now() + backoffMs;
      this.status = providerStatusWithFailure(
        this.status,
        'Forex API',
        error,
        this.retryAtMs,
      );
      this.logger.warn(
        `Forex polling failed: ${this.status.message}. Backing off for ${backoffMs}ms.`,
      );
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
