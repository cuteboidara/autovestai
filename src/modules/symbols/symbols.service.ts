import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma, QuoteSource, Symbol as TradingSymbol, SymbolCategory } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toNumber } from '../../common/utils/decimal';
import { getSymbolMasterRecord, normalizeSymbolIdentifier } from './symbol-master';
import { buildTradingViewSymbol, deriveTradingViewType } from './symbol.constants';

type SymbolUpdateInput = {
  isActive?: boolean;
};

@Injectable()
export class SymbolsService implements OnModuleInit {
  private readonly symbols = new Map<string, TradingSymbol>();

  constructor(private readonly prismaService: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const symbols = await this.prismaService.symbol.findMany({
      orderBy: [{ category: 'asc' }, { symbol: 'asc' }],
    });

    this.symbols.clear();

    for (const symbol of symbols) {
      this.symbols.set(symbol.symbol, symbol);
    }
  }

  listSymbols(options?: { activeOnly?: boolean }) {
    const values = Array.from(this.symbols.values());
    return options?.activeOnly ? values.filter((symbol) => symbol.isActive) : values;
  }

  listSymbolsBySource(source: QuoteSource, options?: { activeOnly?: boolean }) {
    return this.listSymbols(options).filter((symbol) => symbol.quoteSource === source);
  }

  hasSymbol(symbol: string) {
    return this.symbols.has(this.normalize(symbol));
  }

  getSymbol(symbol: string) {
    return this.symbols.get(this.normalize(symbol));
  }

  getSymbolOrThrow(symbol: string) {
    const normalized = this.normalize(symbol);
    const instrument = this.symbols.get(normalized);

    if (!instrument) {
      throw new NotFoundException(`Unsupported symbol: ${symbol}`);
    }

    return instrument;
  }

  async updateSymbol(symbol: string, data: SymbolUpdateInput) {
    const normalized = this.normalize(symbol);
    this.getSymbolOrThrow(normalized);

    const updated = await this.prismaService.symbol.update({
      where: { symbol: normalized },
      data,
    });

    this.symbols.set(updated.symbol, updated);
    return updated;
  }

  normalize(symbol: string) {
    return normalizeSymbolIdentifier(symbol);
  }

  getPriceScale(symbol: TradingSymbol) {
    return Math.max(1, Math.pow(10, symbol.digits));
  }

  getMinMovement() {
    return 1;
  }

  getTradingViewSession(symbol: TradingSymbol) {
    if (symbol.category === SymbolCategory.CRYPTO) {
      return '24x7';
    }

    const firstRange = this.extractTimeRanges(symbol.tradingHours)[0];

    if (!firstRange) {
      return '24x5';
    }

    return `${firstRange.start.replace(':', '')}-${firstRange.end.replace(':', '')}`;
  }

  getTradingViewType(symbol: TradingSymbol) {
    return deriveTradingViewType(symbol.category);
  }

  getTradingViewSymbol(symbol: TradingSymbol | string) {
    const normalized =
      typeof symbol === 'string' ? this.normalize(symbol) : this.normalize(symbol.symbol);

    return getSymbolMasterRecord(normalized)?.tradingViewSymbol ?? buildTradingViewSymbol(normalized);
  }

  getDefaultMaxLeverage(symbol: TradingSymbol) {
    const registryValue = getSymbolMasterRecord(symbol.symbol)?.maxLeverage;

    if (typeof registryValue === 'number' && Number.isFinite(registryValue)) {
      return registryValue;
    }

    const marginRetailPct = toNumber(symbol.marginRetailPct) ?? 100;
    const derived = Math.floor(100 / Math.max(marginRetailPct, 0.01));
    return Math.max(1, derived);
  }

  getDefaultExposureThreshold(symbol: TradingSymbol) {
    switch (symbol.category) {
      case SymbolCategory.CRYPTO:
        return 25;
      case SymbolCategory.FOREX:
        return 100;
      case SymbolCategory.STOCKS:
      case SymbolCategory.ETFS:
        return 1000;
      default:
        return 250;
    }
  }

