import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  change?: ReactNode;
  helper?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, change, helper, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-3xl border border-border bg-surface p-5 shadow-glow',
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <div className="mt-3 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0 flex-1 text-[clamp(1.25rem,2vw,1.75rem)] font-semibold leading-none text-primary">
          <div className="price-display tabular-nums">{value}</div>
        </div>
        {change ? <div className="min-w-0 shrink-0 text-sm text-secondary tabular-nums">{change}</div> : null}
      </div>
      <div className="mt-4 h-px w-full bg-border" />
      {helper ? <div className="mt-3 min-w-0 text-sm text-secondary">{helper}</div> : null}
    </div>
  );
}
