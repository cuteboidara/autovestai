import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  STARTER_SYMBOLS,
  buildTradingViewSymbol,
  deriveDefaultSpread,
  deriveMaxLeverageFromMarginRetailPct,
  deriveQuoteSource,
  deriveQuoteSymbol,
} from './symbol.constants';

export type SupportedAssetClass =
  | 'FOREX'
  | 'METALS'
  | 'INDICES'
  | 'COMMODITIES'
  | 'CRYPTO'
  | 'STOCKS'
  | 'ETFS';

export interface SymbolMasterRecord {
  symbol: string;
  displayName: string;
  description: string;
  assetClass: SupportedAssetClass;
  category: SupportedAssetClass;
  marketGroup: string | null;
  lotSize: number;
  marginRetailPct: number;
  marginProPct: number;
  maxLeverage: number;
  swapLong: number;
  swapShort: number;
  digits: number;
  tickSize: number;
  minTickIncrement: number;
  minLot: number;
  minTradeSizeLots: number;
  maxLot: number;
  maxTradeSizeLots: number;
  pipValue: string;
  tradingHours: string;
  defaultSpread: number;
  quoteSource: ReturnType<typeof deriveQuoteSource>;
  quoteSymbol: string | null;
  tradingViewSymbol: string;
  enabled: boolean;
  isActive: boolean;
}

const STARTER_SYMBOL_SET = new Set<string>(STARTER_SYMBOLS);

const SECTION_MAP: Array<{
  pattern: RegExp;
  category: SupportedAssetClass;
  marketGroup: string | null;
}> = [
  { pattern: /^FOREX Trading Hours/, category: 'FOREX', marketGroup: null },
  { pattern: /^METALS Trading Hours/, category: 'METALS', marketGroup: null },
  { pattern: /^INDICES Trading Hours/, category: 'INDICES', marketGroup: null },
  { pattern: /^COMMODITIES Trading Hours/, category: 'COMMODITIES', marketGroup: null },
  { pattern: /^CRYPTO Trading Hours/, category: 'CRYPTO', marketGroup: null },
  { pattern: /^STOCKS US Trading Hours/, category: 'STOCKS', marketGroup: 'US' },
  { pattern: /^STOCKS EU Trading Hours/, category: 'STOCKS', marketGroup: 'EU' },
  { pattern: /^STOCKS UK Trading Hours/, category: 'STOCKS', marketGroup: 'UK' },
  { pattern: /^STOCKS MIDEAST Trading Hours/, category: 'STOCKS', marketGroup: 'MIDEAST' },
  { pattern: /^STOCKS LATAM Trading Hours/, category: 'STOCKS', marketGroup: 'LATAM' },
  { pattern: /^STOCKS ROW Trading Hours/, category: 'STOCKS', marketGroup: 'ROW' },
  { pattern: /^ETFs Trading Hours/, category: 'ETFS', marketGroup: null },
];

const ROW_PATTERN =
  /^(?<symbol>\S+)\s+(?<description>.+?)\s+(?<marginRetail>\d+(?:\.\d+)?%)\s+(?<marginPro>\d+(?:\.\d+)?%)\s+(?<lotSize>[\d,]+)\s+(?<pipValue>.+?)\s+(?<swapLong>-?\d+(?:\.\d+)?)\s+(?<swapShort>-?\d+(?:\.\d+)?)\s+(?<digits>\d+)\s+(?<tick>\d+(?:\.\d+)?)\s+(?<minLots>\d+(?:\.\d+)?)\s+(?<maxLots>\d+(?:\.\d+)?)\s+(?<hours>.+)$/;

let cachedSymbolMaster: SymbolMasterRecord[] | null = null;

export function loadSymbolMaster() {
  if (cachedSymbolMaster) {
    return cachedSymbolMaster;
  }

  const generatedPath = join(process.cwd(), 'activation_output', 'instruments_master.json');
  if (existsSync(generatedPath)) {
    cachedSymbolMaster = parseGeneratedInstrumentRegistry(readFileSync(generatedPath, 'utf8'));
    return cachedSymbolMaster;
  }

  const textPath = join(process.cwd(), 'Contract-Specifications.txt');

  if (!existsSync(textPath)) {
    throw new Error(`Contract specification file not found: ${textPath}`);
  }

  cachedSymbolMaster = parseContractSpecificationText(readFileSync(textPath, 'utf8'));
  return cachedSymbolMaster;
}

