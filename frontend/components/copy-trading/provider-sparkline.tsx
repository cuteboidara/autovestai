'use client';

import { cn } from '@/lib/utils';

interface ProviderSparklineProps {
  values: number[];
  className?: string;
}

export function ProviderSparkline({
  values,
  className,
}: ProviderSparklineProps) {
  const safeValues = values.length > 0 ? values : [0, 0, 0, 0, 0, 0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(safeValues.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className={cn('h-16 w-full rounded-2xl border border-border bg-page p-2', className)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="provider-sparkline-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(245,166,35,0.35)" />
            <stop offset="100%" stopColor="rgba(245,166,35,0)" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="rgba(245,166,35,0.95)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <polygon
          fill="url(#provider-sparkline-fill)"
          points={`0,100 ${points} 100,100`}
        />
      </svg>
    </div>
  );
}