  isMarketOpen(symbol: TradingSymbol, at = new Date()) {
    if (symbol.category === SymbolCategory.CRYPTO) {
      return true;
    }

    const day = at.getUTCDay();
    const schedule = this.parseTradingSchedule(symbol.tradingHours);
    const regularRanges = schedule.regularRanges;

    if (regularRanges.length === 0) {
      return false;
    }

    if (symbol.category === SymbolCategory.STOCKS || symbol.category === SymbolCategory.ETFS) {
      if (day === 0 || day === 6) {
        return false;
      }

      return regularRanges.some((range) => this.isWithinRange(at, range.start, range.end));
    }

    if (day === 6) {
      return false;
    }

    if (day === 0) {
      const sundayRange = regularRanges[0];
      return sundayRange
        ? this.isWithinRange(at, sundayRange.start, sundayRange.end)
        : false;
    }

    if (day === 5) {
      const fridayClose = schedule.fridayRanges[schedule.fridayRanges.length - 1]?.end;

      if (!fridayClose) {
        return false;
      }

      return at.getUTCHours() * 60 + at.getUTCMinutes() <= this.toMinutes(fridayClose);
    }

    return regularRanges.some((range) => this.isWithinRange(at, range.start, range.end));
  }

  roundPrice(symbol: TradingSymbol, price: number) {
    return Number(price.toFixed(symbol.digits));
  }

  toAdminRecord(symbol: TradingSymbol) {
    return {
      symbol: symbol.symbol,
      description: symbol.description,
      category: symbol.category,
      marketGroup: symbol.marketGroup,
      lotSize: toNumber(symbol.lotSize) ?? 0,
      marginRetailPct: toNumber(symbol.marginRetailPct) ?? 0,
      marginProPct: toNumber(symbol.marginProPct) ?? 0,
      swapLong: toNumber(symbol.swapLong) ?? 0,
      swapShort: toNumber(symbol.swapShort) ?? 0,
      digits: symbol.digits,
      minTickIncrement: toNumber(symbol.minTickIncrement) ?? 0,
      minTradeSizeLots: toNumber(symbol.minTradeSizeLots) ?? 0,
      maxTradeSizeLots: toNumber(symbol.maxTradeSizeLots) ?? 0,
      pipValue: symbol.pipValue,
      tradingHours: symbol.tradingHours,
      defaultSpread: toNumber(symbol.defaultSpread) ?? 0,
      quoteSource: symbol.quoteSource,
      quoteSymbol: symbol.quoteSymbol,
      isActive: symbol.isActive,
      enabled: symbol.isActive,
      displayName: getSymbolMasterRecord(symbol.symbol)?.displayName ?? symbol.description,
      assetClass: symbol.category,
      tickSize: toNumber(symbol.minTickIncrement) ?? 0,
      minLot: toNumber(symbol.minTradeSizeLots) ?? 0,
      maxLot: toNumber(symbol.maxTradeSizeLots) ?? 0,
      tradingViewSymbol: this.getTradingViewSymbol(symbol),
      priceScale: this.getPriceScale(symbol),
      session: this.getTradingViewSession(symbol),
      type: this.getTradingViewType(symbol),
    };
  }

  private extractTimeRanges(tradingHours: string) {
    return Array.from(
      tradingHours.matchAll(/(?<start>\d{2}:\d{2})-(?<end>\d{2}:\d{2})/g),
      (match) => ({
        start: match.groups?.start ?? '00:00',
        end: match.groups?.end ?? '00:00',
      }),
    );
  }

  private parseTradingSchedule(tradingHours: string) {
    const sections = tradingHours
      .split(';')
      .map((section) => section.trim())
      .filter(Boolean);
    const regularRanges = this.extractTimeRanges(sections[0] ?? tradingHours);
    const fridayRanges = this.extractTimeRanges(sections[sections.length - 1] ?? tradingHours);

    return {
      regularRanges,
      fridayRanges,
    };
  }

  private isWithinRange(at: Date, start: string, end: string) {
    if (start === end) {
      return true;
    }

    const nowMinutes = at.getUTCHours() * 60 + at.getUTCMinutes();
    const startMinutes = this.toMinutes(start);
    const endMinutes = this.toMinutes(end);

    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
    }

    return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
  }

  private toMinutes(value: string) {
    const [hours, minutes] = value.split(':').map((item) => Number(item));
    return hours * 60 + minutes;
  }
}
