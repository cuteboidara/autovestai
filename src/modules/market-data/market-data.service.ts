import { BadRequestException, Injectable } from '@nestjs/common';

import { toNumber } from '../../common/utils/decimal';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { PricingService } from '../pricing/pricing.service';
import { CandleService } from '../pricing/candle.service';
import { SymbolsService } from '../symbols/symbols.service';
import {
  SUPPORTED_RESOLUTION_MAP,
  SUPPORTED_RESOLUTIONS,
  SupportedResolution,
} from './symbols.config';
import { getSymbolMasterRecord } from '../symbols/symbol-master';
import { TRADINGVIEW_EXCHANGE_NAME } from '../symbols/symbol.constants';
import { createMarketQuotePayload } from './market-quote.presenter';

@Injectable()
export class MarketDataService {
  constructor(
    private readonly pricingService: PricingService,
    private readonly candleService: CandleService,
    private readonly symbolsService: SymbolsService,
    private readonly brokerSettingsService: BrokerSettingsService,
  ) {}

  listSymbols(filters?: {
    search?: string;
    assetClass?: string;
    enabledOnly?: boolean;
  }) {
    const enabledOnly = filters?.enabledOnly ?? true;
    const assetClass = filters?.assetClass?.trim().toUpperCase();
    const search = filters?.search?.trim().toLowerCase();

    return this.symbolsService
      .listSymbols({ activeOnly: enabledOnly })
      .filter((symbol) => {
        if (assetClass && symbol.category !== assetClass) {
          return false;
        }

        if (!search) {
          return true;
        }

        const tradingViewSymbol = this.symbolsService.getTradingViewSymbol(symbol);
        return (
          symbol.symbol.toLowerCase().includes(search) ||
          symbol.description.toLowerCase().includes(search) ||
          tradingViewSymbol.toLowerCase().includes(search)
        );
      })
      .map((symbol) => this.formatSymbolInfo(symbol.symbol));
  }

  getSymbolInfo(symbol: string) {
    return this.formatSymbolInfo(this.resolveSymbol(symbol).symbol);
  }

  getConfig() {
    return {
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
      supported_resolutions: [...SUPPORTED_RESOLUTIONS],
      exchanges: [
        {
          value: TRADINGVIEW_EXCHANGE_NAME,
          name: TRADINGVIEW_EXCHANGE_NAME,
          desc: TRADINGVIEW_EXCHANGE_NAME,
        },
      ],
      symbols_types: [
        { name: 'Forex', value: 'forex' },
        { name: 'Metals', value: 'commodity' },
        { name: 'Indices', value: 'index' },
        { name: 'Commodities', value: 'commodity' },
        { name: 'Crypto', value: 'crypto' },
        { name: 'Stocks', value: 'stock' },
        { name: 'ETFs', value: 'fund' },
      ],
    };
  }

  async getCurrentPrice(symbol: string) {
    const instrument = this.resolveSymbol(symbol);
    const quote = await this.pricingService.getLatestQuote(instrument.symbol);
    const health = this.pricingService.getSymbolHealth(instrument.symbol);

    return createMarketQuotePayload({
      instrument,
      snapshot: quote,
      health,
      tradingViewSymbol: this.symbolsService.getTradingViewSymbol(instrument),
    });
  }

  async getCurrentPrices(symbols: string[]) {
    const normalizedSymbols = [...new Set(symbols.map((symbol) => symbol.trim()).filter(Boolean))];

    if (normalizedSymbols.length === 0) {
      return [];
    }

    return Promise.all(
      normalizedSymbols.map((symbol) => this.getCurrentPrice(symbol)),
    );
  }

  async getHistory(params: {
    symbol: string;
    resolution: string;
    from: string;
    to: string;
  }) {
    const instrument = this.resolveSymbol(params.symbol);
    const resolution = this.normalizeResolution(params.resolution);
    const from = this.normalizeEpochToMilliseconds(params.from);
    const to = this.normalizeEpochToMilliseconds(params.to);

    if (from > to) {
      throw new BadRequestException('`from` must be less than or equal to `to`');
    }

    const candles = await this.candleService.getRecentCandles(instrument.symbol, resolution);
    const filtered = candles.filter((candle) => {
      const timestamp = new Date(candle.timestamp).getTime();
      return timestamp >= from && timestamp <= to;
    });

    if (filtered.length === 0) {
      const fallback = await this.buildSyntheticHistory(
        instrument.symbol,
        resolution,
        from,
        to,
      );

      if (fallback.length === 0) {
        return {
          s: 'no_data',
          t: [],
          o: [],
          h: [],
          l: [],
          c: [],
        };
      }

      return this.toHistoryResponse(fallback);
    }

    const sorted = [...filtered].sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );

