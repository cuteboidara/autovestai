'use client';

import { cn } from '@/lib/utils';

interface SegmentedItem {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  items: SegmentedItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({
  items,
  value,
  onChange,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        'flex w-full max-w-full overflow-x-auto rounded-xl border border-border bg-page p-1 sm:inline-flex sm:w-auto',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'min-w-[32px] flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none',
              active ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