export function getSymbolMasterRecord(symbol: string) {
  const normalized = normalizeSymbolIdentifier(symbol);
  return loadSymbolMaster().find((item) => item.symbol === normalized);
}

export function isStarterRolloutSymbol(symbol: string) {
  return STARTER_SYMBOL_SET.has(normalizeSymbolIdentifier(symbol));
}

export function normalizeSymbolIdentifier(symbol: string) {
  const trimmed = String(symbol ?? '').trim();
  const withoutPrefix = trimmed.includes(':')
    ? trimmed.slice(trimmed.lastIndexOf(':') + 1)
    : trimmed;

  return withoutPrefix.toUpperCase();
}

export function parseContractSpecificationText(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const rows: Array<{
    category: SupportedAssetClass;
    marketGroup: string | null;
    text: string;
  }> = [];

  let currentCategory: SupportedAssetClass | null = null;
  let currentMarketGroup: string | null = null;
  let buffer = '';

  const flush = () => {
    if (!buffer || !currentCategory) {
      buffer = '';
      return;
    }

    rows.push({
      category: currentCategory,
      marketGroup: currentMarketGroup,
      text: buffer.trim(),
    });
    buffer = '';
  };

  for (const line of lines) {
    const section = SECTION_MAP.find((item) => item.pattern.test(line));

    if (section) {
      flush();
      currentCategory = section.category;
      currentMarketGroup = section.marketGroup;
      continue;
    }

    if (isNoiseLine(line) || !currentCategory) {
      continue;
    }

    if (looksLikeRowStart(line)) {
      flush();
      buffer = line;
      continue;
    }

    if (buffer) {
      buffer = `${buffer} ${line}`;
    }
  }

  flush();

  return rows.map((row) => {
    const match = row.text.match(ROW_PATTERN);

    if (!match?.groups) {
      throw new Error(`Unable to parse contract specification row: ${row.text}`);
    }

    const symbol = normalizeSymbolIdentifier(match.groups.symbol);
    const tickSize = toNumberValue(match.groups.tick);
    const marginRetailPct = toPercentValue(match.groups.marginRetail);
    const enabled = isStarterRolloutSymbol(symbol);

    return {
      symbol,
      displayName: match.groups.description.trim(),
      description: match.groups.description.trim(),
      assetClass: row.category,
      category: row.category,
      marketGroup: row.marketGroup,
      lotSize: toNumberValue(match.groups.lotSize),
      marginRetailPct,
      marginProPct: toPercentValue(match.groups.marginPro),
      maxLeverage: deriveMaxLeverageFromMarginRetailPct(marginRetailPct),
      swapLong: toNumberValue(match.groups.swapLong),
      swapShort: toNumberValue(match.groups.swapShort),
      digits: Number(match.groups.digits),
      tickSize,
      minTickIncrement: tickSize,
      minLot: toNumberValue(match.groups.minLots),
      minTradeSizeLots: toNumberValue(match.groups.minLots),
      maxLot: toNumberValue(match.groups.maxLots),
      maxTradeSizeLots: toNumberValue(match.groups.maxLots),
      pipValue: match.groups.pipValue.trim(),
      tradingHours: match.groups.hours.trim(),
      defaultSpread: deriveDefaultSpread({
        symbol,
        category: row.category,
        minTickIncrement: tickSize,
      }),
      quoteSource: deriveQuoteSource(symbol, row.category),
      quoteSymbol: deriveQuoteSymbol(symbol, row.category),
      tradingViewSymbol: buildTradingViewSymbol(symbol),
      enabled,
      isActive: enabled,
    } satisfies SymbolMasterRecord;
  });
}

type GeneratedInstrumentRegistryEntry = {
  raw_pdf_symbol?: string;
  display_symbol?: string;
  name?: string;
  asset_class?: SupportedAssetClass;
  status?: string;
  backend_seed?: {
    symbol?: string;
    description?: string;
    category?: SupportedAssetClass;
    market_group?: string | null;
    lot_size?: number;
    margin_retail_pct?: number;
    margin_pro_pct?: number;
    swap_long?: number;
    swap_short?: number;
    digits?: number;
    min_tick_increment?: number;
    min_trade_size_lots?: number;
    max_trade_size_lots?: number;
    pip_value?: string;
    trading_hours?: string;
    default_spread?: number;
    quote_source?: ReturnType<typeof deriveQuoteSource>;
    quote_symbol?: string | null;
    enabled?: boolean;
    is_active?: boolean;
  };
  metadata?: {
    broker_description?: string;
    contract_spec?: {
      lot_size?: number;
      margin_retail_pct?: number;
      margin_pro_pct?: number;
      swap_long?: number;
      swap_short?: number;
      digits?: number;
      min_tick_increment?: number;
      min_trade_size_lots?: number;
      max_trade_size_lots?: number;
      pip_value?: string;
      trading_hours?: string;
    };
  };
};

