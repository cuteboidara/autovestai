'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface TradingViewPanelProps {
  symbol: string;
  resolution: string;
  className?: string;
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => { remove?: () => void };
    };
  }
}

const TV_SYMBOL_MAP: Record<string, string> = {
  EURUSD: 'FX:EURUSD',
  GBPUSD: 'FX:GBPUSD',
  USDJPY: 'FX:USDJPY',
  USDCHF: 'FX:USDCHF',
  AUDUSD: 'FX:AUDUSD',
  USDCAD: 'FX:USDCAD',
  NZDUSD: 'FX:NZDUSD',
  EURGBP: 'FX:EURGBP',
  EURJPY: 'FX:EURJPY',
  GBPJPY: 'FX:GBPJPY',
  XAUUSD: 'TVC:GOLD',
  XAGUSD: 'TVC:SILVER',
  XPTUSD: 'TVC:PLATINUM',
  BTCUSD: 'BINANCE:BTCUSDT',
  ETHUSD: 'BINANCE:ETHUSDT',
  BNBUSD: 'BINANCE:BNBUSDT',
  SOLUSD: 'BINANCE:SOLUSDT',
  XRPUSD: 'BINANCE:XRPUSDT',
  'NSDQ-CASH': 'NASDAQ:NDX',
  'SP-CASH': 'SP:SPX',
  'DOW-CASH': 'TVC:DJI',
  'DAX-CASH': 'XETR:DAX',
  'FTSE-CASH': 'TVC:UKX',
  'CAC-CASH': 'EURONEXT:PX1',
  'NK-CASH': 'TVC:NI225',
  'ASX-CASH': 'ASX:XJO',
  'BRNT-CASH': 'TVC:UKOIL',
  'CL-CASH': 'TVC:USOIL',
  'NGAS-CASH': 'TVC:NATURALGAS',
  'COPPER-CASH': 'TVC:COPPER',
  'CORN-CASH': 'CBOT:ZC1!',
  'WHEAT-CASH': 'CBOT:ZW1!',
  'SUGAR-CASH': 'ICEUS:SB1!',
  'COFFEE-CASH': 'ICEUS:KC1!',
  'COCOA-CASH': 'ICEUS:CC1!',
};

const TIMEFRAME_MAP: Record<string, string> = {
  '1': '1',
  '5': '5',
  '15': '15',
  '30': '30',
  '60': '60',
  '240': '240',
  '1D': 'D',
  D: 'D',
};

function getTVSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();

  if (TV_SYMBOL_MAP[normalized]) {
    return TV_SYMBOL_MAP[normalized];
  }

  if (/^[A-Z]{6}$/.test(normalized)) {
    return `FX:${normalized}`;
  }

  return normalized;
}

function getTVInterval(resolution: string) {
  return TIMEFRAME_MAP[resolution] ?? resolution;
}

function ChartFallback({ message }: { message?: string }) {
  return (
    <div className="flex h-[460px] w-full items-center justify-center rounded-md bg-[var(--terminal-bg-primary)]">
      <p className="text-sm text-[var(--terminal-text-secondary)]">
        {message ?? 'Chart temporarily unavailable'}
      </p>
    </div>
  );
}

export function TradingViewPanel({
  symbol,
  resolution,
  className,
}: TradingViewPanelProps) {
  const widgetRef = useRef<{ remove?: () => void } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeSymbol = useMemo(() => symbol.trim(), [symbol]);
  const selectedTimeframe = useMemo(() => getTVInterval(resolution), [resolution]);

  useEffect(() => {
    if (!activeSymbol || typeof window === 'undefined') {
      return;
    }

    setErrorMessage(null);

    const container = document.getElementById('tv_chart_container');
    if (container) {
      container.innerHTML = '';
    }

    widgetRef.current?.remove?.();
    widgetRef.current = null;

    const initializeWidget = () => {
      if (typeof window.TradingView === 'undefined') {
        setErrorMessage('Chart temporarily unavailable');
        return;
      }

      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: getTVSymbol(activeSymbol),
        interval: selectedTimeframe,
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#111827',
        enable_publishing: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        container_id: 'tv_chart_container',
        backgroundColor: '#0A0E1A',
        gridColor: 'rgba(255,255,255,0.04)',
        hide_top_toolbar: false,
      });
    };

    let script: HTMLScriptElement | null = null;

    if (typeof window.TradingView !== 'undefined') {
      initializeWidget();
    } else {
      script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        initializeWidget();
      };
      script.onerror = () => {
        setErrorMessage('Chart temporarily unavailable');
      };
      document.head.appendChild(script);
    }

    return () => {
      widgetRef.current?.remove?.();
      widgetRef.current = null;

      const nextContainer = document.getElementById('tv_chart_container');
      if (nextContainer) {
        nextContainer.innerHTML = '';
      }

      if (script && document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [activeSymbol, selectedTimeframe]);

  if (!activeSymbol) {
    return <ChartFallback message="Select a symbol to load the chart" />;
  }

  return (
    <div
      className={cn(
        'w-full overflow-hidden bg-[var(--terminal-bg-primary)]',
        className,
      )}
    >
      {errorMessage ? <ChartFallback message={errorMessage} /> : null}
      <div
        id="tv_chart_container"
        style={{ height: '460px', width: '100%' }}
        className={cn('rounded-md overflow-hidden', errorMessage ? 'hidden' : 'block')}
      />
    </div>
  );
}
