'use client';

import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

import { cn } from '@/lib/utils';
import { socketManager } from '@/lib/socket-manager';
import { marketDataApi } from '@/services/api/market-data';

interface LightweightChartProps {
  symbol: string;
  resolution: string;
  className?: string;
}

export function LightweightChart({ symbol, resolution, className }: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  if (!symbol) {
    return (
      <div
        data-testid="chart-empty-state"
        className={cn(
          'flex h-full w-full items-center justify-center bg-[#0F1117] px-6 text-center',
          className,
        )}
      >
        <div className="max-w-sm rounded-3xl border border-dashed border-[#2D3142] bg-[#11161F] px-6 py-8">
          <p className="text-sm font-semibold text-white">Select a symbol to load the chart</p>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">
            Live candles become available once an instrument is in focus.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: {
          type: ColorType.Solid,
          color: '#0F1117',
        },
        textColor: '#6B7280',
      },
      grid: {
        vertLines: { color: '#1A1D27' },
        horzLines: { color: '#1A1D27' },
      },
      rightPriceScale: {
        borderColor: '#1E2235',
      },
      timeScale: {
        borderColor: '#1E2235',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;

    if (!series) {
      return;
    }

    let active = true;
    socketManager.connect(
      typeof window !== 'undefined' ? window.localStorage.getItem('autovestai.token') : null,
    );

    void marketDataApi
      .getHistory({
        symbol,
        resolution,
        from: Math.floor(Date.now() / 1000) - 60 * 60 * 24,
        to: Math.floor(Date.now() / 1000),
      })
      .then((history) => {
        if (!active) {
          return;
        }

        series.setData(
          history.t.map((time, index) => ({
            time: time as UTCTimestamp,
            open: history.o[index],
            high: history.h[index],
            low: history.l[index],
            close: history.c[index],
          })),
        );
        chartRef.current?.timeScale().fitContent();
      });

    socketManager.subscribeCandles(symbol, resolution);
    const unsubscribe = socketManager.on('candle_update', (payload) => {
      const update = payload as
        | {
            symbol?: string;
            resolution?: string;
            candle?: {
              timestamp: string;
              open: number;
              high: number;
              low: number;
              close: number;
            };
          }
        | undefined;

      if (
        !update?.candle ||
        update.symbol !== symbol ||
        String(update.resolution) !== String(resolution)
      ) {
        return;
      }

      series.update({
        time: Math.floor(new Date(update.candle.timestamp).getTime() / 1000) as UTCTimestamp,
        open: update.candle.open,
        high: update.candle.high,
        low: update.candle.low,
        close: update.candle.close,
      });
    });

    return () => {
      active = false;
      socketManager.unsubscribeCandles(symbol, resolution);
      unsubscribe();
    };
  }, [resolution, symbol]);

  return <div ref={containerRef} className={cn('h-full w-full', className)} />;
}