function parseGeneratedInstrumentRegistry(text: string): SymbolMasterRecord[] {
  const parsed = JSON.parse(text) as GeneratedInstrumentRegistryEntry[];

  return parsed.map((entry) => {
    const backend = entry.backend_seed ?? {};
    const contract = entry.metadata?.contract_spec ?? {};
    const symbol = normalizeSymbolIdentifier(backend.symbol ?? entry.raw_pdf_symbol ?? '');
    const category = (backend.category ?? entry.asset_class ?? 'STOCKS') as SupportedAssetClass;
    const tickSize = Number(backend.min_tick_increment ?? contract.min_tick_increment ?? 0.01);
    const marginRetailPct = Number(
      backend.margin_retail_pct ?? contract.margin_retail_pct ?? 100,
    );
    const lotSize = Number(backend.lot_size ?? contract.lot_size ?? 1);
    const minLots = Number(backend.min_trade_size_lots ?? contract.min_trade_size_lots ?? 0.01);
    const maxLots = Number(backend.max_trade_size_lots ?? contract.max_trade_size_lots ?? 100);
    const description = String(
      backend.description ?? entry.metadata?.broker_description ?? entry.name ?? symbol,
    ).trim();
    const enabled = Boolean(
      backend.enabled ?? backend.is_active ?? (entry.status ? entry.status !== 'unresolved' : true),
    );

    return {
      symbol,
      displayName: String(entry.name ?? entry.display_symbol ?? description).trim(),
      description,
      assetClass: category,
      category,
      marketGroup: backend.market_group ?? null,
      lotSize,
      marginRetailPct,
      marginProPct: Number(backend.margin_pro_pct ?? contract.margin_pro_pct ?? 100),
      maxLeverage: deriveMaxLeverageFromMarginRetailPct(marginRetailPct),
      swapLong: Number(backend.swap_long ?? contract.swap_long ?? 0),
      swapShort: Number(backend.swap_short ?? contract.swap_short ?? 0),
      digits: Number(backend.digits ?? contract.digits ?? 2),
      tickSize,
      minTickIncrement: tickSize,
      minLot: minLots,
      minTradeSizeLots: minLots,
      maxLot: maxLots,
      maxTradeSizeLots: maxLots,
      pipValue: String(backend.pip_value ?? contract.pip_value ?? ''),
      tradingHours: String(backend.trading_hours ?? contract.trading_hours ?? ''),
      defaultSpread: Number(
        backend.default_spread ??
          deriveDefaultSpread({
            symbol,
            category,
            minTickIncrement: tickSize,
          }),
      ),
      quoteSource: (backend.quote_source ?? deriveQuoteSource(symbol, category)) as ReturnType<
        typeof deriveQuoteSource
      >,
      quoteSymbol: backend.quote_symbol ?? deriveQuoteSymbol(symbol, category),
      tradingViewSymbol: buildTradingViewSymbol(symbol),
      enabled,
      isActive: Boolean(backend.is_active ?? enabled),
    } satisfies SymbolMasterRecord;
  });
}

function looksLikeRowStart(line: string) {
  return /^[A-Za-z0-9][A-Za-z0-9-]*\s+/.test(line);
}

function isNoiseLine(line: string) {
  return (
    !line ||
    /^--- \d+ \/ \d+ ---$/.test(line) ||
    /^Symbol Market Description/.test(line) ||
    /^\(Units\)/.test(line) ||
    /^Swap Long/.test(line) ||
    /^Silver Tier$/.test(line) ||
    /^Swap Short/.test(line) ||
    /^Increment$/.test(line) ||
    /^Min Trade Size/.test(line) ||
    /^\(Lots\)/.test(line) ||
    /^Max Trade Size/.test(line) ||
    /^Sunday Monday/.test(line) ||
    /^Monday - Friday$/.test(line) ||
    /^Monday - Sunday$/.test(line) ||
    /^Sunday Monday - Thursday Friday$/.test(line)
  );
}

function toNumberValue(value: string) {
  return Number(value.replace(/,/g, ''));
}

function toPercentValue(value: string) {
  return Number(value.replace('%', ''));
}