    return this.toHistoryResponse(sorted);
  }

  async getLatestCandle(symbol: string, resolution: string) {
    const normalizedSymbol = this.resolveSymbol(symbol).symbol;
    const normalizedResolution = this.normalizeResolution(resolution);
    const candles = await this.candleService.getRecentCandles(
      normalizedSymbol,
      normalizedResolution,
    );

    return candles.length > 0 ? candles[candles.length - 1] : null;
  }

  private resolveSymbol(symbol: string) {
    return this.symbolsService.getSymbolOrThrow(symbol);
  }

  private normalizeResolution(resolution: string): SupportedResolution {
    const normalized = resolution.toLowerCase() as keyof typeof SUPPORTED_RESOLUTION_MAP;
    const mapped = SUPPORTED_RESOLUTION_MAP[normalized];

    if (!mapped) {
      throw new BadRequestException(`Unsupported resolution: ${resolution}`);
    }

    return mapped;
  }

  private normalizeEpochToMilliseconds(value: string): number {
    const numeric = Number(value);

    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new BadRequestException('Invalid epoch value');
    }

    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }

  private async buildSyntheticHistory(
    symbol: string,
    resolution: SupportedResolution,
    from: number,
    to: number,
  ) {
    const instrument = this.symbolsService.getSymbolOrThrow(symbol);

    if (!instrument.isActive) {
      return [];
    }

    const quote = await this.pricingService.getLatestQuote(symbol).catch(() => null);

    if (!quote) {
      return [];
    }

    const intervalMs = resolution * 60 * 1000;
    const maxBars = 240;
    const alignedTo = Math.floor(to / intervalMs) * intervalMs;
    const alignedFrom = Math.floor(from / intervalMs) * intervalMs;
    const start = Math.max(alignedFrom, alignedTo - intervalMs * (maxBars - 1));
    const tickSize = Math.max(toNumber(instrument.minTickIncrement) ?? 0, 0.00000001);
    const basePrice = quote.rawPrice;
    const candles: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
    }> = [];

    for (let timestamp = start; timestamp <= alignedTo; timestamp += intervalMs) {
      const sequence = Math.floor((timestamp - start) / intervalMs);
      const offset = ((sequence % 6) - 3) * tickSize;
      const open = this.symbolsService.roundPrice(instrument, basePrice + offset);
      const close = this.symbolsService.roundPrice(
        instrument,
        basePrice + offset + (sequence % 2 === 0 ? tickSize / 2 : -tickSize / 2),
      );
      const high = Math.max(open, close);
      const low = Math.min(open, close);

      candles.push({
        timestamp: new Date(timestamp).toISOString(),
        open,
        high,
        low,
        close,
      });
    }

    return candles;
  }

  private toHistoryResponse(
    candles: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
    }>,
  ) {
    return {
      s: 'ok',
      t: candles.map((candle) => Math.floor(new Date(candle.timestamp).getTime() / 1000)),
      o: candles.map((candle) => candle.open),
      h: candles.map((candle) => candle.high),
      l: candles.map((candle) => candle.low),
      c: candles.map((candle) => candle.close),
    };
  }

  private getMarketStatus(symbol: string) {
    const instrument = this.symbolsService.getSymbolOrThrow(symbol);
    const health = this.pricingService.getSymbolHealth(symbol);

    if (!instrument.isActive || health.status === 'disabled') {
      return 'DISABLED';
    }

    if (health.marketState === 'CLOSED' || !this.symbolsService.isMarketOpen(instrument)) {
      return 'CLOSED';
    }

    if (health.status === 'stale') {
      return 'STALE';
    }

    if (health.status === 'delayed') {
      return 'DELAYED';
    }

    if (health.status === 'degraded' || health.status === 'down') {
      return 'DEGRADED';
    }

    return 'LIVE';
  }

  private formatSymbolInfo(symbol: string) {
    const definition = this.resolveSymbol(symbol);
    const master = getSymbolMasterRecord(definition.symbol);
    const symbolConfig = this.brokerSettingsService.getSymbolConfig(definition.symbol);
    const health = this.pricingService.getSymbolHealth(symbol);
    const marketStatus = this.getMarketStatus(definition.symbol);
    const tickSize = toNumber(definition.minTickIncrement) ?? 0;
    const minLot = toNumber(definition.minTradeSizeLots) ?? 0;
    const maxLot = toNumber(definition.maxTradeSizeLots) ?? 0;

    return {
      symbol: definition.symbol,
      displayName: master?.displayName ?? definition.description,
      assetClass: definition.category,
      enabled: definition.isActive,
      tradingViewSymbol: this.symbolsService.getTradingViewSymbol(definition),
      name: definition.symbol,
      ticker: this.symbolsService.getTradingViewSymbol(definition),
      full_name: this.symbolsService.getTradingViewSymbol(definition),
      pro_name: this.symbolsService.getTradingViewSymbol(definition),
      description: definition.description,
      category: definition.category,
      marketGroup: definition.marketGroup,
      type: this.symbolsService.getTradingViewType(definition),
      session: this.symbolsService.getTradingViewSession(definition),
      timezone: 'UTC',
      minmov: this.symbolsService.getMinMovement(),
      pricescale: this.symbolsService.getPriceScale(definition),
      has_intraday: true,
      has_weekly_and_monthly: false,
      exchange: TRADINGVIEW_EXCHANGE_NAME,
      listed_exchange: TRADINGVIEW_EXCHANGE_NAME,
      supported_resolutions: [...SUPPORTED_RESOLUTIONS],
      data_status:
        marketStatus === 'LIVE'
          ? 'streaming'
          : marketStatus === 'CLOSED'
            ? 'endofday'
            : 'pulsed',
      lotSize: toNumber(definition.lotSize) ?? 0,
      minLot,
      maxLot,
      tickSize,
      maxLeverage: symbolConfig.maxLeverage,
      marginRetailPct: toNumber(definition.marginRetailPct) ?? 0,
      marginProPct: toNumber(definition.marginProPct) ?? 0,
      swapLong: toNumber(definition.swapLong) ?? 0,
      swapShort: toNumber(definition.swapShort) ?? 0,
      digits: definition.digits,
      minTickIncrement: tickSize,
      minTradeSizeLots: minLot,
      maxTradeSizeLots: maxLot,
      pipValue: definition.pipValue,
      tradingHours: definition.tradingHours,
      quoteSource: definition.quoteSource,
      marketStatus,
      healthStatus: health.status,
      tradingAvailable: health.tradingAvailable,
      isActive: definition.isActive,
    };
  }
}
