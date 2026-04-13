import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Symbol as TradingSymbol } from '@prisma/client';

import {
  PricingProviderStatus,
  PricingUpdateHandler,
} from './pricing-provider.types';
import { RateLimitedFetcher } from './rate-limited-fetcher';

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
  private instruments: TradingSymbol[] = [];
  private timer?: NodeJS.Timeout;
  private updateHandler?: PricingUpdateHandler;
  private status: PricingProviderStatus = {
    provider: 'coingecko',
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
    // Only keep instruments that have a CoinGecko mapping
    this.instruments = instruments.filter((i) =>
      SYMBOL_TO_COINGECKO_ID.has(i.symbol),
    );
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
    return { ...this.status };
  }

  private async fetchPrices(): Promise<void> {
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

      this.status = {
        ...this.status,
        status: 'polling',
        lastUpdateAt: timestamp,
        lastError: null,
      };

      if (updatedCount > 0 && !this.firstLogDone) {
        this.firstLogDone = true;
        this.logger.log(
          `CoinGecko first poll: ${updatedCount} crypto prices received`,
        );
      }
    } catch (error) {
      this.status = {
        ...this.status,
        status: 'degraded',
        lastError: (error as Error).message,
      };
      this.logger.warn(`CoinGecko polling failed: ${(error as Error).message}`);
    }
  }

  private firstLogDone = false;
}
