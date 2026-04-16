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

interface CoinGeckoSimplePriceResponse {
  [id: string]: {
    usd?: number;
    usd_24h_change?: number;
  };
}

/**
 * Maps CoinGecko coin IDs → platform symbols (xxxUSD).
 * Only coins listed in this map are polled.
 */
const COINGECKO_ID_TO_SYMBOL: Record<string, string> = {
  bitcoin: 'BTCUSD',
  ethereum: 'ETHUSD',
  solana: 'SOLUSD',
  cardano: 'ADAUSD',
  binancecoin: 'BNBUSD',
  ripple: 'XRPUSD',
  polkadot: 'DOTUSD',
  chainlink: 'LINKUSD',
  litecoin: 'LTCUSD',
  dogecoin: 'DOGEUSD',
  'bitcoin-cash': 'BCHUSD',
  decentraland: 'MANAUSD',
  'the-sandbox': 'SANDUSD',
  sui: 'SUIUSD',
  tron: 'TRXUSD',
  monero: 'XMRUSD',
  dash: 'DASHUSD',
};

/** Reverse map: platform symbol → CoinGecko ID */
const SYMBOL_TO_COINGECKO_ID = new Map<string, string>(
  Object.entries(COINGECKO_ID_TO_SYMBOL).map(([id, sym]) => [sym, id]),
);

const COINGECKO_BASE_URL =
  'https://api.coingecko.com/api/v3/simple/price';

@Injectable()
export class CoinGeckoProvider implements OnModuleDestroy {
  private readonly logger = new Logger(CoinGeckoProvider.name);
  private readonly pollMs = 60_000; // 60s — well within free-tier 30 req/min
  private readonly providerEnabled: boolean;
  private readonly staleAfterMs = this.pollMs * 3;
  private readonly rateLimitBackoffMs = 5 * 60_000;
  private readonly failureBackoffScheduleMs = [60_000, 120_000, 300_000] as const;
  private instruments: TradingSymbol[] = [];
  private timer?: NodeJS.Timeout;
  private updateHandler?: PricingUpdateHandler;
  private retryAtMs = 0;
  private status: PricingProviderStatus = createProviderStatus('coingecko', 'polling');

  constructor(
    private readonly fetcher: RateLimitedFetcher,
    private readonly configService: ConfigService,
  ) {
    this.providerEnabled =
      this.configService.get<boolean>('pricing.coinGeckoEnabled') ?? true;
  }

  onModuleDestroy(): void {
    this.stop();
  }

  async start(
    instruments: TradingSymbol[],
    onUpdate: PricingUpdateHandler,
  ): Promise<void> {
    this.stop();
    // Only keep instruments that have a CoinGecko mapping
    this.instruments = instruments.filter((i) =>
      SYMBOL_TO_COINGECKO_ID.has(i.symbol),
    );
    this.updateHandler = onUpdate;
    this.status = {
      ...this.status,
      symbolCount: this.instruments.length,
      status: 'DEGRADED',
      reason: 'awaiting_first_update',
      message:
        this.instruments.length > 0
          ? 'Awaiting the first successful CoinGecko poll.'
          : 'No symbols are assigned to CoinGecko.',
      retryAt: null,
      recommendedAction: null,
      consecutiveFailures: 0,
    };

    if (!this.providerEnabled) {
      this.status = disabledProviderStatus(
        this.status,
        'disabled_by_config',
        'CoinGecko is disabled by configuration.',
        'Set COINGECKO_PROVIDER_ENABLED=true to enable CoinGecko polling.',
      );
      return;
    }

    if (this.instruments.length === 0) {
      this.status = disabledProviderStatus(
        this.status,
        'no_symbols_configured',
        'No active CoinGecko symbols are configured.',
        null,
      );
      return;
    }

    await this.fetchPrices();
    this.timer = setInterval(() => {
      void this.fetchPrices();
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

  private async fetchPrices(): Promise<void> {
    if (Date.now() < this.retryAtMs) {
      return;
    }

    try {
      const ids = this.instruments
        .map((i) => SYMBOL_TO_COINGECKO_ID.get(i.symbol))
        .filter((id): id is string => Boolean(id));

      if (ids.length === 0) {
        return;
      }

      const url = `${COINGECKO_BASE_URL}?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`;

      const payload = await this.fetcher.fetchJson<CoinGeckoSimplePriceResponse>(
        url,
        { retries: 2, retryDelayMs: 5_000 },
      );

      const timestamp = new Date().toISOString();
      let updatedCount = 0;

      for (const [coinId, data] of Object.entries(payload)) {
        const symbol = COINGECKO_ID_TO_SYMBOL[coinId];
        const rawPrice = data?.usd;

        if (!symbol || !rawPrice || !Number.isFinite(rawPrice) || rawPrice <= 0) {
          continue;
        }

        updatedCount += 1;
        void this.updateHandler?.('coingecko', {
          symbol,
          rawPrice,
          changePct: Number.isFinite(data.usd_24h_change)
            ? data.usd_24h_change
            : null,
          timestamp,
          marketState: 'LIVE',
        });
      }

      this.retryAtMs = 0;
      this.status = okProviderStatus(this.status, timestamp);

      if (updatedCount > 0 && !this.firstLogDone) {
        this.firstLogDone = true;
        this.logger.log(
          `CoinGecko first poll: ${updatedCount} crypto prices received`,
        );
      }
    } catch (error) {
      const backoffMs =
        providerStatusWithFailure(this.status, 'CoinGecko', error).status === 'RATE_LIMITED'
          ? this.rateLimitBackoffMs
          : this.failureBackoffScheduleMs[
              Math.min(this.status.consecutiveFailures, this.failureBackoffScheduleMs.length - 1)
            ];
      this.retryAtMs = Date.now() + backoffMs;
      this.status = providerStatusWithFailure(
        this.status,
        'CoinGecko',
        error,
        this.retryAtMs,
      );
      this.logger.warn(
        `CoinGecko polling failed: ${this.status.message}. Backing off for ${backoffMs}ms.`,
      );
    }
  }

  private firstLogDone = false;
}
