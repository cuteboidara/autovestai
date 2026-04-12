import { Injectable } from '@nestjs/common';
import { Symbol as TradingSymbol } from '@prisma/client';

export interface StooqQuoteSnapshot {
  rawPrice: number;
  timestamp: string;
  providerSymbol: string;
}

const STOOQ_SYMBOL_MAP: Record<string, string> = {
  'ASX-CASH': '^asx',
  'BRNT-CASH': 'cb.f',
  'CAC-CASH': '^cac',
  'CL-CASH': 'cl.f',
  'COCOA-CASH': 'cc.f',
  'COFFEE-CASH': 'kc.f',
  'COPPER-CASH': 'hg.f',
  'CORN-CASH': 'zc.f',
  'COTTON-CASH': 'ct.f',
  'DAX-CASH': '^dax',
  'DOW-CASH': '^dji',
  'DXY-CASH': '^dxy',
  'FTSE-CASH': '^ftx',
  'NGAS-CASH': 'ng.f',
  'NK-CASH': '^nkx',
  'NSDQ-CASH': '^ndx',
  'RTY-CASH': '^rut',
  'SBEAN-CASH': 'zs.f',
  'SP-CASH': '^spx',
  'SUGAR-CASH': 'sb.f',
  WHEAT: 'zw.f',
  'WHEAT-CASH': 'zw.f',
  XAGUSD: 'xagusd',
  XAUUSD: 'xauusd',
  XPDUSD: 'xpdusd',
  XPTUSD: 'xptusd',
};

@Injectable()
export class StooqPricingAdapter {
  private readonly baseUrl = 'https://stooq.com/q/l/';
  private readonly requestTimeoutMs = 12_000;

  supportsInstrument(instrument: TradingSymbol): boolean {
    return this.getProviderSymbol(instrument) !== null;
  }

  getProviderSymbol(instrument: Pick<TradingSymbol, 'symbol'>): string | null {
    return STOOQ_SYMBOL_MAP[instrument.symbol] ?? null;
  }

  async fetchQuotes(instruments: TradingSymbol[]): Promise<Map<string, StooqQuoteSnapshot>> {
    const quotes = new Map<string, StooqQuoteSnapshot>();

    for (const batch of this.chunk(instruments, 8)) {
      const results = await Promise.allSettled(
        batch.map(async (instrument) => {
          const providerSymbol = this.getProviderSymbol(instrument);

          if (!providerSymbol) {
            return null;
          }

          const quote = await this.fetchQuote(providerSymbol);
          return quote ? ([instrument.symbol, quote] as const) : null;
        }),
      );

      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value) {
          continue;
        }

        const [symbol, quote] = result.value;
        if (symbol && quote) {
          quotes.set(symbol, quote);
        }
      }
    }

    return quotes;
  }

  async fetchQuote(providerSymbol: string): Promise<StooqQuoteSnapshot | null> {
    const url = `${this.baseUrl}?s=${encodeURIComponent(providerSymbol)}&f=sd2t2ohlcv&h&e=csv`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/csv,*/*;q=0.8',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.text();
      return this.parseCsvPayload(providerSymbol, payload);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseCsvPayload(
    providerSymbol: string,
    payload: string,
  ): StooqQuoteSnapshot | null {
    const rows = payload
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean);

    if (rows.length < 2) {
      return null;
    }

    const lastRow = rows[rows.length - 1];
    const columns = lastRow.split(',').map((value) => value.trim());

    if (columns.length < 7) {
      return null;
    }

    const [, date, time, , , , close] = columns;
    const rawPrice = Number.parseFloat(close);

    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      return null;
    }

    return {
      rawPrice,
      timestamp: this.toIsoTimestamp(date, time),
      providerSymbol,
    };
  }

  private toIsoTimestamp(date: string, time: string): string {
    const normalizedDate = date && date !== 'N/D' ? date : null;
    const normalizedTime = time && time !== 'N/D' ? time : '00:00:00';

    if (!normalizedDate) {
      return new Date().toISOString();
    }

    const candidate = new Date(`${normalizedDate}T${normalizedTime}Z`);
    return Number.isNaN(candidate.getTime()) ? new Date().toISOString() : candidate.toISOString();
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }

    return chunks;
  }
}
