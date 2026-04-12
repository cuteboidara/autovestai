import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { Candle } from '../../common/interfaces/candle.interface';
import { PriceSnapshot } from '../../common/interfaces/price-snapshot.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { toDecimal, toNumber } from '../../common/utils/decimal';
import { TradingEventsService } from '../trading/trading-events.service';
import { SupportedResolution } from '../market-data/symbols.config';
import { SymbolsService } from '../symbols/symbols.service';
import {
  CANDLE_CACHE_PREFIX,
  MAX_CANDLES_PER_SYMBOL,
  SUPPORTED_CANDLE_RESOLUTIONS,
} from './pricing.constants';

@Injectable()
export class CandleService implements OnModuleInit {
  private readonly logger = new Logger(CandleService.name);
  private readonly currentCandles = new Map<string, Candle>();
  private readonly candleHistory = new Map<string, Candle[]>();

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly tradingEventsService: TradingEventsService,
    private readonly symbolsService: SymbolsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.symbolsService.reload();

    for (const symbol of this.symbolsService.listSymbols().map((item) => item.symbol)) {
      for (const resolution of SUPPORTED_CANDLE_RESOLUTIONS) {
        const candles = await this.loadInitialCandles(symbol, resolution);
        const cacheKey = this.buildCacheKey(symbol, resolution);

        this.candleHistory.set(cacheKey, candles);

        const lastCandle = candles.length > 0 ? candles[candles.length - 1] : undefined;
        const currentBucket = this.toBucketStart(new Date().toISOString(), resolution);

        if (lastCandle && lastCandle.timestamp === currentBucket) {
          this.currentCandles.set(cacheKey, { ...lastCandle });
        }
      }
    }
  }

  async handlePriceUpdate(snapshot: PriceSnapshot): Promise<void> {
    const symbol = snapshot.symbol;

    for (const resolution of SUPPORTED_CANDLE_RESOLUTIONS) {
      await this.updateResolutionCandle(symbol, resolution, snapshot);
    }
  }

  async getRecentCandles(
    symbol: string,
    resolution: SupportedResolution,
  ): Promise<Candle[]> {
    const cacheKey = this.buildCacheKey(symbol, resolution);
    const inMemory = this.candleHistory.get(cacheKey);

    if (inMemory) {
      return inMemory;
    }

    const loaded = await this.loadInitialCandles(symbol, resolution);
    this.candleHistory.set(cacheKey, loaded);
    return loaded;
  }

  private async updateResolutionCandle(
    symbol: string,
    resolution: SupportedResolution,
    snapshot: PriceSnapshot,
  ): Promise<void> {
    const bucketTimestamp = this.toBucketStart(snapshot.timestamp, resolution);
    const cacheKey = this.buildCacheKey(symbol, resolution);
    const current = this.currentCandles.get(cacheKey);

    if (!current || current.timestamp !== bucketTimestamp) {
      const nextCandle: Candle = {
        symbol,
        open: snapshot.rawPrice,
        high: snapshot.rawPrice,
        low: snapshot.rawPrice,
        close: snapshot.rawPrice,
        timestamp: bucketTimestamp,
      };

      this.currentCandles.set(cacheKey, nextCandle);
      await this.persistCandle(symbol, resolution, nextCandle);
      this.tradingEventsService.broadcastCandleUpdate({
        symbol,
        resolution: String(resolution),
        candle: nextCandle,
      });
      return;
    }

    current.high = Math.max(current.high, snapshot.rawPrice);
    current.low = Math.min(current.low, snapshot.rawPrice);
    current.close = snapshot.rawPrice;

    await this.persistCandle(symbol, resolution, current);
    this.tradingEventsService.broadcastCandleUpdate({
      symbol,
      resolution: String(resolution),
      candle: current,
    });
  }

  private async loadInitialCandles(
    symbol: string,
    resolution: SupportedResolution,
  ): Promise<Candle[]> {
    const redisClient = this.redisService.getClient();
    const cacheKey = this.buildCacheKey(symbol, resolution);
    const raw = await redisClient.get(cacheKey);

    if (raw) {
      try {
        return this.parseCandles(raw);
      } catch (error) {
        this.logger.warn(
          `Failed to parse cached candles for ${symbol}/${resolution}: ${(error as Error).message}`,
        );
      }
    }

    if (resolution === 1) {
      const legacyRaw = await redisClient.get(`${CANDLE_CACHE_PREFIX}:${symbol}`);

      if (legacyRaw) {
        try {
          const parsed = this.parseCandles(legacyRaw);
          await redisClient.set(cacheKey, JSON.stringify(parsed));
          return parsed;
        } catch (error) {
          this.logger.warn(
            `Failed to parse legacy candle cache for ${symbol}: ${(error as Error).message}`,
          );
        }
      }
    }

    const candles = await this.prismaService.marketCandle.findMany({
      where: {
        symbol,
        resolution,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: MAX_CANDLES_PER_SYMBOL,
    });

    const normalized = candles
      .reverse()
      .map((candle) => ({
        symbol: candle.symbol,
        open: toNumber(candle.open) ?? 0,
        high: toNumber(candle.high) ?? 0,
        low: toNumber(candle.low) ?? 0,
        close: toNumber(candle.close) ?? 0,
        timestamp: candle.timestamp.toISOString(),
      }));

    if (normalized.length > 0) {
      await redisClient.set(cacheKey, JSON.stringify(normalized));
    }

    return normalized;
  }

  private parseCandles(raw: string): Candle[] {
    const parsed = JSON.parse(raw) as Candle[];
    return parsed
      .slice(-MAX_CANDLES_PER_SYMBOL)
      .sort(
        (left, right) =>
          new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
      );
  }

  private async persistCandle(
    symbol: string,
    resolution: SupportedResolution,
    candle: Candle,
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(symbol, resolution);
    const candles = this.candleHistory.get(cacheKey) ?? [];
    const lastCandle = candles.length > 0 ? candles[candles.length - 1] : undefined;

    if (!lastCandle || lastCandle.timestamp !== candle.timestamp) {
      candles.push({ ...candle });
    } else {
      candles[candles.length - 1] = { ...candle };
    }

    const trimmed = candles.slice(-MAX_CANDLES_PER_SYMBOL);
    this.candleHistory.set(cacheKey, trimmed);

    await Promise.all([
      this.redisService.getClient().set(cacheKey, JSON.stringify(trimmed)),
      this.prismaService.marketCandle.upsert({
        where: {
          symbol_resolution_timestamp: {
            symbol,
            resolution,
            timestamp: new Date(candle.timestamp),
          },
        },
        create: {
          symbol,
          resolution,
          timestamp: new Date(candle.timestamp),
          open: toDecimal(candle.open),
          high: toDecimal(candle.high),
          low: toDecimal(candle.low),
          close: toDecimal(candle.close),
        },
        update: {
          open: toDecimal(candle.open),
          high: toDecimal(candle.high),
          low: toDecimal(candle.low),
          close: toDecimal(candle.close),
        },
      }),
    ]);
  }

  private toBucketStart(timestamp: string, resolution: SupportedResolution): string {
    const date = new Date(timestamp);
    const intervalMinutes = resolution;
    const currentMinute = date.getUTCMinutes();
    const bucketMinute = Math.floor(currentMinute / intervalMinutes) * intervalMinutes;

    date.setUTCMinutes(bucketMinute, 0, 0);
    return date.toISOString();
  }

  private buildCacheKey(symbol: string, resolution: SupportedResolution): string {
    return `${CANDLE_CACHE_PREFIX}:${symbol}:${resolution}`;
  }
}
