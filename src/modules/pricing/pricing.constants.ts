import { SupportedResolution } from '../market-data/symbols.config';

export const PRICE_CACHE_PREFIX = 'price';
export const CANDLE_CACHE_PREFIX = 'candles';
export const MAX_CANDLES_PER_SYMBOL = 500;
export const SUPPORTED_CANDLE_RESOLUTIONS: SupportedResolution[] = [1, 5, 15, 60];
